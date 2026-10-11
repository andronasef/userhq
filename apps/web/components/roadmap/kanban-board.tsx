"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { toast } from "sonner";
import {
  generateKeyBetween,
  type AdminRoadmapItem,
  type Status,
} from "@userhq/types";
import { KanbanColumn } from "./kanban-column";
import { apiFetch } from "../../lib/api-client";

export interface KanbanBoardProps {
  ws: string;
  product: string;
  statuses: Status[];
  items: AdminRoadmapItem[];
  selectedAssigneeId: string | null;
  onItemsChange: (items: AdminRoadmapItem[]) => void;
  onAddItem: (statusId: string) => void;
  onSelectItem: (item: AdminRoadmapItem) => void;
}

export function KanbanBoard({
  ws,
  product,
  statuses,
  items,
  selectedAssigneeId,
  onItemsChange,
  onAddItem,
  onSelectItem,
}: KanbanBoardProps) {
  // Filter items by assignee if an assignee filter is selected
  const displayedItems = React.useMemo(() => {
    if (!selectedAssigneeId) return items;
    return items.filter((item) => item.assignee?.id === selectedAssigneeId);
  }, [items, selectedAssigneeId]);

  // Group items by statusId and sort by rank ascending
  const itemsByStatus = React.useMemo(() => {
    const map = new Map<string, AdminRoadmapItem[]>();
    for (const status of statuses) {
      map.set(status.id, []);
    }
    for (const item of displayedItems) {
      const list = map.get(item.statusId);
      if (list) {
        list.push(item);
      }
    }
    // Sort each list by rank
    for (const list of map.values()) {
      list.sort((a, b) => a.rank.localeCompare(b.rank));
    }
    return map;
  }, [statuses, displayedItems]);

  const handleDragEnd = async (event: any) => {
    if (event.canceled) return;

    const { source, target } = event.operation;
    if (!source || !target) return;

    const sourceItemId = String(source.id);
    const draggedItem = items.find((it) => it.id === sourceItemId);
    if (!draggedItem) return;

    // Determine target status
    let targetStatusId: string;
    const targetStatus = statuses.find((s) => s.id === target.id);
    if (targetStatus) {
      // Dropped on column container
      targetStatusId = targetStatus.id;
    } else if (target.group) {
      // Dropped on a card in a group
      targetStatusId = target.group;
    } else {
      // Fallback
      targetStatusId = draggedItem.statusId;
    }

    // Get current items in destination column excluding the dragged item
    const destItems = items
      .filter((it) => it.statusId === targetStatusId && it.id !== sourceItemId)
      .sort((a, b) => a.rank.localeCompare(b.rank));

    let targetIndex: number;
    if (targetStatus) {
      // Dropped on column -> place at the end
      targetIndex = destItems.length;
    } else if (typeof target.index === "number") {
      targetIndex = target.index;
    } else {
      targetIndex = destItems.length;
    }

    // Calculate new LexoRank
    let newRank: string;
    if (destItems.length === 0) {
      newRank = generateKeyBetween(null, null);
    } else if (targetIndex <= 0) {
      newRank = generateKeyBetween(null, destItems[0].rank);
    } else if (targetIndex >= destItems.length) {
      newRank = generateKeyBetween(destItems[destItems.length - 1].rank, null);
    } else {
      const prevRank = destItems[targetIndex - 1].rank;
      const nextRank = destItems[targetIndex].rank;
      newRank = generateKeyBetween(prevRank, nextRank);
    }

    // If no change in status or rank, do nothing
    if (
      draggedItem.statusId === targetStatusId &&
      draggedItem.rank === newRank
    ) {
      return;
    }

    // Optimistic state update
    const previousItems = [...items];
    const updatedItems = items.map((it) =>
      it.id === sourceItemId
        ? { ...it, statusId: targetStatusId, rank: newRank }
        : it
    );
    onItemsChange(updatedItems);

    try {
      await apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/roadmap/${sourceItemId}/move`,
        {
          method: "PATCH",
          body: {
            statusId: targetStatusId,
            targetRank: newRank,
          },
        }
      );
    } catch {
      // Rollback on failure
      onItemsChange(previousItems);
      toast.error("Couldn't move item. Check your connection and try again.");
    }
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[calc(100vh-16rem)]">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            items={itemsByStatus.get(status.id) ?? []}
            onAddItem={onAddItem}
            onSelectItem={onSelectItem}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}
