import { Injectable, Inject, Optional } from "@nestjs/common";
import {
  and,
  eq,
  isNull,
  isNotNull,
  notInArray,
  desc,
  asc,
  sql,
} from "drizzle-orm";
import {
  DB,
  type Db,
  posts,
  statuses,
  categories,
  votes,
  comments,
  postMutes,
  postActivity,
  user,
} from "@userhq/db";
import {
  type StatusChangeInput,
  type StatusChangeResult,
  type AdminBoardQuery,
  type AdminPostPage,
  type AdminPostDetail,
  type VoterPage,
  type DeletedPostPage,
  type DeletedCommentRow,
  type PublicAuthor,
  type PostViewer,
  ADMIN_PAGE_SIZE,
  postSlug,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { prefixTsQuery } from "./search.js";
import { encodeBoardCursor, decodeBoardCursor } from "./cursor.js";
import { loadTimeline } from "./posts.service.js";
import { CommentsService } from "./comments.service.js";

@Injectable()
export class ModerationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Optional() private readonly commentsService?: CommentsService
  ) {}

  async changeStatus(
    tenant: { workspaceId: string; productId: string },
    actor: { id: string; name?: string | null; image?: string | null },
    postNumber: number,
    input: StatusChangeInput
  ): Promise<StatusChangeResult> {
    return this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({
          id: posts.id,
          statusId: posts.statusId,
          version: posts.version,
        })
        .from(posts)
        .where(
          and(
            eq(posts.productId, tenant.productId),
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

      if (post.version !== input.version) {
        throw new ApiException(
          "edit_conflict",
          409,
          "Someone else changed this while you were editing. Reload to see their version, then try again."
        );
      }

      const [targetStatus] = await tx
        .select({
          id: statuses.id,
          name: statuses.name,
          color: statuses.color,
          type: statuses.type,
        })
        .from(statuses)
        .where(
          and(
            eq(statuses.id, input.statusId),
            eq(statuses.productId, tenant.productId)
          )
        );

      if (!targetStatus) {
        throw new ApiException("validation_failed", 400, "Choose a valid status.");
      }

      if (post.statusId === targetStatus.id) {
        return {
          status: {
            id: targetStatus.id,
            name: targetStatus.name,
            color: targetStatus.color,
            type: targetStatus.type,
          },
          version: post.version,
          activity: null,
        };
      }

      const newVersion = post.version + 1;
      await tx
        .update(posts)
        .set({
          statusId: targetStatus.id,
          version: newVersion,
        })
        .where(eq(posts.id, post.id));

      const trimmedNote = input.note ?? null;

      const [insertedActivity] = await tx
        .insert(postActivity)
        .values({
          postId: post.id,
          actorId: actor.id,
          kind: "status_changed",
          toStatusId: targetStatus.id,
          statusName: targetStatus.name,
          statusColor: targetStatus.color,
          note: trimmedNote,
        })
        .returning({
          id: postActivity.id,
          createdAt: postActivity.createdAt,
        });

      return {
        status: {
          id: targetStatus.id,
          name: targetStatus.name,
          color: targetStatus.color,
          type: targetStatus.type,
        },
        version: newVersion,
        activity: {
          id: insertedActivity.id,
          actor: {
            name: actor.name ?? null,
            image: actor.image ?? null,
            isAdmin: true,
            deleted: false,
          },
          statusName: targetStatus.name,
          statusColor: targetStatus.color,
          note: trimmedNote,
          createdAt: insertedActivity.createdAt.toISOString(),
        },
      };
    });
  }

  async listAdminPosts(
    tenant: { workspaceId: string; productId: string },
    query?: AdminBoardQuery
  ): Promise<AdminPostPage> {
    const statusWhere =
      query?.status === "all" || !query?.status
        ? undefined
        : query.status === "open"
          ? notInArray(statuses.type, ["completed", "closed"])
          : eq(posts.statusId, query.status);

    const categoryWhere = query?.category
      ? eq(posts.categoryId, query.category)
      : undefined;

    const tsQuery = query?.q ? prefixTsQuery(query.q) : null;
    const searchWhere = tsQuery
      ? sql`${posts.search} @@ to_tsquery('english', ${tsQuery})`
      : undefined;

    const effectiveSort = query?.sort ?? (tsQuery ? "match" : "new");
    const orderClauses =
      effectiveSort === "top"
        ? [desc(posts.voteCount), desc(posts.createdAt), desc(posts.id)]
        : effectiveSort === "match" && tsQuery
          ? [
              sql`ts_rank(${posts.search}, to_tsquery('english', ${tsQuery})) DESC`,
              desc(posts.voteCount),
              desc(posts.id),
            ]
          : [desc(posts.createdAt), desc(posts.id)];

    const offset = query?.cursor ? decodeBoardCursor(query.cursor) : 0;

    const rows = await this.db
      .select({
        number: posts.number,
        title: posts.title,
        voteCount: posts.voteCount,
        createdAt: posts.createdAt,
        statusId: statuses.id,
        statusName: statuses.name,
        statusColor: statuses.color,
        statusType: statuses.type,
        categoryId: categories.id,
        categoryName: categories.name,
        commentCount: sql<number>`(SELECT count(*)::int FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL)`,
      })
      .from(posts)
      .innerJoin(statuses, eq(posts.statusId, statuses.id))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(
        and(
          eq(posts.productId, tenant.productId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId),
          statusWhere,
          categoryWhere,
          searchWhere
        )
      )
      .orderBy(...orderClauses)
      .offset(offset)
      .limit(ADMIN_PAGE_SIZE + 1);

    const hasMore = rows.length > ADMIN_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, ADMIN_PAGE_SIZE) : rows;
    const nextCursor = hasMore
      ? encodeBoardCursor(offset + ADMIN_PAGE_SIZE)
      : null;

    return {
      posts: pageRows.map((r) => ({
        number: r.number,
        slug: postSlug(r.title),
        title: r.title,
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
        voteCount: r.voteCount,
        commentCount: Number(r.commentCount),
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async getAdminPost(
    tenant: { workspaceId: string; productId: string },
    viewer: { id: string },
    postNumber: number
  ): Promise<AdminPostDetail> {
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
        deletedAt: posts.deletedAt,
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
          eq(posts.productId, tenant.productId),
          eq(posts.number, postNumber)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }

    if (row.mergedIntoId) {
      const [target] = await this.db
        .select({ number: posts.number })
        .from(posts)
        .where(
          and(
            eq(posts.id, row.mergedIntoId),
            eq(posts.productId, tenant.productId)
          )
        )
        .limit(1);

      if (!target) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      return {
        kind: "redirect",
        number: target.number,
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

    const isAuthor = row.authorId === viewer.id;

    const [
      [voteRow],
      [ownComment],
      [muteRow],
      [viewerUser],
    ] = await Promise.all([
      this.db
        .select({ postId: votes.postId })
        .from(votes)
        .where(and(eq(votes.postId, row.id), eq(votes.userId, viewer.id)))
        .limit(1),
      isAuthor
        ? Promise.resolve([null])
        : this.db
            .select({ id: comments.id })
            .from(comments)
            .where(
              and(
                eq(comments.postId, row.id),
                eq(comments.authorId, viewer.id),
                isNull(comments.deletedAt)
              )
            )
            .limit(1),
      this.db
        .select({ userId: postMutes.userId })
        .from(postMutes)
        .where(and(eq(postMutes.postId, row.id), eq(postMutes.userId, viewer.id)))
        .limit(1),
      this.db
        .select({ commentEmails: user.commentEmails })
        .from(user)
        .where(eq(user.id, viewer.id))
        .limit(1),
    ]);

    const postViewer: PostViewer = {
      signedIn: true,
      voted: Boolean(voteRow),
      isAuthor,
      isAdmin: true,
      inConversation: isAuthor || Boolean(ownComment),
      muted: Boolean(muteRow),
      commentEmailsOn: viewerUser?.commentEmails ?? true,
      canEdit: true,
      canDelete: true,
    };

    const commentsService = this.commentsService ?? new CommentsService(this.db);
    const timeline = await loadTimeline(
      this.db,
      row.id,
      { userId: viewer.id, isAdmin: true },
      commentsService
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
      deleted: row.deletedAt !== null,
      timeline,
      viewer: postViewer,
    };
  }

  async listVoters(
    tenant: { workspaceId: string; productId: string },
    postNumber: number,
    cursor?: string
  ): Promise<VoterPage> {
    const [post] = await this.db
      .select({ id: posts.id, voteCount: posts.voteCount })
      .from(posts)
      .where(
        and(
          eq(posts.productId, tenant.productId),
          eq(posts.number, postNumber),
          isNull(posts.mergedIntoId)
        )
      )
      .limit(1);

    if (!post) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }

    const offset = cursor ? decodeBoardCursor(cursor) : 0;

    const rows = await this.db
      .select({
        userId: user.id,
        name: user.name,
        image: user.image,
        deletedAt: user.deletedAt,
        votedAt: votes.createdAt,
      })
      .from(votes)
      .innerJoin(user, eq(votes.userId, user.id))
      .where(eq(votes.postId, post.id))
      .orderBy(desc(votes.createdAt), asc(user.id))
      .offset(offset)
      .limit(ADMIN_PAGE_SIZE + 1);

    const hasMore = rows.length > ADMIN_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, ADMIN_PAGE_SIZE) : rows;
    const nextCursor = hasMore
      ? encodeBoardCursor(offset + ADMIN_PAGE_SIZE)
      : null;

    return {
      total: post.voteCount,
      voters: pageRows.map((r) => ({
        name: r.deletedAt ? null : r.name,
        image: r.deletedAt ? null : r.image,
        deleted: r.deletedAt !== null,
        votedAt: r.votedAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async listDeletedPosts(
    tenant: { workspaceId: string; productId: string },
    cursor?: string
  ): Promise<DeletedPostPage> {
    const offset = cursor ? decodeBoardCursor(cursor) : 0;

    const rows = await this.db
      .select({
        number: posts.number,
        title: posts.title,
        deletedAt: posts.deletedAt,
        authorId: posts.authorId,
        deletedById: posts.deletedById,
        deletedByName: user.name,
      })
      .from(posts)
      .leftJoin(user, eq(posts.deletedById, user.id))
      .where(
        and(
          eq(posts.productId, tenant.productId),
          isNotNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .orderBy(desc(posts.deletedAt), desc(posts.id))
      .offset(offset)
      .limit(ADMIN_PAGE_SIZE + 1);

    const hasMore = rows.length > ADMIN_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, ADMIN_PAGE_SIZE) : rows;
    const nextCursor = hasMore
      ? encodeBoardCursor(offset + ADMIN_PAGE_SIZE)
      : null;

    return {
      posts: pageRows.map((r) => ({
        number: r.number,
        title: r.title,
        deletedAt: r.deletedAt!.toISOString(),
        deletedBy: r.deletedByName ?? null,
        deletedByAuthor: r.deletedById !== null && r.deletedById === r.authorId,
      })),
      nextCursor,
    };
  }

  async restorePost(
    tenant: { workspaceId: string; productId: string },
    postNumber: number
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({
          id: posts.id,
          deletedAt: posts.deletedAt,
          mergedIntoId: posts.mergedIntoId,
        })
        .from(posts)
        .where(
          and(
            eq(posts.productId, tenant.productId),
            eq(posts.number, postNumber)
          )
        )
        .for("update");

      if (!post || post.deletedAt === null || post.mergedIntoId !== null) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      await tx
        .update(posts)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(posts.id, post.id));
    });
  }

  async listDeletedComments(
    tenant: { workspaceId: string; productId: string }
  ): Promise<DeletedCommentRow[]> {
    const rows = await this.db
      .select({
        id: comments.id,
        body: comments.body,
        deletedAt: comments.deletedAt,
        authorName: user.name,
        authorDeletedAt: user.deletedAt,
        postNumber: posts.number,
        postTitle: posts.title,
        postDeletedAt: posts.deletedAt,
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .leftJoin(user, eq(comments.authorId, user.id))
      .where(
        and(
          eq(posts.productId, tenant.productId),
          isNotNull(comments.deletedAt)
        )
      )
      .orderBy(desc(comments.deletedAt), desc(comments.id));

    return rows.map((r) => ({
      id: r.id,
      excerpt: r.body.slice(0, 80),
      post: {
        number: r.postNumber,
        title: r.postTitle,
        deleted: r.postDeletedAt !== null,
      },
      authorName: r.authorDeletedAt ? null : (r.authorName ?? null),
      deletedAt: r.deletedAt!.toISOString(),
    }));
  }

  async restoreComment(
    tenant: { workspaceId: string; productId: string },
    commentId: string
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          commentId: comments.id,
          commentDeletedAt: comments.deletedAt,
          postDeletedAt: posts.deletedAt,
          postMergedIntoId: posts.mergedIntoId,
        })
        .from(comments)
        .innerJoin(posts, eq(comments.postId, posts.id))
        .where(
          and(
            eq(comments.id, commentId),
            eq(posts.productId, tenant.productId)
          )
        )
        .for("update");

      if (!row || row.commentDeletedAt === null) {
        throw new ApiException("comment_not_found", 404, "Comment not found.");
      }

      if (row.postDeletedAt !== null || row.postMergedIntoId !== null) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      await tx
        .update(comments)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(comments.id, row.commentId));
    });
  }
}
