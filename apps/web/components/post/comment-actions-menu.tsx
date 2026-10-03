"use client";

import * as React from "react";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface CommentActionsMenuProps {
  canEdit: boolean;
  canDelete: boolean;
  viewerIsAdmin: boolean;
  isAuthor: boolean;
  triggerRef?: React.Ref<HTMLButtonElement>;
  onStartEdit?: () => void;
  onDelete: () => Promise<void>;
}

export function CommentActionsMenu({
  canEdit,
  canDelete,
  viewerIsAdmin,
  isAuthor,
  triggerRef,
  onStartEdit,
  onDelete,
}: CommentActionsMenuProps): React.JSX.Element | null {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (!canEdit && !canDelete) {
    return null;
  }

  const isAdminCopy = viewerIsAdmin && !isAuthor;
  const dialogDescription = isAdminCopy
    ? "It disappears from the portal. You can restore it from the Deleted tab on the dashboard board."
    : "It'll be removed from the conversation. This can't be undone.";

  const handleConfirmDelete = async () => {
    await onDelete();
    toast.success("Comment deleted");
    const heading = document.getElementById("comments-heading");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Comment actions"
          >
            <Ellipsis className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          {canEdit && (
            <DropdownMenuItem onSelect={onStartEdit}>
              Edit comment
            </DropdownMenuItem>
          )}
          {canEdit && canDelete && <DropdownMenuSeparator />}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirmOpen(true)}
            >
              Delete comment
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this comment?"
        description={dialogDescription}
        dismissLabel="Keep comment"
        confirmLabel="Delete comment"
        pendingLabel="Deleting…"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
