import { describe, expect, it } from "vitest";
import { isPortalSectionChange } from "./portal-motion";

describe("public portal section navigation", () => {
  const base = "/acme/atlas";

  it("bridges top-level sections in either direction", () => {
    expect(isPortalSectionChange(base, `${base}/roadmap`, base)).toBe(true);
    expect(isPortalSectionChange(`${base}/faq`, base, base)).toBe(true);
    expect(
      isPortalSectionChange(`${base}/changelog`, `${base}/activity`, base),
    ).toBe(true);
  });

  it("does not animate initial renders or repeat navigation", () => {
    expect(isPortalSectionChange(null, base, base)).toBe(false);
    expect(isPortalSectionChange(base, base, base)).toBe(false);
  });

  it("does not treat query or hash updates as section changes", () => {
    for (const suffix of ["?sort=top", "#ideas"]) {
      expect(isPortalSectionChange(base, `${base}${suffix}`, base)).toBe(false);
    }
  });

  it("rejects another tenant or product", () => {
    expect(isPortalSectionChange(base, "/other/atlas/faq", base)).toBe(false);
    expect(isPortalSectionChange(base, "/acme/other/faq", base)).toBe(false);
  });

  it("rejects nested articles, posts, and workspace indexes", () => {
    expect(isPortalSectionChange(base, `${base}/p/1-example`, base)).toBe(
      false,
    );
    expect(
      isPortalSectionChange(`${base}/changelog/release`, `${base}/faq`, base),
    ).toBe(false);
    expect(isPortalSectionChange("/acme", "/acme/faq", "/acme")).toBe(false);
  });

  it("rejects admin and non-public roots", () => {
    for (const root of ["admin", "dashboard", "api", "dev", "login"]) {
      expect(
        isPortalSectionChange(
          `/${root}/atlas`,
          `/${root}/atlas/faq`,
          `/${root}/atlas`,
        ),
      ).toBe(false);
    }
  });
});
