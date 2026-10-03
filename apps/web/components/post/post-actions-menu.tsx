"use client";

import * as React from "react";
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
import { portalHref } from "@/lib/tenant";

export interface PostActionsMenuProps {
  ws: string;
  product: string;
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
  post,
  statuses,
  categories = [],
  adminView,
  viewer,
  variant = "portal",
  triggerIconOnly = false,
}: PostActionsMenuProps): React.JSX.Element | null {
  const router = useRouter();
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [votersDialogOpen, setVotersDialogOpen] = React.useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);

  const handleDelete = async () => {
    await apiFetch(
      `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/posts/${post.number}`,
      { method: "DELETE" }
    );
    toast.success("Post deleted");
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
              aria-label={triggerIconOnly ? "Admin actions" : undefined}
            >
              <Ellipsis className="size-4" aria-hidden="true" />
              {!triggerIconOnly && <span>Admin</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditDialogOpen(true)}>
              Edit post
            </DropdownMenuItem>
            {variant !== "dashboard" && (
              <DropdownMenuItem onSelect={() => setStatusDialogOpen(true)}>
                Change status
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setVotersDialogOpen(true)}>
              View voters
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMergeDialogOpen(true)}>
              Merge into…
            </DropdownMenuItem>
            {variant === "dashboard" && (
              <DropdownMenuItem asChild>
                <a
                  href={`${portalHref(ws, product)}/p/${post.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on portal
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive data-[highlighted]:text-destructive"
            >
              Delete post
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
              aria-label="Post actions"
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
              <span>Edit post</span>
              {isLocked && (
                <span className="text-xs text-muted-foreground font-normal">
                  Locked after someone else voted or commented
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
              <span>Delete post</span>
              {isLocked && (
                <span className="text-xs text-muted-foreground font-normal">
                  Locked after someone else voted or commented
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
        title={adminView ? `Delete "${post.title}"?` : "Delete this post?"}
        description={
          adminView
            ? "It disappears from the portal. You can restore it from the Deleted tab on the dashboard board."
            : "It'll be removed from the board, along with its votes. This can't be undone."
        }
        dismissLabel="Keep post"
        confirmLabel="Delete post"
        pendingLabel="Deleting…"
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

