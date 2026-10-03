import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { type createTestApp, signedInCookie } from "./test-app.js";

export interface TenantSeed {
  slug: string;
  id: string;
  cookie: string;
  userId: string;
  memberUserId?: string;
  inviteId?: string;
  productSlug?: string;
  statusId?: string;
  postNumber?: number;
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

  const prodSlugA = `prod-a-${randA}`;
  const [prodA] = await testApp.db
    .insert(schema.products)
    .values({
      workspaceId: wsA.id,
      name: `Product A ${randA}`,
      slug: prodSlugA,
      accentColor: "#2563EB",
    })
    .returning();

  const [statusA] = await testApp.db
    .insert(schema.statuses)
    .values({
      productId: prodA.id,
      name: "Under Review",
      color: "#EA580C",
      type: "review",
      position: 0,
      isDefault: true,
    })
    .returning();

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

  const prodSlugB = `prod-b-${randB}`;
  const [prodB] = await testApp.db
    .insert(schema.products)
    .values({
      workspaceId: wsB.id,
      name: `Product B ${randB}`,
      slug: prodSlugB,
      accentColor: "#2563EB",
    })
    .returning();

  const [statusB] = await testApp.db
    .insert(schema.statuses)
    .values({
      productId: prodB.id,
      name: "Under Review",
      color: "#EA580C",
      type: "review",
      position: 0,
      isDefault: true,
    })
    .returning();

  const [postB] = await testApp.db
    .insert(schema.posts)
    .values({
      productId: prodB.id,
      number: 1,
      title: "Tenant B Post 1",
      description: "Tenant B Post 1 Description",
      statusId: statusB.id,
      authorId: userB.userId,
      voteCount: 1,
    })
    .returning();

  await testApp.db.insert(schema.votes).values({
    postId: postB.id,
    userId: userB.userId,
  });

  await testApp.db
    .update(schema.products)
    .set({ nextPostNumber: 2 })
    .where(eq(schema.products.id, prodB.id));

  return {
    a: {
      slug: slugA,
      id: wsA.id,
      cookie: userA.cookie,
      userId: userA.userId,
      productSlug: prodSlugA,
      productId: prodA.id,
      statusId: statusA.id,
    },
    b: {
      slug: slugB,
      id: wsB.id,
      cookie: userB.cookie,
      userId: userB.userId,
      memberUserId: memberB.userId,
      inviteId: inviteB.id,
      productSlug: prodSlugB,
      productId: prodB.id,
      statusId: statusB.id,
      postNumber: 1,
    },
  };
}
