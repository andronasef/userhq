import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull, isNotNull, sql, desc, inArray, gte, lt } from "drizzle-orm";
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
  workspaceApiKeys,
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
import { encodeKeysetCursor, decodeKeysetCursor, type KeysetKind } from "./cursor.js";
import { postSlug } from "@userhq/types";
import { type Actor, adminKeySource } from "../auth/principal.js";
import { CommentsService } from "./comments.service.js";

@Injectable()
export class WorkspaceFeedbackService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly commentsService: CommentsService
  ) {}

  async listRequests(
    tenant: { workspaceId: string },
    query: WorkspaceRequestsQuery
  ): Promise<WorkspaceRequestsResponse> {
    const limit = typeof query.limit === "number" ? query.limit : (Number(query.limit) || 20);
    const sort = query.sort ?? "top";
    const kind: KeysetKind = `requests:${sort}`;
    // Decode (and reject tampered cursors) before touching the database.
    const position = query.cursor ? decodeKeysetCursor(kind, query.cursor) : null;

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

    // UTC calendar days: from is the start of createdFrom, to is exclusive of the day after createdTo.
    const fromWhere = query.createdFrom
      ? gte(posts.createdAt, new Date(`${query.createdFrom}T00:00:00Z`))
      : undefined;
    const toWhere = query.createdTo
      ? lt(posts.createdAt, new Date(new Date(`${query.createdTo}T00:00:00Z`).getTime() + 86_400_000))
      : undefined;

    const effectiveWhere = and(
      baseWhere,
      productWhere,
      statusWhere,
      categoryWhere,
      searchWhere,
      fromWhere,
      toWhere
    );

    const totalCountQuery = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .where(effectiveWhere);

    const totalCount = totalCountQuery[0]?.count ?? 0;

    const activityAt = sql`coalesce((SELECT max(c.created_at) FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL), ${posts.createdAt})`;
    const orderClauses =
      sort === "new"
        ? [desc(posts.createdAt), desc(posts.id)]
        : sort === "activity"
          ? [desc(activityAt), desc(posts.id)]
          : [desc(posts.voteCount), desc(posts.createdAt), desc(posts.id)];

    // Row-value comparison, strictly less-than because every ordering is descending.
    const cursorWhere = position
      ? sort === "new"
        ? sql`(${posts.createdAt}, ${posts.id}) < (${position.t}::timestamptz, ${position.id}::uuid)`
        : sort === "activity"
          ? sql`(${activityAt}, ${posts.id}) < (${position.t}::timestamptz, ${position.id}::uuid)`
          : sql`(${posts.voteCount}, ${posts.createdAt}, ${posts.id}) < (${position.v}::int, ${position.t}::timestamptz, ${position.id}::uuid)`
      : undefined;
    const cursorTs =
      sort === "activity" ? sql<string>`(${activityAt})::text` : sql<string>`${posts.createdAt}::text`;

    const rows = await this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        description: posts.description,
        voteCount: posts.voteCount,
        createdAt: posts.createdAt,
        cursorTs,
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
        createdByApiKeyId: posts.createdByApiKeyId,
        apiKeyName: workspaceApiKeys.name,
        commentCount: sql<number>`(SELECT count(*)::int FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL)`,
      })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .leftJoin(user, eq(posts.authorId, user.id))
      .leftJoin(workspaceApiKeys, eq(posts.createdByApiKeyId, workspaceApiKeys.id))
      .where(and(effectiveWhere, cursorWhere))
      .orderBy(...orderClauses)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];

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
      source: adminKeySource(r.createdByApiKeyId, r.apiKeyName),
    }));

    // ponytail: votes or comments changing between page loads can move a row across the cursor; snapshot the sort key if that matters
    return {
      items,
      nextCursor:
        hasMore && lastRow
          ? encodeKeysetCursor(kind, { t: lastRow.cursorTs, id: lastRow.id, v: lastRow.voteCount })
          : null,
      totalCount,
    };
  }

  async listComments(
    tenant: { workspaceId: string },
    viewer: { id: string },
    query: WorkspaceCommentsQuery
  ): Promise<WorkspaceCommentsResponse> {
    const limit = typeof query.limit === "number" ? query.limit : (Number(query.limit) || 20);
    const position = query.cursor ? decodeKeysetCursor("comments", query.cursor) : null;

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
    const cursorWhere = position
      ? sql`(${comments.createdAt}, ${comments.id}) < (${position.t}::timestamptz, ${position.id}::uuid)`
      : undefined;

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
        cursorTs: sql<string>`${comments.createdAt}::text`,
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
        createdByApiKeyId: comments.createdByApiKeyId,
        apiKeyName: workspaceApiKeys.name,
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(products, eq(posts.productId, products.id))
      .leftJoin(uploads, eq(products.logoUploadId, uploads.id))
      .leftJoin(user, eq(comments.authorId, user.id))
      .leftJoin(workspaceApiKeys, eq(comments.createdByApiKeyId, workspaceApiKeys.id))
      .leftJoin(
        commentReads,
        and(eq(commentReads.commentId, comments.id), eq(commentReads.userId, viewer.id))
      )
      .where(and(effectiveWhere, cursorWhere))
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows[pageRows.length - 1];

    // Collect handledBy user names if any
    const handledByIds = pageRows
      .map((r) => r.handledById)
      .filter((id): id is string => Boolean(id));

    const handledUsersMap = new Map<
      string,
      { name: string | null; image: string | null; deleted: boolean }
    >();
    if (handledByIds.length > 0) {
      const handledUsers = await this.db
        .select({ id: user.id, name: user.name, image: user.image, deletedAt: user.deletedAt })
        .from(user)
        .where(inArray(user.id, handledByIds));
      for (const u of handledUsers) {
        handledUsersMap.set(u.id, { name: u.name, image: u.image, deleted: Boolean(u.deletedAt) });
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
          ? handledUser.deleted
            ? { name: null, image: null, isAdmin: false, deleted: true }
            : { name: handledUser.name, image: handledUser.image, isAdmin: true, deleted: false }
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
        source: adminKeySource(r.createdByApiKeyId, r.apiKeyName),
      };
    });

    return {
      items,
      nextCursor:
        hasMore && lastRow
          ? encodeKeysetCursor("comments", { t: lastRow.cursorTs, id: lastRow.id })
          : null,
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
      .where(and(eq(comments.id, commentId), isNull(comments.handledAt)));
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
    viewer: Actor & { name: string | null; image: string | null },
    commentId: string,
    input: ReplyWorkspaceCommentInput,
    apiKeyId?: string | null
  ): Promise<WorkspaceCommentItem> {
    // Tenant-scoped lookup first: a foreign or deleted comment id is a 404 before anything else runs.
    const [parent] = await this.db
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

    // Same creation path as the portal: folds to the thread root, resolves the thread,
    // post lock + merged guard, email (Board switch), webhook and push.
    const created = await this.commentsService.createComment(
      { workspaceId: tenant.workspaceId, productId: parent.productId },
      viewer,
      parent.postNumber,
      { body: input.body, parentId: parent.id },
      null,
      apiKeyId
    );

    return {
      id: created.id,
      body: created.body,
      isAdmin: created.author.isAdmin,
      createdAt: created.createdAt,
      editedAt: created.editedAt,
      handledAt: null,
      handledBy: null,
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
      author: created.author,
      source: created.source
        ? adminKeySource(apiKeyId ?? viewer.apiPrincipal?.keyId, created.source.name)
        : null,
    };
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
