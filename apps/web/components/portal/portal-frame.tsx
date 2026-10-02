import * as React from "react";
import Link from "next/link";

export interface PortalFrameProps {
  homeHref: string;
  name: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  logoUrl?: string | null;
  tagline?: string | null;
  websiteUrl?: string | null;
  accentColor?: string;
}

export function PortalFrame({
  homeHref,
  name,
  children,
  style,
}: PortalFrameProps): React.JSX.Element {
  return (
    <div data-shell="portal" className="min-h-dvh flex flex-col bg-background" style={style}>
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 min-h-16 py-2 flex items-center gap-4">
          <Link
            href={homeHref}
            className="text-base font-semibold truncate hover:opacity-80 transition-opacity"
          >
            {name}
          </Link>
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
