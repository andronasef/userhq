import { describe, it, expect } from "vitest";
import { safeNext } from "./safe-next.js";

describe("safeNext open redirect guard", () => {
  it("allows root /", () => {
    expect(safeNext("/")).toBe("/");
  });

  it("allows relative path with query and hash", () => {
    expect(safeNext("/dev/upload?x=1#h")).toBe("/dev/upload?x=1#h");
  });

  it("rejects absolute URLs", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("http://evil.example/path")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("//evil.example/path")).toBe("/");
  });

  it("rejects backslash variations", () => {
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/test\\path")).toBe("/");
  });

  it("keeps %5C safely under same origin or falls back", () => {
    const res = safeNext("/%5Cevil");
    expect(res).not.toContain("evil.example");
    if (res !== "/") {
      expect(res.startsWith("/")).toBe(true);
      expect(res.startsWith("//")).toBe(false);
    }
  });

  it("rejects paths under /api/", () => {
    expect(safeNext("/api/v1/me")).toBe("/");
    expect(safeNext("/api/auth/sign-in")).toBe("/");
  });

  it("rejects /login and /login with params/subpaths", () => {
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/login?next=/x")).toBe("/");
    expect(safeNext("/login/subpath")).toBe("/");
  });

  it("rejects empty, null, undefined, and array values", () => {
    expect(safeNext("")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(["a", "b"])).toBe("/");
  });

  it("rejects javascript: and other pseudo-protocols", () => {
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("data:text/html,evil")).toBe("/");
  });

  it("rejects values containing newlines or control characters", () => {
    expect(safeNext("/test\nnewline")).toBe("/");
    expect(safeNext("/test\r\nnewline")).toBe("/");
    expect(safeNext("/test\x00null")).toBe("/");
  });

  it("supports custom fallback argument", () => {
    expect(safeNext("https://evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeNext("", "/custom")).toBe("/custom");
    expect(safeNext("/dev/upload", "/custom")).toBe("/dev/upload");
  });
});
