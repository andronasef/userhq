"use client";

import * as React from "react";
import { useI18n } from "../lib/i18n/context";
import {
  type SupportedLocale,
  LOCALE_CATALOG,
  DEFAULT_LOCALE,
  isRtl,
} from "@userhq/types";
import { cn } from "../lib/utils";
import { Globe } from "lucide-react";

export interface EntryLocaleTabsProps {
  activeLocale: SupportedLocale;
  onSelectLocale: (locale: SupportedLocale) => void;
  defaultLocale?: SupportedLocale;
  enabledLocales?: SupportedLocale[];
  translationsStatus?: Partial<Record<SupportedLocale, boolean>>;
  className?: string;
}

export function EntryLocaleTabs({
  activeLocale,
  onSelectLocale,
  defaultLocale = DEFAULT_LOCALE,
  enabledLocales,
  translationsStatus = {},
  className,
}: EntryLocaleTabsProps): React.JSX.Element | null {
  const { t } = useI18n();
  const locales = (enabledLocales && enabledLocales.length > 0)
    ? enabledLocales
    : [defaultLocale];

  // If there's only 1 locale enabled, no need to clutter with tabs
  if (locales.length <= 1) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1.5 pb-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Globe className="size-3.5" aria-hidden="true" />
          <span>{t("ui.languageVersion")}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          {t("ui.defaultLabel")}: <strong className="text-foreground">{LOCALE_CATALOG[defaultLocale]?.name ?? defaultLocale}</strong>
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t("ui.entryLocalesAria")}
        className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none"
      >
        {locales.map((code) => {
          const meta = LOCALE_CATALOG[code] || {
            code,
            name: code,
            nativeName: code,
            dir: "ltr",
          };
          const isActive = code === activeLocale;
          const isDefault = code === defaultLocale;
          const isFilled = isDefault || Boolean(translationsStatus[code]);
          const rtl = isRtl(code);

          return (
            <button
              key={code}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectLocale(code)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0",
                isActive
                  ? "border-foreground/30 bg-muted text-foreground shadow-xs font-semibold"
                  : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full shrink-0",
                  isFilled
                    ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                    : "bg-muted-foreground/40",
                )}
                title={isFilled ? t("ui.translationProvided") : t("ui.emptyFallsBack")}
              />
              <span>{meta.nativeName}</span>
              {rtl && (
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                  RTL
                </span>
              )}
              {isDefault && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground">
                  {t("ui.defaultLabel")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
