import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, isNull, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db, roadmapItems, statuses, posts } from "@userhq/db";
import {
  PublicRoadmapListResponseSchema,
  PublicRoadmapDetailResponseSchema,
  type PublicRoadmapListResponse,
  postSlug,
  type PublicRoadmapDetailResponse,
} from "@userhq/types";
import { Public } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";

const UuidParamSchema = z.string().uuid();

@Controller("portal/:ws/:product/roadmap")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalRoadmapController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Public()
  @SerializeOptions({ schema: PublicRoadmapListResponseSchema })
  async getPublicRoadmap(@Req() req: any): Promise<PublicRoadmapListResponse> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    // Strict query: ONLY selects from roadmapItems, statuses where is_public_roadmap = true, and posts
    // STRICT ZERO-JOIN to roadmapItemInternals (ROAD-12)
    const rows = await this.db
      .select({
        id: roadmapItems.id,
        statusId: roadmapItems.statusId,
        title: roadmapItems.publicTitle,
        description: roadmapItems.publicDescription,
        rank: roadmapItems.rank,
        createdAt: roadmapItems.createdAt,
        postCount: sql<number>`count(${posts.id})::int`,
      })
      .from(roadmapItems)
      .innerJoin(
        statuses,
        and(
          eq(roadmapItems.statusId, statuses.id),
          eq(statuses.isPublicRoadmap, true)
        )
      )
      .leftJoin(
        posts,
        and(
          eq(posts.roadmapItemId, roadmapItems.id),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .where(
        and(
          eq(roadmapItems.productId, productId),
          eq(roadmapItems.isPublic, true)
        )
      )
      .groupBy(roadmapItems.id)
      .orderBy(asc(sql`${roadmapItems.rank} COLLATE "C"`), asc(roadmapItems.createdAt));

    return {
      items: rows.map((r) => ({
        id: r.id,
        statusId: r.statusId,
        title: r.title ?? "Untitled item",
        description: r.description ?? null,
        postCount: Number(r.postCount ?? 0),
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    };
  }

  @Get(":id")
  @Public()
  @SerializeOptions({ schema: PublicRoadmapDetailResponseSchema })
  async getPublicRoadmapDetail(
    @Req() req: any,
    @Param("id") rawId: string
  ): Promise<PublicRoadmapDetailResponse> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const parsedId = UuidParamSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    // Strict query: ONLY selects from roadmapItems and statuses where is_public_roadmap = true
    // STRICT ZERO-JOIN to roadmapItemInternals (ROAD-12)
    const [row] = await this.db
      .select({
        id: roadmapItems.id,
        statusId: roadmapItems.statusId,
        title: roadmapItems.publicTitle,
        description: roadmapItems.publicDescription,
        createdAt: roadmapItems.createdAt,
      })
      .from(roadmapItems)
      .innerJoin(
        statuses,
        and(
          eq(roadmapItems.statusId, statuses.id),
          eq(statuses.isPublicRoadmap, true)
        )
      )
      .where(
        and(
          eq(roadmapItems.id, parsedId.data),
          eq(roadmapItems.productId, productId),
          eq(roadmapItems.isPublic, true)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Roadmap item not found.");
    }

    const linkedPosts = await this.db
      .select({
        number: posts.number,
        title: posts.title,
        voteCount: posts.voteCount,
      })
      .from(posts)
      .where(
        and(
          eq(posts.roadmapItemId, row.id),
          eq(posts.productId, productId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .orderBy(asc(posts.number));

    return {
      item: {
        id: row.id,
        statusId: row.statusId,
        title: row.title ?? "Untitled item",
        description: row.description ?? null,
        postCount: linkedPosts.length,
        createdAt: new Date(row.createdAt).toISOString(),
      },
      posts: linkedPosts.map((p) => ({
        number: p.number,
        slug: postSlug(p.title),
        title: p.title,
        voteCount: p.voteCount,
      })),
    };
  }
}
