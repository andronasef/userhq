import { Injectable, Inject, Optional } from "@nestjs/common";
import { NotificationsService } from "../notifications/notifications.service.js";
import { and, eq, isNull, inArray, desc, asc, sql, or, ilike } from "drizzle-orm";
import {
  DB,
  type Db,
  roadmapItems,
  roadmapItemInternals,
  statuses,
  posts,
  postActivity,
  user,
  workspaceMembers,
} from "@userhq/db";
import {
  generateKeyBetween,
  type AdminRoadmapItem,
  type CreateRoadmapItemInput,
  type UpdateRoadmapItemInput,
  type MoveRoadmapItemInput,
  type RoadmapPostLinkSearchResult,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { escapeLike } from "../platform/platform.controller.js";

@Injectable()
export class RoadmapService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Optional() private readonly notificationsService?: NotificationsService
  ) {}

  async listAdminItems(tenant: {
    workspaceId: string;
    productId: string;
  }): Promise<AdminRoadmapItem[]> {
    const rows = await this.db
      .select({
        id: roadmapItems.id,
        statusId: roadmapItems.statusId,
        publicTitle: roadmapItems.publicTitle,
        publicDescription: roadmapItems.publicDescription,
        isPublic: roadmapItems.isPublic,
        rank: roadmapItems.rank,
        createdAt: roadmapItems.createdAt,
        updatedAt: roadmapItems.updatedAt,
        internalTitle: roadmapItemInternals.internalTitle,
        internalDescription: roadmapItemInternals.internalDescription,
        internalNotes: roadmapItemInternals.internalNotes,
        assigneeId: roadmapItemInternals.assigneeId,
        deadlineText: roadmapItemInternals.deadlineText,
        deadlineDate: roadmapItemInternals.deadlineDate,
        assigneeName: user.name,
        assigneeImage: user.image,
        linkedPostCount: sql<number>`count(${posts.id})::int`,
      })
      .from(roadmapItems)
      .innerJoin(
        roadmapItemInternals,
        eq(roadmapItems.id, roadmapItemInternals.itemId)
      )
      .leftJoin(user, eq(roadmapItemInternals.assigneeId, user.id))
      .leftJoin(
        posts,
        and(
          eq(posts.roadmapItemId, roadmapItems.id),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .where(eq(roadmapItems.productId, tenant.productId))
      .groupBy(
        roadmapItems.id,
        roadmapItemInternals.itemId,
        user.id
      )
      .orderBy(asc(sql`${roadmapItems.rank} COLLATE "C"`), asc(roadmapItems.createdAt));

    return rows.map((r) => this.mapAdminItem(r));
  }

  async getItemById(
    tenant: { workspaceId: string; productId: string },
    itemId: string,
    executor: any = this.db
  ): Promise<AdminRoadmapItem> {
    const [row] = await executor
      .select({
        id: roadmapItems.id,
        statusId: roadmapItems.statusId,
        publicTitle: roadmapItems.publicTitle,
        publicDescription: roadmapItems.publicDescription,
        isPublic: roadmapItems.isPublic,
        rank: roadmapItems.rank,
        createdAt: roadmapItems.createdAt,
        updatedAt: roadmapItems.updatedAt,
        internalTitle: roadmapItemInternals.internalTitle,
        internalDescription: roadmapItemInternals.internalDescription,
        internalNotes: roadmapItemInternals.internalNotes,
        assigneeId: roadmapItemInternals.assigneeId,
        deadlineText: roadmapItemInternals.deadlineText,
        deadlineDate: roadmapItemInternals.deadlineDate,
        assigneeName: user.name,
        assigneeImage: user.image,
        linkedPostCount: sql<number>`count(${posts.id})::int`,
      })
      .from(roadmapItems)
      .innerJoin(
        roadmapItemInternals,
        eq(roadmapItems.id, roadmapItemInternals.itemId)
      )
      .leftJoin(user, eq(roadmapItemInternals.assigneeId, user.id))
      .leftJoin(
        posts,
        and(
          eq(posts.roadmapItemId, roadmapItems.id),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .where(
        and(
          eq(roadmapItems.id, itemId),
          eq(roadmapItems.productId, tenant.productId)
        )
      )
      .groupBy(
        roadmapItems.id,
        roadmapItemInternals.itemId,
        user.id
      )
      .limit(1);

    if (!row) {
      throw new ApiException("item_not_found", 404, "Roadmap item not found.");
    }

    return this.mapAdminItem(row);
  }

  async createItem(
    tenant: { workspaceId: string; productId: string },
    adminUser: { id: string },
    input: CreateRoadmapItemInput
  ): Promise<AdminRoadmapItem> {
    return this.db.transaction(async (tx) => {
      // 1. Verify target status exists in this product
      const [statusRow] = await tx
        .select({ id: statuses.id, name: statuses.name, color: statuses.color })
        .from(statuses)
        .where(
          and(
            eq(statuses.id, input.statusId),
            eq(statuses.productId, tenant.productId)
          )
        )
        .limit(1);

      if (!statusRow) {
        throw new ApiException("validation_failed", 400, "Invalid status.");
      }

      // 2. Validate assignee membership if provided
      if (input.assigneeId) {
        const [member] = await tx
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, tenant.workspaceId),
              eq(workspaceMembers.userId, input.assigneeId)
            )
          )
          .limit(1);

        if (!member) {
          throw new ApiException(
            "validation_failed",
            400,
            "Assignee must be a member of this workspace."
          );
        }
      }

      // 3. Determine rank
      let rank = input.rank;
      if (!rank) {
        const [highestRankRow] = await tx
          .select({ rank: roadmapItems.rank })
          .from(roadmapItems)
          .where(
            and(
              eq(roadmapItems.productId, tenant.productId),
              eq(roadmapItems.statusId, input.statusId)
            )
          )
          .orderBy(desc(sql`${roadmapItems.rank} COLLATE "C"`))
          .limit(1);

        rank = generateKeyBetween(highestRankRow?.rank ?? null, null);
      }

      // 4. Handle publicTitle prefill if public
      const isPublic = input.isPublic ?? false;
      const publicTitle =
        input.publicTitle !== undefined
          ? input.publicTitle
          : isPublic
            ? input.internalTitle
            : null;

      // 5. Insert public-safe roadmap item
      const [newItem] = await tx
        .insert(roadmapItems)
        .values({
          productId: tenant.productId,
          statusId: input.statusId,
          publicTitle,
          publicDescription: input.publicDescription ?? null,
          isPublic,
          rank,
        })
        .returning({ id: roadmapItems.id });

      // 6. Insert internal details
      await tx.insert(roadmapItemInternals).values({
        itemId: newItem.id,
        productId: tenant.productId,
        internalTitle: input.internalTitle,
        internalDescription: input.internalDescription ?? null,
        internalNotes: input.internalNotes ?? null,
        assigneeId: input.assigneeId ?? null,
        deadlineText: input.deadlineText ?? null,
        deadlineDate: input.deadlineDate ? new Date(input.deadlineDate) : null,
      });

      // 7. Link posts if requested
      if (input.postIds && input.postIds.length > 0) {
        const postsToLink = await tx
          .select({
            id: posts.id,
            statusId: posts.statusId,
            version: posts.version,
            roadmapItemId: posts.roadmapItemId,
          })
          .from(posts)
          .where(
            and(
              eq(posts.productId, tenant.productId),
              inArray(posts.id, input.postIds),
              isNull(posts.deletedAt),
              isNull(posts.mergedIntoId)
            )
          )
          .for("update");

        if (postsToLink.length !== new Set(input.postIds).size) {
          throw new ApiException("post_not_found", 404, "One or more posts not found.");
        }

        if (postsToLink.some((p) => p.roadmapItemId !== null)) {
          throw new ApiException(
            "post_already_linked",
            400,
            "A post is already linked to another roadmap item."
          );
        }

        await tx
          .update(posts)
          .set({ roadmapItemId: newItem.id })
          .where(inArray(posts.id, input.postIds));
        await this.followItemStatus(tx, tenant, adminUser.id, statusRow, postsToLink);
      }

      return this.getItemById(tenant, newItem.id, tx);
    });
  }

  async updateItem(
    tenant: { workspaceId: string; productId: string },
    adminUser: { id: string },
    itemId: string,
    input: UpdateRoadmapItemInput
  ): Promise<AdminRoadmapItem> {
    return this.db.transaction(async (tx) => {
      // 1. Fetch & lock existing item and internals
      const [existing] = await tx
        .select({
          id: roadmapItems.id,
          statusId: roadmapItems.statusId,
          publicTitle: roadmapItems.publicTitle,
          isPublic: roadmapItems.isPublic,
          internalTitle: roadmapItemInternals.internalTitle,
        })
        .from(roadmapItems)
        .innerJoin(
          roadmapItemInternals,
          eq(roadmapItems.id, roadmapItemInternals.itemId)
        )
        .where(
          and(
            eq(roadmapItems.id, itemId),
            eq(roadmapItems.productId, tenant.productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("item_not_found", 404, "Roadmap item not found.");
      }

      // 2. Validate status if updating statusId
      let targetStatus: { id: string; name: string; color: string } | null = null;
      if (input.statusId && input.statusId !== existing.statusId) {
        const [foundStatus] = await tx
          .select({ id: statuses.id, name: statuses.name, color: statuses.color })
          .from(statuses)
          .where(
            and(
              eq(statuses.id, input.statusId),
              eq(statuses.productId, tenant.productId)
            )
          )
          .limit(1);

        if (!foundStatus) {
          throw new ApiException("validation_failed", 400, "Invalid status.");
        }
        targetStatus = foundStatus;
      }

      // 3. Validate assignee if updating assigneeId
      if (input.assigneeId !== undefined && input.assigneeId !== null) {
        const [member] = await tx
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, tenant.workspaceId),
              eq(workspaceMembers.userId, input.assigneeId)
            )
          )
          .limit(1);

        if (!member) {
          throw new ApiException(
            "validation_failed",
            400,
            "Assignee must be a member of this workspace."
          );
        }
      }

      // 4. Validate public title when making public
      const resultingIsPublic = input.isPublic !== undefined ? input.isPublic : existing.isPublic;
      let resultingPublicTitle =
        input.publicTitle !== undefined ? input.publicTitle : existing.publicTitle;

      if (resultingIsPublic) {
        if (!resultingPublicTitle) {
          resultingPublicTitle = input.internalTitle ?? existing.internalTitle;
        }
        if (!resultingPublicTitle || resultingPublicTitle.trim().length === 0) {
          throw new ApiException("public_title_required", 400, "A public title is required for public items.");
        }
      }

      // 5. Update roadmapItems
      const itemUpdates: Record<string, any> = { updatedAt: new Date() };
      if (input.statusId !== undefined) itemUpdates.statusId = input.statusId;
      if (input.isPublic !== undefined) itemUpdates.isPublic = input.isPublic;
      if (resultingPublicTitle !== undefined) itemUpdates.publicTitle = resultingPublicTitle;
      if (input.publicDescription !== undefined) itemUpdates.publicDescription = input.publicDescription;

      await tx
        .update(roadmapItems)
        .set(itemUpdates)
        .where(eq(roadmapItems.id, itemId));

      // 6. Update roadmapItemInternals
      const internalUpdates: Record<string, any> = {};
      if (input.internalTitle !== undefined) internalUpdates.internalTitle = input.internalTitle;
      if (input.internalDescription !== undefined)
        internalUpdates.internalDescription = input.internalDescription;
      if (input.internalNotes !== undefined) internalUpdates.internalNotes = input.internalNotes;
      if (input.assigneeId !== undefined) internalUpdates.assigneeId = input.assigneeId;
      if (input.deadlineText !== undefined) internalUpdates.deadlineText = input.deadlineText;
      if (input.deadlineDate !== undefined)
        internalUpdates.deadlineDate = input.deadlineDate ? new Date(input.deadlineDate) : null;

      if (Object.keys(internalUpdates).length > 0) {
        await tx
          .update(roadmapItemInternals)
          .set(internalUpdates)
          .where(eq(roadmapItemInternals.itemId, itemId));
      }

      // 7. Cascade status changes to linked posts
      if (targetStatus) {
        await this.followItemStatus(
          tx,
          tenant,
          adminUser.id,
          targetStatus,
          await this.lockLinkedPosts(tx, tenant.productId, itemId)
        );
      }

      return this.getItemById(tenant, itemId, tx);
    });
  }

  async moveItem(
    tenant: { workspaceId: string; productId: string },
    adminUser: { id: string },
    itemId: string,
    input: MoveRoadmapItemInput
  ): Promise<AdminRoadmapItem> {
    return this.db.transaction(async (tx) => {
      // 1. Fetch & lock roadmap item
      const [existing] = await tx
        .select({
          id: roadmapItems.id,
          statusId: roadmapItems.statusId,
          rank: roadmapItems.rank,
        })
        .from(roadmapItems)
        .where(
          and(
            eq(roadmapItems.id, itemId),
            eq(roadmapItems.productId, tenant.productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("item_not_found", 404, "Roadmap item not found.");
      }

      // 2. Fetch target status
      const [targetStatus] = await tx
        .select({ id: statuses.id, name: statuses.name, color: statuses.color })
        .from(statuses)
        .where(
          and(
            eq(statuses.id, input.statusId),
            eq(statuses.productId, tenant.productId)
          )
        )
        .limit(1);

      if (!targetStatus) {
        throw new ApiException("validation_failed", 400, "Invalid status.");
      }

      const statusChanged = existing.statusId !== input.statusId;

      // 3. Update roadmap item rank and status
      await tx
        .update(roadmapItems)
        .set({
          statusId: input.statusId,
          rank: input.targetRank,
          updatedAt: new Date(),
        })
        .where(eq(roadmapItems.id, itemId));

      // 4. Cascade to linked posts if column changed
      if (statusChanged) {
        await this.followItemStatus(
          tx,
          tenant,
          adminUser.id,
          targetStatus,
          await this.lockLinkedPosts(tx, tenant.productId, itemId)
        );
      }

      return this.getItemById(tenant, itemId, tx);
    });
  }

  async deleteItem(
    tenant: { workspaceId: string; productId: string },
    itemId: string
  ): Promise<void> {
    const [deleted] = await this.db
      .delete(roadmapItems)
      .where(
        and(
          eq(roadmapItems.id, itemId),
          eq(roadmapItems.productId, tenant.productId)
        )
      )
      .returning({ id: roadmapItems.id });

    if (!deleted) {
      throw new ApiException("item_not_found", 404, "Roadmap item not found.");
    }
  }

  async linkPost(
    tenant: { workspaceId: string; productId: string },
    adminUser: { id: string },
    itemId: string,
    postId: string
  ): Promise<{ success: true; linkedPostCount: number }> {
    return this.db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: roadmapItems.id,
          status: { id: statuses.id, name: statuses.name, color: statuses.color },
        })
        .from(roadmapItems)
        .innerJoin(statuses, eq(roadmapItems.statusId, statuses.id))
        .where(
          and(
            eq(roadmapItems.id, itemId),
            eq(roadmapItems.productId, tenant.productId)
          )
        )
        .for("update", { of: roadmapItems });

      if (!item) {
        throw new ApiException("item_not_found", 404, "Roadmap item not found.");
      }

      const [post] = await tx
        .select({
          id: posts.id,
          statusId: posts.statusId,
          version: posts.version,
          roadmapItemId: posts.roadmapItemId,
        })
        .from(posts)
        .where(
          and(
            eq(posts.id, postId),
            eq(posts.productId, tenant.productId),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        )
        .for("update");

      if (!post) {
        throw new ApiException("post_not_found", 404, "Post not found.");
      }

      if (post.roadmapItemId !== null) {
        throw new ApiException(
          "post_already_linked",
          400,
          "This post is already linked to a roadmap item."
        );
      }

      await tx
        .update(posts)
        .set({ roadmapItemId: item.id })
        .where(eq(posts.id, post.id));
      await this.followItemStatus(tx, tenant, adminUser.id, item.status, [post]);

      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(posts)
        .where(
          and(
            eq(posts.roadmapItemId, item.id),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        );

      return { success: true, linkedPostCount: countRow?.count ?? 0 };
    });
  }

  async unlinkPost(
    tenant: { workspaceId: string; productId: string },
    itemId: string,
    postId: string
  ): Promise<{ success: true }> {
    return this.db.transaction(async (tx) => {
      const [post] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.id, postId),
            eq(posts.productId, tenant.productId),
            eq(posts.roadmapItemId, itemId)
          )
        )
        .for("update");

      if (!post) {
        throw new ApiException(
          "post_not_found",
          404,
          "Post not found or not linked to this item."
        );
      }

      await tx
        .update(posts)
        .set({ roadmapItemId: null })
        .where(eq(posts.id, post.id));

      return { success: true };
    });
  }

  async searchPosts(
    tenant: { workspaceId: string; productId: string },
    searchQuery?: string
  ): Promise<RoadmapPostLinkSearchResult[]> {
    const whereConditions = [
      eq(posts.productId, tenant.productId),
      isNull(posts.deletedAt),
      isNull(posts.mergedIntoId),
    ];

    if (searchQuery && searchQuery.trim().length > 0) {
      const trimmed = searchQuery.trim();
      const asNum = parseInt(trimmed, 10);
      if (!isNaN(asNum) && asNum > 0) {
        whereConditions.push(
          or(eq(posts.number, asNum), ilike(posts.title, `%${escapeLike(trimmed)}%`))!
        );
      } else {
        whereConditions.push(ilike(posts.title, `%${escapeLike(trimmed)}%`));
      }
    }

    const rows = await this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        statusId: posts.statusId,
        roadmapItemId: posts.roadmapItemId,
        voteCount: posts.voteCount,
      })
      .from(posts)
      .where(and(...whereConditions))
      .orderBy(desc(posts.number))
      .limit(20);

    return rows;
  }


  async getLinkedPosts(
    tenant: { workspaceId: string; productId: string },
    itemId: string
  ): Promise<RoadmapPostLinkSearchResult[]> {
    return this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        statusId: posts.statusId,
        roadmapItemId: posts.roadmapItemId,
        voteCount: posts.voteCount,
      })
      .from(posts)
      .where(
        and(
          eq(posts.productId, tenant.productId),
          eq(posts.roadmapItemId, itemId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .orderBy(desc(posts.number));
  }

  private lockLinkedPosts(tx: any, productId: string, itemId: string) {
    return tx
      .select({ id: posts.id, statusId: posts.statusId, version: posts.version })
      .from(posts)
      .where(
        and(
          eq(posts.productId, productId),
          eq(posts.roadmapItemId, itemId),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .for("update");
  }

  // Linked posts take the item's status (ROAD-07); every change is logged and
  // notifies the post's stakeholders (LOOP-03), however the post got linked.
  private async followItemStatus(
    tx: any,
    tenant: { workspaceId: string; productId: string },
    actorId: string,
    status: { id: string; name: string; color: string },
    linked: { id: string; statusId: string; version: number }[]
  ): Promise<void> {
    for (const post of linked) {
      if (post.statusId === status.id) continue;

      await tx
        .update(posts)
        .set({ statusId: status.id, version: post.version + 1 })
        .where(eq(posts.id, post.id));

      const [act] = await tx
        .insert(postActivity)
        .values({
          postId: post.id,
          actorId,
          kind: "status_changed",
          toStatusId: status.id,
          statusName: status.name,
          statusColor: status.color,
          note: null,
        })
        .returning({ id: postActivity.id });

      await this.notificationsService?.fanOutStatusChange(tx, {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId,
        postId: post.id,
        postActivityId: act.id,
        actorId,
      });
    }
  }

  private mapAdminItem(row: any): AdminRoadmapItem {
    return {
      id: row.id,
      statusId: row.statusId,
      internalTitle: row.internalTitle,
      internalDescription: row.internalDescription ?? null,
      internalNotes: row.internalNotes ?? null,
      publicTitle: row.publicTitle ?? null,
      publicDescription: row.publicDescription ?? null,
      isPublic: Boolean(row.isPublic),
      rank: row.rank,
      assignee: row.assigneeId
        ? {
            id: row.assigneeId,
            name: row.assigneeName ?? null,
            image: row.assigneeImage ?? null,
          }
        : null,
      deadlineText: row.deadlineText ?? null,
      deadlineDate: row.deadlineDate ? new Date(row.deadlineDate).toISOString() : null,
      linkedPostCount: Number(row.linkedPostCount ?? 0),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }
}
