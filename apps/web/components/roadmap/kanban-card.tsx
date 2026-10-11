"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Globe, Lock, Link2, Calendar } from "lucide-react";
import type { AdminRoadmapItem } from "@userhq/types";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { cn } from "../../lib/utils";

export interface KanbanCardProps {
  item: AdminRoadmapItem;
  index: number;
  onSelect: (item: AdminRoadmapItem) => void;
}

export function KanbanCard({ item, index, onSelect }: KanbanCardProps) {
  const { ref, isDragging } = useSortable({
    id: item.id,
    index,
    group: item.statusId,
  });

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const deadlineDisplay =
    item.deadlineText ||
    (item.deadlineDate
      ? new Date(item.deadlineDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null);

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="button"
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={cn(
        "rounded-lg border border-border bg-background p-3 flex flex-col gap-2 shadow-sm hover:border-foreground/25 cursor-grab active:cursor-grabbing transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "shadow-lg ring-2 ring-primary/40 opacity-70 z-20"
      )}
    >
      {/* Top Row: Privacy and Linked Posts */}
      <div className="flex items-center justify-between gap-2">
        {item.isPublic ? (
          <Badge
            variant="outline"
            className="gap-1 text-[11px] font-normal text-muted-foreground border-border py-0 h-5"
          >
            <Globe className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Public</span>
          </Badge>
        ) : (
          <Badge
            variant="neutral"
            className="gap-1 text-[11px] font-normal text-muted-foreground py-0 h-5"
          >
            <Lock className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Internal</span>
          </Badge>
        )}

        {item.linkedPostCount > 0 && (
          <Badge
            variant="neutral"
            className="gap-1 text-[11px] font-normal text-muted-foreground py-0 h-5"
            title={`${item.linkedPostCount} linked feedback ${item.linkedPostCount === 1 ? "post" : "posts"}`}
          >
            <Link2 className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>
              {item.linkedPostCount} {item.linkedPostCount === 1 ? "post" : "posts"}
            </span>
          </Badge>
        )}
      </div>

      {/* Card Title */}
      <h3
        className="text-sm font-semibold text-foreground line-clamp-2 break-words"
        title={item.internalTitle}
      >
        {item.internalTitle}
      </h3>

      {/* Bottom Row: Deadline and Assignee */}
      {(deadlineDisplay || item.assignee?.name) && (
        <div className="flex items-center justify-between gap-2 mt-1 text-xs text-muted-foreground">
          {deadlineDisplay ? (
            <div className="flex items-center gap-1.5 truncate text-[11px]">
              <Calendar className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="truncate">{deadlineDisplay}</span>
            </div>
          ) : (
            <div />
          )}

          {item.assignee?.name && (
            <div className="shrink-0" title={`Assigned to ${item.assignee?.name}`}>
              <Avatar className="size-5 text-[10px]">
                <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                  {getInitials(item.assignee?.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
