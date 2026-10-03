import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EntityLogo } from "../entity-logo";

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
}: PortalFrameProps): React.JSX.Element {
  const combinedStyle = style ?? accentStyle;

  return (
    <div
      data-shell="portal"
      className="min-h-dvh flex flex-col bg-background"
      style={combinedStyle}
    >
      <header className="border-b border-border">
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

          <div className="ml-auto flex items-center gap-4 shrink-0">
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
            {right}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
          {children}
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="hover:underline font-medium text-foreground">
            UserHQ
          </Link>
        </div>
      </footer>
    </div>
  );
}
