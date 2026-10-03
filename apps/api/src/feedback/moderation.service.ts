import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DB, type Db, posts, statuses, postActivity } from "@userhq/db";
import type { StatusChangeInput, StatusChangeResult } from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class ModerationService {
  constructor(@Inject(DB) private readonly db: Db) {}

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

      // Phase 4: reject when the post is linked to a roadmap item (ROAD-07)
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
}
