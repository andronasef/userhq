import { describe, expect, it } from "vitest";
import {
  API_ERROR_COPY,
  FIELD_FOR_CODE,
  errorCopy,
  NETWORK_ERROR_COPY,
  GENERIC_ERROR_COPY,
} from "./api-errors";

describe("API Error Mapping (Plan 02-04)", () => {
  it("maps known error code to copy", () => {
    expect(API_ERROR_COPY.slug_taken).toBe("That URL is taken. Try another.");
    expect(errorCopy({ code: "slug_taken" })).toBe(
      "That URL is taken. Try another."
    );
  });

  it("interpolates variables in error copy", () => {
    const result = errorCopy({ code: "invite_pending" }, { email: "a@b.co" });
    expect(result).toContain("a@b.co");
    expect(result).toBe(
      "There's already a pending invite for a@b.co. Revoke it first to create a new link."
    );
  });

  it("returns network error copy on status 0 or network code", () => {
    expect(errorCopy({ status: 0, code: "network" })).toBe(NETWORK_ERROR_COPY);
    expect(errorCopy({ status: 0, code: null })).toBe(NETWORK_ERROR_COPY);
  });

  it("returns generic error copy on 500 or unknown code", () => {
    expect(errorCopy({ status: 500, code: "internal_error" })).toBe(
      GENERIC_ERROR_COPY
    );
    expect(errorCopy({ status: 400, code: "some_unrecognized_code" })).toBe(
      GENERIC_ERROR_COPY
    );
  });

  it("maps field names for field-specific error codes", () => {
    expect(FIELD_FOR_CODE.slug_reserved).toBe("slug");
    expect(FIELD_FOR_CODE.slug_taken).toBe("slug");
    expect(FIELD_FOR_CODE.slug_invalid).toBe("slug");
    expect(FIELD_FOR_CODE.name_too_long).toBe("name");
    expect(FIELD_FOR_CODE.name_required).toBe("name");
  });
});
