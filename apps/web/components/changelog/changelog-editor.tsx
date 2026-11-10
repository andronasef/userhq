"use client";

import * as React from "react";
import { HiddenModuleNotice } from "../dashboard/hidden-module-notice";
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
  ProductLocalesConfig,
  SupportedLocale,
} from "@userhq/types";
import { DEFAULT_LOCALE, isRtl } from "@userhq/types";
import { EntryLocaleTabs } from "../entry-locale-tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { RichTextEditor } from "../rich-text/rich-text-editor";
import { ChangelogTagDialog } from "./changelog-tag-dialog";
import { ChangelogPreviewModal } from "./changelog-preview-modal";
import { getChangelogTagClasses } from "./changelog-timeline-item";
import { useI18n } from "../../lib/i18n/context";
import { apiFetch } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { formatDate, isScheduled } from "../../lib/format";

export interface ChangelogEditorProps {
  ws: string;
  product: string;
  productName: string;
  changelogEnabled: boolean;
  productLogoUrl?: string | null;
  productLocales?: ProductLocalesConfig | null;
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
  changelogEnabled,
  productName,
  productLogoUrl,
  productLocales,
  entry: initialEntry,
  availableTags: initialTags,
}: ChangelogEditorProps): React.JSX.Element {
  const { t, locale } = useI18n();
  const router = useRouter();

  const defaultLocale = productLocales?.defaultLocale ?? DEFAULT_LOCALE;
  const enabledLocales =
    productLocales?.enabledLocales && productLocales.enabledLocales.length > 0
      ? productLocales.enabledLocales
      : [defaultLocale];
  const [activeLocale, setActiveLocale] =
    React.useState<SupportedLocale>(defaultLocale);
  const [translations, setTranslations] = React.useState<
    Record<
      string,
      { title?: string; summary?: string | null; content?: RichTextDoc | null }
    >
  >(initialEntry?.translations ?? {});

  const [entryId, setEntryId] = React.useState<string | undefined>(
    initialEntry?.id,
  );
  const [title, setTitle] = React.useState(initialEntry?.title ?? "");
  const [slug, setSlug] = React.useState(initialEntry?.slug ?? "");
  const [isSlugManual, setIsSlugManual] = React.useState(Boolean(initialEntry));
  const [summary, setSummary] = React.useState(initialEntry?.summary ?? "");
  const [releaseDate, setReleaseDate] = React.useState(
    toDatetimeLocal(initialEntry?.publishedAt),
  );
  const [content, setContent] = React.useState<RichTextDoc>(
    initialEntry?.content ?? {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
  );
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>(
    initialEntry?.tags?.map((t) => t.id) ?? [],
  );
  const [tags, setTags] = React.useState<ChangelogTag[]>(initialTags);
  const [isPublished, setIsPublished] = React.useState(
    Boolean(initialEntry?.publishedAt),
  );
  const [savedPublishedAt, setSavedPublishedAt] = React.useState(
    initialEntry?.publishedAt ?? null,
  );
  const scheduled = isPublished && isScheduled(savedPublishedAt);

  const [isDirty, setIsDirty] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<
    "saved" | "unsaved" | "saving" | "failed"
  >("saved");
  const [savedTime, setSavedTime] = React.useState<Date | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Dialog states
  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const currentTitle =
    activeLocale === defaultLocale
      ? title
      : (translations[activeLocale]?.title ?? "");
  const currentSummary =
    activeLocale === defaultLocale
      ? summary
      : (translations[activeLocale]?.summary ?? "");
  const currentContent =
    activeLocale === defaultLocale
      ? content
      : (translations[activeLocale]?.content ?? {
          type: "doc",
          content: [{ type: "paragraph" }],
        });

  const translationsStatus = React.useMemo(() => {
    const status: Partial<Record<SupportedLocale, boolean>> = {};
    for (const loc of enabledLocales) {
      if (loc === defaultLocale) {
        status[loc] = Boolean(title.trim());
      } else {
        const trans = translations[loc];
        status[loc] = Boolean(trans?.title?.trim() || trans?.summary?.trim());
      }
    }
    return status;
  }, [enabledLocales, defaultLocale, title, translations]);

  // Handle active locale edits
  const handleCurrentTitleChange = (nextTitle: string) => {
    setIsDirty(true);
    if (activeLocale === defaultLocale) {
      setTitle(nextTitle);
      if (!isSlugManual) {
        setSlug(slugify(nextTitle));
      }
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          title: nextTitle,
        },
      }));
    }
  };

  const handleCurrentSummaryChange = (nextSummary: string) => {
    setIsDirty(true);
    if (activeLocale === defaultLocale) {
      setSummary(nextSummary);
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          summary: nextSummary,
        },
      }));
    }
  };

  const handleCurrentContentChange = (nextDoc: RichTextDoc) => {
    setIsDirty(true);
    if (activeLocale === defaultLocale) {
      setContent(nextDoc);
    } else {
      setTranslations((prev) => ({
        ...prev,
        [activeLocale]: {
          ...prev[activeLocale],
          content: nextDoc,
        },
      }));
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
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // Debounced auto-save every 3,000ms for existing entries (D-07)
  React.useEffect(() => {
    if (!entryId || !isDirty || isSaving) return;

    setAutoSaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setAutoSaveStatus("saving");
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
              translations,
            },
          },
        );
        setIsDirty(false);
        setSavedTime(new Date());
        setAutoSaveStatus("saved");
      } catch (err) {
        console.error("Auto-save failed", err);
        setAutoSaveStatus("failed");
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [
    entryId,
    isDirty,
    isSaving,
    ws,
    product,
    title,
    slug,
    summary,
    content,
    selectedTagIds,
    translations,
  ]);

  const publishedToast = (
    publishedAt: string,
    wasPublished: boolean,
  ): string =>
    isScheduled(publishedAt)
      ? `${t("changelog.statusScheduled")}: ${formatDate(publishedAt, locale)}`
      : t(wasPublished ? "changelog.entryUpdated" : "changelog.entryPublished");

  // Manual save draft
  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error(t("changelog.titleRequired"));
      return;
    }

    setIsSaving(true);
    setAutoSaveStatus("saving");
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
              translations,
            },
          },
        );
        setSlug(updated.slug);
        setIsDirty(false);
        toast.success(t("changelog.draftSaved"));
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
              translations,
            },
          },
        );
        setEntryId(created.id);
        setSlug(created.slug);
        setIsDirty(false);
        toast.success(t("changelog.draftSaved"));
        window.history.replaceState(
          null,
          "",
          `/dashboard/${ws}/${product}/changelog/${created.id}`,
        );
      }
      setSavedTime(new Date());
      setAutoSaveStatus("saved");
    } catch (err: any) {
      toast.error(err.message || t("common.saveFailed"));
      setAutoSaveStatus("failed");
    } finally {
      setIsSaving(false);
    }
  };

  // Publish / Update entry
  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error(t("changelog.titleRequired"));
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
              translations,
            },
          },
        );
        activeId = created.id;
        setEntryId(created.id);
        setSlug(created.slug);
        setIsPublished(true);
        setSavedPublishedAt(pubDate);
        setIsDirty(false);
        toast.success(publishedToast(pubDate, false));
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
            translations,
          },
        },
      );

      await apiFetch<AdminChangelogEntry>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(activeId)}/publish`,
        {
          method: "POST",
          body: {
            publishedAt: pubDate,
          },
        },
      );

      setIsPublished(true);
      setSavedPublishedAt(pubDate);
      setIsDirty(false);
      setAutoSaveStatus("saved");
      toast.success(publishedToast(pubDate, isPublished));
      router.push(`/dashboard/${ws}/${product}/changelog`);
    } catch (err: any) {
      toast.error(err.message || t("common.saveFailed"));
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
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(entryId)}/unpublish`,
        { method: "POST" },
      );
      setIsPublished(false);
      setSavedPublishedAt(null);
      setReleaseDate("");
      toast.success(t("changelog.entryUnpublished"));
    } catch (err: any) {
      toast.error(err.message || t("common.saveFailed"));
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
      },
    );
    toast.success(t("changelog.entryDeleted"));
    router.push(`/dashboard/${ws}/${product}/changelog`);
  };

  // Preview entry representation
  const previewEntry: AdminChangelogEntry = {
    id: entryId ?? "preview-id",
    title: title.trim() || "Untitled release",
    slug: slug.trim() || "untitled-release",
    summary: summary.trim() || null,
    content,
    publishedAt: releaseDate
      ? new Date(releaseDate).toISOString()
      : new Date().toISOString(),
    createdAt: initialEntry?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: tags.filter((t) => selectedTagIds.includes(t.id)),
    translations,
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
            {t("changelog.title")}
          </Link>

          <span className="text-muted-foreground text-xs" aria-hidden="true">
            /
          </span>

          <h1 className="text-sm sm:text-base font-semibold text-foreground">
            {entryId ? t("changelog.actionEdit") : t("changelog.newEntry")}
          </h1>

          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              scheduled
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                : isPublished
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-muted text-muted-foreground border-border",
            )}
          >
            {scheduled
              ? t("changelog.statusScheduled")
              : isPublished
                ? t("changelog.statusPublished")
                : t("changelog.statusDraft")}
          </span>

          <span className="text-xs text-muted-foreground hidden md:inline-block">
            {t(
              autoSaveStatus === "unsaved"
                ? "changelog.unsavedChanges"
                : autoSaveStatus === "saving"
                  ? "changelog.savingDraft"
                  : autoSaveStatus === "failed"
                    ? "common.saveFailed"
                    : "changelog.draftSaved",
            )}
            {autoSaveStatus === "saved" &&
              savedTime &&
              ` · ${savedTime.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`}
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
            {t("changelog.preview")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            {t("changelog.saveDraft")}
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
              {t("changelog.unpublish")}
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
            {isPublished ? t("changelog.update") : t("changelog.publish")}
          </Button>

          {entryId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-muted-foreground hover:text-destructive"
              title={t("changelog.actionDelete")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {!changelogEnabled && (
        <HiddenModuleNotice ws={ws} product={product} module="changelog" />
      )}

      <EntryLocaleTabs
        activeLocale={activeLocale}
        onSelectLocale={setActiveLocale}
        defaultLocale={defaultLocale}
        enabledLocales={enabledLocales}
        translationsStatus={translationsStatus}
      />

      {/* Metadata Configuration Section */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
            {t("changelog.titleLabel")}{" "}
            {activeLocale !== defaultLocale && `(${activeLocale})`}
          </label>
          <Input
            type="text"
            placeholder={t("ui.titlePlaceholder")}
            value={currentTitle}
            onChange={(e) => handleCurrentTitleChange(e.target.value)}
            dir={isRtl(activeLocale) ? "rtl" : "ltr"}
            className="text-base font-medium"
          />
        </div>

        {/* Slug & Release Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                {t("changelog.slugLabel")}
              </label>
              <button
                type="button"
                onClick={() => {
                  setSlug(slugify(title));
                  setIsSlugManual(false);
                  setIsDirty(true);
                }}
                className="text-xs text-[var(--primary-text)] hover:underline flex items-center gap-1 cursor-pointer"
                title={t("changelog.resyncSlug")}
              >
                <RotateCcw className="size-3" /> {t("changelog.resyncSlug")}
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
              {t("changelog.releaseDateLabel")}
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
              {t("changelog.tagsLabel")}
            </label>
            <button
              type="button"
              onClick={() => setTagDialogOpen(true)}
              className="text-xs font-medium text-[var(--primary-text)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="size-3" /> {t("changelog.manageTags")}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tags.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("changelog.noTagsYetHelp")}
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
                        ? cn(
                            getChangelogTagClasses(tag.name),
                            "ring-2 ring-[var(--primary-text)] ring-offset-1",
                          )
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80 opacity-70",
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
            {t("changelog.summaryExcerptLabel")}{" "}
            {activeLocale !== defaultLocale && `(${activeLocale})`}
          </label>
          <Input
            type="text"
            placeholder={t("changelog.summaryExcerptHelp")}
            value={currentSummary}
            onChange={(e) => handleCurrentSummaryChange(e.target.value)}
            dir={isRtl(activeLocale) ? "rtl" : "ltr"}
            maxLength={300}
            className="text-sm"
          />
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          {t("changelog.contentLabel")}{" "}
          {activeLocale !== defaultLocale && `(${activeLocale})`}
        </label>
        <div
          dir={isRtl(activeLocale) ? "rtl" : "ltr"}
          className="border border-border rounded-lg bg-card shadow-xs"
        >
          <RichTextEditor
            key={activeLocale}
            initialContent={currentContent}
            onChange={handleCurrentContentChange}
            placeholder={t("changelog.contentPlaceholder")}
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
        title={t("changelog.deleteEntryTitle")}
        description={t("changelog.deleteEntryDesc")}
        dismissLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        pendingLabel={t("common.deleting")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
