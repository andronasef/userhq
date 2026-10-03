import { Injectable, Inject } from "@nestjs/common";
import { eq, and, isNull, sql, notInArray, desc, asc, getTableName } from "drizzle-orm";
import {
  DB,
  type Db,
  products,
  statuses,
  categories,
  posts,
  votes,
  comments,
  postMutes,
  postActivity,
  user,
} from "@userhq/db";
import {
  type CreatePostInput,
  type UpdatePostInput,
  type PostCreated,
  type BoardQuery,
  type PublicBoardPage,
  type PublicPostPage,
  type PublicAuthor,
  type PostViewer,
  type TimelineItem,
  postSlug,
  BOARD_PAGE_SIZE,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isWorkspaceAdmin } from "./membership.js";
import { prefixTsQuery } from "./search.js";
import { encodeBoardCursor, decodeBoardCursor } from "./cursor.js";
import { CommentsService } from "./comments.service.js";

export function engagedSql(postsTable: typeof posts = posts) {
  const tableName = getTableName(postsTable);
  return sql<boolean>`(
    EXISTS (SELECT 1 FROM ${votes} v WHERE v.post_id = ${sql.raw(`"${tableName}"."id"`)} AND v.user_id <> ${sql.raw(`"${tableName}"."author_id"`)})
    OR EXISTS (SELECT 1 FROM ${comments} c WHERE c.post_id = ${sql.raw(`"${tableName}"."id"`)} AND c.author_id <> ${sql.raw(`"${tableName}"."author_id"`)} AND c.deleted_at IS NULL)
  )`;
}

export async function assertCategory(
  tx: Db | any,
  productId: string,
  categoryId?: string | null
): Promise<string | null> {
  const prodCategories = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.productId, productId));

  if (prodCategories.length > 0) {
    if (!categoryId) {
      throw new ApiException("category_required", 400, "Choose a category.");
    }
    const match = prodCategories.find((c: { id: string }) => c.id === categoryId);
    if (!match) {
      throw new ApiException(
        "category_invalid",
        400,
        "Choose a category from the list."
      );
    }
    return categoryId;
  }

  if (categoryId) {
    throw new ApiException(
      "category_invalid",
      400,
      "Choose a category from the list."
    );
  }

  return null;
}

