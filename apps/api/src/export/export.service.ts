import { Injectable, Inject } from "@nestjs/common";
import { eq, and, isNull, gte, lt, or, desc, sql, inArray } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaces,
  products,
  posts,
  comments,
  categories,
  statuses,
  user,
} from "@userhq/db";
import type {
  FeedbackExportQuery,
  FeedbackExportResponse,
  FeedbackExportItem,
  FeedbackExportComment,
} from "@userhq/types";

interface ExportScope {
  workspaceId: string;
}

@Injectable()
export class ExportService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async exportFeedback(
    scope: ExportScope,
    query: FeedbackExportQuery
  ): Promise<FeedbackExportResponse> {
    const limit = query.limit ?? 100;

    const baseConditions = [
      eq(products.workspaceId, scope.workspaceId),
      isNull(products.deletedAt),
      isNull(posts.deletedAt),
    ];

    if (query.productId) {
      baseConditions.push(eq(posts.productId, query.productId));
    }

    if (query.since) {
      baseConditions.push(gte(posts.createdAt, new Date(query.since)));
    }

    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, "base64url").toString("utf8")
        );
        if (decoded.createdAt && decoded.id) {
          const cursorDate = new Date(decoded.createdAt);
          baseConditions.push(
            or(
              lt(posts.createdAt, cursorDate),
              and(
                eq(posts.createdAt, cursorDate),
                lt(posts.id, decoded.id)
              )
            )!
          );
        }
      } catch {
        // Ignore invalid cursor
      }
    }

    // Get total count matching non-cursor filters
    const countConditions = [
      eq(products.workspaceId, scope.workspaceId),
      isNull(products.deletedAt),
      isNull(posts.deletedAt),
    ];
    if (query.productId) countConditions.push(eq(posts.productId, query.productId));
    if (query.since) countConditions.push(gte(posts.createdAt, new Date(query.since)));

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .where(and(...countConditions));

    // Fetch posts
    const postRows = await this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        description: posts.description,
        voteCount: posts.voteCount,
        commentCount: sql<number>`(SELECT count(*)::int FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL)`,
        createdByApiKeyId: posts.createdByApiKeyId,
        createdAt: posts.createdAt,
        editedAt: posts.editedAt,
        productId: products.id,
        productName: products.name,
        productSlug: products.slug,
        categoryId: categories.id,
        categoryName: categories.name,
        statusId: statuses.id,
        statusName: statuses.name,
        statusType: statuses.type,
        statusColor: statuses.color,
        authorId: user.id,
        authorName: user.name,
        authorEmail: user.email,
      })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .leftJoin(user, eq(posts.authorId, user.id))
      .where(and(...baseConditions))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(limit + 1);

    const hasMore = postRows.length > limit;
    const pagedPosts = hasMore ? postRows.slice(0, limit) : postRows;

    let nextCursor: string | null = null;
    if (hasMore && pagedPosts.length > 0) {
      const last = pagedPosts[pagedPosts.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        })
      ).toString("base64url");
    }

    // Fetch comments for paged posts
    const postIds = pagedPosts.map((p) => p.id);
    const commentsByPostId = new Map<string, FeedbackExportComment[]>();

    if (postIds.length > 0) {
      const commentRows = await this.db
        .select({
          id: comments.id,
          postId: comments.postId,
          body: comments.body,
          isAdmin: comments.isAdmin,
          createdByApiKeyId: comments.createdByApiKeyId,
          createdAt: comments.createdAt,
          authorId: user.id,
          authorName: user.name,
          authorEmail: user.email,
        })
        .from(comments)
        .leftJoin(user, eq(comments.authorId, user.id))
        .where(
          and(
            inArray(comments.postId, postIds),
            isNull(comments.deletedAt)
          )
        )
        .orderBy(comments.createdAt);

      for (const c of commentRows) {
        const list = commentsByPostId.get(c.postId) ?? [];
        list.push({
          id: c.id,
          body: c.body,
          author: {
            id: c.authorId ?? "unknown",
            name: c.authorName ?? "Anonymous",
            email: c.authorEmail ?? undefined,
          },
          isAdmin: c.isAdmin,
          createdByApiKeyId: c.createdByApiKeyId,
          createdAt: c.createdAt.toISOString(),
        });
        commentsByPostId.set(c.postId, list);
      }
    }

    const items: FeedbackExportItem[] = pagedPosts.map((p) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      description: p.description,
      product: {
        id: p.productId,
        name: p.productName,
        slug: p.productSlug,
      },
      category: p.categoryId && p.categoryName
        ? { id: p.categoryId, name: p.categoryName }
        : null,
      status: {
        id: p.statusId,
        name: p.statusName,
        type: p.statusType as any,
        color: p.statusColor,
      },
      author: {
        id: p.authorId ?? "unknown",
        name: p.authorName ?? "Anonymous",
        email: p.authorEmail ?? undefined,
      },
      voteCount: p.voteCount,
      commentCount: p.commentCount,
      createdByApiKeyId: p.createdByApiKeyId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: (p.editedAt ?? p.createdAt).toISOString(),
      comments: commentsByPostId.get(p.id) ?? [],
    }));

    return {
      items,
      nextCursor,
      hasMore,
      totalCount: count,
    };
  }
}
