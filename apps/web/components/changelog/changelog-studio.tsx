"use client";

import * as React from "react";
import { HiddenModuleNotice } from "../dashboard/hidden-module-notice";
import Link from "next/link";
import {
  Plus,
  Tag as TagIcon,
  Megaphone,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Undo2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminChangelogEntry, ChangelogTag } from "@userhq/types";
import { Button } from "../ui/button";
import { EmptyState } from "../empty-state";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Table, THead, TBody, TR, TH, TD } from "../ui/table";
import { ChangelogTagDialog } from "./changelog-tag-dialog";
import { getChangelogTagClasses } from "./changelog-timeline-item";
import { useI18n } from "../../lib/i18n/context";
import { apiFetch } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { isScheduled } from "../../lib/format";

export interface ChangelogStudioProps {
  ws: string;
  product: string;
  productName: string;
  changelogEnabled: boolean;
  entries: AdminChangelogEntry[];
  tags: ChangelogTag[];
}

export function ChangelogStudio({
  ws,
  product,
  changelogEnabled,
  entries: initialEntries,
  tags: initialTags,
}: ChangelogStudioProps): React.JSX.Element {
  const { t } = useI18n();
  const [entriesList, setEntriesList] =
    React.useState<AdminChangelogEntry[]>(initialEntries);
  const [tagsList, setTagsList] = React.useState<ChangelogTag[]>(initialTags);

  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [deletingEntry, setDeletingEntry] =
    React.useState<AdminChangelogEntry | null>(null);

  const formatReleaseDate = (entry: AdminChangelogEntry): string => {
    if (!entry.publishedAt) return t("ui.unscheduledDraft");
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(entry.publishedAt));
    } catch {
      return entry.publishedAt;
    }
  };

  const handleUnpublishEntry = async (entry: AdminChangelogEntry) => {
    try {
      await apiFetch<AdminChangelogEntry>(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(entry.id)}/unpublish`,
        {
          method: "POST",
        },
      );
      setEntriesList((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, publishedAt: null } : e)),
      );
      toast.success(t("changelog.entryUnpublished"));
    } catch (err: any) {
      toast.error(err.message || t("changelog.failedToUnpublish"));
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    await apiFetch(
      `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(deletingEntry.id)}`,
      {
        method: "DELETE",
      },
    );
    setEntriesList((prev) => prev.filter((e) => e.id !== deletingEntry.id));
    toast.success(t("changelog.entryDeleted"));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("changelog.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("changelog.studioDesc")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTagDialogOpen(true)}
          >
            <TagIcon className="size-3.5 mr-1.5" />
            {t("changelog.manageTags")}
          </Button>

          <Button asChild size="sm">
            <Link href={`/dashboard/${ws}/${product}/changelog/new`}>
              <Plus className="size-4 mr-1.5" />
              {t("changelog.newEntry")}
            </Link>
          </Button>
        </div>
      </div>

      {!changelogEnabled && (
        <HiddenModuleNotice ws={ws} product={product} module="changelog" />
      )}

      {/* Main Table or Empty State */}
      {entriesList.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6 text-muted-foreground" />}
          title={t("changelog.emptyStudioTitle")}
          body={t("changelog.emptyStudioDesc")}
          action={
            <Button asChild>
              <Link href={`/dashboard/${ws}/${product}/changelog/new`}>
                <Plus className="size-4 mr-1.5" />
                {t("changelog.newEntry")}
              </Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("changelog.colTitle")}</TH>
              <TH>{t("changelog.colStatus")}</TH>
              <TH>{t("changelog.colTags")}</TH>
              <TH>{t("changelog.colReleaseDate")}</TH>
              <TH className="w-12 text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {entriesList.map((entry) => {
              const isPublished = Boolean(entry.publishedAt);
              const scheduled = isScheduled(entry.publishedAt);

              return (
                <TR key={entry.id}>
                  <TD className="font-medium text-foreground">
                    <Link
                      href={`/dashboard/${ws}/${product}/changelog/${entry.id}`}
                      className="hover:underline hover:text-[var(--primary-text)] transition-colors block"
                    >
                      {entry.title}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      /changelog/{entry.slug}
                    </span>
                  </TD>

                  <TD>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                        scheduled
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                          : isPublished
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border",
                      )}
                      title={
                        scheduled
                          ? "Goes live on the portal on its release date"
                          : undefined
                      }
                    >
                      {scheduled
                        ? t("changelog.statusScheduled")
                        : isPublished
                          ? t("changelog.statusPublished")
                          : t("changelog.statusDraft")}
                    </span>
                  </TD>

                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      {entry.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        entry.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className={cn(
                              "inline-flex items-center h-5 px-1.5 rounded-full text-[11px] font-semibold",
                              getChangelogTagClasses(tag.name),
                            )}
                          >
                            {tag.name}
                          </span>
                        ))
                      )}
                    </div>
                  </TD>

                  <TD className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatReleaseDate(entry)}
                  </TD>

                  <TD className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0"
                          aria-label={t("common.actions")}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/dashboard/${ws}/${product}/changelog/${entry.id}`}
                          >
                            <Pencil className="size-3.5 mr-2" />
                            {t("common.edit")}
                          </Link>
                        </DropdownMenuItem>

                        {changelogEnabled && isPublished && !scheduled && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/${ws}/${product}/changelog/${entry.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5 mr-2" />
                              {t("changelog.actionViewLive")}
                            </Link>
                          </DropdownMenuItem>
                        )}

                        {isPublished && (
                          <DropdownMenuItem
                            onClick={() => handleUnpublishEntry(entry)}
                          >
                            <Undo2 className="size-3.5 mr-2" />
                            {t("changelog.unpublish")}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={() => setDeletingEntry(entry)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      {/* Tag Management Dialog */}
      <ChangelogTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        ws={ws}
        product={product}
        tags={tagsList}
        onTagsChange={setTagsList}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onOpenChange={(open) => {
          if (!open) setDeletingEntry(null);
        }}
        title={t("changelog.deleteEntryTitle")}
        description={t("changelog.deleteEntryDesc")}
        dismissLabel={t("common.cancel")}
        confirmLabel={t("common.delete")}
        pendingLabel={t("common.deleting")}
        onConfirm={handleDeleteEntry}
      />
    </div>
  );
}
