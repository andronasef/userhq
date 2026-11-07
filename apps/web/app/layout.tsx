import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MotionInput } from "@/components/motion-input";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "UserHQ",
  description: "UserHQ feedback, roadmap, and changelog platform",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground font-sans antialiased">
        <ThemeProvider>
          <MotionInput />
          <NuqsAdapter>{children}</NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
