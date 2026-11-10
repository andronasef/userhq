"use client";

import * as React from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import type { ProductFeatures } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useI18n } from "../../lib/i18n/context";

export function HiddenModuleNotice({ ws, product, module }: {
  ws: string;
  product: string;
  module: keyof ProductFeatures;
}): React.JSX.Element {
  const { t } = useI18n();

  const noticeCopy: Record<keyof ProductFeatures, string> = {
    board: t("hiddenModule.board"),
    roadmap: t("hiddenModule.roadmap"),
    changelog: t("hiddenModule.changelog"),
    faq: t("hiddenModule.faq"),
  };

  return (
    <div role="status" className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-muted p-4 sm:flex-row sm:items-center sm:gap-4">
      <Badge variant="outline" className="self-start bg-card">
        <EyeOff className="size-3 mr-1" aria-hidden />
        {t("hiddenModule.badge")}
      </Badge>
      <p className="text-sm text-foreground sm:flex-1">{noticeCopy[module]}</p>
      <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
        <Link href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/settings#portal-features`}>{t("hiddenModule.turnOnInSettings")}</Link>
      </Button>
    </div>
  );
}
