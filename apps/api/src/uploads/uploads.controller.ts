/// <reference types="multer" />
import {
  Controller,
  Post,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  Inject,
  UseFilters,
  ExceptionFilter,
  ArgumentsHost,
  HttpStatus,
  PayloadTooLargeException,
  BadRequestException,
  HttpException,
  Catch,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { DB, type Db, uploads } from "@userhq/db";
import {
  UPLOAD_MAX_BYTES,
  UploadResponseSchema,
  type UploadResponse,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { toWebp } from "./image-pipeline.js";
import { writeUpload, removeUpload } from "./storage.js";

@Catch(PayloadTooLargeException, BadRequestException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(
    exception: PayloadTooLargeException | BadRequestException,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (
      exception instanceof PayloadTooLargeException ||
      (exception instanceof HttpException &&
        exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE)
    ) {
      return response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        code: "file_too_large",
        message: "Images must be 2 MB or smaller.",
      });
    }

    if (exception instanceof BadRequestException) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        code: "no_file",
        message: "Send exactly one image in the file field.",
      });
    }

    throw exception;
  }
}

@Controller("uploads")
@UseFilters(MulterExceptionFilter)
export class UploadsController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db
  ) {}

  @Post()
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: UPLOAD_MAX_BYTES,
        files: 1,
        fields: 0,
      },
    })
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: { id: string }
  ): Promise<UploadResponse> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new ApiException(
        "no_file",
        400,
        "Choose a file before selecting Upload image."
      );
    }

    const { data, width, height, bytes } = await toWebp(file.buffer);
    const { key, url, absPath } = await writeUpload(
      this.env.UPLOAD_DIR,
      data,
      new Date()
    );

    let uploadId: string;
    try {
      const [inserted] = await this.db
        .insert(uploads)
        .values({
          storageKey: key,
          uploaderId: user.id,
          bytes,
          width,
          height,
        })
        .returning({ id: uploads.id });
      uploadId = inserted.id;
    } catch (err) {
      await removeUpload(absPath);
      throw err;
    }

    return UploadResponseSchema.parse({
      id: uploadId,
      url,
      width,
      height,
      bytes,
      format: "webp",
    });
  }
}
