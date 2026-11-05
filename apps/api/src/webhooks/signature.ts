import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhookPayload(
  payloadString: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000)
): { signature: string; header: string; timestamp: number } {
  const signedContent = `${timestamp}.${payloadString}`;
  const hmac = createHmac("sha256", secret).update(signedContent).digest("hex");
  const header = `t=${timestamp},v1=${hmac}`;
  return { signature: hmac, header, timestamp };
}

export function verifyWebhookSignature(
  payloadString: string,
  header: string,
  secret: string,
  toleranceSeconds: number = 300 // 5 minutes tolerance
): boolean {
  if (!header || !secret) return false;

  const parts = header.split(",");
  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = parseInt(v, 10);
    if (k === "v1") signature = v;
  }

  if (!timestamp || !signature || isNaN(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (toleranceSeconds > 0 && Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expectedSigned = `${timestamp}.${payloadString}`;
  const expectedHmac = createHmac("sha256", secret).update(expectedSigned).digest("hex");

  try {
    const bufA = Buffer.from(signature, "hex");
    const bufB = Buffer.from(expectedHmac, "hex");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
