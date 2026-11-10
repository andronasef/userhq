"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useI18n } from "../../lib/i18n/context";

export interface FaqNotFoundPromptProps {
  ws: string;
  product: string;
  boardEnabled: boolean;
  query?: string;
  className?: string;
}

export function FaqNotFoundPrompt({
  ws,
  product,
  boardEnabled,
  query,
  className,
}: FaqNotFoundPromptProps): React.JSX.Element | null {
  const { t } = useI18n();
  const trimmed = query?.trim() ?? "";
  if (!boardEnabled) {
    if (!trimmed) return null;
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
        <h3 className="text-base font-semibold text-foreground">{t("faq.noMatches")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("faq.tryDifferentWords")}</p>
      </div>
    );
  }
  const href = trimmed
    ? `/${ws}/${product}?new=true&title=${encodeURIComponent(trimmed)}`
    : `/${ws}/${product}?new=true`;

  return (
    <div
      className={cn(
        "p-6 rounded-lg border border-border bg-muted/30 text-center flex flex-col items-center gap-3 w-full",
        className
      )}
    >
      <MessageSquarePlus className="size-8 text-[var(--primary-text)]" aria-hidden="true" />
      <div>
        <h3 className="text-base font-semibold text-foreground">
          {t("faq.didntFind")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("faq.submitIdeaPrompt")}
        </p>
      </div>
      <Button asChild variant="default">
        <Link href={href}>{t("faq.postToBoard")}</Link>
      </Button>
    </div>
  );
}
