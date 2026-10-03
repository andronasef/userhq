"use client";

import * as React from "react";
import type { PublicComment } from "@userhq/types";
import { AuthorLine } from "@/components/post/author-line";
import { PlainText } from "@/components/plain-text";

export interface CommentItemProps {
  comment: PublicComment;
  onReply?: () => void;
  actionsSlot?: React.ReactNode;
}

export function CommentItem({
  comment,
  actionsSlot,
}: CommentItemProps): React.JSX.Element {
  return (
    <li id={`comment-${comment.id}`} tabIndex={-1} className="focus:outline-none">
      <AuthorLine
        author={comment.author}
        createdAt={comment.createdAt}
        editedAt={comment.editedAt}
      />
      <div className="mt-2 pl-12 text-sm text-foreground">
        <PlainText text={comment.body} />
      </div>
      {actionsSlot && <div className="mt-2 pl-12 flex items-center gap-2">{actionsSlot}</div>}
    </li>
  );
}
