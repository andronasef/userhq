import { describe, expect, it } from "vitest";
import { portalHref, postHref, dashboardPostHref, parsePostRef } from "./tenant";

describe("portalHref", () => {
  it("formats workspace root link", () => {
    expect(portalHref("acme")).toBe("/acme");
  });

  it("formats workspace product link", () => {
    expect(portalHref("acme", "app")).toBe("/acme/app");
  });
});

describe("dashboardPostHref", () => {
  it("formats dashboard board post link with encoded segments", () => {
    expect(dashboardPostHref("acme", "app", 42)).toBe(
      "/dashboard/acme/app/board/42"
    );
    expect(dashboardPostHref("increasing-labs", "soundboard maker", 2)).toBe(
      "/dashboard/increasing-labs/soundboard%20maker/board/2"
    );
  });
});

describe("postHref", () => {
  it("formats post permalink with slug", () => {
    expect(postHref("acme", "app", 42, "dark-mode")).toBe(
      "/acme/app/p/42-dark-mode"
    );
  });

  it("formats post permalink with empty or null slug", () => {
    expect(postHref("acme", "app", 42, "")).toBe("/acme/app/p/42");
    expect(postHref("acme", "app", 42, null)).toBe("/acme/app/p/42");
    expect(postHref("acme", "app", 42)).toBe("/acme/app/p/42");
  });
});

describe("parsePostRef", () => {
  it("parses numeric refs with and without slugs", () => {
    expect(parsePostRef("42-dark-mode")).toBe(42);
    expect(parsePostRef("42")).toBe(42);
    expect(parsePostRef("123-some-long-title-slug")).toBe(123);
  });

  it("returns null for non-numeric or non-positive refs", () => {
    expect(parsePostRef("abc")).toBe(null);
    expect(parsePostRef("0")).toBe(null);
    expect(parsePostRef("0-zero-test")).toBe(null);
    expect(parsePostRef("-5")).toBe(null);
    expect(parsePostRef("")).toBe(null);
  });
});
