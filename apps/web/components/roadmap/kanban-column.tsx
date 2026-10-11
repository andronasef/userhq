"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/react";
import { Plus, Eye, EyeOff } from "lucide-react";
import type { Status, AdminRoadmapItem } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { KanbanCard } from "./kanban-card";
import { cn } from "../../lib/utils";

export interface KanbanColumnProps {
  status: Status;
  items: AdminRoadmapItem[];
  onAddItem: (statusId: string) => void;
  onSelectItem: (item: AdminRoadmapItem) => void;
}

export function KanbanColumn({
  status,
  items,
  onAddItem,
  onSelectItem,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: status.id,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "w-[300px] shrink-0 rounded-lg bg-muted/40 border border-border p-3 flex flex-col gap-3 min-h-[500px] transition-colors",
        isDropTarget && "bg-muted/70 ring-1 ring-primary/30"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: status.color }}
            aria-hidden="true"
          />
          <h2
            className="text-sm font-semibold text-foreground truncate"
            title={status.name}
          >
            {status.name}
          </h2>
          <Badge variant="neutral" className="px-1.5 py-0 h-5 text-xs tabular-nums">
            {items.length}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            title={
              status.isPublicRoadmap
                ? "Public column (shown on customer roadmap)"
                : "Internal column (hidden from customer roadmap)"
            }
          >
            {status.isPublicRoadmap ? (
              <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <EyeOff className="size-3.5 text-muted-foreground/40" aria-hidden="true" />
            )}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onAddItem(status.id)}
            className="size-7 text-muted-foreground hover:text-foreground"
            aria-label={`Add item to ${status.name}`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Cards Area */}
      <div className="flex flex-col gap-2.5 flex-1 min-h-[100px]">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border/70 rounded-md p-6 text-center text-xs text-muted-foreground">
            <span>No items in this stage</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onAddItem(status.id)}
              className="mt-1 text-xs text-muted-foreground hover:text-foreground h-auto p-0"
            >
              + Add item
            </Button>
          </div>
        ) : (
          items.map((item, idx) => (
            <KanbanCard
              key={item.id}
              item={item}
              index={idx}
              onSelect={onSelectItem}
            />
          ))
        )}
      </div>
    </div>
  );
}
