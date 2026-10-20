"use client";

import * as React from "react";
import Link from "next/link";
import { Kanban, MessageSquarePlus } from "lucide-react";
import type { PostStatus, PublicRoadmapItem } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { portalHref } from "../../lib/tenant";
import { PublicRoadmapCard } from "./public-roadmap-card";
import { PublicRoadmapModal } from "./public-roadmap-modal";

export interface PublicRoadmapBoardProps {
  ws: string;
  product: string;
  statuses: PostStatus[];
  items: PublicRoadmapItem[];
}

export function PublicRoadmapBoard({
  ws,
  product,
  statuses,
  items,
}: PublicRoadmapBoardProps): React.JSX.Element {
  const [activeItem, setActiveItem] = React.useState<PublicRoadmapItem | null>(null);

  // Group items by status
  const itemsByStatus = React.useMemo(() => {
    const map = new Map<string, PublicRoadmapItem[]>();
    for (const status of statuses) {
      map.set(status.id, []);
    }
    for (const item of items) {
      const list = map.get(item.statusId);
      if (list) {
        list.push(item);
      } else {
        map.set(item.statusId, [item]);
      }
    }
    return map;
  }, [statuses, items]);

  // Mobile selected status tab (defaults to first status with items, or first status)
  const [selectedMobileStatusId, setSelectedMobileStatusId] = React.useState<string>(() => {
    const firstWithItems = statuses.find((s) => (itemsByStatus.get(s.id)?.length ?? 0) > 0);
    return firstWithItems ? firstWithItems.id : (statuses[0]?.id ?? "");
  });

  const totalItemsCount = items.length;

  if (statuses.length === 0 || (totalItemsCount === 0 && statuses.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-card/50">
        <Kanban className="size-10 text-muted-foreground/60 mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground">No public roadmap yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-5">
          Check back later or share feedback to help shape what we build next.
        </p>
        <Button asChild>
          <Link href={portalHref(ws, product)}>
            <MessageSquarePlus className="size-4 mr-2" aria-hidden="true" />
            <span>View feedback board</span>
          </Link>
        </Button>
      </div>
    );
  }

  const selectedMobileStatus = statuses.find((s) => s.id === selectedMobileStatusId) ?? statuses[0];
  const mobileItems = selectedMobileStatus ? (itemsByStatus.get(selectedMobileStatus.id) ?? []) : [];

  return (
    <div className="w-full">
      {/* Mobile view (< 640px) */}
      <div className="sm:hidden flex flex-col gap-4">
        {/* Mobile Status Pills */}
        <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1 no-scrollbar" role="tablist">
          {statuses.map((status) => {
            const count = itemsByStatus.get(status.id)?.length ?? 0;
            const isSelected = status.id === selectedMobileStatusId;
            return (
              <button
                key={status.id}
                role="tab"
                aria-selected={isSelected}
                type="button"
                onClick={() => setSelectedMobileStatusId(status.id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                  isSelected
                    ? "bg-foreground text-background border-foreground font-semibold"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
                )}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: status.color }}
                />
                <span>{status.name}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    isSelected ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile Items Stack */}
        <div className="flex flex-col gap-3 min-h-[200px]">
          {mobileItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border/80 bg-muted/20">
              <p className="text-sm font-medium text-foreground">Nothing in this stage yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Check back soon for updates.</p>
            </div>
          ) : (
            mobileItems.map((item) => (
              <PublicRoadmapCard
                key={item.id}
                item={item}
                onClick={() => setActiveItem(item)}
              />
            ))
          )}
        </div>
      </div>

      {/* Desktop view (>= 640px) */}
      <div className="hidden sm:flex gap-6 overflow-x-auto pb-6 items-start">
        {statuses.map((status) => {
          const colItems = itemsByStatus.get(status.id) ?? [];
          return (
            <div
              key={status.id}
              className="w-80 shrink-0 flex flex-col gap-3 rounded-xl bg-muted/30 p-3.5 border border-border/60"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: status.color }}
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {status.name}
                  </h3>
                </div>
                <Badge variant="outline" className="text-xs font-normal">
                  {colItems.length}
                </Badge>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-2.5 min-h-[160px]">
                {colItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 p-4 text-center rounded-lg border border-dashed border-border/60 bg-muted/20">
                    <p className="text-xs font-medium text-foreground">
                      Nothing in this stage yet
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Check back soon for updates.
                    </p>
                  </div>
                ) : (
                  colItems.map((item) => (
                    <PublicRoadmapCard
                      key={item.id}
                      item={item}
                      onClick={() => setActiveItem(item)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Item Detail Modal */}
      <PublicRoadmapModal
        open={Boolean(activeItem)}
        onOpenChange={(open) => {
          if (!open) setActiveItem(null);
        }}
        item={activeItem}
        status={activeItem ? statuses.find((s) => s.id === activeItem.statusId) : null}
        ws={ws}
        product={product}
      />
    </div>
  );
}
