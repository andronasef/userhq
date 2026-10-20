"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type {
  AdminRoadmapItem,
  Status,
  MemberRow,
  ProductDetail,
} from "@userhq/types";
import { PageHeader } from "../../../../../components/page-header";
import { TabNav } from "../../../../../components/tab-nav";
import { Button } from "../../../../../components/ui/button";
import { NativeSelect } from "../../../../../components/ui/native-select";
import { KanbanBoard } from "../../../../../components/roadmap/kanban-board";
import { PublicColumnsPopover } from "../../../../../components/roadmap/public-columns-popover";
import { RoadmapItemModal } from "../../../../../components/roadmap/roadmap-item-modal";

export interface RoadmapViewProps {
  ws: string;
  product: ProductDetail;
  initialStatuses: Status[];
  initialMembers: MemberRow[];
  initialItems: AdminRoadmapItem[];
  initialItemId?: string;
  initialLinkPostNumber?: number;
  tabs?: Array<{ label: string; href: string }>;
  activeHref?: string;
}

export function RoadmapView({
  ws,
  product,
  initialStatuses,
  initialMembers,
  initialItems,
  initialItemId,
  initialLinkPostNumber,
  tabs,
  activeHref,
}: RoadmapViewProps) {
  const [statuses, setStatuses] = React.useState<Status[]>(initialStatuses);
  const [items, setItems] = React.useState<AdminRoadmapItem[]>(initialItems);
  const [selectedAssigneeId, setSelectedAssigneeId] = React.useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createDefaultStatusId, setCreateDefaultStatusId] = React.useState<string | undefined>(undefined);
  const [editingItem, setEditingItem] = React.useState<AdminRoadmapItem | null>(() => {
    if (initialItemId) {
      return initialItems.find((i) => i.id === initialItemId) ?? null;
    }
    return null;
  });
  const [prelinkedPost, setPrelinkedPost] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (initialLinkPostNumber && !isCreateOpen) {
      import("../../../../../lib/api-client").then(({ apiFetch }) => {
        apiFetch<any>(
          `/api/v1/workspaces/${ws}/products/${product.slug}/roadmap/search-posts?q=${initialLinkPostNumber}`
        ).then((res) => {
          const match = res.posts?.find((p: any) => p.number === initialLinkPostNumber);
          if (match) {
            setPrelinkedPost(match);
            setIsCreateOpen(true);
          }
        }).catch(() => {});
      });
    }
  }, [initialLinkPostNumber, ws, product.slug]);

  const handleAddItem = (statusId: string) => {
    setCreateDefaultStatusId(statusId);
    setIsCreateOpen(true);
  };

  const handleSelectItem = (item: AdminRoadmapItem) => {
    setEditingItem(item);
  };

  const handleItemSaved = (saved: AdminRoadmapItem) => {
    setItems((prev) => {
      const exists = prev.some((it) => it.id === saved.id);
      if (exists) {
        return prev.map((it) => (it.id === saved.id ? saved : it));
      }
      return [...prev, saved];
    });
  };

  const handleItemDeleted = (deletedId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== deletedId));
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Roadmap"
        description="Plan internal milestones and choose what appears on the public roadmap."
        action={
          <Button onClick={() => handleAddItem(statuses[0]?.id ?? "")} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            <span>New item</span>
          </Button>
        }
      />

      {tabs && activeHref && (
        <TabNav tabs={tabs} activeHref={activeHref} className="mb-6" />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="filter-assignee" className="sr-only">
            Filter by assignee
          </label>
          <NativeSelect
            id="filter-assignee"
            value={selectedAssigneeId ?? ""}
            onChange={(e) => setSelectedAssigneeId(e.target.value || null)}
            className="w-44 text-sm"
          >
            <option value="">All assignees</option>
            {initialMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.email}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-2">
          <PublicColumnsPopover
            ws={ws}
            product={product.slug}
            statuses={statuses}
            onStatusesChange={setStatuses}
          />
        </div>
      </div>

      {/* Board */}
      <KanbanBoard
        ws={ws}
        product={product.slug}
        statuses={statuses}
        items={items}
        selectedAssigneeId={selectedAssigneeId}
        onAddItem={handleAddItem}
        onSelectItem={handleSelectItem}
        onItemsChange={setItems}
      />

      {/* Create Modal */}
      {isCreateOpen && (
        <RoadmapItemModal
          ws={ws}
          product={product.slug}
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          statuses={statuses}
          members={initialMembers}
          defaultStatusId={createDefaultStatusId}
          prelinkedPost={prelinkedPost}
          onSaved={handleItemSaved}
        />
      )}

      {/* Edit Modal */}
      {editingItem && (
        <RoadmapItemModal
          ws={ws}
          product={product.slug}
          item={editingItem}
          open={Boolean(editingItem)}
          onOpenChange={(open) => {
            if (!open) setEditingItem(null);
          }}
          statuses={statuses}
          members={initialMembers}
          onSaved={handleItemSaved}
          onDeleted={handleItemDeleted}
        />
      )}
    </div>
  );
}
