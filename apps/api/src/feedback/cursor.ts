// ponytail: offset cursor; switch "new" to keyset if a product passes ~10k posts
import { ApiException } from "../common/api-error.filter.js";

export function encodeBoardCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

export function decodeBoardCursor(s: string): number {
  try {
    const jsonStr = Buffer.from(s, "base64url").toString("utf8");
    const parsed = JSON.parse(jsonStr);
    if (
      typeof parsed?.o === "number" &&
      Number.isInteger(parsed.o) &&
      parsed.o >= 0 &&
      parsed.o <= 10000
    ) {
      return parsed.o;
    }
  } catch {
    // fall through to exception
  }
  throw new ApiException("validation_failed", 400, "Invalid cursor.");
}
