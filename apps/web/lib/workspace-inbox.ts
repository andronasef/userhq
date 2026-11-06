import type { WorkspaceCommentItem } from "@userhq/types";

export type CommentAttentionFilter = "needs_attention" | "handled" | "all";

/**
 * Local feed update after an admin reply (D-04: a reply resolves the thread).
 * The server also resolves thread-mates; the caller refreshes to pick those up.
 */
export function applyReplyToFeed(
  items: WorkspaceCommentItem[],
  parentId: string,
  reply: WorkspaceCommentItem,
  attention: CommentAttentionFilter
): { items: WorkspaceCommentItem[]; needsAttentionDelta: number } {
  const parentIndex = items.findIndex((c) => c.id === parentId);
  if (parentIndex === -1) return { items, needsAttentionDelta: 0 };

  const parent = items[parentIndex];
  // An existing handler is never overwritten, matching the server.
  const resolves = !parent.isAdmin && !parent.handledAt;
  const next = items.slice();
  if (resolves) {
    next[parentIndex] = { ...parent, handledAt: reply.createdAt, handledBy: reply.author };
  }
  if (attention !== "needs_attention" && !items.some((c) => c.id === reply.id)) {
    next.splice(parentIndex + 1, 0, reply);
  }
  return { items: next, needsAttentionDelta: resolves ? -1 : 0 };
}
