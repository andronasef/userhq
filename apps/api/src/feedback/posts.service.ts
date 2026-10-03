import { Injectable, Inject } from "@nestjs/common";
import { eq, and, isNull, sql, notInArray, desc } from "drizzle-orm";
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
  user,
} from "@userhq/db";
import {
  type CreatePostInput,
  type PostCreated,
  type BoardQuery,
  type PublicBoardPage,
  type PublicPostPage,
  type PublicAuthor,
  type PostViewer,
  postSlug,
  BOARD_PAGE_SIZE,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isWorkspaceAdmin } from "./membership.js";

export function engagedSql(postsTable: typeof posts = posts) {
  return sql<boolean>`(
    EXISTS (SELECT 1 FROM ${votes} v WHERE v.post_id = ${postsTable.id} AND v.user_id <> ${postsTable.authorId})
    OR EXISTS (SELECT 1 FROM ${comments} c WHERE c.post_id = ${postsTable.id} AND c.author_id <> ${postsTable.authorId} AND c.deleted_at IS NULL)
  )`;
}

@Injectable()
export class PostsService {
  constructor(@Inject(DB) private readonly db: Db) {}

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
          categoryWhere
        )
      )
      .orderBy(desc(posts.voteCount), desc(posts.createdAt), desc(posts.id))
      .limit(BOARD_PAGE_SIZE);

    return {
      posts: rows.map((r) => ({
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
      nextCursor: null,
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
    };
  }
}
