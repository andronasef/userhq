import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DB, type Db, posts, comments } from "@userhq/db";
import type {
  CreateCommentInput,
  PublicComment,
  TimelineItem,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { isWorkspaceAdmin } from "./membership.js";

export interface CommentRowWithAuthor {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  isAdmin: boolean;
  body: string;
  version: number;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
  authorImage: string | null;
  authorDeletedAt: Date | null;
}

@Injectable()
export class CommentsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async createComment(
    portal: { workspaceId: string; productId: string },
    currentUser: { id: string; name: string | null; image: string | null },
    number: number,
    input: CreateCommentInput
  ): Promise<PublicComment> {
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.productId, portal.productId),
            eq(posts.number, number),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        )
        .for("update");

      if (!p) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      const isAdmin = await isWorkspaceAdmin(tx, currentUser.id, portal.workspaceId);

      let resolvedParentId: string | null = null;
      if (input.parentId) {
        const [parent] = await tx
          .select({ id: comments.id, parentId: comments.parentId })
          .from(comments)
          .where(
            and(
              eq(comments.id, input.parentId),
              eq(comments.postId, p.id),
              isNull(comments.deletedAt)
            )
          );

        if (!parent) {
          throw new ApiException("comment_not_found", 404, "Parent comment not found.");
        }

        // Replies are one level deep: reply to a reply attaches to the top-level parent (D-16)
        resolvedParentId = parent.parentId ?? parent.id;
      }

      const [newComment] = await tx
        .insert(comments)
        .values({
          postId: p.id,
          parentId: resolvedParentId,
          authorId: currentUser.id,
          isAdmin,
          body: input.body,
        })
        .returning();

      return {
        id: newComment.id,
        author: {
          name: currentUser.name,
          image: currentUser.image,
          isAdmin,
          deleted: false,
        },
        body: newComment.body,
        createdAt: newComment.createdAt.toISOString(),
        editedAt: newComment.editedAt ? newComment.editedAt.toISOString() : null,
        version: newComment.version,
        canEdit: true,
        canDelete: true,
      };
    });
  }

  shapeTimeline(
    rows: CommentRowWithAuthor[],
    viewer: { userId: string | null; isAdmin: boolean }
  ): TimelineItem[] {
    const topLevelRows: CommentRowWithAuthor[] = [];
    const repliesByParent = new Map<string, CommentRowWithAuthor[]>();

    for (const row of rows) {
      if (row.parentId === null) {
        topLevelRows.push(row);
      } else {
        // Deleted replies always vanish (D-18)
        if (row.deletedAt !== null) {
          continue;
        }
        const existing = repliesByParent.get(row.parentId) ?? [];
        existing.push(row);
        repliesByParent.set(row.parentId, existing);
      }
    }

    const mapComment = (row: CommentRowWithAuthor): PublicComment => {
      const isAuthor = viewer.userId === row.authorId;
      const canManage = isAuthor || viewer.isAdmin;
      const isDeletedUser = Boolean(row.authorDeletedAt);

      return {
        id: row.id,
        author: isDeletedUser
          ? { name: null, image: null, isAdmin: false, deleted: true }
          : {
              name: row.authorName,
              image: row.authorImage,
              isAdmin: row.isAdmin,
              deleted: false,
            },
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        version: row.version,
        canEdit: canManage && !row.deletedAt,
        canDelete: canManage && !row.deletedAt,
      };
    };

    const timeline: TimelineItem[] = [];

    for (const row of topLevelRows) {
      const replies = (repliesByParent.get(row.id) ?? []).map(mapComment);

      if (row.deletedAt !== null) {
        // A deleted top-level comment with at least one visible reply leaves a stub
        if (replies.length > 0) {
          timeline.push({
            kind: "stub",
            id: row.id,
            replies,
          });
        }
      } else {
        timeline.push({
          kind: "comment",
          comment: mapComment(row),
          replies,
        });
      }
    }

    return timeline;
  }
}
