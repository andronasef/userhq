"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import {
  type SupportedLocale,
  LOCALE_CATALOG,
} from "@userhq/types";
import { useI18n } from "../lib/i18n/context";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { cn } from "../lib/utils";

export interface LanguageSwitcherProps {
  align?: "start" | "end" | "center";
  className?: string;
  allowedLocales?: SupportedLocale[];
  variant?: "ghost" | "outline" | "portal";
}

export function LanguageSwitcher({
  align = "end",
  className,
  allowedLocales,
  variant = "ghost",
}: LanguageSwitcherProps): React.JSX.Element {
  const router = useRouter();
  const { locale, setLocale, allowedLocales: ctxAllowed, t } = useI18n();

  const selectableLocales = React.useMemo(() => {
    const list = allowedLocales && allowedLocales.length > 0 ? allowedLocales : ctxAllowed;
    return list.map((code) => LOCALE_CATALOG[code] || {
      code,
      name: code,
      nativeName: code,
      dir: "ltr" as const,
    });
  }, [allowedLocales, ctxAllowed]);

  const currentMeta = LOCALE_CATALOG[locale] ?? LOCALE_CATALOG.en;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.switchLanguage", "Switch language")}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
            variant === "outline" &&
              "border border-border bg-background hover:bg-muted text-foreground",
            variant === "portal" &&
              "text-muted-foreground hover:text-foreground hover:bg-muted/80",
            variant === "ghost" &&
              "text-muted-foreground hover:text-foreground hover:bg-muted",
            className,
          )}
        >
          <Globe className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{currentMeta.nativeName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-44 max-h-72 overflow-y-auto">
        {selectableLocales.map((item) => {
          const isSelected = item.code === locale;
          return (
            <DropdownMenuItem
              key={item.code}
              onClick={() => {
                setLocale(item.code);
                router.refresh(); // re-fetch server-rendered content in the new language
              }}
              className={cn(
                "flex items-center justify-between text-xs py-1.5 px-2 cursor-pointer",
                isSelected && "font-semibold text-foreground bg-muted/60",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-foreground">{item.nativeName}</span>
                <span className="text-[11px] text-muted-foreground">({item.name})</span>
              </div>
              {isSelected && <Check className="size-3.5 text-foreground ml-2 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
