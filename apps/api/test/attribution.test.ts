import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  anchoredRegex,
  readCookie,
  signAttributionCookie,
  verifyAttributionCookie,
  verifySignedValue,
  ATTRIBUTION_MAX_AGE_MS,
} from "../src/badges/attribution.js";

describe("Attribution verification", () => {
  const secret = "test-secret";
  const product = randomUUID();
  const now = Date.now();
  const entries = [{ badgeId: randomUUID(), value: "pro" }];
  it("round trips a product-bound cookie and rejects tampering and other products", () => {
    const raw = signAttributionCookie(secret, product, entries, now);
    expect(verifyAttributionCookie(secret, product, raw, now)).toEqual(entries);
    expect(verifyAttributionCookie(secret, randomUUID(), raw, now)).toBeNull();
    expect(
      verifyAttributionCookie(secret, product, `x${raw.slice(1)}`, now),
    ).toBeNull();
    expect(
      verifyAttributionCookie(secret, product, `${raw.slice(0, -1)}x`, now),
    ).toBeNull();
  });
  it("rejects expired and future cookies", () => {
    expect(
      verifyAttributionCookie(
        secret,
        product,
        signAttributionCookie(
          secret,
          product,
          entries,
          now - ATTRIBUTION_MAX_AGE_MS - 1000,
        ),
        now,
      ),
    ).toBeNull();
    expect(
      verifyAttributionCookie(
        secret,
        product,
        signAttributionCookie(secret, product, entries, now + 600_000),
        now,
      ),
    ).toBeNull();
  });
  it("validates timestamped signatures without crashing on multibyte input", () => {
    const ts = String(Math.floor(now / 1000));
    const sig = createHmac("sha256", secret).update(`pro.${ts}`).digest("hex");
    expect(
      verifySignedValue({ secret, value: "pro", ts, sig, nowMs: now }),
    ).toBe(true);
    for (const badTs of [
      undefined,
      "abc",
      String(Math.floor((now - ATTRIBUTION_MAX_AGE_MS - 1000) / 1000)),
      String(Math.floor((now + 600_000) / 1000)),
    ])
      expect(
        verifySignedValue({ secret, value: "pro", ts: badTs, sig, nowMs: now }),
      ).toBe(false);
    expect(
      verifySignedValue({
        secret,
        value: "pro",
        ts,
        sig: "é".repeat(64),
        nowMs: now,
      }),
    ).toBe(false);
  });
  it("fully anchors patterns and disallows escaping the wrapper", () => {
    for (const text of ["xproy", "proz", "pro\n"])
      expect(anchoredRegex("pro").test(text)).toBe(false);
    expect(anchoredRegex("a|b").test("ab")).toBe(false);
    expect(() => anchoredRegex("a)|(.*")).toThrow();
  });
  it("reads named cookies safely", () => {
    expect(readCookie("a=1; target=value; c=3", "target")).toBe("value");
    expect(readCookie("a=1", "target")).toBeUndefined();
  });
});
