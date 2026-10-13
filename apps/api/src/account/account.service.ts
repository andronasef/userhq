import { Injectable, Inject, HttpStatus } from "@nestjs/common";
import { sql, eq, and, inArray, isNull } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaces,
  workspaceMembers,
  products,
  postMutes,
  commentEmailBatches,
  user as userTable,
  session,
  account,
} from "@userhq/db";
import type { DeleteAccountInput } from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { ApiException } from "../common/api-error.filter.js";
import { isPlatformOwner } from "../auth/platform-owner.js";

@Injectable()
export class AccountService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env
  ) {}

  async deleteAccount(user: any, input: DeleteAccountInput): Promise<void> {
    if (isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL)) {
      throw new ApiException(
        "platform_owner_account",
        HttpStatus.FORBIDDEN,
        "This is the platform owner account. It's set in server configuration and can't be deleted here."
      );
    }

    await this.db.transaction(async (tx) => {
      // 1. Select caller's owned workspaces with FOR UPDATE
      const ownedWorkspaces = await tx
        .select({
          id: workspaces.id,
          slug: workspaces.slug,
          name: workspaces.name,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(
          and(
            eq(workspaceMembers.userId, user.id),
            eq(workspaceMembers.role, "owner"),
            isNull(workspaces.deletedAt)
          )
        )
        .for("update");

      const ownedMap = new Map(ownedWorkspaces.map((w) => [w.slug, w]));
      const inputSlugs = new Set(input.workspaces.map((w) => w.slug));

      if (
        input.workspaces.length !== ownedWorkspaces.length ||
        inputSlugs.size !== ownedWorkspaces.length ||
        !ownedWorkspaces.every((w) => inputSlugs.has(w.slug))
      ) {
        throw new ApiException(
          "owned_workspaces_unresolved",
          HttpStatus.BAD_REQUEST,
          "Choose what happens to each of your workspaces first."
        );
      }

      // 2. Process workspace choices
      for (const item of input.workspaces) {
        const ws = ownedMap.get(item.slug)!;
        if (item.action === "transfer") {
          const invalid = () =>
            new ApiException(
              "transfer_target_invalid",
              HttpStatus.BAD_REQUEST,
              `That person is no longer a member of ${ws.name}. Choose someone else.`
            );
          if (!item.toUserId || item.toUserId === user.id) throw invalid();

          const [memberRow] = await tx
            .select({ userId: workspaceMembers.userId })
            .from(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.workspaceId, ws.id),
                eq(workspaceMembers.userId, item.toUserId)
              )
            )
            .for("update");

          if (!memberRow) throw invalid();

          // Delete caller's membership first, then promote target to owner
          // (partial unique index workspace_members_one_owner is checked per-statement)
          await tx
            .delete(workspaceMembers)
            .where(
              and(
                eq(workspaceMembers.workspaceId, ws.id),
                eq(workspaceMembers.userId, user.id)
              )
            );

          await tx
            .update(workspaceMembers)
            .set({ role: "owner" })
            .where(
              and(
                eq(workspaceMembers.workspaceId, ws.id),
                eq(workspaceMembers.userId, item.toUserId)
              )
            );
        } else if (item.action === "delete") {
          // Same as WorkspaceController.deleteWorkspace
          await tx
            .update(workspaces)
            .set({ deletedAt: sql`now()` })
            .where(eq(workspaces.id, ws.id));
          await tx
            .update(products)
            .set({ deletedAt: sql`now()` })
            .where(and(eq(products.workspaceId, ws.id), isNull(products.deletedAt)));
        }
      }

      // 3. Delete any remaining memberships for the caller
      await tx
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.userId, user.id));

      // 4. Delete post mutes
      await tx.delete(postMutes).where(eq(postMutes.userId, user.id));

      // 5. Cancel pending and retrying comment email batches
      await tx
        .update(commentEmailBatches)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(commentEmailBatches.userId, user.id),
            inArray(commentEmailBatches.status, ["pending", "retrying"])
          )
        );

      // 6. Scrub user row in place
      await tx
        .update(userTable)
        .set({
          name: "",
          image: null,
          email: sql`'deleted-' || ${userTable.id} || '@deleted.invalid'`,
          emailVerified: false,
          commentEmails: false,
          deletedAt: sql`now()`,
        })
        .where(eq(userTable.id, user.id));

      // 7. Delete sessions and accounts
      await tx.delete(session).where(eq(session.userId, user.id));
      await tx.delete(account).where(eq(account.userId, user.id));
    });
  }
}
