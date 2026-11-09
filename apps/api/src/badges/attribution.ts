import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CookieOptions } from "express";
import type { Env } from "../env.js";

export const ATTRIBUTION_COOKIE_PREFIX = "uhq_attr_";
export const ATTRIBUTION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const ATTRIBUTION_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const ATTRIBUTION_MAX_BADGES = 10;
export const ATTRIBUTION_STORED_VALUE_MAX = 64;
const entriesSchema = z
  .array(
    z.object({
      badgeId: z.string().uuid(),
      value: z.string().max(ATTRIBUTION_STORED_VALUE_MAX),
    }),
  )
  .max(ATTRIBUTION_MAX_BADGES);
const payloadSchema = z.object({
  issuedAt: z.number().int(),
  entries: entriesSchema,
});
export type AttributionEntry = z.infer<typeof entriesSchema>[number];
export const attributionCookieName = (productId: string) =>
  `${ATTRIBUTION_COOKIE_PREFIX}${productId}`;
export function attributionCookieOptions(
  env: Pick<Env, "NODE_ENV">,
): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ATTRIBUTION_MAX_AGE_MS,
  };
}
export function anchoredRegex(pattern: string): RegExp {
  new RegExp(pattern);
  return new RegExp(`^(?:${pattern})$(?![\\s\\S])`);
}
function sameMac(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
function validTime(issuedMs: number, nowMs: number): boolean {
  return (
    issuedMs >= nowMs - ATTRIBUTION_MAX_AGE_MS &&
    issuedMs <= nowMs + ATTRIBUTION_FUTURE_SKEW_MS
  );
}
export function verifySignedValue({
  secret,
  value,
  ts,
  sig,
  nowMs = Date.now(),
}: {
  secret: string;
  value: string;
  ts?: string;
  sig?: string;
  nowMs?: number;
}): boolean {
  if (
    !ts ||
    !sig ||
    !/^\d{1,12}$/.test(ts) ||
    !validTime(Number(ts) * 1000, nowMs)
  )
    return false;
  return sameMac(
    sig,
    createHmac("sha256", secret).update(`${value}.${ts}`).digest("hex"),
  );
}
function cookieMac(secret: string, productId: string, payload: string): string {
  return createHmac("sha256", secret)
    .update(`userhq:attribution:v1:${productId}:${payload}`)
    .digest("hex");
}
export function signAttributionCookie(
  secret: string,
  productId: string,
  entries: AttributionEntry[],
  nowMs = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      issuedAt: Math.floor(nowMs / 1000),
      entries: entries
        .slice(0, ATTRIBUTION_MAX_BADGES)
        .map((entry) => ({
          ...entry,
          value: entry.value.slice(0, ATTRIBUTION_STORED_VALUE_MAX),
        })),
    }),
  ).toString("base64url");
  return `${payload}.${cookieMac(secret, productId, payload)}`;
}
export function verifyAttributionCookie(
  secret: string,
  productId: string,
  raw: string,
  nowMs = Date.now(),
): AttributionEntry[] | null {
  if (raw.length > 4096) return null;
  const parts = raw.split(".");
  if (
    parts.length !== 2 ||
    !sameMac(parts[1], cookieMac(secret, productId, parts[0]))
  )
    return null;
  try {
    const parsed = payloadSchema.safeParse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString()),
    );
    return parsed.success && validTime(parsed.data.issuedAt * 1000, nowMs)
      ? parsed.data.entries
      : null;
  } catch {
    return null;
  }
}
export function readCookie(
  headerValue: string | undefined,
  name: string,
): string | undefined {
  for (const part of (headerValue ?? "").split(";")) {
    const index = part.indexOf("=");
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}
