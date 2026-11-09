import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MotionInput } from "@/components/motion-input";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { isRtl } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

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
  const locale = await getRequestLocale();

  return (
    <html lang={locale} dir={isRtl(locale) ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground font-sans antialiased">
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>
            <MotionInput />
            <NuqsAdapter>{children}</NuqsAdapter>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
