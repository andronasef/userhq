"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";
import {
  PublicChangelogFeedResponseSchema,
  type PublicChangelogEntry,
} from "@userhq/types";
import { EmptyState } from "../empty-state";
import { Button } from "../ui/button";
import { apiFetch } from "../../lib/api-client";
import { ChangelogTimelineItem } from "./changelog-timeline-item";

export interface ChangelogFeedProps {
  ws: string;
  product: string;
  productName: string;
  productLogoUrl?: string | null;
  entries: PublicChangelogEntry[];
  nextCursor?: string | null;
}

export function ChangelogFeed({
  ws,
  product,
  productName,
  productLogoUrl,
  entries: initialEntries,
  nextCursor: initialCursor = null,
}: ChangelogFeedProps): React.JSX.Element {
  const [entries, setEntries] = React.useState(initialEntries);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await apiFetch(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/changelog?cursor=${encodeURIComponent(cursor)}`,
        { schema: PublicChangelogFeedResponseSchema }
      );
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.entries.filter((e) => !seen.has(e.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone className="size-6 text-muted-foreground" />}
        title="No updates published yet"
        body="Check back soon for announcements, new features, and improvements."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="relative pl-6 sm:pl-8 border-l border-border space-y-12 sm:space-y-16">
        {entries.map((entry) => (
          <ChangelogTimelineItem
            key={entry.id}
            entry={entry}
            ws={ws}
            product={product}
            productName={productName}
            productLogoUrl={productLogoUrl}
          />
        ))}
      </div>

      {cursor && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load older updates"}
          </Button>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              Couldn't load more updates. Try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
