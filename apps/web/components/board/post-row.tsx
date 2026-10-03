import * as React from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { PublicPostRow } from "@userhq/types";
import { postHref } from "@/lib/tenant";
import { VoteButton } from "./vote-button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

export interface PostRowProps {
  ws: string;
  product: string;
  post: PublicPostRow;
  signedIn?: boolean;
}

export function PostRow({
  ws,
  product,
  post,
  signedIn,
}: PostRowProps): React.JSX.Element {
  const href = postHref(ws, product, post.number, post.slug);
  const commentLabel =
    post.commentCount === 1 ? "1 comment" : `${post.commentCount} comments`;

  return (
    <li className="flex gap-4 p-4 bg-background">
      <VoteButton
        ws={ws}
        product={product}
        number={post.number}
        title={post.title}
        voteCount={post.voteCount}
        voted={post.voted}
        signedIn={signedIn}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link
          href={href}
          className="text-base font-semibold line-clamp-2 break-words hover:underline text-foreground"
        >
          {post.title}
        </Link>
        {post.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 break-words">
            {post.description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge name={post.status.name} color={post.status.color} />
          {post.category && (
            <Badge variant="neutral">{post.category.name}</Badge>
          )}
          {post.commentCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-sm text-muted-foreground"
              aria-label={commentLabel}
            >
              <MessageSquare className="size-4" aria-hidden="true" />
              <span>{post.commentCount}</span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