@Injectable()
export class PostsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly commentsService: CommentsService
  ) {}

  async createPost(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string },
    input: CreatePostInput
  ): Promise<PostCreated> {
    const isAdmin = await isWorkspaceAdmin(
      this.db,
      currentUser.id,
      portal.workspaceId
    );

    const post = await this.db.transaction(async (tx) => {
      const [{ n }] = await tx
        .update(products)
        .set({ nextPostNumber: sql`${products.nextPostNumber} + 1` })
        .where(eq(products.id, portal.productId))
        .returning({ n: sql<number>`${products.nextPostNumber} - 1` });

      const verifiedCategoryId = await assertCategory(
        tx,
        portal.productId,
        input.categoryId
      );

      const [def] = await tx
        .select({ id: statuses.id })
        .from(statuses)
        .where(
          and(
            eq(statuses.productId, portal.productId),
            eq(statuses.isDefault, true)
          )
        )
        .limit(1);

      if (!def) {
        throw new ApiException(
          "internal_error",
          500,
          "Product has no default status."
        );
      }

      const [newPost] = await tx
        .insert(posts)
        .values({
          productId: portal.productId,
          number: n,
          title: input.title,
          description: input.description ?? null,
          statusId: def.id,
          categoryId: verifiedCategoryId,
          authorId: currentUser.id,
          authorIsAdmin: isAdmin,
          voteCount: 1,
        })
        .returning({
          id: posts.id,
          number: posts.number,
          title: posts.title,
        });

      await tx
        .insert(votes)
        .values({ postId: newPost.id, userId: currentUser.id });

      return newPost;
    });

    return {
      number: post.number,
      slug: postSlug(post.title),
    };
  }

  async updatePost(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string },
    postNumber: number,
    input: UpdatePostInput
  ): Promise<PostCreated> {
    const isAdmin = await isWorkspaceAdmin(
      this.db,
      currentUser.id,
      portal.workspaceId
    );

    return this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({
          id: posts.id,
          number: posts.number,
          authorId: posts.authorId,
          version: posts.version,
        })
        .from(posts)
        .where(
          and(
            eq(posts.productId, portal.productId),
            eq(posts.number, postNumber),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        )
        .for("update");

      if (!post) {
        throw new ApiException(
          "post_not_found",
          404,
          "This post was removed or merged. Go back to the board."
        );
      }

      const isAuthor = post.authorId === currentUser.id;
      if (!isAuthor && !isAdmin) {
        throw new ApiException("not_allowed", 403, "Not allowed.");
      }

      if (!isAdmin) {
        const [engagedResult] = await tx
          .select({ engaged: engagedSql() })
          .from(posts)
          .where(eq(posts.id, post.id))
          .limit(1);

        if (engagedResult?.engaged) {
          throw new ApiException(
            "post_locked",
            403,
            "Locked after someone else voted or commented."
          );
        }
      }

      const verifiedCategoryId = await assertCategory(
        tx,
        portal.productId,
        input.categoryId
      );

      const [updated] = await tx
        .update(posts)
        .set({
          title: input.title,
          description: input.description ?? null,
          categoryId: verifiedCategoryId,
          version: sql`${posts.version} + 1`,
          editedAt: sql`now()`,
        })
        .where(
          and(
            eq(posts.id, post.id),
            eq(posts.version, input.version),
            isNull(posts.deletedAt)
          )
        )
        .returning({
          number: posts.number,
          title: posts.title,
        });

      if (!updated) {
        const [still] = await tx
          .select({ id: posts.id })
          .from(posts)
          .where(
            and(
              eq(posts.id, post.id),
              isNull(posts.deletedAt),
              isNull(posts.mergedIntoId)
            )
          );
        if (!still) {
          throw new ApiException(
            "post_not_found",
            404,
            "This post was removed or merged. Go back to the board."
          );
        }
        throw new ApiException(
          "edit_conflict",
          409,
          "Someone else changed this while you were editing. Reload to see their version, then try again."
        );
      }

      return {
        number: updated.number,
        slug: postSlug(updated.title),
      };
    });
  }

  async deletePost(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string },
    postNumber: number
  ): Promise<void> {
    const isAdmin = await isWorkspaceAdmin(
      this.db,
      currentUser.id,
      portal.workspaceId
    );

    return this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({
          id: posts.id,
          authorId: posts.authorId,
        })
        .from(posts)
        .where(
          and(
            eq(posts.productId, portal.productId),
            eq(posts.number, postNumber),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        )
        .for("update");

      if (!post) {
        throw new ApiException(
          "post_not_found",
          404,
          "This post was removed or merged. Go back to the board."
        );
      }

      const isAuthor = post.authorId === currentUser.id;
      if (!isAuthor && !isAdmin) {
        throw new ApiException("not_allowed", 403, "Not allowed.");
      }

      if (!isAdmin) {
        const [engagedResult] = await tx
          .select({ engaged: engagedSql() })
          .from(posts)
          .where(eq(posts.id, post.id))
          .limit(1);

        if (engagedResult?.engaged) {
          throw new ApiException(
            "post_locked",
            403,
            "Locked after someone else voted or commented."
          );
        }
      }

      const [deleted] = await tx
        .update(posts)
        .set({
          deletedAt: sql`now()`,
          deletedById: currentUser.id,
        })
        .where(and(eq(posts.id, post.id), isNull(posts.deletedAt)))
        .returning({ id: posts.id });

      if (!deleted) {
        throw new ApiException(
          "post_not_found",
          404,
          "This post was removed or merged. Go back to the board."
        );
      }
    });
  }

  async listBoard(
    portal: { workspaceId: string; productId: string },
    viewerId: string | null,
    query?: BoardQuery
  ): Promise<PublicBoardPage> {
    const statusWhere =
      query?.status === "all"
        ? undefined
        : query?.status
          ? eq(posts.statusId, query.status)
          : notInArray(statuses.type, ["completed", "closed"]);

    const categoryWhere = query?.category
      ? eq(posts.categoryId, query.category)
      : undefined;

    const tsQuery = query?.q ? prefixTsQuery(query.q) : null;
    const searchWhere = tsQuery
      ? sql`${posts.search} @@ to_tsquery('english', ${tsQuery})`
      : undefined;

    const effectiveSort = query?.sort ?? (tsQuery ? "match" : "top");
    const orderClauses =
      effectiveSort === "new"
        ? [desc(posts.createdAt), desc(posts.id)]
        : effectiveSort === "match" && tsQuery
          ? [
              sql`ts_rank(${posts.search}, to_tsquery('english', ${tsQuery})) DESC`,
              desc(posts.voteCount),
              desc(posts.id),
            ]
          : [desc(posts.voteCount), desc(posts.createdAt), desc(posts.id)];

    const offset = query?.cursor ? decodeBoardCursor(query.cursor) : 0;

    const rows = await this.db
      .select({
        number: posts.number,
        title: posts.title,
        description: posts.description,
        voteCount: posts.voteCount,
        createdAt: posts.createdAt,
        statusId: statuses.id,
        statusName: statuses.name,
        statusColor: statuses.color,
        statusType: statuses.type,
        categoryId: categories.id,
        categoryName: categories.name,
        commentCount: sql<number>`(SELECT count(*)::int FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL)`,
        voted: viewerId
          ? sql<boolean>`EXISTS (SELECT 1 FROM ${votes} v WHERE v.post_id = ${posts.id} AND v.user_id = ${viewerId})`
          : sql<boolean>`false`,
      })
      .from(posts)
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(
        and(
          eq(posts.productId, portal.productId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId),
          statusWhere,
          categoryWhere,
          searchWhere
        )
      )
      .orderBy(...orderClauses)
      .offset(offset)
      .limit(BOARD_PAGE_SIZE + 1);

    const hasMore = rows.length > BOARD_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, BOARD_PAGE_SIZE) : rows;
    const nextCursor = hasMore
      ? encodeBoardCursor(offset + BOARD_PAGE_SIZE)
      : null;

    return {
      posts: pageRows.map((r) => ({
        number: r.number,
        slug: postSlug(r.title),
        title: r.title,
        description: r.description,
        voteCount: r.voteCount,
        voted: Boolean(r.voted),
        commentCount: Number(r.commentCount),
        createdAt: r.createdAt.toISOString(),
        status: {
          id: r.statusId,
          name: r.statusName,
          color: r.statusColor,
          type: r.statusType,
        },
        category:
          r.categoryId && r.categoryName
            ? { id: r.categoryId, name: r.categoryName }
            : null,
      })),
      nextCursor,
    };
  }

  async getPostPage(
    portal: { workspaceId: string; productId: string },
    viewerId: string | null,
    postNumber: number
  ): Promise<PublicPostPage> {
    const [row] = await this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        description: posts.description,
        voteCount: posts.voteCount,
        createdAt: posts.createdAt,
        editedAt: posts.editedAt,
        version: posts.version,
        authorId: posts.authorId,
        authorIsAdmin: posts.authorIsAdmin,
        mergedIntoId: posts.mergedIntoId,
        statusId: statuses.id,
        statusName: statuses.name,
        statusColor: statuses.color,
        statusType: statuses.type,
        categoryId: categories.id,
        categoryName: categories.name,
        authorName: user.name,
        authorImage: user.image,
        authorDeletedAt: user.deletedAt,
      })
      .from(posts)
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .innerJoin(user, eq(posts.authorId, user.id))
      .where(
        and(
          eq(posts.productId, portal.productId),
          eq(posts.number, postNumber),
          isNull(posts.deletedAt)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }

    if (row.mergedIntoId) {
      const [target] = await this.db
        .select({ number: posts.number, title: posts.title })
        .from(posts)
        .where(
          and(
            eq(posts.id, row.mergedIntoId),
            eq(posts.productId, portal.productId),
            isNull(posts.deletedAt)
          )
        )
        .limit(1);

      if (!target) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      return {
        kind: "redirect",
        number: target.number,
        slug: postSlug(target.title),
      };
    }

    const author: PublicAuthor = row.authorDeletedAt
      ? { name: null, image: null, isAdmin: false, deleted: true }
      : {
          name: row.authorName,
          image: row.authorImage,
          isAdmin: row.authorIsAdmin,
          deleted: false,
        };

    let viewer: PostViewer = {
      signedIn: false,
      voted: false,
      isAuthor: false,
      isAdmin: false,
      inConversation: false,
      muted: false,
      commentEmailsOn: false,
      canEdit: false,
      canDelete: false,
    };

    if (viewerId) {
      const isAuthor = row.authorId === viewerId;

      const [
        isAdmin,
        [voteRow],
        [ownComment],
        [muteRow],
        [viewerUser],
        [engagedResult],
      ] = await Promise.all([
        isWorkspaceAdmin(this.db, viewerId, portal.workspaceId),
        this.db
          .select({ postId: votes.postId })
          .from(votes)
          .where(and(eq(votes.postId, row.id), eq(votes.userId, viewerId)))
          .limit(1),
        isAuthor
          ? Promise.resolve([null])
          : this.db
              .select({ id: comments.id })
              .from(comments)
              .where(
                and(
                  eq(comments.postId, row.id),
                  eq(comments.authorId, viewerId),
                  isNull(comments.deletedAt)
                )
              )
              .limit(1),
        this.db
          .select({ userId: postMutes.userId })
          .from(postMutes)
          .where(and(eq(postMutes.postId, row.id), eq(postMutes.userId, viewerId)))
          .limit(1),
        this.db
          .select({ commentEmails: user.commentEmails })
          .from(user)
          .where(eq(user.id, viewerId))
          .limit(1),
        this.db
          .select({ engaged: engagedSql() })
          .from(posts)
          .where(eq(posts.id, row.id))
          .limit(1),
      ]);

      const isEngaged = Boolean(engagedResult?.engaged);
      const canManage = isAdmin || (isAuthor && !isEngaged);

      viewer = {
        signedIn: true,
        voted: Boolean(voteRow),
        isAuthor,
        isAdmin,
        inConversation: isAuthor || Boolean(ownComment),
        muted: Boolean(muteRow),
        commentEmailsOn: viewerUser?.commentEmails ?? true,
        canEdit: canManage,
        canDelete: canManage,
      };
    }

    const timeline = await loadTimeline(
      this.db,
      row.id,
      { userId: viewerId, isAdmin: viewer.isAdmin },
      this.commentsService
    );

    return {
      kind: "post",
      post: {
        number: row.number,
        slug: postSlug(row.title),
        title: row.title,
        description: row.description,
        voteCount: row.voteCount,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        version: row.version,
        status: {
          id: row.statusId,
          name: row.statusName,
          color: row.statusColor,
          type: row.statusType,
        },
        category:
          row.categoryId && row.categoryName
            ? { id: row.categoryId, name: row.categoryName }
            : null,
        author,
      },
      viewer,
      timeline,
    };
  }
}

