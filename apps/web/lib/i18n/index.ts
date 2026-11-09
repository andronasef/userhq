import {
  type SupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_CATALOG,
  normalizeLocale,
  isSupportedLocale,
} from "@userhq/types";
import { DICTIONARIES, type TranslationDictionary } from "./dictionaries";

export * from "./dictionaries";
export { LOCALE_CATALOG, SUPPORTED_LOCALES, DEFAULT_LOCALE, normalizeLocale, isSupportedLocale };

export const LOCALE_COOKIE_NAME = "userhq_locale";

export function getDictionary(locale?: SupportedLocale | string | null): TranslationDictionary {
  const norm = normalizeLocale(locale);
  return DICTIONARIES[norm] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isRtl(locale?: SupportedLocale | string | null): boolean {
  const norm = normalizeLocale(locale);
  return LOCALE_CATALOG[norm]?.dir === "rtl";
}

export interface ResolveLocaleOptions {
  queryLang?: string | null;
  cookieLang?: string | null;
  acceptLanguage?: string | null;
  productDefaultLocale?: SupportedLocale | string | null;
  allowedLocales?: SupportedLocale[];
}

export function resolveLocale({
  queryLang,
  cookieLang,
  acceptLanguage,
  productDefaultLocale,
  allowedLocales,
}: ResolveLocaleOptions): SupportedLocale {
  const isAllowed = (loc: SupportedLocale) => {
    if (!allowedLocales || allowedLocales.length === 0) return true;
    return allowedLocales.includes(loc);
  };

  // 1. Explicit query parameter ?lang=
  if (queryLang) {
    const candidate = normalizeLocale(queryLang);
    if (isAllowed(candidate)) return candidate;
  }

  // 2. Cookie userhq_locale
  if (cookieLang) {
    const candidate = normalizeLocale(cookieLang);
    if (isAllowed(candidate)) return candidate;
  }

  // 3. Accept-Language header
  if (acceptLanguage) {
    // Parse Accept-Language header: e.g. "fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5"
    const tags = acceptLanguage
      .split(",")
      .map((part) => {
        const [tag, qPart] = part.trim().split(";");
        const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1.0;
        return { tag: tag.trim(), q: isNaN(q) ? 0 : q };
      })
      .sort((a, b) => b.q - a.q);

    for (const item of tags) {
      const candidate = normalizeLocale(item.tag, null as any);
      if (candidate && isAllowed(candidate)) {
        return candidate;
      }
    }
  }

  // 4. Product default locale
  if (productDefaultLocale) {
    const candidate = normalizeLocale(productDefaultLocale);
    if (isAllowed(candidate)) return candidate;
  }

  // 5. System default
  if (allowedLocales && allowedLocales.length > 0 && !allowedLocales.includes(DEFAULT_LOCALE)) {
    return allowedLocales[0]!;
  }

  return DEFAULT_LOCALE;
}
