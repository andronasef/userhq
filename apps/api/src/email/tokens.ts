import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

export function signToken(
  secret: string,
  userId: string,
  scope: "all" | `p:${string}`
): string {
  const key = Buffer.from(
    hkdfSync("sha256", secret, "", "userhq-unsubscribe-v1", 32)
  );
  const payload = Buffer.from(
    JSON.stringify({ u: userId, s: scope })
  ).toString("base64url");
  const mac = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifyToken(
  secret: string,
  token: string
): { u: string; s: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, mac] = parts;
  if (!payload || !mac) return null;

  const key = Buffer.from(
    hkdfSync("sha256", secret, "", "userhq-unsubscribe-v1", 32)
  );
  const expected = createHmac("sha256", key).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    );
    if (parsed && typeof parsed.u === "string" && typeof parsed.s === "string") {
      return { u: parsed.u, s: parsed.s };
    }
    return null;
  } catch {
    return null;
  }
}
