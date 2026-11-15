import * as React from "react";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MotionInput } from "@/components/motion-input";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { isRtl } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { getMe } from "@/lib/api-server";
import { createHmac } from "node:crypto";

export const metadata: Metadata = {
  title: "UserHQ",
  description: "UserHQ feedback, roadmap, and changelog platform",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, me] = await Promise.all([getRequestLocale(), getMe()]);
  const enabled =
    process.env.NODE_ENV === "production" &&
    process.env.ANALYTICS_ENABLED !== "false";
  // Server-derived opaque ID; the auth/database secret never enters the web image.
  const analyticsSecret =
    process.env.ANALYTICS_ID_SALT || "userhq-analytics-v1";
  const opaqueId = me.user
    ? createHmac("sha256", analyticsSecret)
        .update(`analytics:v1:${me.user.id}`)
        .digest("hex")
        .slice(0, 32)
    : null;

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <head>
        <meta name="referrer" content="no-referrer" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        data-clarity-mask="true"
        className="min-h-dvh flex flex-col bg-background text-foreground font-sans antialiased"
      >
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>
            <React.Suspense fallback={null}>
              <AnalyticsProvider
                enabled={enabled}
                me={me}
                opaqueId={opaqueId}
                release={process.env.APP_RELEASE}
              />
            </React.Suspense>
            <MotionInput />
            <NuqsAdapter>{children}</NuqsAdapter>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
