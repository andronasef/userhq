"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EntityLogo } from "../entity-logo";
import { UserHQBrand } from "../userhq-brand";
import { ThemeToggle } from "../theme-toggle";
import { LanguageSwitcher } from "../language-switcher";
import { useI18n } from "../../lib/i18n/context";
import { PortalSectionMotion } from "./portal-section-motion";
import { PortalAccentProvider } from "./portal-accent-context";

export interface PortalFrameProps {
  homeHref: string;
  name: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  accentStyle?: React.CSSProperties;
  logoUrl?: string | null;
  tagline?: string | null;
  websiteUrl?: string | null;
  companyName?: string;
  right?: React.ReactNode;
  tabs?: React.ReactNode;
}

export function PortalFrame({
  homeHref,
  name,
  children,
  style,
  accentStyle,
  logoUrl,
  tagline,
  websiteUrl,
  companyName,
  right,
  tabs,
}: PortalFrameProps): React.JSX.Element {
  const { t } = useI18n();
  const combinedStyle = style ?? accentStyle;

  return (
    <PortalAccentProvider value={combinedStyle}>
      <div
        data-shell="portal"
        className="min-h-dvh flex flex-col bg-background"
        style={combinedStyle}
      >
        <header className="border-b border-border bg-card">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 min-h-16 py-2 flex items-center gap-4">
            <Link
              href={homeHref}
              className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
            >
              <EntityLogo
                src={logoUrl}
                name={name}
                size={32}
                className="shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-base font-semibold truncate text-foreground">
                  {name}
                </span>
                {tagline && (
                  <span className="hidden sm:block truncate text-sm text-muted-foreground">
                    {tagline}
                  </span>
                )}
              </div>
            </Link>

            <div className="ml-auto flex items-center gap-2 sm:gap-4 shrink-0">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 text-sm text-[var(--primary-text)] hover:underline"
                >
                  <span>Back to {companyName ?? name}</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              )}
              <LanguageSwitcher variant="portal" />
              <ThemeToggle variant="dropdown" />
              {right}
            </div>
          </div>
          {tabs && (
            <div
              data-portal-section-tabs={homeHref}
              className="mx-auto w-full max-w-5xl px-4 sm:px-6"
            >
              {tabs}
            </div>
          )}
        </header>

        <main className="flex-1">
          <PortalSectionMotion basePath={homeHref}>
            {children}
          </PortalSectionMotion>
        </main>

        <footer className="border-t border-border py-6">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {t("ui.poweredBy")}{" "}
              <Link
                href="/"
                className="hover:underline font-medium text-foreground"
              >
                <UserHQBrand compact className="text-sm" />
              </Link>
            </div>
            <ThemeToggle variant="segmented" />
          </div>
        </footer>
      </div>
    </PortalAccentProvider>
  );
}
