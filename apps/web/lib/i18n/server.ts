import { cookies, headers } from "next/headers";
import { type SupportedLocale, DEFAULT_LOCALE } from "@userhq/types";
import {
  LOCALE_COOKIE_NAME,
  resolveLocale,
  getDictionary,
  formatMessage,
  DICTIONARIES,
  type DictionaryKey,
} from "./index";
import type { TranslationParams } from "./context";

export { getDictionary, formatMessage };

/** The visitor's language for this request: saved cookie, then Accept-Language. */
export async function getRequestLocale(): Promise<SupportedLocale> {
  return resolveLocale({
    cookieLang: (await cookies()).get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
}

/** Server-side helper returning resolved locale, dictionary, and a typesafe `t` helper function. */
export async function getServerI18n() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  const t = (
    path: DictionaryKey,
    paramsOrFallback?: TranslationParams | string,
    fallback?: string,
  ): string => {
    const params =
      typeof paramsOrFallback === "object" && paramsOrFallback !== null
        ? paramsOrFallback
        : undefined;
    const explicitFallback =
      typeof paramsOrFallback === "string" ? paramsOrFallback : fallback;

    const parts = path.split(".");
    let current: any = dictionary;
    for (const p of parts) {
      if (current && typeof current === "object" && p in current) {
        current = current[p];
      } else {
        current = undefined;
        break;
      }
    }

    let res: string | undefined =
      typeof current === "string" ? current : undefined;

    if (res === undefined) {
      const enDict = DICTIONARIES[DEFAULT_LOCALE];
      let enCurrent: any = enDict;
      for (const p of parts) {
        if (enCurrent && typeof enCurrent === "object" && p in enCurrent) {
          enCurrent = enCurrent[p];
        } else {
          enCurrent = undefined;
          break;
        }
      }
      if (typeof enCurrent === "string") res = enCurrent;
    }

    if (res === undefined) {
      res = explicitFallback ?? path;
    }

    if (params) {
      return formatMessage(res, params);
    }
    return res;
  };

  return { locale, dictionary, t };
}
