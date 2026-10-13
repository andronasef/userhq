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

const BY_STATUS: Partial<Record<number, [ApiErrorCode, string]>> = {
  [HttpStatus.UNAUTHORIZED]: ["unauthorized", "Unauthorized"],
  [HttpStatus.FORBIDDEN]: ["forbidden", "Forbidden"],
  [HttpStatus.NOT_FOUND]: ["not_found", "Not Found"],
  [HttpStatus.PAYLOAD_TOO_LARGE]: ["file_too_large", "File too large"],
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ["unsupported_type", "Unsupported media type"],
  [HttpStatus.TOO_MANY_REQUESTS]: ["rate_limited", "Too many requests"],
};

// Message carried by a Nest HttpException or a status-bearing error (body-parser, multer, ...).
function detailOf(exception: any): string {
  if (exception instanceof HttpException) {
    const res: any = exception.getResponse();
    if (typeof res === "string") return res;
    if (res?.message) {
      return Array.isArray(res.message) ? res.message.join(", ") : String(res.message);
    }
  }
  return exception?.message || "";
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = "internal_error";
    let message = "Something went wrong on our end.";

    const e = exception as any;
    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else {
      const s = exception instanceof HttpException ? exception.getStatus() : (e?.status ?? e?.statusCode);
      if (typeof s === "number") {
        status = s;
        if (status >= 400 && status < 500) {
          const [mapped, fallback] = BY_STATUS[status] ?? ["internal_error", "Request Error"];
          code = mapped;
          message = detailOf(exception) || fallback;
        }
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
