"use client";

import * as React from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import type { PublicChangelogEntry, AdminChangelogEntry } from "@userhq/types";
import { RichTextViewer } from "../rich-text/rich-text-viewer";
import { EntityLogo } from "../entity-logo";
import { getChangelogTagClasses } from "./changelog-timeline-item";
import { cn } from "../../lib/utils";

export interface ChangelogArticleProps {
  ws: string;
  product: string;
  productName: string;
  productLogoUrl?: string | null;
  entry: PublicChangelogEntry | AdminChangelogEntry;
  className?: string;
}

export function ChangelogArticle({
  ws,
  product,
  productName,
  productLogoUrl,
  entry,
  className,
}: ChangelogArticleProps): React.JSX.Element {
  const formattedDate = React.useMemo(() => {
    if (!entry.publishedAt) return "Unscheduled draft";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(entry.publishedAt));
    } catch {
      return entry.publishedAt;
    }
  }, [entry.publishedAt]);

  const handleCopyLink = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const permalink = `${origin}/${ws}/${product}/changelog/${entry.slug}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(permalink);
      }
    } catch {
      // ignore clipboard error
    }
    toast("Link copied to clipboard");
  };

  return (
    <div className={cn("max-w-3xl mx-auto px-4 sm:px-6 py-10", className)}>
      {/* Top breadcrumb */}
      <Link
        href={`/${ws}/${product}/changelog`}
        className="text-sm font-medium text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 transition-colors"
      >
        ← All updates
      </Link>

      {/* Header: formatted date, tag badges, permalink copy */}
      <div className="flex flex-wrap items-center gap-2">
        <time
          dateTime={entry.publishedAt ?? undefined}
          className="text-sm font-medium text-muted-foreground"
        >
          {formattedDate}
        </time>

        {entry.tags.length > 0 && (
          <span className="text-muted-foreground text-xs" aria-hidden="true">
            •
          </span>
        )}

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

        <button
          type="button"
          onClick={handleCopyLink}
          aria-label="Copy link"
          title="Copy link"
          className="size-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-auto sm:ml-0"
        >
          <Share2 className="size-3.5" />
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mt-3 mb-4">
        {entry.title}
      </h1>

      {/* Brand row: product logo with {productName} team */}
      <div className="flex items-center gap-2">
        <EntityLogo src={productLogoUrl} name={productName} size={24} />
        <span className="text-sm font-medium text-foreground">
          {productName} team
        </span>
      </div>

      {/* Divider */}
      <div className="border-b border-border my-6" />

      {/* Article Body */}
      <RichTextViewer content={entry.content} className="text-base" />

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-border flex items-center justify-between">
        <Link
          href={`/${ws}/${product}/changelog`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          ← Back to changelog
        </Link>
      </div>
    </div>
  );
}
