"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";

export interface SignInPromptProps {
  postHref: string;
}

export function SignInPrompt({ postHref }: SignInPromptProps): React.JSX.Element {
  const { t } = useI18n();
  const signInHref = `/login?next=${encodeURIComponent(`${postHref}#comment`)}`;

  return (
    <div className="rounded-lg border border-border p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-foreground">
        {t("ui.signInToJoin")}
      </p>
      <Button variant="outline" asChild>
        <Link href={signInHref}>
          {t("ui.signInToComment")}
        </Link>
      </Button>
    </div>
  );
}
