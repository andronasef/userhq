import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DB, type Db, posts, comments, user } from "@userhq/db";
import type {
  CreateCommentInput,
  UpdateCommentInput,
  PublicComment,
  TimelineItem,
  DeviceInfo,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isWorkspaceAdmin } from "./membership.js";
import { enqueueCommentEmail } from "../email/outbox.js";
import { parseUserAgent } from "./device-info.js";

export interface CommentRowWithAuthor {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  isAdmin: boolean;
  body: string;
  version: number;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  deviceInfo?: DeviceInfo | null;
  authorName: string | null;
  authorImage: string | null;
  authorDeletedAt: Date | null;
}

@Injectable()
export class CommentsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async createComment(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string; name: string | null; image: string | null },
    number: number,
    input: CreateCommentInput,
    userAgent?: string | null
  ): Promise<PublicComment> {
    const deviceInfo = parseUserAgent(userAgent);

    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.productId, portal.productId),
            eq(posts.number, number),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        )
        .for("update");

      if (!p) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      const isAdmin = await isWorkspaceAdmin(tx, currentUser.id, portal.workspaceId);

      let resolvedParentId: string | null = null;
      if (input.parentId) {
        const [parent] = await tx
          .select({ id: comments.id, parentId: comments.parentId })
          .from(comments)
          .where(
            and(
              eq(comments.id, input.parentId),
              eq(comments.postId, p.id),
              isNull(comments.deletedAt)
            )
          );

        if (!parent) {
          throw new ApiException("comment_not_found", 404, "Parent comment not found.");
        }

        // Replies are one level deep: reply to a reply attaches to the top-level parent (D-16)
        resolvedParentId = parent.parentId ?? parent.id;
      }

      const [newComment] = await tx
        .insert(comments)
        .values({
          postId: p.id,
          parentId: resolvedParentId,
          authorId: currentUser.id,
          isAdmin,
          body: input.body,
          deviceInfo,
        })
        .returning();

      await enqueueCommentEmail(tx, {
        postId: p.id,
        commentId: newComment.id,
        actorId: currentUser.id,
        workspaceId: portal.workspaceId,
      });

      return {
        id: newComment.id,
        author: {
          name: currentUser.name,
          image: currentUser.image,
          isAdmin,
          deleted: false,
        },
        body: newComment.body,
        createdAt: newComment.createdAt.toISOString(),
        editedAt: newComment.editedAt ? newComment.editedAt.toISOString() : null,
        version: newComment.version,
        canEdit: true,
        canDelete: true,
        deviceInfo: isAdmin ? (newComment.deviceInfo ?? null) : null,
      };
    });
  }

  async updateComment(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string },
    commentId: string,
    input: UpdateCommentInput
  ): Promise<PublicComment> {
    const [row] = await this.db
      .select({
        commentId: comments.id,
        commentAuthorId: comments.authorId,
        commentVersion: comments.version,
        commentDeletedAt: comments.deletedAt,
        postId: posts.id,
        postDeletedAt: posts.deletedAt,
        postMergedIntoId: posts.mergedIntoId,
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(posts.productId, portal.productId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .limit(1);

    if (!row || row.commentDeletedAt !== null) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    const isAdmin = await isWorkspaceAdmin(this.db, currentUser.id, portal.workspaceId);
    const isAuthor = row.commentAuthorId === currentUser.id;

    if (!isAuthor && !isAdmin) {
      throw new ApiException("not_allowed", 403, "Not allowed.");
    }

    const [updated] = await this.db
      .update(comments)
      .set({
        body: input.body,
        version: sql`${comments.version} + 1`,
        editedAt: sql`now()`,
      })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.version, input.version),
          isNull(comments.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      const [still] = await this.db
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
        .limit(1);

      if (still) {
        throw new ApiException(
          "edit_conflict",
          409,
          "Someone edited this while you were looking at it. Refresh to see the latest version."
        );
      } else {
        throw new ApiException("comment_not_found", 404, "Comment not found.");
      }
    }

    const [authorUser] = await this.db
      .select({ name: user.name, image: user.image, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, updated.authorId))
      .limit(1);

    const isDeletedUser = Boolean(authorUser?.deletedAt);

    return {
      id: updated.id,
      author: isDeletedUser
        ? { name: null, image: null, isAdmin: false, deleted: true }
        : {
            name: authorUser?.name ?? null,
            image: authorUser?.image ?? null,
            isAdmin: updated.isAdmin,
            deleted: false,
          },
      body: updated.body,
      createdAt: updated.createdAt.toISOString(),
      editedAt: updated.editedAt ? updated.editedAt.toISOString() : null,
      version: updated.version,
      canEdit: true,
      canDelete: true,
      deviceInfo: isAdmin ? (updated.deviceInfo ?? null) : null,
    };
  }

  async deleteComment(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string },
    commentId: string
  ): Promise<void> {
    const [row] = await this.db
      .select({
        commentId: comments.id,
        commentAuthorId: comments.authorId,
        commentDeletedAt: comments.deletedAt,
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(posts.productId, portal.productId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .limit(1);

    if (!row || row.commentDeletedAt !== null) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    const isAdmin = await isWorkspaceAdmin(this.db, currentUser.id, portal.workspaceId);
    const isAuthor = row.commentAuthorId === currentUser.id;

    if (!isAuthor && !isAdmin) {
      throw new ApiException("not_allowed", 403, "Not allowed.");
    }

    const [deleted] = await this.db
      .update(comments)
      .set({
        deletedAt: sql`now()`,
        deletedById: currentUser.id,
      })
      .where(and(eq(comments.id, commentId), isNull(comments.deletedAt)))
      .returning({ id: comments.id });

    if (!deleted) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }
  }

  shapeTimeline(
    rows: CommentRowWithAuthor[],
    viewer: { userId: string | null; isAdmin: boolean }
  ): TimelineItem[] {
    const topLevelRows: CommentRowWithAuthor[] = [];
    const repliesByParent = new Map<string, CommentRowWithAuthor[]>();

    for (const row of rows) {
      if (row.parentId === null) {
        topLevelRows.push(row);
      } else {
        // Deleted replies always vanish (D-18)
        if (row.deletedAt !== null) {
          continue;
        }
        const existing = repliesByParent.get(row.parentId) ?? [];
        existing.push(row);
        repliesByParent.set(row.parentId, existing);
      }
    }

    const mapComment = (row: CommentRowWithAuthor): PublicComment => {
      const isAuthor = viewer.userId === row.authorId;
      const canManage = isAuthor || viewer.isAdmin;
      const isDeletedUser = Boolean(row.authorDeletedAt);

      return {
        id: row.id,
        author: isDeletedUser
          ? { name: null, image: null, isAdmin: false, deleted: true }
          : {
              name: row.authorName,
              image: row.authorImage,
              isAdmin: row.isAdmin,
              deleted: false,
            },
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        version: row.version,
        canEdit: canManage && !row.deletedAt,
        canDelete: canManage && !row.deletedAt,
        deviceInfo: viewer.isAdmin ? (row.deviceInfo ?? null) : null,
      };
    };

    const timeline: TimelineItem[] = [];

    for (const row of topLevelRows) {
      const replies = (repliesByParent.get(row.id) ?? []).map(mapComment);

      if (row.deletedAt !== null) {
        // A deleted top-level comment with at least one visible reply leaves a stub
        if (replies.length > 0) {
          timeline.push({
            kind: "stub",
            id: row.id,
            replies,
          });
        }
      } else {
        timeline.push({
          kind: "comment",
          comment: mapComment(row),
          replies,
        });
      }
    }

    return timeline;
  }
}
