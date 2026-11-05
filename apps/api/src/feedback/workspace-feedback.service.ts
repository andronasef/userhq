import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull, isNotNull, sql, desc, inArray } from "drizzle-orm";
import {
  DB,
  type Db,
  products,
  statuses,
  categories,
  posts,
  comments,
  commentReads,
  uploads,
  user,
} from "@userhq/db";
import type {
  WorkspaceRequestItem,
  WorkspaceRequestsQuery,
  WorkspaceRequestsResponse,
  WorkspaceCommentItem,
  WorkspaceCommentsQuery,
  WorkspaceCommentsResponse,
  ReplyWorkspaceCommentInput,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { prefixTsQuery } from "./search.js";
import { encodeBoardCursor, decodeBoardCursor } from "./cursor.js";
import { postSlug } from "@userhq/types";

@Injectable()
export class WorkspaceFeedbackService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listRequests(
    tenant: { workspaceId: string },
    query: WorkspaceRequestsQuery
  ): Promise<WorkspaceRequestsResponse> {
    const limit = typeof query.limit === "number" ? query.limit : (Number(query.limit) || 20);
    const offset = query.cursor ? decodeBoardCursor(query.cursor) : 0;

    const baseWhere = and(
      eq(products.workspaceId, tenant.workspaceId),
      isNull(products.deletedAt),
      isNull(posts.deletedAt),
      isNull(posts.mergedIntoId)
    );

    const productWhere = query.product
      ? eq(products.slug, query.product)
      : undefined;

    const statusWhere = query.statusId
      ? eq(posts.statusId, query.statusId)
      : query.statusType
        ? eq(statuses.type, query.statusType)
        : undefined;

    const categoryWhere = query.categoryId
      ? eq(posts.categoryId, query.categoryId)
      : undefined;

    const tsQuery = query.search ? prefixTsQuery(query.search) : null;
    const searchWhere = tsQuery
      ? sql`${posts.search} @@ to_tsquery('english', ${tsQuery})`
      : undefined;

    const effectiveWhere = and(
      baseWhere,
      productWhere,
      statusWhere,
      categoryWhere,
      searchWhere
    );

    const totalCountQuery = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .where(effectiveWhere);

    const totalCount = totalCountQuery[0]?.count ?? 0;

    const sort = query.sort ?? "top";
    const orderClauses =
      sort === "new"
        ? [desc(posts.createdAt), desc(posts.id)]
        : sort === "activity"
          ? [
              desc(
                sql`coalesce((SELECT max(c.created_at) FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL), ${posts.createdAt})`
              ),
              desc(posts.id),
            ]
          : [desc(posts.voteCount), desc(posts.createdAt), desc(posts.id)];

    const rows = await this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        description: posts.description,
        voteCount: posts.voteCount,
        createdAt: posts.createdAt,
        authorId: posts.authorId,
        authorIsAdmin: posts.authorIsAdmin,
        authorName: user.name,
        authorImage: user.image,
        authorDeletedAt: user.deletedAt,
        productId: products.id,
        productSlug: products.slug,
        productName: products.name,
        productLogoKey: uploads.storageKey,
        productAccentColor: products.accentColor,
        statusId: statuses.id,
        statusName: statuses.name,
        statusColor: statuses.color,
        statusType: statuses.type,
        categoryId: categories.id,
        categoryName: categories.name,
        commentCount: sql<number>`(SELECT count(*)::int FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL)`,
      })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .leftJoin(user, eq(posts.authorId, user.id))
      .where(effectiveWhere)
      .orderBy(...orderClauses)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: WorkspaceRequestItem[] = pageRows.map((r) => ({
      id: r.id,
      number: r.number,
      slug: postSlug(r.title),
      title: r.title,
      description: r.description,
      voteCount: r.voteCount,
      createdAt: r.createdAt.toISOString(),
      product: {
        id: r.productId,
        slug: r.productSlug,
        name: r.productName,
        logoUrl: r.productLogoKey ? `/uploads/${r.productLogoKey}` : null,
        accentColor: r.productAccentColor,
      },
      status: {
        id: r.statusId,
        name: r.statusName,
        color: r.statusColor,
        type: r.statusType as any,
      },
      category: r.categoryId && r.categoryName ? { id: r.categoryId, name: r.categoryName } : null,
      author: r.authorDeletedAt
        ? { name: null, image: null, isAdmin: false, deleted: true }
        : {
            name: r.authorName,
            image: r.authorImage,
            isAdmin: r.authorIsAdmin,
            deleted: false,
          },
      commentCount: r.commentCount,
    }));

    return {
      items,
      nextCursor: hasMore ? encodeBoardCursor(offset + limit) : null,
      totalCount,
    };
  }

  async listComments(
    tenant: { workspaceId: string },
    viewer: { id: string },
    query: WorkspaceCommentsQuery
  ): Promise<WorkspaceCommentsResponse> {
    const limit = typeof query.limit === "number" ? query.limit : (Number(query.limit) || 20);
    const offset = query.cursor ? decodeBoardCursor(query.cursor) : 0;

    const baseWhere = and(
      eq(products.workspaceId, tenant.workspaceId),
      isNull(products.deletedAt),
      isNull(posts.deletedAt),
      isNull(comments.deletedAt)
    );

    const productWhere = query.product
      ? eq(products.slug, query.product)
      : undefined;

    const attention = query.attention ?? "needs_attention";
    const attentionWhere =
      attention === "needs_attention"
        ? and(eq(comments.isAdmin, false), isNull(comments.handledAt))
        : attention === "handled"
          ? sql`(${comments.handledAt} IS NOT NULL OR ${comments.isAdmin} = true)`
          : undefined;

    const effectiveWhere = and(baseWhere, productWhere, attentionWhere);

    // Count needs attention across workspace
    const needsAttentionCountQuery = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .where(
        and(
          eq(products.workspaceId, tenant.workspaceId),
          isNull(products.deletedAt),
          isNull(posts.deletedAt),
          isNull(comments.deletedAt),
          eq(comments.isAdmin, false),
          isNull(comments.handledAt)
        )
      );

    const needsAttentionCount = needsAttentionCountQuery[0]?.count ?? 0;

    const rows = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        isAdmin: comments.isAdmin,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        handledAt: comments.handledAt,
        handledById: comments.handledById,
        authorId: comments.authorId,
        authorName: user.name,
        authorImage: user.image,
        authorDeletedAt: user.deletedAt,
        postId: posts.id,
        postNumber: posts.number,
        postTitle: posts.title,
        productId: products.id,
        productSlug: products.slug,
        productName: products.name,
        productLogoKey: uploads.storageKey,
        productAccentColor: products.accentColor,
        isRead: isNotNull(commentReads.readAt),
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .leftJoin(user, eq(comments.authorId, user.id))
      .leftJoin(
        commentReads,
        and(eq(commentReads.commentId, comments.id), eq(commentReads.userId, viewer.id))
      )
      .where(effectiveWhere)
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Collect handledBy user names if any
    const handledByIds = pageRows
      .map((r) => r.handledById)
      .filter((id): id is string => Boolean(id));

    const handledUsersMap = new Map<string, { name: string | null; image: string | null }>();
    if (handledByIds.length > 0) {
      const handledUsers = await this.db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, handledByIds));
      for (const u of handledUsers) {
        handledUsersMap.set(u.id, { name: u.name, image: u.image });
      }
    }

    const items: WorkspaceCommentItem[] = pageRows.map((r) => {
      const handledUser = r.handledById ? handledUsersMap.get(r.handledById) : null;
      return {
        id: r.id,
        body: r.body,
        isAdmin: r.isAdmin,
        createdAt: r.createdAt.toISOString(),
        editedAt: r.editedAt ? r.editedAt.toISOString() : null,
        handledAt: r.handledAt ? r.handledAt.toISOString() : null,
        handledBy: handledUser
          ? {
              name: handledUser.name,
              image: handledUser.image,
              isAdmin: true,
              deleted: false,
            }
          : null,
        isUnread: !r.isRead && r.authorId !== viewer.id,
        post: {
          id: r.postId,
          number: r.postNumber,
          slug: postSlug(r.postTitle),
          title: r.postTitle,
        },
        product: {
          id: r.productId,
          slug: r.productSlug,
          name: r.productName,
          logoUrl: r.productLogoKey ? `/uploads/${r.productLogoKey}` : null,
          accentColor: r.productAccentColor,
        },
        author: r.authorDeletedAt
          ? { name: null, image: null, isAdmin: false, deleted: true }
          : {
              name: r.authorName,
              image: r.authorImage,
              isAdmin: r.isAdmin,
              deleted: false,
            },
      };
    });

    return {
      items,
      nextCursor: hasMore ? encodeBoardCursor(offset + limit) : null,
      needsAttentionCount,
    };
  }

  async markCommentHandled(
    tenant: { workspaceId: string },
    viewer: { id: string },
    commentId: string
  ): Promise<void> {
    const [c] = await this.db
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(products.workspaceId, tenant.workspaceId),
          isNull(products.deletedAt),
          isNull(posts.deletedAt),
          isNull(comments.deletedAt)
        )
      )
      .limit(1);

    if (!c) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    await this.db
      .update(comments)
      .set({ handledAt: new Date(), handledById: viewer.id })
      .where(eq(comments.id, commentId));
  }

  async reopenComment(
    tenant: { workspaceId: string },
    commentId: string
  ): Promise<void> {
    const [c] = await this.db
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(products.workspaceId, tenant.workspaceId),
          isNull(products.deletedAt),
          isNull(posts.deletedAt),
          isNull(comments.deletedAt)
        )
      )
      .limit(1);

    if (!c) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    await this.db
      .update(comments)
      .set({ handledAt: null, handledById: null })
      .where(eq(comments.id, commentId));
  }

  async replyToComment(
    tenant: { workspaceId: string },
    viewer: { id: string; name: string | null; image: string | null },
    commentId: string,
    input: ReplyWorkspaceCommentInput
  ): Promise<WorkspaceCommentItem> {
    return this.db.transaction(async (tx) => {
      const [parent] = await tx
        .select({
          id: comments.id,
          postId: comments.postId,
          productId: posts.productId,
          postNumber: posts.number,
          postTitle: posts.title,
          productSlug: products.slug,
          productName: products.name,
          productLogoKey: uploads.storageKey,
          productAccentColor: products.accentColor,
        })
        .from(comments)
        .innerJoin(posts, eq(comments.postId, posts.id))
        .innerJoin(products, eq(posts.productId, products.id))
        .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
        .where(
          and(
            eq(comments.id, commentId),
            eq(products.workspaceId, tenant.workspaceId),
            isNull(products.deletedAt),
            isNull(posts.deletedAt),
            isNull(comments.deletedAt)
          )
        )
        .limit(1);

      if (!parent) {
        throw new ApiException("comment_not_found", 404, "Comment not found.");
      }

      // Mark target comment as handled
      await tx
        .update(comments)
        .set({ handledAt: new Date(), handledById: viewer.id })
        .where(eq(comments.id, commentId));

      // Insert new admin reply comment
      const [reply] = await tx
        .insert(comments)
        .values({
          postId: parent.postId,
          parentId: parent.id,
          authorId: viewer.id,
          isAdmin: true,
          body: input.body,
          handledAt: new Date(),
          handledById: viewer.id,
        })
        .returning();

      return {
        id: reply.id,
        body: reply.body,
        isAdmin: true,
        createdAt: reply.createdAt.toISOString(),
        editedAt: null,
        handledAt: reply.handledAt ? reply.handledAt.toISOString() : null,
        handledBy: {
          name: viewer.name,
          image: viewer.image,
          isAdmin: true,
          deleted: false,
        },
        isUnread: false,
        post: {
          id: parent.postId,
          number: parent.postNumber,
          slug: postSlug(parent.postTitle),
          title: parent.postTitle,
        },
        product: {
          id: parent.productId,
          slug: parent.productSlug,
          name: parent.productName,
          logoUrl: parent.productLogoKey ? `/uploads/${parent.productLogoKey}` : null,
          accentColor: parent.productAccentColor,
        },
        author: {
          name: viewer.name,
          image: viewer.image,
          isAdmin: true,
          deleted: false,
        },
      };
    });
  }

  async markCommentRead(
    tenant: { workspaceId: string },
    viewer: { id: string },
    commentId: string
  ): Promise<void> {
    const [c] = await this.db
      .select({ id: comments.id })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .where(
        and(
          eq(comments.id, commentId),
          eq(products.workspaceId, tenant.workspaceId),
          isNull(products.deletedAt),
          isNull(posts.deletedAt),
          isNull(comments.deletedAt)
        )
      )
      .limit(1);

    if (!c) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    await this.db
      .insert(commentReads)
      .values({
        userId: viewer.id,
        commentId,
        readAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [commentReads.userId, commentReads.commentId],
        set: { readAt: new Date() },
      });
  }
}
