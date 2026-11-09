import type { ProductLocalesConfig, SupportedLocale } from "@userhq/types";

export interface PortalLocaleContext {
  locales?: ProductLocalesConfig;
  locale?: SupportedLocale;
}

/**
 * Picks the stored translation for the request language. `translation` is only
 * returned when the visitor's language differs from the product default and the
 * translation has content; otherwise the original is served and `isFallback`
 * says whether the visitor asked for something else.
 */
export function localize<T extends object>(
  portal: PortalLocaleContext,
  translations: unknown,
  isFilled: (t: T) => boolean,
  sourceLocale?: SupportedLocale,
): { translation: T | null; resolvedLocale: SupportedLocale; isFallback: boolean } {
  const def = portal.locales?.defaultLocale ?? "en";
  const source = sourceLocale ?? def;
  const wanted = portal.locale ?? def;
  if (wanted === source) return { translation: null, resolvedLocale: source, isFallback: false };
  const t = (translations as Record<string, T> | null)?.[wanted];
  if (t && isFilled(t)) return { translation: t, resolvedLocale: wanted, isFallback: false };
  return { translation: null, resolvedLocale: source, isFallback: true };
}
