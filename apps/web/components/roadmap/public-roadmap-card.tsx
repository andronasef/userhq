"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import type { PublicRoadmapItem } from "@userhq/types";
import { isRtl } from "@userhq/types";
import { PlainText } from "../plain-text";
import { useI18n } from "../../lib/i18n/context";

export interface PublicRoadmapCardProps {
  item: PublicRoadmapItem;
  onClick: () => void;
}

export function PublicRoadmapCard({
  item,
  onClick,
}: PublicRoadmapCardProps): React.JSX.Element {
  const { contentDefaultLocale, t } = useI18n();

  const displayTitle = item.title;
  const displayDescription = item.description;
  const isFallback = Boolean(("isFallback" in (item ?? {})) && (item as { isFallback?: boolean }).isFallback);
  const textDir = isRtl((item as { resolvedLocale?: string } | undefined)?.resolvedLocale ?? contentDefaultLocale) ? "rtl" : "ltr";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 bg-card rounded-lg border border-border hover:border-foreground/20 hover:shadow-xs transition-all flex flex-col gap-2.5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          dir={textDir}
          className="text-sm font-semibold text-foreground line-clamp-2 leading-snug flex-1"
        >
          {displayTitle}
        </h3>
        {isFallback && (
          <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-normal shrink-0">
            {t("ui.original")}
          </span>
        )}
      </div>

      {displayDescription && (
        <div dir={textDir} className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          <PlainText text={displayDescription} />
        </div>
      )}

      {item.postCount > 0 && (
        <div className="mt-1 pt-2 border-t border-border/60 flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {item.postCount} {item.postCount === 1 ? "idea" : "ideas"}
          </span>
        </div>
      )}
    </button>
  );
}
