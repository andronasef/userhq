// ponytail: offset cursor; switch "new" to keyset if a product passes ~10k posts
import { z } from "zod";
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

// Keyset cursors for the workspace inbox feeds (requests and comments).
// The timestamp is the full-precision text Postgres produced (never a JS Date, which truncates to ms)
// and is cast back to timestamptz in the predicate. Everything is validated before it reaches SQL.
export type KeysetKind = "requests:new" | "requests:top" | "requests:activity" | "comments";

export interface KeysetPosition {
  /** created_at (or activity time) exactly as `::text` returned it, e.g. "2026-03-01 10:00:00.1239+00" */
  t: string;
  id: string;
  /** vote count; only for requests:top */
  v?: number;
}

const INT32_MAX = 2147483647;
const PG_TIMESTAMPTZ = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?([+-])(\d{2})(?::(\d{2}))?$/;

function isRealTimestamp(text: string): boolean {
  const m = PG_TIMESTAMPTZ.exec(text);
  if (!m) return false;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
  if (y < 1970 || y > 2999) return false;
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== mo - 1 ||
    probe.getUTCDate() !== d ||
    h > 23 ||
    mi > 59 ||
    s > 59
  ) {
    return false;
  }
  const offsetHours = Number(m[8]);
  const offsetMinutes = m[9] === undefined ? 0 : Number(m[9]);
  return offsetHours <= 15 && offsetMinutes <= 59;
}

const KeysetPayloadSchema = z
  .object({
    k: z.enum(["requests:new", "requests:top", "requests:activity", "comments"]),
    t: z.string().max(40).refine(isRealTimestamp),
    i: z.string().uuid(),
    v: z.number().int().min(0).max(INT32_MAX).optional(),
  })
  .strict();

export function encodeKeysetCursor(kind: KeysetKind, pos: KeysetPosition): string {
  const payload: Record<string, unknown> = { k: kind, t: pos.t, i: pos.id };
  if (kind === "requests:top") payload.v = pos.v;
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeKeysetCursor(kind: KeysetKind, s: string): KeysetPosition {
  try {
    const parsed = KeysetPayloadSchema.safeParse(
      JSON.parse(Buffer.from(s, "base64url").toString("utf8"))
    );
    if (
      parsed.success &&
      parsed.data.k === kind &&
      (kind === "requests:top") === (parsed.data.v !== undefined)
    ) {
      return { t: parsed.data.t, id: parsed.data.i, v: parsed.data.v };
    }
  } catch {
    // fall through to exception
  }
  throw new ApiException("validation_failed", 400, "Invalid cursor.");
}
