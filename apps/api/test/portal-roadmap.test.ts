import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Public Portal Roadmap API (Plan 04-02 Task 2)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;

  let publicStatusId: string;
  let privateStatusId: string;

  let publicItemInPublicStatusId: string;
  let privateItemInPublicStatusId: string;
  let publicItemInPrivateStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    adminUser = await signedInCookie(testApp.test, {
      name: "Portal Roadmap Admin",
      email: "portal-admin@roadmap.test",
      emailVerified: true,
    });

    wsSlug = "ws-portal-roadmap";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Portal Roadmap Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "portal-roadmap-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Portal Roadmap Product",
      })
      .returning();
    prodId = prod.id;

    // 1. Create one status with is_public_roadmap = true and one with is_public_roadmap = false
    const [pubStatus] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodId,
        name: "Planned Public",
        color: "#2563EB",
        type: "planned",
        position: 0,
        isPublicRoadmap: true,
      })
      .returning();
    publicStatusId = pubStatus.id;

    const [privStatus] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodId,
        name: "Internal Only Status",
        color: "#6B7280",
        type: "review",
        position: 1,
        isPublicRoadmap: false,
      })
      .returning();
    privateStatusId = privStatus.id;

    // 2. Item A: Public item in public status (SHOULD be visible)
    const [itemA] = await testApp.db
      .insert(schema.roadmapItems)
      .values({
        productId: prodId,
        statusId: publicStatusId,
        publicTitle: "Public Roadmap Item",
        publicDescription: "This should be publicly visible to everyone.",
        isPublic: true,
        rank: "a0",
      })
      .returning();
    publicItemInPublicStatusId = itemA.id;
    await testApp.db.insert(schema.roadmapItemInternals).values({
      itemId: itemA.id,
      productId: prodId,
      internalTitle: "Internal A Secret Title",
      internalNotes: "Confidential internal note",
    });

    // Link a post to Item A
    const [postA] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Linked Post for Item A",
        statusId: publicStatusId,
        authorId: adminUser.userId,
        roadmapItemId: itemA.id,
        voteCount: 12,
      })
      .returning();
    void postA;

    // 3. Item B: Private item in public status (SHOULD NOT be visible)
    const [itemB] = await testApp.db
      .insert(schema.roadmapItems)
      .values({
        productId: prodId,
        statusId: publicStatusId,
        publicTitle: "Private Item in Public Status",
        isPublic: false,
        rank: "a1",
      })
      .returning();
    privateItemInPublicStatusId = itemB.id;
    await testApp.db.insert(schema.roadmapItemInternals).values({
      itemId: itemB.id,
      productId: prodId,
      internalTitle: "Internal B Secret Title",
    });

    // 4. Item C: Public item in private status (SHOULD NOT be visible)
    const [itemC] = await testApp.db
      .insert(schema.roadmapItems)
      .values({
        productId: prodId,
        statusId: privateStatusId,
        publicTitle: "Public Item in Private Status",
        isPublic: true,
        rank: "a2",
      })
      .returning();
    publicItemInPrivateStatusId = itemC.id;
    await testApp.db.insert(schema.roadmapItemInternals).values({
      itemId: itemC.id,
      productId: prodId,
      internalTitle: "Internal C Secret Title",
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("lists only public items in statuses with is_public_roadmap = true (STAT-06, ROAD-11)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);

    const ids = res.body.items.map((i: any) => i.id);
    expect(ids).toContain(publicItemInPublicStatusId);
    expect(ids).not.toContain(privateItemInPublicStatusId);
    expect(ids).not.toContain(publicItemInPrivateStatusId);

    const visibleItem = res.body.items.find((i: any) => i.id === publicItemInPublicStatusId);
    expect(visibleItem.title).toBe("Public Roadmap Item");
    expect(visibleItem.description).toBe("This should be publicly visible to everyone.");
    expect(visibleItem.postCount).toBe(1);
    expect(visibleItem.internalTitle).toBeUndefined();
    expect(visibleItem.internalNotes).toBeUndefined();
  });

  it("returns public roadmap item detail with linked public posts (ROAD-11)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap/${publicItemInPublicStatusId}`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe(publicItemInPublicStatusId);
    expect(res.body.item.title).toBe("Public Roadmap Item");
    expect(res.body.item.description).toBe("This should be publicly visible to everyone.");
    expect(res.body.item.postCount).toBe(1);

    expect(res.body.posts).toBeInstanceOf(Array);
    expect(res.body.posts.length).toBe(1);
    expect(res.body.posts[0]).toEqual({
      number: 1,
      slug: "linked-post-for-item-a",
      title: "Linked Post for Item A",
      voteCount: 12,
    });
  });

  it("returns 404 for private item or item in private status (STAT-06, ROAD-11)", async () => {
    // Private item
    const resPrivate = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap/${privateItemInPublicStatusId}`)
      .set("Origin", "http://localhost:3000");
    expect(resPrivate.status).toBe(404);
    expect(resPrivate.body.code).toBe("not_found");

    // Item in private status
    const resPrivateStatus = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap/${publicItemInPrivateStatusId}`)
      .set("Origin", "http://localhost:3000");
    expect(resPrivateStatus.status).toBe(404);
    expect(resPrivateStatus.body.code).toBe("not_found");

    // Non-existent item
    const resNotFound = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap/00000000-0000-0000-0000-000000000000`)
      .set("Origin", "http://localhost:3000");
    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.code).toBe("not_found");
  });
});
