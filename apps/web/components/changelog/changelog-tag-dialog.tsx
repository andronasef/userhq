"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ChangelogTag } from "@userhq/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { apiFetch } from "../../lib/api-client";
import { getChangelogTagClasses } from "./changelog-timeline-item";
import { cn } from "../../lib/utils";

export interface ChangelogTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: string;
  product: string;
  tags: ChangelogTag[];
  onTagsChange: (tags: ChangelogTag[]) => void;
}

const COLOR_PRESETS = [
  { label: "Emerald", hex: "#10B981" },
  { label: "Blue", hex: "#3B82F6" },
  { label: "Amber", hex: "#F59E0B" },
  { label: "Slate", hex: "#64748B" },
  { label: "Purple", hex: "#8B5CF6" },
  { label: "Rose", hex: "#F43F5E" },
];

export function ChangelogTagDialog({
  open,
  onOpenChange,
  ws,
  product,
  tags,
  onTagsChange,
}: ChangelogTagDialogProps): React.JSX.Element {
  const [tagName, setTagName] = React.useState("");
  const [tagColor, setTagColor] = React.useState("#3B82F6");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tagName.trim();
    if (!trimmed) {
      toast.error("Tag name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiFetch<ChangelogTag>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/tags`,
        {
          method: "POST",
          body: {
            name: trimmed,
            color: tagColor,
          },
        }
      );
      onTagsChange([...tags, created]);
      setTagName("");
      toast.success(`Tag "${created.name}" created`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create tag");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async (tag: ChangelogTag) => {
    setDeletingId(tag.id);
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/tags/${encodeURIComponent(tag.id)}`,
        {
          method: "DELETE",
        }
      );
      const nextTags = tags.filter((t) => t.id !== tag.id);
      onTagsChange(nextTags);
      toast.success(`Tag "${tag.name}" deleted`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete tag");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage tags</DialogTitle>
          <DialogDescription>
            Add or remove tags used to categorize changelog release updates.
          </DialogDescription>
        </DialogHeader>

        {/* Existing tags list */}
        <div className="space-y-2 my-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Current tags ({tags.length})
          </label>
          <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground text-center">
                No tags created yet.
              </p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "inline-flex items-center h-5 px-2 rounded-full text-xs font-semibold",
                        getChangelogTagClasses(tag.name)
                      )}
                    >
                      {tag.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={deletingId === tag.id}
                    onClick={() => handleDeleteTag(tag)}
                    aria-label={`Delete tag ${tag.name}`}
                    className="text-muted-foreground hover:text-destructive p-1 rounded-sm transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add new tag form */}
        <form onSubmit={handleAddTag} className="space-y-3 pt-2 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Add new tag
          </label>

          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Tag name (e.g. Security)"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              maxLength={30}
              className="flex-1"
            />
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="color"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
                className="size-9 rounded-md border border-input cursor-pointer p-0.5 bg-background"
                title="Select tag color"
              />
            </div>
          </div>

          {/* Color preset chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => setTagColor(p.hex)}
                className={cn(
                  "size-5 rounded-full border border-black/10 transition-transform",
                  tagColor.toUpperCase() === p.hex.toUpperCase()
                    ? "ring-2 ring-primary ring-offset-1 scale-110"
                    : "hover:scale-105"
                )}
                style={{ backgroundColor: p.hex }}
                title={p.label}
              />
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || !tagName.trim()}
              size="sm"
            >
              <Plus className="size-3.5 mr-1.5" />
              Add tag
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
