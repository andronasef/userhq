import {
  Controller,
  Get,
  Inject,
  Req,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  userProductActivityVisits,
  postActivity,
} from "@userhq/db";
import {
  ActivityListResponseSchema,
  type ActivityListResponse,
  type ActivityItem,
} from "@userhq/types";
import { PortalGuard } from "../portal/portal.guard.js";
import { ApiException } from "../common/api-error.filter.js";

@Controller("portal/:ws/:product/activity")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalActivityController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @SerializeOptions({ schema: ActivityListResponseSchema })
  async getMyActivity(@Req() req: any): Promise<ActivityListResponse> {
    const user = req.user;
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in to view your activity.");
    }
    const portal = req.portal;

    // 1. Fetch user's previous visit timestamp for this product
    const [existingVisit] = await this.db
      .select({ lastVisitedAt: userProductActivityVisits.lastVisitedAt })
      .from(userProductActivityVisits)
      .where(
        and(
          eq(userProductActivityVisits.userId, user.id),
          eq(userProductActivityVisits.productId, portal.productId)
        )
      );

    const lastVisitedAt = existingVisit ? existingVisit.lastVisitedAt : new Date(0);

    // 2. Discover all non-deleted, non-merged posts for this product where user engaged
    const engagedPosts = await this.db.execute<{
      id: string;
      number: number;
      title: string;
      created_at: Date;
      status_id: string;
      status_name: string;
      status_color: string;
      is_author: boolean;
      is_voter: boolean;
      is_commenter: boolean;
    }>(sql`
      SELECT
        p.id,
        p.number,
        p.title,
        p.created_at,
        p.status_id,
        s.name AS status_name,
        s.color AS status_color,
        (p.author_id = ${user.id}) AS is_author,
        EXISTS(SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.user_id = ${user.id}) AS is_voter,
        EXISTS(SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id = ${user.id} AND c.deleted_at IS NULL) AS is_commenter
      FROM posts p
      INNER JOIN statuses s ON s.id = p.status_id
      WHERE p.product_id = ${portal.productId}
        AND p.deleted_at IS NULL
        AND p.merged_into_id IS NULL
        AND (
          p.author_id = ${user.id}
          OR EXISTS(SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.user_id = ${user.id})
          OR EXISTS(SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id = ${user.id} AND c.deleted_at IS NULL)
        )
      ORDER BY p.created_at DESC
    `);

    const postRows = engagedPosts.rows ?? engagedPosts;

    const activities: ActivityItem[] = [];

    for (const p of postRows) {
      // Determine primary engagement type
      let type = "voted";
      if (p.is_author) {
        type = "created";
      } else if (p.is_commenter) {
        type = "commented";
      }

      // Fetch latest status change activity for this post
      const [latestActivity] = await this.db
        .select({
          id: postActivity.id,
          toStatusId: postActivity.toStatusId,
          statusName: postActivity.statusName,
          statusColor: postActivity.statusColor,
          createdAt: postActivity.createdAt,
        })
        .from(postActivity)
        .where(
          and(
            eq(postActivity.postId, p.id),
            eq(postActivity.kind, "status_changed")
          )
        )
        .orderBy(sql`${postActivity.createdAt} DESC`)
        .limit(1);

      // Fetch comments metadata: count & latest comment from someone other than this user
      const commentRes = await this.db.execute<{
        comment_count: number;
        latest_other_comment_at: Date | null;
      }>(sql`
        SELECT
          COUNT(*)::int AS comment_count,
          MAX(CASE WHEN author_id != ${user.id} THEN created_at ELSE NULL END) AS latest_other_comment_at
        FROM comments
        WHERE post_id = ${p.id} AND deleted_at IS NULL
      `);
      const commentMeta = (commentRes.rows ?? commentRes)[0];

      const commentCount = Number(commentMeta?.comment_count ?? 0);
      const latestOtherCommentAt = commentMeta?.latest_other_comment_at
        ? new Date(commentMeta.latest_other_comment_at)
        : null;

      // Diffing rules:
      const hasNewStatus = latestActivity
        ? new Date(latestActivity.createdAt).getTime() > new Date(lastVisitedAt).getTime()
        : false;

      const hasNewComments = latestOtherCommentAt
        ? latestOtherCommentAt.getTime() > new Date(lastVisitedAt).getTime()
        : false;

      activities.push({
        id: p.id,
        type,
        post: {
          id: p.id,
          number: p.number,
          title: p.title,
          status: {
            id: p.status_id,
            name: p.status_name,
            color: p.status_color,
          },
        },
        fromStatus: null,
        toStatus: latestActivity && latestActivity.toStatusId
          ? {
              id: latestActivity.toStatusId,
              name: latestActivity.statusName,
              color: latestActivity.statusColor,
            }
          : null,
        hasNewStatus,
        hasStatusChange: hasNewStatus,
        hasNewComments,
        commentCount,
        createdAt: new Date(p.created_at).toISOString(),
      });
    }

    // 3. Upsert current visit timestamp
    await this.db
      .insert(userProductActivityVisits)
      .values({
        userId: user.id,
        productId: portal.productId,
        lastVisitedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [
          userProductActivityVisits.userId,
          userProductActivityVisits.productId,
        ],
        set: {
          lastVisitedAt: sql`now()`,
        },
      });

    return {
      activities,
      hasUnread: activities.some((a) => a.hasNewStatus || a.hasNewComments),
    };
  }
}
