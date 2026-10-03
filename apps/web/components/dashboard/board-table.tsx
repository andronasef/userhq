"use client";

import * as React from "react";
import Link from "next/link";
import type { AdminPostRow, PostStatus } from "@userhq/types";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { PostActionsMenu } from "@/components/post/post-actions-menu";
import { formatDate } from "@/lib/format";

export interface BoardTableProps {
  ws: string;
  product: string;
  posts: AdminPostRow[];
  statuses: PostStatus[];
  categories?: { id: string; name: string }[];
}

export function BoardTable({
  ws,
  product,
  posts,
  statuses,
  categories = [],
}: BoardTableProps): React.JSX.Element {
  return (
    <Table>
      <THead>
        <TR>
          <TH>Post</TH>
          <TH>Category</TH>
          <TH>Status</TH>
          <TH className="text-right">Votes</TH>
          <TH className="text-right">Comments</TH>
          <TH>Created</TH>
          <TH className="w-12 text-right">
            <span className="sr-only">Actions</span>
          </TH>
        </TR>
      </THead>
      <TBody>
        {posts.map((post) => (
          <TR key={post.number}>
            <TD>
              <Link
                href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board/${post.number}`}
                className="text-sm font-semibold text-foreground hover:underline truncate max-w-80 block"
                title={post.title}
              >
                {post.title}
              </Link>
            </TD>
            <TD className="text-sm text-muted-foreground">
              {post.category?.name ?? "—"}
            </TD>
            <TD>
              <StatusBadge name={post.status.name} color={post.status.color} />
            </TD>
            <TD className="text-right tabular-nums text-sm text-foreground">
              {post.voteCount}
            </TD>
            <TD className="text-right tabular-nums text-sm text-foreground">
              {post.commentCount}
            </TD>
            <TD className="text-sm text-muted-foreground whitespace-nowrap">
              {formatDate(post.createdAt)}
            </TD>
            <TD className="text-right">
              <PostActionsMenu
                ws={ws}
                product={product}
                post={{
                  number: post.number,
                  slug: post.slug,
                  title: post.title,
                  description: null,
                  voteCount: post.voteCount,
                  createdAt: post.createdAt,
                  editedAt: null,
                  version: 1,
                  status: post.status,
                  category: post.category,
                  author: {
                    name: null,
                    image: null,
                    isAdmin: false,
                    deleted: false,
                  },
                }}
                statuses={statuses}
                categories={categories}
                adminView={true}
                viewer={{
                  signedIn: true,
                  voted: false,
                  isAuthor: false,
                  isAdmin: true,
                  inConversation: false,
                  muted: false,
                  commentEmailsOn: false,
                  canEdit: true,
                  canDelete: true,
                }}
                variant="dashboard"
                triggerIconOnly={true}
              />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