export async function loadTimeline(
  db: Db,
  postId: string,
  viewer: { userId: string | null; isAdmin: boolean },
  commentsService?: CommentsService
): Promise<TimelineItem[]> {
  const service = commentsService ?? new CommentsService(db);
  const commentRows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      isAdmin: comments.isAdmin,
      body: comments.body,
      version: comments.version,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt,
      authorName: user.name,
      authorImage: user.image,
      authorDeletedAt: user.deletedAt,
    })
    .from(comments)
    .leftJoin(user, eq(comments.authorId, user.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  const commentTimeline = service.shapeTimeline(commentRows, {
    userId: viewer.userId,
    isAdmin: viewer.isAdmin,
  });

  const activityRows = await db
    .select({
      id: postActivity.id,
      statusName: postActivity.statusName,
      statusColor: postActivity.statusColor,
      note: postActivity.note,
      createdAt: postActivity.createdAt,
      actorName: user.name,
      actorImage: user.image,
      actorDeletedAt: user.deletedAt,
    })
    .from(postActivity)
    .leftJoin(user, eq(postActivity.actorId, user.id))
    .where(eq(postActivity.postId, postId))
    .orderBy(asc(postActivity.createdAt), asc(postActivity.id));

  const activityItems: { item: TimelineItem; createdAt: Date; id: string }[] =
    activityRows.map((r) => ({
      item: {
        kind: "activity",
        activity: {
          id: r.id,
          actor: r.actorDeletedAt
            ? { name: null, image: null, isAdmin: false, deleted: true }
            : {
                name: r.actorName ?? null,
                image: r.actorImage ?? null,
                isAdmin: true,
                deleted: false,
              },
          statusName: r.statusName,
          statusColor: r.statusColor,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        },
      },
      createdAt: r.createdAt,
      id: r.id,
    }));

  const commentItems: { item: TimelineItem; createdAt: Date; id: string }[] =
    commentTimeline.map((item) => {
      const id =
        item.kind === "comment"
          ? item.comment.id
          : item.kind === "stub"
            ? item.id
            : item.activity.id;
      const matchingRow = commentRows.find((r) => r.id === id);
      return {
        item,
        createdAt: matchingRow ? matchingRow.createdAt : new Date(0),
        id,
      };
    });

  const combinedTimeline = [...commentItems, ...activityItems].sort((a, b) => {
    const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  return combinedTimeline.map((c) => c.item);
}

