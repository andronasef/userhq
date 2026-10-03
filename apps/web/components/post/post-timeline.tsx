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
  postSlug: _postSlug,
  initialTimeline,
  signedIn,
}: PostTimelineProps): React.JSX.Element {
  const router = useRouter();
  const [timeline, setTimeline] = React.useState<TimelineItem[]>(initialTimeline);

  React.useEffect(() => {
    setTimeline(initialTimeline);
  }, [initialTimeline]);

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

  return (
    <div className="flex flex-col gap-6">
      {timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {timeline.map((item) => {
            if (item.kind === "stub") {
              return (
                <li
                  key={item.id}
                  id={`comment-${item.id}`}
                  tabIndex={-1}
                  className="focus:outline-none"
                >
                  <DeletedStub />
                  {item.replies.length > 0 && (
                    <ol className="mt-4 flex flex-col gap-4 pl-12">
                      {item.replies.map((reply) => (
                        <CommentItem key={reply.id} comment={reply} />
                      ))}
                    </ol>
                  )}
                </li>
              );
            }

            return (
              <li
                key={item.comment.id}
                id={`comment-${item.comment.id}`}
                tabIndex={-1}
                className="focus:outline-none"
              >
                <CommentItem comment={item.comment} />
                {item.replies.length > 0 && (
                  <ol className="mt-4 flex flex-col gap-4 pl-12">
                    {item.replies.map((reply) => (
                      <CommentItem key={reply.id} comment={reply} />
                    ))}
                  </ol>
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
