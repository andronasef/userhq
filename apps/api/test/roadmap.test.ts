import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Roadmap API & Status Synchronization Engine (Plan 04-02 Task 1)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string };
  let memberUser: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let prodId: string;
  let prodSlug: string;
  let statusList: { id: string; name: string }[] = [];

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@roadmap.test",
    });

    ownerUser = await signedInCookie(testApp.test, {
      name: "Roadmap Owner",
      email: "owner@roadmap.test",
      emailVerified: true,
    });

    memberUser = await signedInCookie(testApp.test, {
      name: "Roadmap Member",
      email: "member@roadmap.test",
      emailVerified: true,
    });

    wsSlug = "ws-roadmap-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Roadmap Test Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values([
      {
        workspaceId: wsId,
        userId: ownerUser.userId,
        role: "owner",
      },
      {
        workspaceId: wsId,
        userId: memberUser.userId,
        role: "admin",
      },
    ]);

    prodSlug = "roadmap-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Roadmap Product",
      })
      .returning();
    prodId = prod.id;

    // Seed default statuses
    statusList = await testApp.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: prodId,
          name: s.name,
          type: s.type,
          color: s.color,
          position: idx,
          isDefault: idx === 0,
          isPublicRoadmap: idx > 0, // Planned, In Progress, Complete public
        }))
      )
      .returning({ id: schema.statuses.id, name: schema.statuses.name });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("creates a roadmap item with internal title, description, notes, assignee, and deadline", async () => {
    const plannedStatus = statusList.find((s) => s.name === "Planned")!;
    const res = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatus.id,
        internalTitle: "SSO Integration",
        internalDescription: "Implement SAML and OIDC for enterprise users",
        internalNotes: "Security team review scheduled for Q3",
        assigneeId: memberUser.userId,
        deadlineText: "Q3 2026",
        deadlineDate: "2026-09-30T23:59:59.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.statusId).toBe(plannedStatus.id);
    expect(res.body.internalTitle).toBe("SSO Integration");
    expect(res.body.internalDescription).toBe("Implement SAML and OIDC for enterprise users");
    expect(res.body.internalNotes).toBe("Security team review scheduled for Q3");
    expect(res.body.assignee).toEqual({
      id: memberUser.userId,
      name: "Roadmap Member",
      image: null,
    });
    expect(res.body.deadlineText).toBe("Q3 2026");
    expect(res.body.isPublic).toBe(false);
    expect(res.body.rank).toBe("a0");
  });

  it("lists roadmap items ordered by rank", async () => {
    const inProgressStatus = statusList.find((s) => s.name === "In Progress")!;
    // Create 2 items in In Progress
    const res1 = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        internalTitle: "Card 1",
      });
    expect(res1.status).toBe(201);

    const res2 = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        internalTitle: "Card 2",
      });
    expect(res2.status).toBe(201);

    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toBeInstanceOf(Array);
    const inProgressItems = listRes.body.items.filter(
      (i: any) => i.statusId === inProgressStatus.id
    );
    expect(inProgressItems.length).toBe(2);
    expect(inProgressItems[0].internalTitle).toBe("Card 1");
    expect(inProgressItems[1].internalTitle).toBe("Card 2");
  });

  it("orders ranks by code unit, not by the database's case-folding collation", async () => {
    const backlog = statusList.find((s) => s.name === SEEDED_STATUSES[0].name)!;
    // "a0V" < "a0l" in byte order; en_US collation puts "a0l" first.
    for (const [title, rank] of [["Lower", "a0l"], ["Upper", "a0V"]]) {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ statusId: backlog.id, internalTitle: title, rank });
      expect(res.status).toBe(201);
    }

    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie);
    const titles = listRes.body.items
      .filter((i: any) => i.statusId === backlog.id)
      .map((i: any) => i.internalTitle);
    expect(titles).toEqual(["Upper", "Lower"]);
  });

  it("moves a roadmap item intra-column and inter-column with LexoRank and cascades status to linked posts", async () => {
    const underReviewStatus = statusList.find((s) => s.name === "Under Review")!;
    const plannedStatus = statusList.find((s) => s.name === "Planned")!;
    const inProgressStatus = statusList.find((s) => s.name === "In Progress")!;

    // 1. Create a post in Under Review
    const [testPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 101,
        title: "Support Dark Mode",
        description: "Need dark mode",
        statusId: underReviewStatus.id,
        authorId: ownerUser.userId,
        voteCount: 5,
      })
      .returning();

    // 2. Create roadmap item in Planned and link the post
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatus.id,
        internalTitle: "Dark Theme System",
        postIds: [testPost.id],
      });

    expect(createRes.status).toBe(201);
    const itemId = createRes.body.id;

    // Verify post status was updated to Planned and activity was created
    const [updatedPost] = await testApp.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, testPost.id));
    expect(updatedPost.statusId).toBe(plannedStatus.id);
    expect(updatedPost.roadmapItemId).toBe(itemId);

    // 3. Move item inter-column to In Progress
    const moveRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${itemId}/move`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        targetRank: "a2",
      });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.statusId).toBe(inProgressStatus.id);
    expect(moveRes.body.rank).toBe("a2");

    // Verify linked post followed the status move
    const [postAfterMove] = await testApp.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, testPost.id));
    expect(postAfterMove.statusId).toBe(inProgressStatus.id);

    // Verify post_activity entry was created
    const activities = await testApp.db
      .select()
      .from(schema.postActivity)
      .where(eq(schema.postActivity.postId, testPost.id));
    expect(activities.some((a) => a.toStatusId === inProgressStatus.id)).toBe(true);
  });

  it("blocks manual status modification on a linked post with 400 post_locked", async () => {
    const plannedStatus = statusList.find((s) => s.name === "Planned")!;
    const completeStatus = statusList.find((s) => s.name === "Completed")!;

    // Create post & link to an item
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 102,
        title: "Export to CSV",
        description: "Export feature",
        statusId: plannedStatus.id,
        authorId: ownerUser.userId,
      })
      .returning();

    await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatus.id,
        internalTitle: "CSV Export Pipeline",
        postIds: [post.id],
      });

    // Attempt direct moderation status change
    const modRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/102/status`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: completeStatus.id,
        version: post.version,
      });

    expect(modRes.status).toBe(400);
    expect(modRes.body.code).toBe("post_locked");
  });

  it("links and unlinks posts dynamically", async () => {
    const plannedStatus = statusList.find((s) => s.name === "Planned")!;
    const underReviewStatus = statusList.find((s) => s.name === "Under Review")!;

    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 103,
        title: "API Rate Limiting",
        description: "Need rate limits",
        statusId: underReviewStatus.id,
        authorId: ownerUser.userId,
      })
      .returning();

    const itemRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatus.id,
        internalTitle: "Rate Limiter",
      });
    const itemId = itemRes.body.id;

    // Link post
    const linkRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${itemId}/link`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ postId: post.id });

    expect(linkRes.status).toBe(201);
    expect(linkRes.body.success).toBe(true);
    expect(linkRes.body.linkedPostCount).toBe(1);

    // Verify post status aligned
    const [linkedPost] = await testApp.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, post.id));
    expect(linkedPost.statusId).toBe(plannedStatus.id);
    expect(linkedPost.roadmapItemId).toBe(itemId);

    // Attempting to link again fails with post_already_linked
    const duplicateLinkRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${itemId}/link`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ postId: post.id });
    expect(duplicateLinkRes.status).toBe(400);
    expect(duplicateLinkRes.body.code).toBe("post_already_linked");

    // Unlink post
    const unlinkRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${itemId}/unlink/${post.id}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(unlinkRes.status).toBe(200);
    expect(unlinkRes.body.success).toBe(true);

    const [unlinkedPost] = await testApp.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, post.id));
    expect(unlinkedPost.roadmapItemId).toBeNull();
    // Post retains its status!
    expect(unlinkedPost.statusId).toBe(plannedStatus.id);
  });

  it("deleting a roadmap item unlocks linked posts while preserving their status", async () => {
    const plannedStatus = statusList.find((s) => s.name === "Planned")!;
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 104,
        title: "Keyboard Shortcuts",
        description: "Need shortcuts",
        statusId: plannedStatus.id,
        authorId: ownerUser.userId,
      })
      .returning();

    const itemRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatus.id,
        internalTitle: "Shortcuts Engine",
        postIds: [post.id],
      });
    const itemId = itemRes.body.id;

    // Delete item
    const deleteRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${itemId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(deleteRes.status).toBe(200);

    // Verify post is now unlocked
    const [unlockedPost] = await testApp.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, post.id));
    expect(unlockedPost.roadmapItemId).toBeNull();
    expect(unlockedPost.statusId).toBe(plannedStatus.id);
  });

  it("deleting a status reassigns roadmap items to target moveTo status", async () => {
    // 1. Create a custom status to delete
    const [tempStatus] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodId,
        name: "Temporary Status",
        color: "#9333EA",
        type: "planned",
        position: 99,
        isDefault: false,
      })
      .returning();

    const plannedStatus = statusList.find((s) => s.name === "Planned")!;

    // 2. Create item in tempStatus
    const itemRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: tempStatus.id,
        internalTitle: "Temporary Task",
      });
    const itemId = itemRes.body.id;

    // 3. Delete tempStatus with moveTo = plannedStatus.id
    const delStatusRes = await request(testApp.http)
      .delete(
        `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${tempStatus.id}?moveTo=${plannedStatus.id}`
      )
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delStatusRes.status).toBe(204);

    // 4. Verify roadmap item was reassigned
    const [reassignedItem] = await testApp.db
      .select()
      .from(schema.roadmapItems)
      .where(eq(schema.roadmapItems.id, itemId));

    expect(reassignedItem.statusId).toBe(plannedStatus.id);
  });

  it("searches posts for linking combobox", async () => {
    const plannedStatus = statusList.find((s) => s.name === "Planned")!;
    await testApp.db.insert(schema.posts).values({
      productId: prodId,
      number: 105,
      title: "Webhook Notifications",
      description: "Send webhooks on events",
      statusId: plannedStatus.id,
      authorId: ownerUser.userId,
    });

    const searchRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/search-posts?q=Webhook`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.posts.some((p: any) => p.number === 105)).toBe(true);
  });
});
