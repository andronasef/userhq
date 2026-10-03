import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { type createTestApp, signedInCookie } from "./test-app.js";

export interface TenantSeed {
  slug: string;
  id: string;
  cookie: string;
  userId: string;
  memberUserId?: string;
  inviteId?: string;
}

export interface Seed {
  a: TenantSeed;
  b: TenantSeed;
}

export async function seedTenants(
  testApp: Awaited<ReturnType<typeof createTestApp>>
): Promise<Seed> {
  const randA = randomBytes(4).toString("hex");
  const randB = randomBytes(4).toString("hex");

  const userA = await signedInCookie(testApp.test, {
    name: "Tenant A Owner",
    emailVerified: true,
  });

  const userB = await signedInCookie(testApp.test, {
    name: "Tenant B Owner",
    emailVerified: true,
  });

  const slugA = `ws-a-${randA}`;
  const slugB = `ws-b-${randB}`;

  const [wsA] = await testApp.db
    .insert(schema.workspaces)
    .values({
      slug: slugA,
      name: `Workspace A ${randA}`,
    })
    .returning();

  await testApp.db.insert(schema.workspaceMembers).values({
    workspaceId: wsA.id,
    userId: userA.userId,
    role: "owner",
  });

  const [wsB] = await testApp.db
    .insert(schema.workspaces)
    .values({
      slug: slugB,
      name: `Workspace B ${randB}`,
    })
    .returning();

  await testApp.db.insert(schema.workspaceMembers).values({
    workspaceId: wsB.id,
    userId: userB.userId,
    role: "owner",
  });

  const memberB = await signedInCookie(testApp.test, {
    name: "Tenant B Admin Member",
    emailVerified: true,
  });

  await testApp.db.insert(schema.workspaceMembers).values({
    workspaceId: wsB.id,
    userId: memberB.userId,
    role: "admin",
  });

  const [inviteB] = await testApp.db
    .insert(schema.invites)
    .values({
      kind: "workspace",
      workspaceId: wsB.id,
      email: `invite-b-${randB}@example.com`,
      tokenHash: randomBytes(32).toString("hex"),
      createdById: userB.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  return {
    a: {
      slug: slugA,
      id: wsA.id,
      cookie: userA.cookie,
      userId: userA.userId,
    },
    b: {
      slug: slugB,
      id: wsB.id,
      cookie: userB.cookie,
      userId: userB.userId,
      memberUserId: memberB.userId,
      inviteId: inviteB.id,
    },
  };
}
