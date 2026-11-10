"use client";

import * as React from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import type { PublicChangelogEntry, RichTextDoc } from "@userhq/types";
import { isRtl } from "@userhq/types";
import { RichTextViewer } from "../rich-text/rich-text-viewer";
import { EntityLogo } from "../entity-logo";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n/context";

export interface ChangelogTimelineItemProps {
  entry: PublicChangelogEntry;
  ws: string;
  product: string;
  productName: string;
  productLogoUrl?: string | null;
  defaultExpanded?: boolean;
  className?: string;
}

export function getChangelogTagClasses(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower === "new") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20";
  }
  if (lower === "improved") {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20";
  }
  if (lower === "fixed") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20";
  }
  return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20";
}

export function isContentExpandable(doc: RichTextDoc | null | undefined): boolean {
  if (!doc?.content || doc.content.length === 0) return false;
  if (doc.content.length > 2) return true;
  let charCount = 0;
  for (const block of doc.content) {
    if (block.text) charCount += block.text.length;
    if (block.content) {
      for (const child of block.content) {
        if (child.text) charCount += child.text.length;
      }
    }
  }
  return charCount > 300;
}

export function ChangelogTimelineItem({
  entry,
  ws,
  product,
  productName,
  productLogoUrl,
  defaultExpanded = false,
  className,
}: ChangelogTimelineItemProps): React.JSX.Element {
  const { currentLocale, contentDefaultLocale, t } = useI18n();
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const displayTitle = entry.title;
  const displayContent = entry.content;
  const isFallback = Boolean(("isFallback" in (entry ?? {})) && (entry as { isFallback?: boolean }).isFallback);
  const textDir = isRtl((entry as { resolvedLocale?: string } | undefined)?.resolvedLocale ?? contentDefaultLocale) ? "rtl" : "ltr";

  const expandable = isContentExpandable(displayContent);

  const formattedDate = React.useMemo(() => {
    return formatDate(entry.publishedAt, currentLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [entry.publishedAt, currentLocale]);

  const handleCopyLink = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const permalink = `${origin}/${ws}/${product}/changelog/${entry.slug}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(permalink);
      }
    } catch {
      // ignore clipboard error in unpermitted contexts
    }
    toast(t("changelog.linkCopied"));
  };

  return (
    <article className={cn("relative -ml-6 sm:-ml-8 pl-6 sm:pl-8", className)}>
      {/* Vertical line connector node */}
      <span
        aria-hidden="true"
        className="absolute -left-[9px] top-1.5 size-4 rounded-full bg-background border-2 border-primary ring-4 ring-background"
      />

      {/* Header row: date, tag pills, permalink copy */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <time
          dateTime={entry.publishedAt}
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          {formattedDate}
        </time>

        {entry.tags.map((tag) => (
          <span
            key={tag.id}
            className={cn(
              "inline-flex items-center h-5 px-2 rounded-full text-xs font-semibold",
              getChangelogTagClasses(tag.name)
            )}
          >
            {tag.name}
          </span>
        ))}

        {isFallback && (
          <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-normal">
            {t("ui.original")}
          </span>
        )}

        <button
          type="button"
          onClick={handleCopyLink}
          aria-label={t("ui.copyLink")}
          title={t("ui.copyLink")}
          className="size-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-auto sm:ml-0"
        >
          <Share2 className="size-3.5" />
        </button>
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight mb-3">
        <Link
          href={`/${ws}/${product}/changelog/${entry.slug}`}
          dir={textDir}
          className="hover:underline hover:text-[var(--primary-text)] transition-colors"
        >
          {displayTitle}
        </Link>
      </h2>

      {/* Body: inline expansion toggle */}
      {expandable ? (
        <div dir={textDir}>
          <div
            className={cn(
              "relative",
              !expanded && "max-h-48 overflow-hidden mask-fade-bottom"
            )}
          >
            <RichTextViewer content={displayContent} />
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-semibold text-[var(--primary-text)] hover:underline flex items-center gap-1 mt-2 cursor-pointer"
          >
            {expanded ? `${t("ui.showLess")} ↑` : `${t("ui.readMore")} ↓`}
          </button>
        </div>
      ) : (
        <div dir={textDir}>
          <RichTextViewer content={displayContent} />
        </div>
      )}

      {/* Footer: brand attribution (D-14) */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/40">
        <EntityLogo src={productLogoUrl} name={productName} size={20} />
        <span className="text-xs text-muted-foreground font-medium">
          Published by {productName}
        </span>
      </div>
    </article>
  );
}
