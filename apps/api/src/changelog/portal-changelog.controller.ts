import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, isNotNull, desc, inArray } from "drizzle-orm";
import {
  DB,
  type Db,
  changelogEntries,
  changelogTags,
  changelogEntryTags,
} from "@userhq/db";
import {
  CHANGELOG_PAGE_SIZE,
  PublicChangelogFeedResponseSchema,
  PublicChangelogEntrySchema,
  type PublicChangelogFeedResponse,
  type PublicChangelogEntry,
} from "@userhq/types";
import { Public } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { encodeBoardCursor, decodeBoardCursor } from "../feedback/cursor.js";

@Controller("portal/:ws/:product/changelog")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalChangelogController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Public()
  @SerializeOptions({ schema: PublicChangelogFeedResponseSchema })
  async getPublicChangelogFeed(
    @Req() req: any,
    @Query("cursor") cursor?: string
  ): Promise<PublicChangelogFeedResponse> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const offset = cursor ? decodeBoardCursor(cursor) : 0;
    const rows = await this.db
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        slug: changelogEntries.slug,
        summary: changelogEntries.summary,
        content: changelogEntries.content,
        publishedAt: changelogEntries.publishedAt,
        createdAt: changelogEntries.createdAt,
      })
      .from(changelogEntries)
      .where(
        and(
          eq(changelogEntries.productId, productId),
          isNotNull(changelogEntries.publishedAt)
        )
      )
      .orderBy(desc(changelogEntries.publishedAt), desc(changelogEntries.id))
      .offset(offset)
      .limit(CHANGELOG_PAGE_SIZE + 1);

    const hasMore = rows.length > CHANGELOG_PAGE_SIZE;
    const page = rows.slice(0, CHANGELOG_PAGE_SIZE);
    const nextCursor = hasMore ? encodeBoardCursor(offset + CHANGELOG_PAGE_SIZE) : null;
    if (page.length === 0) {
      return { entries: [], nextCursor };
    }

    const tagRows = await this.db
      .select({
        entryId: changelogEntryTags.entryId,
        id: changelogTags.id,
        name: changelogTags.name,
        color: changelogTags.color,
      })
      .from(changelogEntryTags)
      .innerJoin(changelogTags, eq(changelogEntryTags.tagId, changelogTags.id))
      .where(
        and(
          eq(changelogEntryTags.productId, productId),
          inArray(changelogEntryTags.entryId, page.map((r) => r.id))
        )
      );

    const tagsByEntry = new Map<string, { id: string; name: string; color: string }[]>();
    for (const tag of tagRows) {
      const list = tagsByEntry.get(tag.entryId) ?? [];
      list.push({ id: tag.id, name: tag.name, color: tag.color });
      tagsByEntry.set(tag.entryId, list);
    }

    return {
      entries: page.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        summary: r.summary ?? null,
        content: r.content as any,
        publishedAt: new Date(r.publishedAt!).toISOString(),
        tags: tagsByEntry.get(r.id) ?? [],
        createdAt: new Date(r.createdAt).toISOString(),
      })),
      nextCursor,
    };
  }

  @Get(":slug")
  @Public()
  @SerializeOptions({ schema: PublicChangelogEntrySchema })
  async getPublicChangelogEntry(
    @Req() req: any,
    @Param("slug") slug: string
  ): Promise<PublicChangelogEntry> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [row] = await this.db
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        slug: changelogEntries.slug,
        summary: changelogEntries.summary,
        content: changelogEntries.content,
        publishedAt: changelogEntries.publishedAt,
        createdAt: changelogEntries.createdAt,
      })
      .from(changelogEntries)
      .where(
        and(
          eq(changelogEntries.productId, productId),
          eq(changelogEntries.slug, slug.toLowerCase()),
          isNotNull(changelogEntries.publishedAt)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }

    const tagRows = await this.db
      .select({
        id: changelogTags.id,
        name: changelogTags.name,
        color: changelogTags.color,
      })
      .from(changelogEntryTags)
      .innerJoin(changelogTags, eq(changelogEntryTags.tagId, changelogTags.id))
      .where(
        and(
          eq(changelogEntryTags.entryId, row.id),
          eq(changelogEntryTags.productId, productId)
        )
      );

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary ?? null,
      content: row.content as any,
      publishedAt: new Date(row.publishedAt!).toISOString(),
      tags: tagRows,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}
