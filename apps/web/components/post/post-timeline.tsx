"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { TimelineItem, PublicComment } from "@userhq/types";
import { CommentItem } from "@/components/post/comment-item";
import { CommentComposer } from "@/components/post/comment-composer";

export interface PostTimelineProps {
  ws: string;
  product: string;
  postNumber: number;
  postSlug: string;
  initialTimeline: TimelineItem[];
  signedIn: boolean;
  viewerIsAdmin?: boolean;
}

export function DeletedStub(): React.JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <div className="size-8 rounded-full bg-muted flex-shrink-0" aria-hidden="true" />
      <span className="text-sm text-muted-foreground font-normal">
        [Comment deleted]
      </span>
    </div>
  );
}

export function PostTimeline({
  ws,
  product,
  postNumber,
  postSlug,
  initialTimeline,
  signedIn,
  viewerIsAdmin = false,
}: PostTimelineProps): React.JSX.Element {
  const router = useRouter();
  const [timeline, setTimeline] = React.useState<TimelineItem[]>(initialTimeline);
  const [activeReplyParentId, setActiveReplyParentId] = React.useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    setTimeline(initialTimeline);
  }, [initialTimeline]);

  const postRef = `${postNumber}-${postSlug}`;

  const handleCommentSuccess = (newComment: PublicComment) => {
    setTimeline((prev) => [
      ...prev,
      { kind: "comment", comment: newComment, replies: [] },
    ]);
    router.refresh();
    setTimeout(() => {
      const el = document.getElementById(`comment-${newComment.id}`);
      if (el) {
        el.focus();
      }
    }, 50);
  };

  const handleReplySuccess = (parentId: string, newReply: PublicComment) => {
    setActiveReplyParentId(null);
    setReplyDrafts((prev) => {
      const next = { ...prev };
      delete next[parentId];
      return next;
    });

    setTimeline((prev) =>
      prev.map((item) => {
        const itemId = item.kind === "comment" ? item.comment.id : item.id;
        if (itemId === parentId) {
          return {
            ...item,
            replies: [...item.replies, newReply],
          };
        }
        return item;
      })
    );

    router.refresh();
    setTimeout(() => {
      const el = document.getElementById(`comment-${newReply.id}`);
      if (el) {
        el.focus();
      }
    }, 50);
  };

  const handleCommentUpdate = (updated: PublicComment) => {
    setTimeline((prev) =>
      prev.map((item) => {
        if (item.kind === "comment") {
          if (item.comment.id === updated.id) {
            return { ...item, comment: updated };
          }
          const replyIndex = item.replies.findIndex((r) => r.id === updated.id);
          if (replyIndex !== -1) {
            const nextReplies = [...item.replies];
            nextReplies[replyIndex] = updated;
            return { ...item, replies: nextReplies };
          }
        } else if (item.kind === "stub") {
          const replyIndex = item.replies.findIndex((r) => r.id === updated.id);
          if (replyIndex !== -1) {
            const nextReplies = [...item.replies];
            nextReplies[replyIndex] = updated;
            return { ...item, replies: nextReplies };
          }
        }
        return item;
      })
    );
  };

  const handleCommentDelete = (commentId: string) => {
    setTimeline((prev) => {
      const next: TimelineItem[] = [];

      for (const item of prev) {
        if (item.kind === "comment") {
          if (item.comment.id === commentId) {
            // Deleted top-level: if it has replies, become a stub; else vanish
            if (item.replies.length > 0) {
              next.push({
                kind: "stub",
                id: item.comment.id,
                replies: item.replies,
              });
            }
            continue;
          }

          // Check if deleted comment is in replies
          const filteredReplies = item.replies.filter((r) => r.id !== commentId);
          next.push({ ...item, replies: filteredReplies });
        } else if (item.kind === "stub") {
          // Check if deleted comment is in replies
          const filteredReplies = item.replies.filter((r) => r.id !== commentId);
          // If stub has replies remaining, keep it; else stub vanishes
          if (filteredReplies.length > 0) {
            next.push({ ...item, replies: filteredReplies });
          }
        }
      }

      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {timeline.map((item) => {
            const isStub = item.kind === "stub";
            const topLevelId = isStub ? item.id : item.comment.id;
            const isReplyOpen = activeReplyParentId === topLevelId;

            return (
              <li
                key={topLevelId}
                id={`comment-${topLevelId}`}
                tabIndex={-1}
                className="focus:outline-none"
              >
                {isStub ? (
                  <DeletedStub />
                ) : (
                  <CommentItem
                    comment={item.comment}
                    ws={ws}
                    product={product}
                    postNumber={postNumber}
                    postRef={postRef}
                    signedIn={signedIn}
                    viewerIsAdmin={viewerIsAdmin}
                    onReply={() => setActiveReplyParentId(topLevelId)}
                    onUpdate={handleCommentUpdate}
                    onDelete={handleCommentDelete}
                  />
                )}

                {item.replies.length > 0 && (
                  <ol className="mt-4 flex flex-col gap-4 pl-12">
                    {item.replies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        ws={ws}
                        product={product}
                        postNumber={postNumber}
                        postRef={postRef}
                        parentId={topLevelId}
                        signedIn={signedIn}
                        viewerIsAdmin={viewerIsAdmin}
                        onReply={() => setActiveReplyParentId(topLevelId)}
                        onUpdate={handleCommentUpdate}
                        onDelete={handleCommentDelete}
                      />
                    ))}
                  </ol>
                )}

                {isReplyOpen && signedIn && (
                  <div className="mt-4 pl-12">
                    <CommentComposer
                      ws={ws}
                      product={product}
                      postNumber={postNumber}
                      parentId={topLevelId}
                      mode="reply"
                      autoFocus
                      initialDraft={replyDrafts[topLevelId] ?? ""}
                      onDraftChange={(draft) =>
                        setReplyDrafts((prev) => ({ ...prev, [topLevelId]: draft }))
                      }
                      onSuccess={(reply) => handleReplySuccess(topLevelId, reply)}
                      onCancel={() => setActiveReplyParentId(null)}
                      discardLabel="Discard reply"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {signedIn && (
        <div className="mt-2">
          <CommentComposer
            ws={ws}
            product={product}
            postNumber={postNumber}
            onSuccess={handleCommentSuccess}
          />
        </div>
      )}
    </div>
  );
}
