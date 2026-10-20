"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reply, LoaderCircle } from "lucide-react";
import type { PublicComment } from "@userhq/types";
import { AuthorLine } from "@/components/post/author-line";
import { PlainText } from "@/components/plain-text";
import { CommentActionsMenu } from "@/components/post/comment-actions-menu";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { errorCopy } from "@/lib/api-errors";

export interface CommentItemProps {
  comment: PublicComment;
  ws: string;
  product: string;
  postNumber: number;
  postRef?: string;
  parentId?: string;
  signedIn: boolean;
  viewerIsAdmin: boolean;
  onReply?: () => void;
  onUpdate?: (updated: PublicComment) => void;
  onDelete?: (id: string) => void;
}

export function CommentItem({
  comment,
  ws,
  product,
  postRef,
  parentId,
  signedIn,
  viewerIsAdmin,
  onReply,
  onUpdate,
  onDelete,
}: CommentItemProps): React.JSX.Element {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(comment.body);
  const [isSaving, setIsSaving] = React.useState(false);
  const [alertError, setAlertError] = React.useState<string | null>(null);
  const [isConflict, setIsConflict] = React.useState(false);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const editTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing) {
      setEditBody(comment.body);
      setIsConflict(false);
      setAlertError(null);
      setTimeout(() => {
        editTextareaRef.current?.focus();
      }, 50);
    }
  }, [isEditing, comment.body]);

  const handleDiscardEdit = () => {
    setIsEditing(false);
    setEditBody(comment.body);
    setAlertError(null);
    setIsConflict(false);
    triggerRef.current?.focus();
  };

  const handleSaveEdit = async () => {
    const trimmed = editBody.trim();
    if (!trimmed || trimmed === comment.body) {
      if (!trimmed) return;
      handleDiscardEdit();
      return;
    }

    setIsSaving(true);
    setAlertError(null);
    setIsConflict(false);

    try {
      const updated = await apiFetch<PublicComment>(
        `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/comments/${comment.id}`,
        {
          method: "PATCH",
          body: {
            body: trimmed,
            version: comment.version,
          },
        }
      );

      setIsEditing(false);
      onUpdate?.(updated);
      triggerRef.current?.focus();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "edit_conflict") {
        setIsConflict(true);
        setAlertError(
          "Someone else changed this while you were editing. Reload to see their version, then try again."
        );
      } else if (err instanceof ApiClientError) {
        setAlertError(errorCopy(err));
      } else {
        setAlertError("Something went wrong on our end. Try again in a moment.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    await apiFetch(
      `/api/v1/portal/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/comments/${comment.id}`,
      {
        method: "DELETE",
      }
    );
    onDelete?.(comment.id);
  };

  const isAuthor = comment.canEdit && !viewerIsAdmin;
  const replyTargetId = parentId ?? comment.id;
  const signInHref = `/login?next=${encodeURIComponent(`/${ws}/${product}/p/${postRef}#comment-${replyTargetId}`)}`;

  return (
    <li id={`comment-${comment.id}`} tabIndex={-1} className="focus:outline-none">
      <AuthorLine
        author={comment.author}
        createdAt={comment.createdAt}
        editedAt={comment.editedAt}
        deviceInfo={comment.deviceInfo}
      />

      {isEditing ? (
        <div className="mt-2 pl-12 flex flex-col gap-2">
          <Textarea
            ref={editTextareaRef}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                handleDiscardEdit();
              } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSaveEdit();
              }
            }}
            disabled={isSaving}
            rows={3}
          />
          {alertError && (
            <Alert variant="destructive">
              <div className="flex items-center justify-between gap-2">
                <p>{alertError}</p>
                {isConflict && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.refresh()}
                  >
                    Reload
                  </Button>
                )}
              </div>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={handleDiscardEdit}
            >
              Discard changes
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isSaving || editBody.trim() === comment.body || !editBody.trim()}
              onClick={handleSaveEdit}
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Saving…</span>
                </>
              ) : (
                "Save comment"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2 pl-12 text-sm text-foreground">
            <PlainText text={comment.body} />
          </div>
          <div className="mt-2 pl-12 flex items-center gap-2">
            {signedIn ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className="text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <Reply className="size-4" aria-hidden="true" />
                <span>Reply</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-muted-foreground hover:text-foreground h-8 px-2"
              >
                <Link href={signInHref}>
                  <Reply className="size-4" aria-hidden="true" />
                  <span>Reply</span>
                </Link>
              </Button>
            )}

            {(comment.canEdit || comment.canDelete) && (
              <CommentActionsMenu
                canEdit={comment.canEdit}
                canDelete={comment.canDelete}
                viewerIsAdmin={viewerIsAdmin}
                isAuthor={isAuthor}
                triggerRef={triggerRef}
                onStartEdit={() => setIsEditing(true)}
                onDelete={handleDelete}
              />
            )}
          </div>
        </>
      )}
    </li>
  );
}
