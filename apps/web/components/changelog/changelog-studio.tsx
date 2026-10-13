"use client";

import * as React from "react";
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
import { apiFetch } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { isScheduled } from "../../lib/format";

export interface ChangelogStudioProps {
  ws: string;
  product: string;
  productName: string;
  entries: AdminChangelogEntry[];
  tags: ChangelogTag[];
}

export function ChangelogStudio({
  ws,
  product,
  entries: initialEntries,
  tags: initialTags,
}: ChangelogStudioProps): React.JSX.Element {
  const [entriesList, setEntriesList] =
    React.useState<AdminChangelogEntry[]>(initialEntries);
  const [tagsList, setTagsList] = React.useState<ChangelogTag[]>(initialTags);

  const [tagDialogOpen, setTagDialogOpen] = React.useState(false);
  const [deletingEntry, setDeletingEntry] =
    React.useState<AdminChangelogEntry | null>(null);

  const formatReleaseDate = (entry: AdminChangelogEntry): string => {
    if (!entry.publishedAt) return "Unscheduled draft";
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
        }
      );
      setEntriesList((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, publishedAt: null }
            : e
        )
      );
      toast.success("Entry unpublished and reverted to draft");
    } catch (err: any) {
      toast.error(err.message || "Failed to unpublish entry");
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;
    await apiFetch(
      `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/changelog/${encodeURIComponent(deletingEntry.id)}`,
      {
        method: "DELETE",
      }
    );
    setEntriesList((prev) => prev.filter((e) => e.id !== deletingEntry.id));
    toast.success("Changelog entry deleted");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Changelog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Publish release notes, product updates, and improvements.
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
            Manage tags
          </Button>

          <Button asChild size="sm">
            <Link href={`/dashboard/${ws}/${product}/changelog/new`}>
              <Plus className="size-3.5 mr-1.5" />
              New entry
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Table or Empty State */}
      {entriesList.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6 text-muted-foreground" />}
          title="No changelog entries yet"
          body="Keep your customers informed about new features, improvements, and fixes."
          action={
            <Button asChild>
              <Link href={`/dashboard/${ws}/${product}/changelog/new`}>
                <Plus className="size-4 mr-1.5" />
                New entry
              </Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Status</TH>
              <TH>Tags</TH>
              <TH>Release Date</TH>
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
                      className="hover:underline hover:text-primary transition-colors block"
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
                            : "bg-muted text-muted-foreground border-border"
                      )}
                      title={scheduled ? "Goes live on the portal on its release date" : undefined}
                    >
                      {scheduled ? "Scheduled" : isPublished ? "Published" : "Draft"}
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
                              getChangelogTagClasses(tag.name)
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
                          aria-label="Actions"
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
                            Edit
                          </Link>
                        </DropdownMenuItem>

                        {isPublished && !scheduled && (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/${ws}/${product}/changelog/${entry.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5 mr-2" />
                              View live
                            </Link>
                          </DropdownMenuItem>
                        )}

                        {isPublished && (
                          <DropdownMenuItem
                            onClick={() => handleUnpublishEntry(entry)}
                          >
                            <Undo2 className="size-3.5 mr-2" />
                            Unpublish
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={() => setDeletingEntry(entry)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          Delete
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
        title="Delete changelog entry"
        description={`Are you sure you want to delete "${deletingEntry?.title}"? This action cannot be undone.`}
        dismissLabel="Cancel"
        confirmLabel="Delete entry"
        pendingLabel="Deleting…"
        onConfirm={handleDeleteEntry}
      />
    </div>
  );
}
