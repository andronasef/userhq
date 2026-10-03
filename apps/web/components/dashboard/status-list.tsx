"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { GripVertical, Ellipsis } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  type Status,
  type StatusType,
  StatusSchema,
} from "@userhq/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Field } from "../ui/field";
import { NativeSelect } from "../ui/native-select";
import { StatusDialog } from "./status-dialog";
import { apiFetch } from "../../lib/api-client";
import { cn } from "../../lib/utils";

export interface SortableStatusListProps {
  ws: string;
  product: string;
  initial: Status[];
}

const TYPE_LABELS: Record<StatusType, string> = {
  review: "Review",
  planned: "Planned",
  active: "In Progress",
  completed: "Completed",
  closed: "Closed",
};

interface StatusRowProps {
  status: Status;
  index: number;
  total: number;
  ws: string;
  product: string;
  onEdit: (status: Status) => void;
  onMakeDefault: (status: Status) => void;
  onDelete: (status: Status) => void;
}

function StatusRow({
  status,
  index,
  total,
  onEdit,
  onMakeDefault,
  onDelete,
}: StatusRowProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: status.id,
    index,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-4 h-14 px-4 bg-background transition-shadow",
        isDragging && "shadow-md ring-1 ring-border z-10"
      )}
    >
      <button
        type="button"
        ref={handleRef}
        aria-label={`Reorder ${status.name}`}
        className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing hover:bg-muted shrink-0"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <span
        className="size-3 rounded-full shrink-0 border border-border"
        style={{ backgroundColor: status.color }}
        aria-hidden="true"
      />

      <span
        className="text-sm font-semibold text-foreground truncate flex-1 min-w-0"
        title={status.name}
      >
        {status.name}
      </span>

      <Badge variant="outline" className="shrink-0">
        {TYPE_LABELS[status.type] ?? status.type}
      </Badge>

      {status.isDefault && (
        <Badge variant="neutral" className="shrink-0 font-normal">
          Default
        </Badge>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Actions for ${status.name}`}
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(status)}>
            Edit status
          </DropdownMenuItem>

          {!status.isDefault && (
            <DropdownMenuItem onClick={() => onMakeDefault(status)}>
              Make default
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {status.isDefault ? (
            <div className="px-2 py-1.5 cursor-not-allowed opacity-50 select-none">
              <div className="text-sm text-destructive font-medium">
                Delete status
              </div>
              <div className="text-xs text-muted-foreground">
                The default status can&apos;t be deleted
              </div>
            </div>
          ) : total <= 1 ? (
            <div className="px-2 py-1.5 cursor-not-allowed opacity-50 select-none">
              <div className="text-sm text-destructive font-medium">
                Delete status
              </div>
              <div className="text-xs text-muted-foreground">
                A product needs at least one status
              </div>
            </div>
          ) : (
            <DropdownMenuItem
              onClick={() => onDelete(status)}
              className="text-destructive focus:text-destructive"
            >
              Delete status
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SortableStatusList({
  ws,
  product,
  initial,
}: SortableStatusListProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<Status[]>(initial);
  const [announcement, setAnnouncement] = React.useState<string>("");

  const [editingStatus, setEditingStatus] = React.useState<Status | null>(null);
  const [deletingStatus, setDeletingStatus] = React.useState<Status | null>(
    null
  );
  const [moveTargetId, setMoveTargetId] = React.useState<string>("");

  const confirmedItemsRef = React.useRef<Status[]>(initial);
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  React.useEffect(() => {
    setItems(initial);
    confirmedItemsRef.current = initial;
  }, [initial]);

  const handleMakeDefault = async (status: Status) => {
    try {
      const updated = await apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/statuses/${status.id}/default`,
        {
          method: "PUT",
          schema: z.array(StatusSchema),
        }
      );
      setItems(updated);
      confirmedItemsRef.current = updated;
      toast.success(`New posts will start in ${status.name}`);
      router.refresh();
    } catch {
      toast.error("Couldn't update default status.");
    }
  };

  const openDeleteDialog = (status: Status) => {
    const defaultStatus = items.find((s) => s.isDefault && s.id !== status.id);
    const fallbackTarget = items.find((s) => s.id !== status.id);
    setMoveTargetId(defaultStatus?.id ?? fallbackTarget?.id ?? "");
    setDeletingStatus(status);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStatus || !moveTargetId) return;
    const name = deletingStatus.name;
    await apiFetch(
      `/api/v1/workspaces/${ws}/products/${product}/statuses/${deletingStatus.id}?moveTo=${moveTargetId}`,
      { method: "DELETE" }
    );
    toast.success(`${name} deleted`);
    setItems((prev) => prev.filter((s) => s.id !== deletingStatus.id));
    setDeletingStatus(null);
    document.querySelector("h1")?.focus();
    router.refresh();
  };

  return (
    <>
      <div aria-live="assertive" className="sr-only">
        {announcement}
      </div>

      <DragDropProvider
        onDragStart={(event) => {
          const { source } = event.operation;
          if (isSortable(source)) {
            const currentItem = items[source.index];
            if (currentItem) {
              setAnnouncement(
                `Picked up ${currentItem.name}. Position ${source.index + 1} of ${items.length}.`
              );
            }
          }
        }}
        onDragOver={(event) => {
          const { source } = event.operation;
          if (isSortable(source)) {
            const currentItem = items[source.initialIndex];
            if (currentItem) {
              setAnnouncement(
                `${currentItem.name} moved to position ${source.index + 1} of ${items.length}.`
              );
            }
          }
        }}
        onDragEnd={(event) => {
          if (event.canceled) {
            setAnnouncement("Reorder canceled.");
            return;
          }
          const { source } = event.operation;
          if (isSortable(source)) {
            const movedItem = items[source.initialIndex];
            if (movedItem) {
              setAnnouncement(
                `${movedItem.name} dropped at position ${source.index + 1} of ${items.length}.`
              );
            }
            if (source.initialIndex !== source.index) {
              const next = [...items];
              const [m] = next.splice(source.initialIndex, 1);
              next.splice(source.index, 0, m);
              setItems(next);

              saveQueueRef.current = saveQueueRef.current
                .then(async () => {
                  const updated = await apiFetch(
                    `/api/v1/workspaces/${ws}/products/${product}/statuses/order`,
                    {
                      method: "PUT",
                      body: { ids: next.map((s) => s.id) },
                      schema: z.array(StatusSchema),
                    }
                  );
                  confirmedItemsRef.current = updated;
                })
                .catch(() => {
                  setItems(confirmedItemsRef.current);
                  toast.error("Couldn't save the new order. Try again.");
                });
            }
          }
        }}
      >
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {items.map((status, index) => (
            <StatusRow
              key={status.id}
              status={status}
              index={index}
              total={items.length}
              ws={ws}
              product={product}
              onEdit={(s) => setEditingStatus(s)}
              onMakeDefault={handleMakeDefault}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      </DragDropProvider>

      {editingStatus && (
        <StatusDialog
          mode="edit"
          status={editingStatus}
          open={!!editingStatus}
          onOpenChange={(open) => {
            if (!open) setEditingStatus(null);
          }}
          onSaved={(saved) => {
            setItems((prev) =>
              prev.map((s) => (s.id === saved.id ? saved : s))
            );
            router.refresh();
          }}
          ws={ws}
          product={product}
        />
      )}

      <ConfirmDialog
        open={!!deletingStatus}
        onOpenChange={(open) => {
          if (!open) setDeletingStatus(null);
        }}
        title={`Delete ${deletingStatus?.name}?`}
        description="Posts in this status will move to the status you choose."
        dismissLabel="Keep status"
        confirmLabel="Delete status"
        pendingLabel="Deleting…"
        confirmDisabled={!moveTargetId}
        onConfirm={handleConfirmDelete}
      >
        <Field id="move-posts-to" label="Move its posts to">
          <NativeSelect
            id="move-posts-to"
            value={moveTargetId}
            onChange={(e) => setMoveTargetId(e.target.value)}
          >
            {items
              .filter((s) => s.id !== deletingStatus?.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isDefault ? "(Default)" : ""}
                </option>
              ))}
          </NativeSelect>
        </Field>
      </ConfirmDialog>
    </>
  );
}
