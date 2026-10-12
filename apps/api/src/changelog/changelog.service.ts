import { Injectable, Inject } from "@nestjs/common";
import { and, eq, ne, inArray, desc, asc } from "drizzle-orm";
import {
  DB,
  type Db,
  changelogEntries,
  changelogTags,
  changelogEntryTags,
} from "@userhq/db";
import {
  slugify,
  type AdminChangelogEntry,
  type AdminChangelogListResponse,
  type ChangelogTag,
  type CreateChangelogEntryInput,
  type UpdateChangelogEntryInput,
  type ChangelogTagInput,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isUniqueViolation } from "../common/db-errors.js";

@Injectable()
export class ChangelogService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listAdminEntries(productId: string): Promise<AdminChangelogListResponse> {
    const entries = await this.db
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        slug: changelogEntries.slug,
        summary: changelogEntries.summary,
        content: changelogEntries.content,
        publishedAt: changelogEntries.publishedAt,
        createdAt: changelogEntries.createdAt,
        updatedAt: changelogEntries.updatedAt,
      })
      .from(changelogEntries)
      .where(eq(changelogEntries.productId, productId))
      .orderBy(desc(changelogEntries.createdAt));

    const tags = await this.listTags(productId);

    if (entries.length === 0) {
      return { entries: [], tags };
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
      .where(eq(changelogEntryTags.productId, productId));

    const tagsByEntry = new Map<string, ChangelogTag[]>();
    for (const tag of tagRows) {
      const list = tagsByEntry.get(tag.entryId) ?? [];
      list.push({ id: tag.id, name: tag.name, color: tag.color });
      tagsByEntry.set(tag.entryId, list);
    }

    return {
      entries: entries.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        summary: e.summary ?? null,
        content: e.content as any,
        publishedAt: e.publishedAt ? new Date(e.publishedAt).toISOString() : null,
        tags: tagsByEntry.get(e.id) ?? [],
        createdAt: new Date(e.createdAt).toISOString(),
        updatedAt: new Date(e.updatedAt).toISOString(),
      })),
      tags,
    };
  }

  async getEntryById(
    productId: string,
    entryId: string,
    executor: any = this.db
  ): Promise<AdminChangelogEntry> {
    const [row] = await executor
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        slug: changelogEntries.slug,
        summary: changelogEntries.summary,
        content: changelogEntries.content,
        publishedAt: changelogEntries.publishedAt,
        createdAt: changelogEntries.createdAt,
        updatedAt: changelogEntries.updatedAt,
      })
      .from(changelogEntries)
      .where(
        and(
          eq(changelogEntries.id, entryId),
          eq(changelogEntries.productId, productId)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }

    const tagRows = await executor
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
      publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
      tags: tagRows,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async createEntry(
    productId: string,
    input: CreateChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    return this.db.transaction(async (tx) => {
      const baseSlug = input.slug
        ? slugify(input.slug, 80)
        : slugify(input.title, 80) || "entry";

      const slug = await this.findUniqueSlug(tx, productId, baseSlug);

      const [created] = await tx
        .insert(changelogEntries)
        .values({
          productId,
          title: input.title,
          slug,
          summary: input.summary ?? null,
          content: input.content,
          publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        })
        .returning({ id: changelogEntries.id });

      if (input.tagIds && input.tagIds.length > 0) {
        const validTags = await tx
          .select({ id: changelogTags.id })
          .from(changelogTags)
          .where(
            and(
              eq(changelogTags.productId, productId),
              inArray(changelogTags.id, input.tagIds)
            )
          );

        if (validTags.length > 0) {
          await tx.insert(changelogEntryTags).values(
            validTags.map((t) => ({
              entryId: created.id,
              tagId: t.id,
              productId,
            }))
          );
        }
      }

      return this.getEntryById(productId, created.id, tx);
    });
  }

  async updateEntry(
    productId: string,
    entryId: string,
    input: UpdateChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: changelogEntries.id,
          title: changelogEntries.title,
          slug: changelogEntries.slug,
          publishedAt: changelogEntries.publishedAt,
        })
        .from(changelogEntries)
        .where(
          and(
            eq(changelogEntries.id, entryId),
            eq(changelogEntries.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Changelog entry not found.");
      }

      const updates: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) {
        updates.title = input.title;
      }
      if (input.summary !== undefined) {
        updates.summary = input.summary;
      }
      if (input.content !== undefined) {
        updates.content = input.content;
      }
      if (input.publishedAt !== undefined) {
        updates.publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
      }

      // Slug deduplication: if slug explicitly passed, use it; else if title changed on draft, re-derive
      if (input.slug !== undefined) {
        const baseSlug = slugify(input.slug, 80) || "entry";
        updates.slug = await this.findUniqueSlug(tx, productId, baseSlug, entryId);
      } else if (
        input.title !== undefined &&
        input.title !== existing.title &&
        existing.publishedAt === null
      ) {
        const baseSlug = slugify(input.title, 80) || "entry";
        updates.slug = await this.findUniqueSlug(tx, productId, baseSlug, entryId);
      }

      await tx
        .update(changelogEntries)
        .set(updates)
        .where(eq(changelogEntries.id, entryId));

      if (input.tagIds !== undefined) {
        await tx
          .delete(changelogEntryTags)
          .where(
            and(
              eq(changelogEntryTags.entryId, entryId),
              eq(changelogEntryTags.productId, productId)
            )
          );

        if (input.tagIds.length > 0) {
          const validTags = await tx
            .select({ id: changelogTags.id })
            .from(changelogTags)
            .where(
              and(
                eq(changelogTags.productId, productId),
                inArray(changelogTags.id, input.tagIds)
              )
            );

          if (validTags.length > 0) {
            await tx.insert(changelogEntryTags).values(
              validTags.map((t) => ({
                entryId,
                tagId: t.id,
                productId,
              }))
            );
          }
        }
      }

      return this.getEntryById(productId, entryId, tx);
    });
  }

  async publishEntry(
    productId: string,
    entryId: string,
    customDate?: string
  ): Promise<AdminChangelogEntry> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: changelogEntries.id })
        .from(changelogEntries)
        .where(
          and(
            eq(changelogEntries.id, entryId),
            eq(changelogEntries.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Changelog entry not found.");
      }

      const publishedAt = customDate ? new Date(customDate) : new Date();

      await tx
        .update(changelogEntries)
        .set({
          publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(changelogEntries.id, entryId));

      return this.getEntryById(productId, entryId, tx);
    });
  }

  async unpublishEntry(
    productId: string,
    entryId: string
  ): Promise<AdminChangelogEntry> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: changelogEntries.id })
        .from(changelogEntries)
        .where(
          and(
            eq(changelogEntries.id, entryId),
            eq(changelogEntries.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Changelog entry not found.");
      }

      await tx
        .update(changelogEntries)
        .set({
          publishedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(changelogEntries.id, entryId));

      return this.getEntryById(productId, entryId, tx);
    });
  }

  async deleteEntry(productId: string, entryId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(changelogEntries)
      .where(
        and(
          eq(changelogEntries.id, entryId),
          eq(changelogEntries.productId, productId)
        )
      )
      .returning({ id: changelogEntries.id });

    if (!deleted) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }
  }

  async listTags(productId: string): Promise<ChangelogTag[]> {
    const rows = await this.db
      .select({
        id: changelogTags.id,
        name: changelogTags.name,
        color: changelogTags.color,
      })
      .from(changelogTags)
      .where(eq(changelogTags.productId, productId))
      .orderBy(asc(changelogTags.name));

    return rows;
  }

  async createTag(
    productId: string,
    input: ChangelogTagInput
  ): Promise<ChangelogTag> {
    try {
      const [inserted] = await this.db
        .insert(changelogTags)
        .values({
          productId,
          name: input.name,
          color: input.color,
        })
        .returning({
          id: changelogTags.id,
          name: changelogTags.name,
          color: changelogTags.color,
        });

      return inserted;
    } catch (e) {
      if (isUniqueViolation(e, "changelog_tags_product_name_ci")) {
        throw new ApiException(
          "tag_name_taken",
          409,
          "A tag with that name already exists."
        );
      }
      throw e;
    }
  }

  async deleteTag(productId: string, tagId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(changelogTags)
      .where(
        and(
          eq(changelogTags.id, tagId),
          eq(changelogTags.productId, productId)
        )
      )
      .returning({ id: changelogTags.id });

    if (!deleted) {
      throw new ApiException("not_found", 404, "Tag not found.");
    }
  }

  private async findUniqueSlug(
    executor: any,
    productId: string,
    baseSlug: string,
    excludeEntryId?: string
  ): Promise<string> {
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const conditions = [
        eq(changelogEntries.productId, productId),
        eq(changelogEntries.slug, candidate),
      ];
      if (excludeEntryId) {
        conditions.push(ne(changelogEntries.id, excludeEntryId));
      }

      const [existing] = await executor
        .select({ id: changelogEntries.id })
        .from(changelogEntries)
        .where(and(...conditions))
        .limit(1);

      if (!existing) {
        return candidate;
      }

      counter += 1;
      candidate = `${baseSlug}-${counter}`;
    }
  }
}
