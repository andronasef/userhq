import * as React from "react";
import Link from "next/link";
import { Kanban, ArrowRight } from "lucide-react";
import type { PostRoadmapItemRef } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export interface LinkedRoadmapBannerProps {
  ws: string;
  product: string;
  roadmapItem?: PostRoadmapItemRef | null;
  statusName?: string;
  statusColor?: string;
  variant?: "admin" | "portal";
}

export function LinkedRoadmapBanner({
  ws,
  product,
  roadmapItem,
  statusName,
  statusColor,
  variant = "portal",
}: LinkedRoadmapBannerProps): React.JSX.Element | null {
  if (!roadmapItem) {
    return null;
  }

  if (variant === "admin") {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-primary/25 bg-primary/5 text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <Kanban className="size-4 text-primary shrink-0" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-foreground">
              Linked to roadmap item:{" "}
              <strong className="font-semibold text-foreground">
                {roadmapItem.title}
              </strong>
            </span>
            {statusName && (
              <Badge variant="outline" className="text-xs">
                {statusColor && (
                  <span
                    className="size-2 rounded-full mr-1.5 shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                )}
                {statusName}
              </Badge>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="shrink-0 text-primary hover:text-primary gap-1 -ml-2 sm:ml-0 w-fit"
        >
          <Link
            href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/roadmap?item=${encodeURIComponent(roadmapItem.id)}`}
          >
            <span>View on roadmap</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-muted/40 text-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <Kanban className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="text-foreground">
          This idea is on our roadmap:{" "}
          <strong className="font-semibold text-foreground">
            {roadmapItem.title}
          </strong>
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        asChild
        className="shrink-0 text-primary hover:text-primary gap-1 -ml-2 sm:ml-0 w-fit"
      >
        <Link href={`/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/roadmap`}>
          <span>View public roadmap</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
