import { describe, it, expect } from "vitest";
import { localize } from "../src/portal/localize.js";

const portal = (locale: string) => ({
  locales: { defaultLocale: "ar" as const, enabledLocales: ["ar" as const, "en" as const] },
  locale: locale as any,
});
const filled = (t: { title?: string }) => Boolean(t.title?.trim());

describe("localize", () => {
  it("serves the original untouched in the product default language", () => {
    expect(localize(portal("ar"), { en: { title: "x" } }, filled)).toEqual({
      translation: null,
      resolvedLocale: "ar",
      isFallback: false,
    });
  });
  it("serves the translation when it has content", () => {
    const r = localize(portal("en"), { en: { title: "Hello" } }, filled);
    expect(r.translation).toEqual({ title: "Hello" });
    expect(r.resolvedLocale).toBe("en");
    expect(r.isFallback).toBe(false);
  });
  it("falls back to the original, flagged, when the translation is empty or missing", () => {
    for (const tr of [{ en: { title: "  " } }, {}, null]) {
      expect(localize(portal("en"), tr, filled)).toEqual({
        translation: null,
        resolvedLocale: "ar",
        isFallback: true,
      });
    }
  });
  it("honors sourceLocale when different from product default", () => {
    // Product default is 'ar', but entry was authored in 'en' without an Arabic translation
    const rArabic = localize(portal("ar"), {}, filled, "en");
    expect(rArabic).toEqual({
      translation: null,
      resolvedLocale: "en",
      isFallback: true,
    });

    // English visitor reading the same entry gets original English without fallback flag
    const rEnglish = localize(portal("en"), {}, filled, "en");
    expect(rEnglish).toEqual({
      translation: null,
      resolvedLocale: "en",
      isFallback: false,
    });
  });
});
