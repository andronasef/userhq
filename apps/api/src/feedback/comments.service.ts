import { Injectable, Inject, Optional } from "@nestjs/common";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { DB, type Db, posts, comments, user, products, workspaces, workspaceApiKeys } from "@userhq/db";
import type {
  CreateCommentInput,
  UpdateCommentInput,
  PublicComment,
  TimelineItem,
  DeviceInfo,
  PublicBadgeChip,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isFeedbackAdmin } from "./membership.js";
import { type Actor, actorSource, keySource } from "../auth/principal.js";
import { enqueueCommentEmail } from "../email/outbox.js";
import { enqueueWebhookEvent } from "../webhooks/outbox.js";
import { parseUserAgent } from "./device-info.js";
import { PushService } from "../push/push.service.js";
import { getPublicBadgesForUsers } from "../badges/badges.service.js";

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
  createdByApiKeyId?: string | null;
  apiKeyName?: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorDeletedAt: Date | null;
}

@Injectable()
export class CommentsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Optional() private readonly pushService?: PushService
  ) {}

  async createComment(
    portal: { workspaceId: string; productId: string },
    currentUser: Actor & { name: string | null; image: string | null },
    number: number,
    input: CreateCommentInput,
    userAgent?: string | null,
    apiKeyId?: string | null
  ): Promise<PublicComment> {
    const deviceInfo = parseUserAgent(userAgent);

    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .select({
          id: posts.id,
          number: posts.number,
          title: posts.title,
        })
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

      const isAdmin = await isFeedbackAdmin(tx, currentUser, portal.workspaceId);

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
          createdByApiKeyId: apiKeyId ?? null,
        })
        .returning();

      // D-04: an admin reply resolves the whole customer thread (root plus its direct replies).
      // Conditional on unhandled so an existing handler and time are never overwritten.
      if (isAdmin && resolvedParentId) {
        await tx
          .update(comments)
          .set({ handledAt: sql`now()`, handledById: currentUser.id })
          .where(
            and(
              eq(comments.postId, p.id),
              eq(comments.isAdmin, false),
              isNull(comments.deletedAt),
              isNull(comments.handledAt),
              or(eq(comments.id, resolvedParentId), eq(comments.parentId, resolvedParentId))
            )
          );
      }

      await enqueueCommentEmail(tx, {
        postId: p.id,
        commentId: newComment.id,
        actorId: currentUser.id,
        workspaceId: portal.workspaceId,
      });

      await enqueueWebhookEvent(tx, {
        workspaceId: portal.workspaceId,
        productId: portal.productId,
        eventType: "comment.created",
        data: {
          id: newComment.id,
          postId: p.id,
          postNumber: p.number,
          authorId: currentUser.id,
          body: newComment.body,
          parentId: resolvedParentId,
        },
      });

      if (this.pushService) {
        const [prod] = await tx
          .select({
            name: products.name,
            slug: products.slug,
            workspaceSlug: workspaces.slug,
          })
          .from(products)
          .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
          .where(eq(products.id, portal.productId))
          .limit(1);

        if (prod) {
          // Push notification for reply
          await this.pushService.enqueueReplyPush(tx, {
            workspaceId: portal.workspaceId,
            productId: portal.productId,
            postId: p.id,
            commentId: newComment.id,
            parentCommentId: resolvedParentId,
            actorId: currentUser.id,
            actorName: currentUser.name || "A user",
            commentContent: newComment.body,
            postTitle: p.title,
            productSlug: prod.slug,
            workspaceSlug: prod.workspaceSlug,
            postNumber: p.number,
          });

          // If top-level comment, push notification to admins following the product
          if (!resolvedParentId) {
            await this.pushService.enqueueNewCommentPush(tx, {
              workspaceId: portal.workspaceId,
              productId: portal.productId,
              postId: p.id,
              commentId: newComment.id,
              actorId: currentUser.id,
              actorName: currentUser.name || "A user",
              postTitle: p.title,
              productName: prod.name,
              productSlug: prod.slug,
              workspaceSlug: prod.workspaceSlug,
              postNumber: p.number,
            });
          }
        }
      }

      const userBadgesMap = await getPublicBadgesForUsers(this.db, portal.productId, [currentUser.id]);
      const userBadges = userBadgesMap.get(currentUser.id) ?? [];

      return {
        id: newComment.id,
        author: {
          name: currentUser.name ?? null,
          image: currentUser.image ?? null,
          isAdmin,
          deleted: false,
          badges: userBadges,
        },
        body: newComment.body,
        createdAt: newComment.createdAt.toISOString(),
        editedAt: newComment.editedAt ? newComment.editedAt.toISOString() : null,
        version: newComment.version,
        canEdit: true,
        canDelete: true,
        deviceInfo: isAdmin ? (newComment.deviceInfo ?? null) : null,
        source: actorSource(currentUser),
      };
    });
  }

  async updateComment(
    portal: { workspaceId: string; productId: string },
    currentUser: Actor,
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

    const isAdmin = await isFeedbackAdmin(this.db, currentUser, portal.workspaceId);
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
    const [keyRow] = updated.createdByApiKeyId
      ? await this.db
          .select({ name: workspaceApiKeys.name })
          .from(workspaceApiKeys)
          .where(eq(workspaceApiKeys.id, updated.createdByApiKeyId))
          .limit(1)
      : [];

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
      source: keySource(updated.createdByApiKeyId, keyRow?.name),
    };
  }

  async deleteComment(
    portal: { workspaceId: string; productId: string },
    currentUser: Actor,
    commentId: string
  ): Promise<void> {
    const [row] = await this.db
      .select({
        commentId: comments.id,
        commentAuthorId: comments.authorId,
        commentDeletedAt: comments.deletedAt,
        postId: comments.postId,
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

    const isAdmin = await isFeedbackAdmin(this.db, currentUser, portal.workspaceId);
    const isAuthor = row.commentAuthorId === currentUser.id;

    if (!isAuthor && !isAdmin) {
      throw new ApiException("not_allowed", 403, "Not allowed.");
    }

    // One transaction: the webhook enqueue share-locks the product row, and the lock must outlive the insert (D-14).
    await this.db.transaction(async (tx) => {
      const [deleted] = await tx
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

      await enqueueWebhookEvent(tx, {
        workspaceId: portal.workspaceId,
        productId: portal.productId,
        eventType: "comment.deleted",
        data: {
          id: commentId,
          postId: row.postId,
        },
      });
    });
  }

  shapeTimeline(
    rows: CommentRowWithAuthor[],
    viewer: { userId: string | null; isAdmin: boolean },
    badgesByUserId?: Map<string, PublicBadgeChip[]>
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
          ? { name: null, image: null, isAdmin: false, deleted: true, badges: [] }
          : {
              name: row.authorName,
              image: row.authorImage,
              isAdmin: row.isAdmin,
              deleted: false,
              badges: badgesByUserId?.get(row.authorId) ?? [],
            },
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        version: row.version,
        canEdit: canManage && !row.deletedAt,
        canDelete: canManage && !row.deletedAt,
        deviceInfo: viewer.isAdmin ? (row.deviceInfo ?? null) : null,
        source: keySource(row.createdByApiKeyId, row.apiKeyName),
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
