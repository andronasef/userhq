"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Send,
  Trash2,
  Undo2,
  RotateCcw,
  Check,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AdminChangelogEntry,
  ChangelogTag,
  RichTextDoc,
} from "@userhq/types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { RichTextEditor } from "../rich-text/rich-text-editor";
import { ChangelogTagDialog } from "./changelog-tag-dialog";
import { ChangelogPreviewModal } from "./changelog-preview-modal";
import { getChangelogTagClasses } from "./changelog-timeline-item";
import { apiFetch } from "../../lib/api-client";
import { cn } from "../../lib/utils";

export interface ChangelogEditorProps {
  ws: string;
  product: string;
  productName: string;
  productLogoUrl?: string | null;
  entry?: AdminChangelogEntry;
  availableTags: ChangelogTag[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toDatetimeLocal(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function ChangelogEditor({
  ws,
  product,
  productName,
  productLogoUrl,
  entry: initialEntry,
  availableTags: initialTags,
}: ChangelogEditorProps): React.JSX.Element {
  const router = useRouter();

  const [entryId, setEntryId] = React.useState<string | undefined>(
    initialEntry?.id
  );
  const [title, setTitle] = React.useState(initialEntry?.title ?? "");
  const [slug, setSlug] = React.useState(initialEntry?.slug ?? "");
  const [isSlugManual, setIsSlugManual] = React.useState(Boolean(initialEntry));
  const [summary, setSummary] = React.useState(initialEntry?.summary ?? "");
  const [releaseDate, setReleaseDate] = React.useState(
    toDatetimeLocal(initialEntry?.publishedAt)
  );
  const [content, setContent] = React.useState<RichTextDoc>(
    initialEntry?.content ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    }
  );
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(
    initialEntry?.tags?.map((t) => t.id) ?? []
  );
  const [tags, setTags] = React.useState<ChangelogTag[]>(initialTags);
  const [isPublished, setIsPublished] = React.useState(
    Boolean(initialEntry?.publishedAt)
  );

  const [isDirty, setIsDirty] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<string>("Saved");
  const [isSaving, setIsSaving] = React.useState(false);

  // Dialog states
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  // Auto-derives slug when title changes unless manually modified
  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    setIsDirty(true);
    if (!isSlugManual) {
      setSlug(slugify(nextTitle));
    }
  };

  const handleSlugChange = (nextSlug: string) => {
    setSlug(slugify(nextSlug));
    setIsSlugManual(true);
    setIsDirty(true);
  };

  const toggleTag = (tagId: string) => {
    setIsDirty(true);
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleContentChange = (nextDoc: RichTextDoc) => {
    setContent(nextDoc);
    setIsDirty(true);
  };

  // Debounced auto-save every 3,000ms for existing entries (D-07)
  React.useEffect(() => {
    if (!entryId || !isDirty || isSaving) return;

    setAutoSaveStatus("Unsaved changes");
    const timer = setTimeout(async () => {
      setAutoSaveStatus("Saving…");
      try {
        await apiFetch(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(entryId)}`,
          {
            method: "PATCH",
            body: {
              title: title.trim() || "Untitled update",
              slug: slug.trim() || undefined,
              summary: summary.trim() || null,
              content,
              tagIds: selectedTagIds,
            },
          }
        );
        setIsDirty(false);
        const timeStr = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        setAutoSaveStatus(`Draft saved at ${timeStr}`);
      } catch (err) {
        console.error("Auto-save failed", err);
        setAutoSaveStatus("Failed to auto-save");
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [entryId, isDirty, isSaving, ws, product, title, slug, summary, content, selectedTagIds]);

  // Manual save draft
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsSaving(true);
    setAutoSaveStatus("Saving…");
    try {
      if (entryId) {
        const updated = await apiFetch<AdminChangelogEntry>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(entryId)}`,
          {
            method: "PATCH",
            body: {
              title: title.trim(),
              slug: slug.trim() || undefined,
              summary: summary.trim() || null,
              content,
              tagIds: selectedTagIds,
            },
          }
        );
        setSlug(updated.slug);
        setIsDirty(false);
        toast.success("Draft saved");
      } else {
        const created = await apiFetch<AdminChangelogEntry>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog`,
          {
            method: "POST",
            body: {
              title: title.trim(),
              slug: slug.trim() || undefined,
              summary: summary.trim() || null,
              content,
              tagIds: selectedTagIds,
              publishedAt: null,
            },
          }
        );
        setEntryId(created.id);
        setSlug(created.slug);
        setIsDirty(false);
        toast.success("Draft created");
        window.history.replaceState(
          null,
          "",
          `/dashboard/${ws}/${product}/changelog/${created.id}`
        );
      }
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setAutoSaveStatus(`Draft saved at ${timeStr}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
      setAutoSaveStatus("Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  // Publish / Update entry
  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsSaving(true);
    try {
      const pubDate = releaseDate
        ? new Date(releaseDate).toISOString()
        : new Date().toISOString();

      let activeId = entryId;

      if (!activeId) {
        const created = await apiFetch<AdminChangelogEntry>(
          `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog`,
          {
            method: "POST",
            body: {
              title: title.trim(),
              slug: slug.trim() || undefined,
              summary: summary.trim() || null,
              content,
              tagIds: selectedTagIds,
              publishedAt: pubDate,
            },
          }
        );
        activeId = created.id;
        setEntryId(created.id);
        setSlug(created.slug);
        setIsPublished(true);
        setIsDirty(false);
        toast.success("Changelog entry published");
        router.push(`/dashboard/${ws}/${product}/changelog`);
        return;
      }

      // If already has ID, update metadata and publish
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(activeId)}`,
        {
          method: "PATCH",
          body: {
            title: title.trim(),
            slug: slug.trim() || undefined,
            summary: summary.trim() || null,
            content,
            tagIds: selectedTagIds,
          },
        }
      );

      await apiFetch<AdminChangelogEntry>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(activeId)}/publish`,
        {
          method: "POST",
          body: {
            publishedAt: pubDate,
          },
        }
      );

      setIsPublished(true);
      setIsDirty(false);
      setAutoSaveStatus("Saved");
      toast.success(isPublished ? "Changelog entry updated" : "Changelog entry published");
      router.push(`/dashboard/${ws}/${product}/changelog`);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    } finally {
      setIsSaving(false);
    }
  };

  // Unpublish entry (CHLG-05)
  const handleUnpublish = async () => {
    if (!entryId) return;
    setIsSaving(true);
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(entryId)}/unpublish`, { method: "POST" }
      );
      setIsPublished(false);
      setReleaseDate("");
      toast.success("Entry reverted to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to unpublish");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete entry (CHLG-06)
  const handleDelete = async () => {
    if (!entryId) return;
    await apiFetch(
      `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(entryId)}`,
      {
        method: "DELETE",
      }
    );
    toast.success("Changelog entry deleted");
    router.push(`/dashboard/${ws}/${product}/changelog`);
  };

  // Preview entry representation
  const previewEntry: AdminChangelogEntry = {
    id: entryId ?? "preview-id",
    title: title.trim() || "Untitled release",
    slug: slug.trim() || "untitled-release",
    summary: summary.trim() || null,
    content,
    publishedAt: releaseDate ? new Date(releaseDate).toISOString() : new Date().toISOString(),
    createdAt: initialEntry?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: tags.filter((t) => selectedTagIds.includes(t.id)),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-xs py-3 border-b border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${ws}/${product}/changelog`}
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Changelog
          </Link>

          <span className="text-muted-foreground text-xs" aria-hidden="true">
            /
          </span>

          <h1 className="text-sm sm:text-base font-semibold text-foreground">
            {entryId ? (isPublished ? "Edit release note" : "Edit draft") : "New release note"}
          </h1>

          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              isPublished
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            {isPublished ? "Published" : "Draft"}
          </span>

          <span className="text-xs text-muted-foreground hidden md:inline-block">
            {autoSaveStatus}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-3.5 mr-1.5" />
            Preview
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            Save draft
          </Button>

          {entryId && isPublished && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUnpublish}
              disabled={isSaving}
            >
              <Undo2 className="size-3.5 mr-1.5" />
              Unpublish
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="size-3.5 mr-1.5" />
            )}
            {isPublished ? "Update" : "Publish"}
          </Button>

