import * as React from "react";
import { Megaphone } from "lucide-react";
import type { PublicChangelogEntry } from "@userhq/types";
import { EmptyState } from "../empty-state";
import { ChangelogTimelineItem } from "./changelog-timeline-item";

export interface ChangelogFeedProps {
  ws: string;
  product: string;
  productName: string;
  productLogoUrl?: string | null;
  entries: PublicChangelogEntry[];
}

export function ChangelogFeed({
  ws,
  product,
  productName,
  productLogoUrl,
  entries,
}: ChangelogFeedProps): React.JSX.Element {
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
  );
}
