import type { SupportedLocale } from "@userhq/types";
import { DICTIONARIES, type UiStrings } from "./dictionaries";

export type { UiStrings };

export const UI_STRINGS: Record<SupportedLocale, UiStrings> = Object.fromEntries(
  Object.entries(DICTIONARIES).map(([locale, dict]) => [locale, dict.ui]),
) as Record<SupportedLocale, UiStrings>;
