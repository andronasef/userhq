import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull, desc, inArray, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  notifications,
  posts,
  postActivity,
  statuses,
  products,
  workspaces,
} from "@userhq/db";
import {
  NOTIFICATION_PAGE_SIZE,
  type NotificationListResponse,
  type UnreadNotificationCountResponse,
  type MarkReadResponse,
} from "@userhq/types";
import { encodeBoardCursor, decodeBoardCursor } from "../feedback/cursor.js";

type DbOrTx = Db | any;

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Fan out status change notifications to all stakeholders of a post:
   * - author of the post
   * - voters of the post
   * - non-deleted commenters of the post
   *
   * Excludes the actor who performed the status change.
   * Upserts into notifications table on conflict (userId, postId), grouping repeated status changes (LOOP-04).
   */
  async fanOutStatusChange(
    tx: DbOrTx,
    opts: {
      workspaceId: string;
      productId: string;
      postId: string;
      postActivityId: string;
      actorId: string;
    }
  ): Promise<void> {
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

    for (const row of rows) {
      if (!row.user_id) continue;
      await tx
        .insert(notifications)
        .values({
          userId: row.user_id,
          workspaceId: opts.workspaceId,
          productId: opts.productId,
          postId: opts.postId,
          postActivityId: opts.postActivityId,
          readAt: null,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [notifications.userId, notifications.postId],
          set: {
            postActivityId: opts.postActivityId,
            readAt: null,
            createdAt: new Date(),
          },
        });
    }
  }

  // Notifications whose post (or its product/workspace) was deleted lead nowhere:
  // hide them from both the list and the unread badge.
  private visible(userId: string) {
    return and(
      eq(notifications.userId, userId),
      isNull(posts.deletedAt),
      isNull(products.deletedAt),
      isNull(workspaces.deletedAt)
    );
  }

  async getUnreadCount(userId: string): Promise<UnreadNotificationCountResponse> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .innerJoin(posts, eq(notifications.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
      .where(and(this.visible(userId), isNull(notifications.readAt)));

    return { unreadCount: Number(result?.count ?? 0) };
  }

  // ponytail: offset cursor; a status change mid-scroll re-sorts a row to the top, the client dedupes by id
  async listNotifications(
    userId: string,
    cursor?: string
  ): Promise<NotificationListResponse> {
    const offset = cursor ? decodeBoardCursor(cursor) : 0;
    const rows = await this.db
      .select({
        id: notifications.id,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        postId: posts.id,
        postNumber: posts.number,
        postTitle: posts.title,
        postStatusId: statuses.id,
        postStatusName: statuses.name,
        postStatusColor: statuses.color,
        workspaceSlug: workspaces.slug,
        productSlug: products.slug,
        activityId: postActivity.id,
        activityKind: postActivity.kind,
        activityToStatusId: postActivity.toStatusId,
        activityStatusName: postActivity.statusName,
        activityStatusColor: postActivity.statusColor,
        activityNote: postActivity.note,
        activityCreatedAt: postActivity.createdAt,
      })
      .from(notifications)
      .innerJoin(posts, eq(notifications.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .innerJoin(postActivity, eq(notifications.postActivityId, postActivity.id))
      .where(this.visible(userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .offset(offset)
      .limit(NOTIFICATION_PAGE_SIZE + 1);

    const hasMore = rows.length > NOTIFICATION_PAGE_SIZE;
    const unread = await this.getUnreadCount(userId);

    return {
      nextCursor: hasMore ? encodeBoardCursor(offset + NOTIFICATION_PAGE_SIZE) : null,
      notifications: rows.slice(0, NOTIFICATION_PAGE_SIZE).map((r) => ({
        id: r.id,
        readAt: r.readAt ? r.readAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        post: {
          id: r.postId,
          number: r.postNumber,
          title: r.postTitle,
          workspaceSlug: r.workspaceSlug,
          productSlug: r.productSlug,
          status: {
            id: r.postStatusId,
            name: r.postStatusName,
            color: r.postStatusColor,
          },
        },
        activity: {
          id: r.activityId,
          type: r.activityKind,
          fromStatus: null,
          toStatus: r.activityToStatusId
            ? {
                id: r.activityToStatusId,
                name: r.activityStatusName,
                color: r.activityStatusColor,
              }
            : null,
          note: r.activityNote ?? null,
          createdAt: r.activityCreatedAt.toISOString(),
        },
      })),
      unreadCount: unread.unreadCount,
    };
  }

  async markRead(
    userId: string,
    notificationIds?: string[]
  ): Promise<MarkReadResponse> {
    if (notificationIds && notificationIds.length > 0) {
      await this.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            inArray(notifications.id, notificationIds),
            isNull(notifications.readAt)
          )
        );
    } else {
      await this.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            isNull(notifications.readAt)
          )
        );
    }

    return { success: true };
  }

  async markPostRead(userId: string, postId: string): Promise<MarkReadResponse> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.postId, postId),
          isNull(notifications.readAt)
        )
      );

    return { success: true };
  }
}
