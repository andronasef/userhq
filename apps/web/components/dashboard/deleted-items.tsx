"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import type {
  DeletedPostRow,
  DeletedCommentRow,
  DeletedPostPage,
  DeletedCommentPage,
} from "@userhq/types";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";

export interface DeletedItemsProps {
  ws: string;
  product: string;
  initialPosts: DeletedPostRow[];
  initialPostsCursor: string | null;
  initialComments: DeletedCommentRow[];
  initialCommentsCursor: string | null;
}

export function DeletedItems({
  ws,
  product,
  initialPosts,
  initialPostsCursor,
  initialComments,
  initialCommentsCursor,
}: DeletedItemsProps): React.JSX.Element {
  const [deletedPosts, setDeletedPosts] =
    React.useState<DeletedPostRow[]>(initialPosts);
  const [deletedComments, setDeletedComments] =
    React.useState<DeletedCommentRow[]>(initialComments);
  const [restoringPostId, setRestoringPostId] = React.useState<number | null>(
    null
  );
  const [restoringCommentId, setRestoringCommentId] = React.useState<
    string | null
  >(null);

  const [postsCursor, setPostsCursor] = React.useState(initialPostsCursor);
  const [commentsCursor, setCommentsCursor] = React.useState(
    initialCommentsCursor
  );
  const [loadingMore, setLoadingMore] = React.useState<
    "posts" | "comments" | null
  >(null);
  const base = `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}`;

  // ponytail: offset cursor; restoring rows before loading more can skip a few, a reload shows them
  const loadMorePosts = async () => {
    if (!postsCursor) return;
    setLoadingMore("posts");
    try {
      const res = await apiFetch<DeletedPostPage>(
        `${base}/posts?view=deleted&cursor=${encodeURIComponent(postsCursor)}`
      );
      setDeletedPosts((prev) => [...prev, ...res.posts]);
      setPostsCursor(res.nextCursor);
    } catch {
      toast.error("Couldn't load more posts. Try again.");
    } finally {
      setLoadingMore(null);
    }
  };

  const loadMoreComments = async () => {
    if (!commentsCursor) return;
    setLoadingMore("comments");
    try {
      const res = await apiFetch<DeletedCommentPage>(
        `${base}/comments/deleted?cursor=${encodeURIComponent(commentsCursor)}`
      );
      setDeletedComments((prev) => [...prev, ...res.comments]);
      setCommentsCursor(res.nextCursor);
    } catch {
      toast.error("Couldn't load more comments. Try again.");
    } finally {
      setLoadingMore(null);
    }
  };

  const loadMoreButton = (onClick: () => void, busy: boolean) => (
    <div className="text-center">
      <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
        {busy ? "Loading…" : "Load more"}
      </Button>
    </div>
  );

  const handleRestorePost = async (post: DeletedPostRow) => {
    setRestoringPostId(post.number);
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/posts/${post.number}/restore`,
        { method: "POST" }
      );
      toast.success("Post restored");
      setDeletedPosts((prev) => prev.filter((p) => p.number !== post.number));
      // update any comments on this post to no longer have post.deleted = true
      setDeletedComments((prev) =>
        prev.map((c) =>
          c.post.number === post.number
            ? { ...c, post: { ...c.post, deleted: false } }
            : c
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore post.");
    } finally {
      setRestoringPostId(null);
    }
  };

  const handleRestoreComment = async (comment: DeletedCommentRow) => {
    setRestoringCommentId(comment.id);
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(ws)}/products/${encodeURIComponent(product)}/comments/${comment.id}/restore`,
        { method: "POST" }
      );
      toast.success("Comment restored");
      setDeletedComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to restore comment."
      );
    } finally {
      setRestoringCommentId(null);
    }
  };

  const bothEmpty = deletedPosts.length === 0 && deletedComments.length === 0;

  if (bothEmpty) {
    return (
      <EmptyState
        title="Nothing deleted"
        body="Deleted posts and comments appear here, so you can restore them."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Deleted posts */}
      <section aria-labelledby="deleted-posts-heading" className="flex flex-col gap-3">
        <h2
          id="deleted-posts-heading"
          className="text-base font-semibold text-foreground"
        >
          Deleted posts
        </h2>

        {deletedPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deleted posts.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Post</TH>
                <TH>Deleted</TH>
                <TH>Deleted by</TH>
                <TH className="w-24 text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {deletedPosts.map((post) => {
                const deletedByLabel = post.deletedByAuthor
                  ? "Author"
                  : (post.deletedBy ?? "—");

                return (
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
                    <TD className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(post.deletedAt)}
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {deletedByLabel}
                    </TD>
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Restore ${post.title}`}
                        disabled={restoringPostId === post.number}
                        onClick={() => handleRestorePost(post)}
                      >
                        {restoringPostId === post.number
                          ? "Restoring…"
                          : "Restore"}
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        {postsCursor && loadMoreButton(loadMorePosts, loadingMore === "posts")}
      </section>

      {/* Deleted comments */}
      <section aria-labelledby="deleted-comments-heading" className="flex flex-col gap-3">
        <h2
          id="deleted-comments-heading"
          className="text-base font-semibold text-foreground"
        >
          Deleted comments
        </h2>

        {deletedComments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deleted comments.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Comment</TH>
                <TH>On post</TH>
                <TH>Author</TH>
                <TH>Deleted</TH>
                <TH className="w-28 text-right">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {deletedComments.map((comment) => {
                const isParentDeleted = comment.post.deleted;

                return (
                  <TR key={comment.id}>
                    <TD className="text-sm text-foreground max-w-xs truncate" title={comment.excerpt}>
                      {comment.excerpt}
                    </TD>
                    <TD>
                      <Link
                        href={`/dashboard/${encodeURIComponent(ws)}/${encodeURIComponent(product)}/board/${comment.post.number}`}
                        className="text-sm text-foreground hover:underline truncate max-w-44 block"
                        title={comment.post.title}
                      >
                        #{comment.post.number} {comment.post.title}
                      </Link>
                    </TD>
                    <TD className="text-sm text-muted-foreground">
                      {comment.authorName ?? "Deleted user"}
                    </TD>
                    <TD className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(comment.deletedAt)}
                    </TD>
                    <TD className="text-right">
                      {isParentDeleted ? (
                        <div className="flex flex-col items-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            aria-label={`Restore comment`}
                          >
                            Restore
                          </Button>
                          <span className="text-[12px] text-muted-foreground">
                            Restore the post first
                          </span>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Restore comment`}
                          disabled={restoringCommentId === comment.id}
                          onClick={() => handleRestoreComment(comment)}
                        >
                          {restoringCommentId === comment.id
                            ? "Restoring…"
                            : "Restore"}
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        {commentsCursor &&
          loadMoreButton(loadMoreComments, loadingMore === "comments")}
      </section>
    </div>
  );
}
