import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { MotionInput } from "@/components/motion-input";
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
    <html lang="en">
      <body className="min-h-dvh flex flex-col bg-background text-foreground font-sans antialiased">
        <MotionInput />
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
