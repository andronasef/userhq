import { z } from "zod";

export const SUPPORTED_LOCALES = [
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
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export interface LocaleMeta {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const LOCALE_CATALOG: Record<SupportedLocale, LocaleMeta> = {
  en: { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl" },
  de: { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  es: { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
  fr: { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr" },
  ru: { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
  hi: { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  fil: { code: "fil", name: "Filipino", nativeName: "Filipino", dir: "ltr" },
  id: { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
  ja: { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr" },
  ko: { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr" },
  zh: { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", dir: "ltr" },
};

export const SupportedLocaleSchema = z.enum(SUPPORTED_LOCALES);

export const ProductLocalesConfigSchema = z.object({
  defaultLocale: SupportedLocaleSchema.default(DEFAULT_LOCALE),
  enabledLocales: z.array(SupportedLocaleSchema).min(1).default([DEFAULT_LOCALE]),
}).refine((v) => v.enabledLocales.includes(v.defaultLocale), {
  message: "default_locale_not_enabled",
  path: ["enabledLocales"],
});
export type ProductLocalesConfig = z.infer<typeof ProductLocalesConfigSchema>;

export function isSupportedLocale(locale: string | null | undefined): locale is SupportedLocale {
  return typeof locale === "string" && SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export function normalizeLocale(raw: string | null | undefined, fallback: SupportedLocale = DEFAULT_LOCALE): SupportedLocale {
  if (!raw) return fallback;
  const clean = raw.trim().toLowerCase();
  
  if (isSupportedLocale(clean)) return clean;

  const base = clean.split("-")[0]?.split("_")[0];
  if (isSupportedLocale(base)) return base;

  if (base === "tl") return "fil";

  return fallback;
}

export function isRtl(locale?: SupportedLocale | string | null): boolean {
  const norm = normalizeLocale(locale);
  return LOCALE_CATALOG[norm]?.dir === "rtl";
}

/**
 * Language a public portal request is served in: the requested one when the
 * product enabled it, otherwise the product default.
 */
export function pickContentLocale(
  config: ProductLocalesConfig | null | undefined,
  requested: string | null | undefined,
): SupportedLocale {
  const def = config?.defaultLocale ?? DEFAULT_LOCALE;
  const enabled = config?.enabledLocales ?? [def];
  const candidate = requested ? normalizeLocale(requested, null as never) : null;
  return candidate && enabled.includes(candidate) ? candidate : def;
}
