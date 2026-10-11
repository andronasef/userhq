"use client";

import * as React from "react";
import type { PostStatus, PublicRoadmapItem } from "@userhq/types";
import { PublicRoadmapBoard } from "@/components/roadmap/public-roadmap-board";

export interface PublicRoadmapViewProps {
  ws: string;
  product: string;
  productName: string;
  statuses: PostStatus[];
  items: PublicRoadmapItem[];
}

export function PublicRoadmapView({
  ws,
  product,
  statuses,
  items,
}: PublicRoadmapViewProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Roadmap
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What we're working on and what's coming next.
        </p>
      </div>

      <PublicRoadmapBoard
        ws={ws}
        product={product}
        statuses={statuses}
        items={items}
      />
    </div>
  );
}
