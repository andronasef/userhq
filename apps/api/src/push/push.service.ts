import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  pushSubscriptions,
  pushPreferences,
  pushFollowedProducts,
  pushDeliveries,
  products,
  workspaces,
  posts,
  comments,
  user,
} from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { getVapidKeys } from "./push.config.js";
import type {
  RegisterPushSubscriptionInput,
  PushSubscriptionResponse,
  PushPreferences,
  UpdatePushPreferencesInput,
  FollowedProductItem,
  VapidPublicKeyResponse,
  PushTestResponse,
} from "@userhq/types";

type DbOrTx = Db | any;

@Injectable()
export class PushService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env
  ) {}

  getVapidPublicKey(): VapidPublicKeyResponse {
    const keys = getVapidKeys(this.env);
    return { publicKey: keys.publicKey };
  }

  async registerSubscription(
    userId: string,
    input: RegisterPushSubscriptionInput
  ): Promise<PushSubscriptionResponse> {
    const [sub] = await this.db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.endpoint],
        set: {
          userId,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
          userAgent: input.userAgent ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Ensure default preferences exist
    await this.db
      .insert(pushPreferences)
      .values({
        userId,
      })
      .onConflictDoNothing();

    return {
      id: sub.id,
      endpoint: sub.endpoint,
      userAgent: sub.userAgent,
      createdAt: sub.createdAt.toISOString(),
    };
  }

  async unregisterSubscription(userId: string, endpoint: string): Promise<{ success: boolean }> {
    const result = await this.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    return { success: true };
  }

  async getPreferences(userId: string): Promise<PushPreferences> {
    const [pref] = await this.db
      .select()
      .from(pushPreferences)
      .where(eq(pushPreferences.userId, userId))
      .limit(1);

    if (!pref) {
      return {
        enabled: true,
        includePreviews: false,
        notifyReplies: true,
        notifyStatusChanges: true,
        notifyNewPosts: true,
        notifyNewComments: true,
      };
    }

    return {
      enabled: pref.enabled,
      includePreviews: pref.includePreviews,
      notifyReplies: pref.notifyReplies,
      notifyStatusChanges: pref.notifyStatusChanges,
      notifyNewPosts: pref.notifyNewPosts,
      notifyNewComments: pref.notifyNewComments,
    };
  }

  async updatePreferences(
    userId: string,
    input: UpdatePushPreferencesInput
  ): Promise<PushPreferences> {
    const [existing] = await this.db
      .select()
      .from(pushPreferences)
      .where(eq(pushPreferences.userId, userId))
      .limit(1);

    if (!existing) {
      const [created] = await this.db
        .insert(pushPreferences)
        .values({
          userId,
          enabled: input.enabled ?? true,
          includePreviews: input.includePreviews ?? false,
          notifyReplies: input.notifyReplies ?? true,
          notifyStatusChanges: input.notifyStatusChanges ?? true,
          notifyNewPosts: input.notifyNewPosts ?? true,
          notifyNewComments: input.notifyNewComments ?? true,
        })
        .returning();

      return {
        enabled: created.enabled,
        includePreviews: created.includePreviews,
        notifyReplies: created.notifyReplies,
        notifyStatusChanges: created.notifyStatusChanges,
        notifyNewPosts: created.notifyNewPosts,
        notifyNewComments: created.notifyNewComments,
      };
    }

    const [updated] = await this.db
      .update(pushPreferences)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(pushPreferences.userId, userId))
      .returning();

    return {
      enabled: updated.enabled,
      includePreviews: updated.includePreviews,
      notifyReplies: updated.notifyReplies,
      notifyStatusChanges: updated.notifyStatusChanges,
      notifyNewPosts: updated.notifyNewPosts,
      notifyNewComments: updated.notifyNewComments,
    };
  }

  async getFollowedProducts(userId: string): Promise<FollowedProductItem[]> {
    const rows = await this.db
      .select({
        productId: pushFollowedProducts.productId,
        productName: products.name,
        productSlug: products.slug,
        workspaceSlug: workspaces.slug,
        createdAt: pushFollowedProducts.createdAt,
      })
      .from(pushFollowedProducts)
      .innerJoin(products, eq(pushFollowedProducts.productId, products.id))
      .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
      .where(
        and(
          eq(pushFollowedProducts.userId, userId),
          isNull(products.deletedAt),
          isNull(workspaces.deletedAt)
        )
      );

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      productSlug: r.productSlug,
      workspaceSlug: r.workspaceSlug,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async followProduct(userId: string, productId: string): Promise<{ success: boolean }> {
    const [product] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    await this.db
      .insert(pushFollowedProducts)
      .values({
        userId,
        productId,
      })
      .onConflictDoNothing();

    return { success: true };
  }

  async unfollowProduct(userId: string, productId: string): Promise<{ success: boolean }> {
    await this.db
      .delete(pushFollowedProducts)
      .where(
        and(
          eq(pushFollowedProducts.userId, userId),
          eq(pushFollowedProducts.productId, productId)
        )
      );

    return { success: true };
  }

  async enqueueTestPush(userId: string): Promise<PushTestResponse> {
    const subs = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length === 0) {
      return { success: false, enqueuedCount: 0 };
    }

    const pref = await this.getPreferences(userId);

    for (const sub of subs) {
      await this.db.insert(pushDeliveries).values({
        subscriptionId: sub.id,
        userId,
        eventType: "test",
        title: pref.includePreviews ? "UserHQ Push Test" : "UserHQ Notification",
        body: pref.includePreviews
          ? "This is a verified test push notification from UserHQ."
          : "You have a new test notification.",
        url: "/",
        data: { test: true },
      });
    }

    return { success: true, enqueuedCount: subs.length };
  }

  /**
   * Enqueues push deliveries for a status change.
   * Checks stakeholder preferences and product board_enabled status (D-02, D-10).
   */
  async enqueueStatusChangePush(
    tx: DbOrTx,
    opts: {
      workspaceId: string;
      productId: string;
      postId: string;
      actorId: string;
      postTitle: string;
      newStatusName: string;
      productSlug: string;
      workspaceSlug: string;
      postNumber: number;
    }
  ): Promise<void> {
    // Check product board status
    const [prod] = await tx
      .select({ boardEnabled: products.boardEnabled })
      .from(products)
      .where(eq(products.id, opts.productId))
      .limit(1);

    if (!prod || !prod.boardEnabled) return;

    // Stakeholders: post author, voters, and non-deleted commenters, excluding actor
    const stakeholders = await tx.execute(sql<{ user_id: string }>`
      SELECT DISTINCT user_id FROM (
        SELECT author_id AS user_id FROM posts WHERE id = ${opts.postId}
        UNION
        SELECT user_id FROM votes WHERE post_id = ${opts.postId}
        UNION
        SELECT author_id AS user_id FROM comments WHERE post_id = ${opts.postId} AND deleted_at IS NULL
      ) s
      WHERE user_id IS NOT NULL AND user_id != ${opts.actorId}
    `);

    const rows: { user_id: string }[] = stakeholders.rows ?? stakeholders;
    if (rows.length === 0) return;

    const userIds = rows.map((r) => r.user_id).filter(Boolean);

    // Fetch preferences for stakeholders
    const prefs = await tx
      .select()
      .from(pushPreferences)
      .where(inArray(pushPreferences.userId, userIds));

    const prefMap = new Map<string, PushPreferences>();
    for (const p of prefs) {
      prefMap.set(p.userId, p);
    }

    // Fetch active subscriptions
    const subs = await tx
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    const postUrl = `/${opts.workspaceSlug}/${opts.productSlug}/posts/${opts.postNumber}`;

    for (const sub of subs) {
      const userPref = prefMap.get(sub.userId) ?? {
        enabled: true,
        includePreviews: false,
        notifyReplies: true,
        notifyStatusChanges: true,
        notifyNewPosts: true,
        notifyNewComments: true,
      };

      if (!userPref.enabled || !userPref.notifyStatusChanges) {
        continue;
      }

      const title = userPref.includePreviews
        ? `Status updated: ${opts.postTitle}`
        : "Feedback status updated";

      const body = userPref.includePreviews
        ? `Status changed to ${opts.newStatusName}`
        : "A post you follow has an updated status.";

      await tx.insert(pushDeliveries).values({
        subscriptionId: sub.id,
        userId: sub.userId,
        eventType: "status_change",
        title,
        body,
        url: postUrl,
        data: {
          postId: opts.postId,
          productId: opts.productId,
          newStatusName: opts.newStatusName,
        },
      });
    }
  }

  /**
   * Enqueues push deliveries for a reply to a comment or post.
   */
  async enqueueReplyPush(
    tx: DbOrTx,
    opts: {
      workspaceId: string;
      productId: string;
      postId: string;
      commentId: string;
      parentCommentId?: string | null;
      actorId: string;
      actorName: string;
      commentContent: string;
      postTitle: string;
      productSlug: string;
      workspaceSlug: string;
      postNumber: number;
    }
  ): Promise<void> {
    const [prod] = await tx
      .select({ boardEnabled: products.boardEnabled })
      .from(products)
      .where(eq(products.id, opts.productId))
      .limit(1);

    if (!prod || !prod.boardEnabled) return;

    // Recipient: if nested reply, author of parent comment; else author of post
    let targetUserId: string | null = null;
    if (opts.parentCommentId) {
      const [parent] = await tx
        .select({ authorId: comments.authorId })
        .from(comments)
        .where(eq(comments.id, opts.parentCommentId))
        .limit(1);
      targetUserId = parent?.authorId ?? null;
    } else {
      const [post] = await tx
        .select({ authorId: posts.authorId })
        .from(posts)
        .where(eq(posts.id, opts.postId))
        .limit(1);
      targetUserId = post?.authorId ?? null;
    }

    if (!targetUserId || targetUserId === opts.actorId) {
      return;
    }

    const pref = await this.getPreferences(targetUserId);
    if (!pref.enabled || !pref.notifyReplies) {
      return;
    }

    const subs = await tx
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, targetUserId));

    const postUrl = `/${opts.workspaceSlug}/${opts.productSlug}/posts/${opts.postNumber}`;

    for (const sub of subs) {
      const title = pref.includePreviews
        ? `${opts.actorName} replied`
        : "New reply";

      const snippet =
        opts.commentContent.length > 80
          ? `${opts.commentContent.slice(0, 77)}...`
          : opts.commentContent;

      const body = pref.includePreviews
        ? snippet
        : "There is a new reply on your feedback.";

      await tx.insert(pushDeliveries).values({
        subscriptionId: sub.id,
        userId: sub.userId,
        eventType: "comment_reply",
        title,
        body,
        url: postUrl,
        data: {
          postId: opts.postId,
          productId: opts.productId,
          commentId: opts.commentId,
        },
      });
    }
  }

  /**
   * Enqueues push deliveries for a new post to admins following the product.
   */
  async enqueueNewPostPush(
    tx: DbOrTx,
    opts: {
      workspaceId: string;
      productId: string;
      postId: string;
      actorId: string;
      postTitle: string;
      productName: string;
      productSlug: string;
      workspaceSlug: string;
      postNumber: number;
    }
  ): Promise<void> {
    const [prod] = await tx
      .select({ boardEnabled: products.boardEnabled })
      .from(products)
      .where(eq(products.id, opts.productId))
      .limit(1);

    if (!prod || !prod.boardEnabled) return;

    // Users following this product, excluding actor
    const followers = await tx
      .select({ userId: pushFollowedProducts.userId })
      .from(pushFollowedProducts)
      .where(
        and(
          eq(pushFollowedProducts.productId, opts.productId),
          sql`${pushFollowedProducts.userId} != ${opts.actorId}`
        )
      );

    if (followers.length === 0) return;

    const followerUserIds = followers.map((f: { userId: string }) => f.userId);

    const subs = await tx
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, followerUserIds));

    const postUrl = `/${opts.workspaceSlug}/${opts.productSlug}/posts/${opts.postNumber}`;

    for (const sub of subs) {
      const pref = await this.getPreferences(sub.userId);
      if (!pref.enabled || !pref.notifyNewPosts) {
        continue;
      }

      const title = pref.includePreviews
        ? `New post in ${opts.productName}`
        : "New feedback request";

      const body = pref.includePreviews
        ? opts.postTitle
        : "A new post was submitted to a product you follow.";

      await tx.insert(pushDeliveries).values({
        subscriptionId: sub.id,
        userId: sub.userId,
        eventType: "new_post",
        title,
        body,
        url: postUrl,
        data: {
          postId: opts.postId,
          productId: opts.productId,
        },
      });
    }
  }

  /**
   * Enqueues push deliveries for a new comment to product followers.
   */
  async enqueueNewCommentPush(
    tx: DbOrTx,
    opts: {
      workspaceId: string;
      productId: string;
      postId: string;
      commentId: string;
      actorId: string;
      actorName: string;
      postTitle: string;
      productName: string;
      productSlug: string;
      workspaceSlug: string;
      postNumber: number;
    }
  ): Promise<void> {
    const [prod] = await tx
      .select({ boardEnabled: products.boardEnabled })
      .from(products)
      .where(eq(products.id, opts.productId))
      .limit(1);

    if (!prod || !prod.boardEnabled) return;

    const followers = await tx
      .select({ userId: pushFollowedProducts.userId })
      .from(pushFollowedProducts)
      .where(
        and(
          eq(pushFollowedProducts.productId, opts.productId),
          sql`${pushFollowedProducts.userId} != ${opts.actorId}`
        )
      );

    if (followers.length === 0) return;

    const followerUserIds = followers.map((f: { userId: string }) => f.userId);

    const subs = await tx
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, followerUserIds));

    const postUrl = `/${opts.workspaceSlug}/${opts.productSlug}/posts/${opts.postNumber}`;

    for (const sub of subs) {
      const pref = await this.getPreferences(sub.userId);
      if (!pref.enabled || !pref.notifyNewComments) {
        continue;
      }

      const title = pref.includePreviews
        ? `New comment in ${opts.productName}`
        : "New feedback comment";

      const body = pref.includePreviews
        ? `Comment on "${opts.postTitle}"`
        : "A new comment was added to a product you follow.";

      await tx.insert(pushDeliveries).values({
        subscriptionId: sub.id,
        userId: sub.userId,
        eventType: "new_comment",
        title,
        body,
        url: postUrl,
        data: {
          postId: opts.postId,
          productId: opts.productId,
          commentId: opts.commentId,
        },
      });
    }
  }
}
