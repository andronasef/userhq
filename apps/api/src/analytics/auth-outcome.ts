import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const AUTH_OUTCOME_COOKIE = "userhq_auth_outcome";
const Outcome = z
  .object({
    session: z.string().min(1),
    user: z.string().min(1),
    signup: z.boolean(),
    method: z.enum(["google", "github"]),
    expires: z.number(),
  })
  .strict();
export type AuthOutcome = z.infer<typeof Outcome>;
export function signAuthOutcome(value: AuthOutcome, secret: string): string {
  const body = Buffer.from(JSON.stringify(Outcome.parse(value))).toString(
    "base64url",
  );
  return (
    body +
    "." +
    createHmac("sha256", secret)
      .update("analytics-auth:v1:" + body)
      .digest("base64url")
  );
}
export function verifyAuthOutcome(
  token: string,
  secret: string,
  session: string,
  user: string,
  now = Date.now(),
): AuthOutcome | null {
  try {
    if (token.length > 2048) return null;
    const [body, mac, extra] = token.split(".");
    if (!body || !mac || extra) return null;
    const expected = createHmac("sha256", secret)
      .update("analytics-auth:v1:" + body)
      .digest();
    const actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const v = Outcome.parse(
      JSON.parse(Buffer.from(body, "base64url").toString()),
    );
    return v.session === session &&
      v.user === user &&
      v.expires > now &&
      v.expires <= now + 300000
      ? v
      : null;
  } catch {
    return null;
  }
}
