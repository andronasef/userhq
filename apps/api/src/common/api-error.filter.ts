import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import type { ApiErrorCode } from "@userhq/types";

export class ApiException extends HttpException {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message, status);
    this.code = code;
  }
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = "internal_error";
    let message = "Something went wrong on our end.";

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const defaultMessage =
        typeof res === "string"
          ? res
          : (res as any)?.message
            ? Array.isArray((res as any).message)
              ? (res as any).message.join(", ")
              : String((res as any).message)
            : exception.message;

      switch (status) {
        case HttpStatus.UNAUTHORIZED:
          code = "unauthorized";
          message = defaultMessage || "Unauthorized";
          break;
        case HttpStatus.FORBIDDEN:
          code = "forbidden";
          message = defaultMessage || "Forbidden";
          break;
        case HttpStatus.NOT_FOUND:
          code = "not_found";
          message = defaultMessage || "Not Found";
          break;
        case HttpStatus.PAYLOAD_TOO_LARGE:
          code = "file_too_large";
          message = defaultMessage || "File too large";
          break;
        case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
          code = "unsupported_type";
          message = defaultMessage || "Unsupported media type";
          break;
        default:
          if (status >= 400 && status < 500) {
            code = "internal_error";
            message = defaultMessage;
          } else {
            code = "internal_error";
            message = "Something went wrong on our end.";
          }
          break;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `Internal server error: ${message}`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(status).json({ code, message });
  }
}