          {entryId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-muted-foreground hover:text-destructive"
              title="Delete entry"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Metadata Configuration Section */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Title
          </label>
          <Input
            type="text"
            placeholder="e.g. Version 2.4 - Faster Exports & Analytics"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-base font-medium"
          />
        </div>

        {/* Slug & Release Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                URL Slug
              </label>
              <button
                type="button"
                onClick={() => {
                  setSlug(slugify(title));
                  setIsSlugManual(false);
                  setIsDirty(true);
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                title="Re-sync from title"
              >
                <RotateCcw className="size-3" /> Re-sync
              </button>
            </div>
            <div className="flex items-center">
              <span className="flex select-none items-center bg-muted border border-r-0 border-input rounded-l-md px-3 text-xs text-muted-foreground whitespace-nowrap h-9">
                /changelog/
              </span>
              <Input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="version-2-4-faster-exports"
                className="rounded-l-none font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Release date
            </label>
            <Input
              type="datetime-local"
              value={releaseDate}
              onChange={(e) => {
                setReleaseDate(e.target.value);
                setIsDirty(true);
              }}
              className="text-xs"
            />
          </div>
        </div>

        {/* Tags multi-select row */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Tags
            </label>
            <button
              type="button"
              onClick={() => setTagDialogOpen(true)}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="size-3" /> Manage tags
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tags.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No tags yet. Click &quot;Manage tags&quot; to add tags.
              </span>
            ) : (
              tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold transition-all border cursor-pointer",
                      selected
                        ? cn(getChangelogTagClasses(tag.name), "ring-2 ring-primary ring-offset-1")
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80 opacity-70"
                    )}
                  >
                    {selected && <Check className="size-3" />}
                    <span>{tag.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Short Summary (optional) */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            Summary / Excerpt (optional)
          </label>
          <Input
            type="text"
            placeholder="Short preview summary for SEO, RSS, and timeline snippet"
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              setIsDirty(true);
            }}
            maxLength={300}
            className="text-sm"
          />
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          Release Content
        </label>
        <div className="border border-border rounded-lg bg-card shadow-xs">
          <RichTextEditor
            initialContent={initialEntry?.content}
            onChange={handleContentChange}
            placeholder="Write changelog notes... Markdown shortcuts (#, *, >) and image URLs are supported."
            className="min-h-[350px] p-4 sm:p-6"
          />
        </div>
      </div>

      {/* Modals & Dialogs */}
      <ChangelogTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        ws={ws}
        product={product}
        tags={tags}
        onTagsChange={(newTags) => {
          setTags(newTags);
          // Drop deleted tags from selectedTagIds
          const validIds = new Set(newTags.map((t) => t.id));
          setSelectedTagIds((prev) => prev.filter((id) => validIds.has(id)));
        }}
      />

      <ChangelogPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        ws={ws}
        product={product}
        productName={productName}
        productLogoUrl={productLogoUrl}
        entry={previewEntry}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete changelog entry"
        description="Are you sure you want to delete this changelog entry? This action cannot be undone and will remove it permanently."
        dismissLabel="Cancel"
        confirmLabel="Delete entry"
        pendingLabel="Deleting…"
        onConfirm={handleDelete}
      />
    </div>
  );
}
