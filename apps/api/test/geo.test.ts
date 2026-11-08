import { describe, it, expect } from "vitest";
import { resolveLocationFromIp } from "../src/feedback/geo.util.js";

describe("resolveLocationFromIp", () => {
  it("returns null for null, undefined, or empty IP", () => {
    expect(resolveLocationFromIp(null)).toBeNull();
    expect(resolveLocationFromIp(undefined)).toBeNull();
    expect(resolveLocationFromIp("")).toBeNull();
  });

  it("returns null for loopback and local addresses", () => {
    expect(resolveLocationFromIp("127.0.0.1")).toBeNull();
    expect(resolveLocationFromIp("::1")).toBeNull();
    expect(resolveLocationFromIp("localhost")).toBeNull();
  });

  it("correctly resolves a public IPv4 address to country and details", () => {
    // 207.97.227.239 is a public US IP (GitHub)
    const result = resolveLocationFromIp("207.97.227.239");
    expect(result).not.toBeNull();
    expect(result?.countryCode).toBe("US");
    expect(result?.country).toBe("United States");
  });

  it("handles IPv6-mapped IPv4 prefixes cleanly", () => {
    const result = resolveLocationFromIp("::ffff:207.97.227.239");
    expect(result).not.toBeNull();
    expect(result?.countryCode).toBe("US");
    expect(result?.country).toBe("United States");
  });
});
