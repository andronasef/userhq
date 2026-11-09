import type { SupportedLocale } from "@userhq/types";

import en from "./locales/en.json";
import ar from "./locales/ar.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import hi from "./locales/hi.json";
import fil from "./locales/fil.json";
import id from "./locales/id.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import zh from "./locales/zh.json";

export type TranslationDictionary = typeof en;
export type UiStrings = typeof en.ui;

export const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  en,
  ar,
  de,
  es,
  fr,
  pt,
  ru,
  hi,
  fil,
  id,
  ja,
  ko,
  zh,
};

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Every valid `t()` key, so a typo is a compile error instead of silent English. */
export type DictionaryKey = Paths<TranslationDictionary>;
