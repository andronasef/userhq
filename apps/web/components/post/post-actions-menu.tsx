"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import type { PostStatus, PublicPostDetail, PostViewer } from "@userhq/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StatusChangeDialog } from "@/components/post/status-change-dialog";
import { PostFormDialog } from "@/components/board/post-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VotersDialog } from "@/components/post/voters-dialog";
import { MergeDialog } from "@/components/post/merge-dialog";
import { apiFetch } from "@/lib/api-client";
import { portalHref, boardApiBase } from "@/lib/tenant";
import { useI18n } from "@/lib/i18n/context";

export interface PostActionsMenuProps {
  ws: string;
  product: string;
  boardEnabled: boolean;
  post: PublicPostDetail;
  statuses: PostStatus[];
  categories?: { id: string; name: string }[];
  adminView: boolean;
  viewer: PostViewer;
  variant?: "portal" | "dashboard";
  triggerIconOnly?: boolean;
}

export function PostActionsMenu({
  ws,
  product,
  boardEnabled,
  post,
  statuses,
  categories = [],
  adminView,
  viewer,
  variant = "portal",
  triggerIconOnly = false,
}: PostActionsMenuProps): React.JSX.Element | null {
  const { t } = useI18n();
  const router = useRouter();
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [votersDialogOpen, setVotersDialogOpen] = React.useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);

  const handleDelete = async () => {
    await apiFetch(
      `${boardApiBase(variant, ws, product)}/posts/${post.number}`,
      { method: "DELETE" }
    );
    toast.success(t("ui.postDeleted"));
    if (variant === "dashboard") {
      router.push(`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board`);
    } else {
      router.push(portalHref(ws, product));
    }
  };

  if (!adminView && !viewer.isAuthor) {
    return null;
  }

  const isLocked = !viewer.canEdit;

  return (
    <>
      {adminView ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={triggerIconOnly ? "icon" : "sm"}
              className={
                triggerIconOnly
                  ? "size-8 text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground h-8 px-2 flex items-center gap-1.5"
              }
              aria-label={triggerIconOnly ? t("ui.adminActions") : undefined}
            >
              <Ellipsis className="size-4" aria-hidden="true" />
              {!triggerIconOnly && <span>{t("ui.adminBadge")}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditDialogOpen(true)}>
              {t("ui.editPost")}
            </DropdownMenuItem>
            {variant !== "dashboard" && (
              <DropdownMenuItem onSelect={() => setStatusDialogOpen(true)}>
                {t("ui.changeStatus")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setVotersDialogOpen(true)}>
              {t("ui.viewVoters")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMergeDialogOpen(true)}>
              {t("ui.mergeInto")}
            </DropdownMenuItem>
            {post.roadmapItem ? (
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/roadmap?item=${encodeURIComponent(post.roadmapItem.id)}`}
                >
                  {t("ui.viewOnRoadmap")}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/roadmap?linkPost=${post.number}`}
                >
                  {t("ui.addToRoadmap")}
                </Link>
              </DropdownMenuItem>
            )}

            {variant === "dashboard" && boardEnabled && (
              <DropdownMenuItem asChild>
                <a
                  href={`${portalHref(ws, product)}/p/${post.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("ui.viewOnPortal")}
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive data-[highlighted]:text-destructive"
            >
              {t("ui.deletePost")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              aria-label={t("post.postActions")}
            >
              <Ellipsis className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={isLocked}
              onSelect={() => setEditDialogOpen(true)}
              className={isLocked ? "flex flex-col items-start h-auto py-2" : undefined}
            >
              <span>{t("ui.editPost")}</span>
              {isLocked && (
                <span className="text-xs text-muted-foreground font-normal">
                  {t("post.lockedHint")}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isLocked}
              onSelect={() => setDeleteDialogOpen(true)}
              className={`text-destructive focus:text-destructive data-[highlighted]:text-destructive ${
                isLocked ? "flex flex-col items-start h-auto py-2" : ""
              }`}
            >
              <span>{t("ui.deletePost")}</span>
              {isLocked && (
                <span className="text-xs text-muted-foreground font-normal">
                  {t("post.lockedHint")}
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {adminView && (
        <StatusChangeDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          ws={ws}
          product={product}
          postNumber={post.number}
          currentStatusId={post.status.id}
          version={post.version}
          statuses={statuses}
        />
      )}

      <PostFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        ws={ws}
        product={product}
        variant={variant}
        categories={categories}
        mode="edit"
        initial={{
          number: post.number,
          title: post.title,
          description: post.description,
          categoryId: post.category?.id ?? null,
          version: post.version,
          slug: post.slug,
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={adminView ? t("post.deleteTitleNamed", { title: post.title }) : t("post.deleteTitle")}
        description={
          adminView
            ? t("post.adminDeletePostDesc")
            : t("post.userDeletePostDesc")
        }
        dismissLabel={t("common.cancel")}
        confirmLabel={t("ui.deletePost")}
        pendingLabel={t("common.deleting")}
        onConfirm={handleDelete}
      />

      <VotersDialog
        open={votersDialogOpen}
        onOpenChange={setVotersDialogOpen}
        ws={ws}
        product={product}
        postNumber={post.number}
        voteCount={post.voteCount}
      />

      <MergeDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        ws={ws}
        product={product}
        post={{
          number: post.number,
          title: post.title,
          voteCount: post.voteCount,
          slug: post.slug,
        }}
        variant={variant}
      />
    </>
  );
}

