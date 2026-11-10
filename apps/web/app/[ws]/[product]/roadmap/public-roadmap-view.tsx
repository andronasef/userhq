"use client";

import * as React from "react";
import type { PostStatus, PublicRoadmapItem } from "@userhq/types";
import { PublicRoadmapBoard } from "@/components/roadmap/public-roadmap-board";
import { useI18n } from "@/lib/i18n/context";

export interface PublicRoadmapViewProps {
  ws: string;
  product: string;
  productName: string;
  statuses: PostStatus[];
  items: PublicRoadmapItem[];
  boardEnabled: boolean;
}

export function PublicRoadmapView({
  ws,
  product,
  statuses,
  items,
  boardEnabled,
}: PublicRoadmapViewProps): React.JSX.Element {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("nav.roadmap")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("roadmap.subtitle")}
        </p>
      </div>

      <PublicRoadmapBoard
        ws={ws}
        product={product}
        statuses={statuses}
        items={items}
        boardEnabled={boardEnabled}
      />
    </div>
  );
}
