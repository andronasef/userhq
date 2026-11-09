"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  type SupportedLocale,
  DEFAULT_LOCALE,
  LOCALE_CATALOG,
} from "@userhq/types";
import {
  DICTIONARIES,
  type TranslationDictionary,
  type DictionaryKey,
  LOCALE_COOKIE_NAME,
  isRtl,
  getDictionary,
  normalizeLocale,
  isSupportedLocale,
} from "./index";

export interface I18nContextValue {
  locale: SupportedLocale;
  currentLocale: SupportedLocale;
  dir: "ltr" | "rtl";
  dictionary: TranslationDictionary;
  allowedLocales: SupportedLocale[];
  /** Language the main (untranslated) content fields are written in. */
  contentDefaultLocale: SupportedLocale;
  setScope: (scope: LocaleScope | null) => void;
  setLocale: (newLocale: SupportedLocale) => void;
  t: (path: DictionaryKey, fallback?: string) => string;
}

export interface LocaleScope {
  defaultLocale: SupportedLocale;
  enabledLocales: SupportedLocale[];
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  initialLocale?: SupportedLocale | string;
  allowedLocales?: SupportedLocale[];
  children: React.ReactNode;
}

export function I18nProvider({
  initialLocale = DEFAULT_LOCALE,
  allowedLocales,
  children,
}: I18nProviderProps): React.JSX.Element {
  const [preferred, setLocaleState] = React.useState<SupportedLocale>(() =>
    normalizeLocale(initialLocale),
  );
  const router = useRouter();
  const [scope, setScope] = React.useState<LocaleScope | null>(null);

  const activeAllowedLocales = React.useMemo(() => {
    if (scope) return scope.enabledLocales;
    if (allowedLocales && allowedLocales.length > 0) {
      return allowedLocales;
    }
    return Object.keys(LOCALE_CATALOG) as SupportedLocale[];
  }, [allowedLocales, scope]);

  // Inside a product portal only the product's enabled languages apply; the
  // visitor's saved preference is kept and used again elsewhere.
  const locale: SupportedLocale = activeAllowedLocales.includes(preferred)
    ? preferred
    : (scope?.defaultLocale ?? preferred);
  const contentDefaultLocale = scope?.defaultLocale ?? DEFAULT_LOCALE;

  // Client-side auto-detection cascade: ?lang= > cookie > navigator.languages > default
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryLang = urlParams.get("lang") || urlParams.get("locale");
      if (queryLang && isSupportedLocale(normalizeLocale(queryLang, null as never))) {
        const norm = normalizeLocale(queryLang);
        setLocaleState(norm);
        document.cookie = `${LOCALE_COOKIE_NAME}=${norm}; path=/; max-age=31536000; samesite=lax`;
        if (norm !== normalizeLocale(initialLocale)) router.refresh(); // server content follows the cookie
        return;
      }

      // Check cookie
      const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`));
      if (cookieMatch && cookieMatch[1]) {
        const norm = normalizeLocale(decodeURIComponent(cookieMatch[1]));
        setLocaleState(norm);
        return;
      }

      // Check browser navigator languages
      if (navigator.languages && navigator.languages.length > 0) {
        for (const navLang of navigator.languages) {
          const norm = normalizeLocale(navLang);
          // If normalized to something other than en or matches first language
          if (norm !== DEFAULT_LOCALE || navLang.toLowerCase().startsWith("en")) {
            setLocaleState(norm);
            return;
          }
        }
      }
    } catch {
      // Ignore parse errors in non-standard environments
    }
  }, []);

  const dir: "ltr" | "rtl" = isRtl(locale) ? "rtl" : "ltr";
  const dictionary = React.useMemo(() => getDictionary(locale), [locale]);

  const setLocale = React.useCallback(
    (newLocale: SupportedLocale) => {
      const normalized = normalizeLocale(newLocale);
      setLocaleState(normalized);
      if (typeof document !== "undefined") {
        document.cookie = `${LOCALE_COOKIE_NAME}=${normalized}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.lang = normalized;
        document.documentElement.dir = isRtl(normalized) ? "rtl" : "ltr";
      }
    },
    [],
  );

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
      document.documentElement.dir = dir;
    }
  }, [locale, dir]);

  const t = React.useCallback(
    (path: DictionaryKey, fallback?: string): string => {
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

      if (typeof current === "string") return current;

      // Fallback to English dictionary if key is missing in active language
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
      if (typeof enCurrent === "string") return enCurrent;

      return fallback ?? path;
    },
    [dictionary],
  );

  const value = React.useMemo(
    () => ({
      locale,
      currentLocale: locale,
      dir,
      dictionary,
      allowedLocales: activeAllowedLocales,
      contentDefaultLocale,
      setScope,
      setLocale,
      t,
    }),
    [locale, dir, dictionary, activeAllowedLocales, contentDefaultLocale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    const defaultDict = DICTIONARIES[DEFAULT_LOCALE];
    return {
      locale: DEFAULT_LOCALE,
      currentLocale: DEFAULT_LOCALE,
      dir: "ltr",
      dictionary: defaultDict,
      allowedLocales: Object.keys(LOCALE_CATALOG) as SupportedLocale[],
      contentDefaultLocale: DEFAULT_LOCALE,
      setScope: () => {},
      setLocale: () => {},
      t: (path: DictionaryKey, fallback?: string) => {
        const parts = path.split(".");
        let current: any = defaultDict;
        for (const p of parts) {
          if (current && typeof current === "object" && p in current) {
            current = current[p];
          } else {
            return fallback ?? path;
          }
        }
        return typeof current === "string" ? current : (fallback ?? path);
      },
    };
  }
  return context;
}
