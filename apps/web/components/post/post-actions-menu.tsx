"use client";

import * as React from "react";
import { Ellipsis } from "lucide-react";
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

export interface PostActionsMenuProps {
  ws: string;
  product: string;
  post: PublicPostDetail;
  statuses: PostStatus[];
  adminView: boolean;
  viewer: PostViewer;
  onStartEdit?: () => void;
  onDelete?: () => void;
}

export function PostActionsMenu({
  ws,
  product,
  post,
  statuses,
  adminView,
  viewer,
  onStartEdit,
  onDelete,
}: PostActionsMenuProps): React.JSX.Element | null {
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);

  if (!adminView && !viewer.isAuthor) {
    return null;
  }

  if (adminView) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8 px-2 flex items-center gap-1.5"
            >
              <Ellipsis className="size-4" aria-hidden="true" />
              <span>Admin</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onStartEdit}>
              Edit post
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setStatusDialogOpen(true)}>
              Change status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive data-[highlighted]:text-destructive"
            >
              Delete post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
      </>
    );
  }

  // Author (not admin) view
  const isLocked = !viewer.canEdit;

  return (
    <>
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
            onSelect={onStartEdit}
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
            onSelect={onDelete}
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
    </>
  );
}
