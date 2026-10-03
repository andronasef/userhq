import * as React from "react";
import { Header } from "./header";
import { AppToaster } from "./ui/toaster";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Header />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          {children}
        </div>
      </main>
      <AppToaster />
    </>
  );
}
