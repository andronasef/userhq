import { describe, it, expect } from "vitest";
import {
  pickContentLocale,
  SUPPORTED_LOCALES,
  LOCALE_CATALOG,
  normalizeLocale,
  isSupportedLocale,
  ProductLocalesConfigSchema,
} from "../src/i18n.js";

describe("i18n types & helpers", () => {
  it("contains all 13 required locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(13);
    expect(SUPPORTED_LOCALES).toEqual([
      "en",
      "ar",
      "de",
      "es",
      "fr",
      "pt",
      "ru",
      "hi",
      "fil",
      "id",
      "ja",
      "ko",
      "zh",
    ]);
  });

  it("marks Arabic as RTL and other languages as LTR", () => {
    expect(LOCALE_CATALOG.ar.dir).toBe("rtl");
    expect(LOCALE_CATALOG.en.dir).toBe("ltr");
    expect(LOCALE_CATALOG.de.dir).toBe("ltr");
    expect(LOCALE_CATALOG.zh.dir).toBe("ltr");
  });

  it("normalizes language tags with variants and aliases", () => {
    expect(normalizeLocale("ar-SA")).toBe("ar");
    expect(normalizeLocale("de-DE")).toBe("de");
    expect(normalizeLocale("zh-CN")).toBe("zh");
    expect(normalizeLocale("pt-BR")).toBe("pt");
    expect(normalizeLocale("tl")).toBe("fil");
    expect(normalizeLocale("tl-PH")).toBe("fil");
    expect(normalizeLocale("unknown-lang")).toBe("en");
    expect(normalizeLocale(null)).toBe("en");
  });

  it("validates ProductLocalesConfigSchema", () => {
    const valid = ProductLocalesConfigSchema.parse({
      defaultLocale: "en",
      enabledLocales: ["en", "ar", "es"],
    });
    expect(valid.defaultLocale).toBe("en");
    expect(valid.enabledLocales).toEqual(["en", "ar", "es"]);

    const defaulted = ProductLocalesConfigSchema.parse({});
    expect(defaulted.defaultLocale).toBe("en");
    expect(defaulted.enabledLocales).toEqual(["en"]);
  });
});


describe("pickContentLocale", () => {
  const cfg = { defaultLocale: "ar", enabledLocales: ["ar", "en"] } as const;
  it("serves the requested language only when the product enabled it", () => {
    expect(pickContentLocale(cfg as any, "en")).toBe("en");
    expect(pickContentLocale(cfg as any, "fr")).toBe("ar");
    expect(pickContentLocale(cfg as any, "bogus")).toBe("ar");
    expect(pickContentLocale(cfg as any, null)).toBe("ar");
    expect(pickContentLocale(undefined, "de")).toBe("en");
  });
  it("rejects a default language that is not enabled", () => {
    expect(ProductLocalesConfigSchema.safeParse({ defaultLocale: "fr", enabledLocales: ["en"] }).success).toBe(false);
  });
});
