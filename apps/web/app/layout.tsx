import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Header } from "../components/header.js";

export const metadata: Metadata = {
  title: "UserHQ",
  description: "UserHQ feedback, roadmap, and changelog platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh flex flex-col bg-background text-foreground font-sans antialiased">
        <Header />
        <main className="flex-1 py-8 sm:py-12">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
