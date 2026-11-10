import * as React from "react";
import Link from "next/link";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { getRequestLocale, getDictionary } from "@/lib/i18n/server";

export const metadata = {
  title: "Page not found · UserHQ",
};

export default async function NotFound(): Promise<React.JSX.Element> {
  const locale = await getRequestLocale();
  const dict = await getDictionary(locale);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-tight">
            {dict.errors?.pageNotFoundHeading ?? "Page not found"}
          </h1>
          <p className="text-base text-muted-foreground">
            {dict.errors?.pageNotFoundDesc ??
              "The page you're looking for doesn't exist or has moved."}
          </p>
        </div>

        <div>
          <Button variant="outline" asChild>
            <Link href="/">{dict.errors?.goToHome ?? "Go to home"}</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
