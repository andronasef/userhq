import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { type createTestApp, signedInCookie } from "./test-app.js";

export interface TenantSeed {
  slug: string;
  id: string;
  cookie: string;
  userId: string;
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
    },
  };
}
