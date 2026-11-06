import { eq, and, isNull } from "drizzle-orm";
import { type Db, workspaceMembers, workspaces } from "@userhq/db";
import type { Actor } from "../auth/principal.js";

export async function isFeedbackAdmin(db: Db | any, actor: Actor, workspaceId: string): Promise<boolean> {
  if (actor.apiPrincipal) {
    return actor.apiPrincipal.workspaceId === workspaceId;
  }
  return isWorkspaceAdmin(db, actor.id, workspaceId);
}

export async function isWorkspaceAdmin(
  db: Db | any,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  return Boolean(row && (row.role === "owner" || row.role === "admin"));
}
