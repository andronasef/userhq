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

    // 2. Engaged posts with their latest status change and comment stats, in one query
    const res = await this.db.execute<{
      id: string;
      number: number;
      title: string;
      created_at: Date;
      status_id: string;
      status_name: string;
      status_color: string;
      is_author: boolean;
      is_commenter: boolean;
      act_status_id: string | null;
      act_status_name: string | null;
      act_status_color: string | null;
      act_created_at: Date | null;
      comment_count: number;
      latest_other_comment_at: Date | null;
    }>(sql`
      SELECT
        p.id, p.number, p.title, p.created_at, p.status_id,
        s.name AS status_name,
        s.color AS status_color,
        (p.author_id = ${user.id}) AS is_author,
        EXISTS(SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id = ${user.id} AND c.deleted_at IS NULL) AS is_commenter,
        la.to_status_id AS act_status_id,
        la.status_name AS act_status_name,
        la.status_color AS act_status_color,
        la.created_at AS act_created_at,
        cm.comment_count,
        cm.latest_other_comment_at
      FROM posts p
      INNER JOIN statuses s ON s.id = p.status_id
      LEFT JOIN LATERAL (
        SELECT a.to_status_id, a.status_name, a.status_color, a.created_at
        FROM post_activity a
        WHERE a.post_id = p.id AND a.kind = 'status_changed'
        ORDER BY a.created_at DESC
        LIMIT 1
      ) la ON true
      CROSS JOIN LATERAL (
        SELECT
          COUNT(*)::int AS comment_count,
          MAX(c.created_at) FILTER (WHERE c.author_id <> ${user.id}) AS latest_other_comment_at
        FROM comments c
        WHERE c.post_id = p.id AND c.deleted_at IS NULL
      ) cm
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

    const since = new Date(lastVisitedAt).getTime();
    const activities: ActivityItem[] = res.rows.map((p) => {
      const hasNewStatus =
        p.act_created_at !== null && new Date(p.act_created_at).getTime() > since;
      return {
        id: p.id,
        type: p.is_author ? "created" : p.is_commenter ? "commented" : "voted",
        post: {
          id: p.id,
          number: p.number,
          title: p.title,
          status: { id: p.status_id, name: p.status_name, color: p.status_color },
        },
        fromStatus: null,
        toStatus: p.act_status_id
          ? { id: p.act_status_id, name: p.act_status_name!, color: p.act_status_color! }
          : null,
        hasNewStatus,
        hasStatusChange: hasNewStatus,
        hasNewComments:
          p.latest_other_comment_at !== null &&
          new Date(p.latest_other_comment_at).getTime() > since,
        commentCount: Number(p.comment_count),
        createdAt: new Date(p.created_at).toISOString(),
      };
    });

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
