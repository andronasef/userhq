"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";

export interface TabItem {
  label: string;
  href: string;
}

export interface TabNavProps {
  tabs: TabItem[];
  activeHref: string;
  className?: string;
  ariaLabel?: string;
}

export function TabNav({ tabs, activeHref, className, ariaLabel }: TabNavProps) {
  const { t } = useI18n();
  if (!tabs || tabs.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn(
        "flex gap-6 border-b border-border overflow-x-auto overflow-y-hidden no-scrollbar",
        className
      )}
      aria-label={ariaLabel ?? t("nav.tabs")}
    >
      {tabs.map((tab) => {
        const isActive = activeHref === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "h-10 inline-flex items-center text-sm border-b-2 -mb-px transition-colors whitespace-nowrap",
              isActive
                ? "border-primary text-[var(--primary-text)] font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
