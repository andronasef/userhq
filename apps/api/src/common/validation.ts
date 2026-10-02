import { StandardSchemaValidationPipe } from "@nestjs/common";
import { API_ERROR_CODES, type ApiErrorCode } from "@userhq/types";
import { ApiException } from "./api-error.filter.js";

const apiErrorCodesSet = new Set<string>(API_ERROR_CODES);

const errorMessages: Partial<Record<ApiErrorCode, string>> = {
  slug_reserved: "That slug is reserved.",
  slug_invalid: "Invalid slug format.",
  name_required: "Name is required.",
  name_too_long: "Name is too long.",
  slug_taken: "That slug is taken.",
  validation_failed: "Check the highlighted fields and try again.",
};

export const validationPipe = new StandardSchemaValidationPipe({
  exceptionFactory: (issues) => {
    for (const issue of issues) {
      if (issue.message && apiErrorCodesSet.has(issue.message)) {
        const code = issue.message as ApiErrorCode;
        return new ApiException(
          code,
          400,
          errorMessages[code] ?? issue.message
        );
      }
    }
    return new ApiException(
      "validation_failed",
      400,
      "Check the highlighted fields and try again."
    );
  },
});
