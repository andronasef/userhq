import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Portal Activity API (Plan 04-03 Task 2)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let testUser: { cookie: string; userId: string };
  let otherUser: { cookie: string; userId: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let plannedStatus: { id: string; name: string };
  let inProgressStatus: { id: string; name: string };
  let postA: any;
  let postB: any;
  let postC: any;
  let postD: any;

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "admin@activity.test",
    });

    adminUser = await signedInCookie(testApp.test, {
      name: "Activity Admin",
      email: "admin@activity.test",
      emailVerified: true,
    });

    testUser = await signedInCookie(testApp.test, {
      name: "Engaged User",
      email: "user@activity.test",
      emailVerified: true,
    });

    otherUser = await signedInCookie(testApp.test, {
      name: "Other User",
      email: "other@activity.test",
      emailVerified: true,
    });

    wsSlug = "ws-activity-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Activity Test Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "activity-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Activity Product",
      })
      .returning();
    prodId = prod.id;

    // Seed statuses
    const statuses = await testApp.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: prodId,
          name: s.name,
          type: s.type,
          color: s.color,
          position: idx,
          isDefault: idx === 0,
          isPublicRoadmap: true,
        }))
      )
      .returning({ id: schema.statuses.id, name: schema.statuses.name });

    plannedStatus = statuses.find((s) => s.name === "Planned")!;
    inProgressStatus = statuses.find((s) => s.name === "In Progress")!;

    // Post A: Created by testUser
    [postA] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Post Created by User",
        statusId: plannedStatus.id,
        authorId: testUser.userId,
      })
      .returning();

    // Post B: Created by adminUser, voted by testUser
    [postB] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 2,
        title: "Post Voted by User",
        statusId: plannedStatus.id,
        authorId: adminUser.userId,
      })
      .returning();

    await testApp.db.insert(schema.votes).values({
      postId: postB.id,
      userId: testUser.userId,
    });

    // Post C: Created by adminUser, commented by testUser
    [postC] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 3,
        title: "Post Commented by User",
        statusId: plannedStatus.id,
        authorId: adminUser.userId,
      })
      .returning();

    await testApp.db.insert(schema.comments).values({
      postId: postC.id,
      authorId: testUser.userId,
      body: "My feedback comment",
    });

    // Post D: Unengaged post (testUser did not create, vote, or comment)
    [postD] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 4,
        title: "Post Unengaged by User",
        statusId: plannedStatus.id,
        authorId: otherUser.userId,
      })
      .returning();
    void postD;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("requires authentication for portal activity (401 unauthorized)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/activity`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(401);
  });

  it("lists all engaged posts with engagement types and excludes unengaged posts", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/activity`)
      .set("Cookie", testUser.cookie)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    expect(res.body.activities).toBeInstanceOf(Array);
    expect(res.body.activities.length).toBe(3);

    const postIds = res.body.activities.map((a: any) => a.post.id);
    expect(postIds).toContain(postA.id);
    expect(postIds).toContain(postB.id);
    expect(postIds).toContain(postC.id);
    expect(postIds).not.toContain(postD.id);

    const itemA = res.body.activities.find((a: any) => a.post.id === postA.id);
    expect(itemA.type).toBe("created");

    const itemB = res.body.activities.find((a: any) => a.post.id === postB.id);
    expect(itemB.type).toBe("voted");

    const itemC = res.body.activities.find((a: any) => a.post.id === postC.id);
    expect(itemC.type).toBe("commented");
  });

  it("tracks session visits and diffs hasStatusChange and hasNewComments", async () => {
    // 1. Admin moves Post A to In Progress with status change activity
    await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/1/status`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        version: postA.version,
        note: "Starting now",
      });

    // 2. Other user adds a comment to Post B
    await testApp.db.insert(schema.comments).values({
      postId: postB.id,
      authorId: otherUser.userId,
      body: "Another user comment on Post B",
    });

    // 3. User visits activity feed -> sees new badges
    const visit1 = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/activity`)
      .set("Cookie", testUser.cookie)
      .set("Origin", "http://localhost:3000");

    expect(visit1.status).toBe(200);
    expect(visit1.body.hasUnread).toBe(true);

    const actA = visit1.body.activities.find((a: any) => a.post.id === postA.id);
    expect(actA.hasNewStatus).toBe(true);

    const actB = visit1.body.activities.find((a: any) => a.post.id === postB.id);
    expect(actB.hasNewComments).toBe(true);

    // 4. User visits activity feed again immediately -> all badges cleared
    const visit2 = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/activity`)
      .set("Cookie", testUser.cookie)
      .set("Origin", "http://localhost:3000");

    expect(visit2.status).toBe(200);
    expect(visit2.body.hasUnread).toBe(false);

    const actA2 = visit2.body.activities.find((a: any) => a.post.id === postA.id);
    expect(actA2.hasNewStatus).toBe(false);

    const actB2 = visit2.body.activities.find((a: any) => a.post.id === postB.id);
    expect(actB2.hasNewComments).toBe(false);
  });
});
