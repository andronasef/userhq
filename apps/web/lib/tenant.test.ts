import { describe, expect, it } from "vitest";
import { portalHref } from "./tenant";

describe("portalHref", () => {
  it("formats workspace root link", () => {
    expect(portalHref("acme")).toBe("/acme");
  });

  it("formats workspace product link", () => {
    expect(portalHref("acme", "app")).toBe("/acme/app");
  });
});
