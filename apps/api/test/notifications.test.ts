import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, and } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Notifications API & Stakeholder Fan-Out Engine (Plan 04-03 Task 1)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let authorUser: { cookie: string; userId: string };
  let voterUser: { cookie: string; userId: string };
  let commenterUser: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let prodId: string;
  let prodSlug: string;
  let plannedStatus: { id: string; name: string };
  let inProgressStatus: { id: string; name: string };
  let completedStatus: { id: string; name: string };

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "admin@notif.test",
    });

    adminUser = await signedInCookie(testApp.test, {
      name: "Notif Admin",
      email: "admin@notif.test",
      emailVerified: true,
    });

    authorUser = await signedInCookie(testApp.test, {
      name: "Notif Author",
      email: "author@notif.test",
      emailVerified: true,
    });

    voterUser = await signedInCookie(testApp.test, {
      name: "Notif Voter",
      email: "voter@notif.test",
      emailVerified: true,
    });

    commenterUser = await signedInCookie(testApp.test, {
      name: "Notif Commenter",
      email: "commenter@notif.test",
      emailVerified: true,
    });

    wsSlug = "ws-notif-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Notif Test Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "notif-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Notif Product",
      })
      .returning();
    prodId = prod.id;

    // Seed default statuses
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
    completedStatus = statuses.find((s) => s.name === "Completed")!;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("fans out status change notifications to author, voter, and commenter while excluding the actor", async () => {
    // 1. Author creates a post
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Feature with Stakeholders",
        statusId: plannedStatus.id,
        authorId: authorUser.userId,
      })
      .returning();

    // 2. Voter upvotes the post
    await testApp.db.insert(schema.votes).values({
      postId: post.id,
      userId: voterUser.userId,
    });

    // 3. Commenter leaves a comment
    await testApp.db.insert(schema.comments).values({
      postId: post.id,
      authorId: commenterUser.userId,
      body: "I really need this!",
    });

    // 4. Admin changes status to In Progress with a public note
    const modRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/1/status`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        version: post.version,
        note: "We started working on this today!",
      });

    expect(modRes.status).toBe(200);

    // 5. Verify notifications table
    const notifs = await testApp.db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.postId, post.id));

    const notifiedUserIds = notifs.map((n) => n.userId);
    expect(notifiedUserIds).toContain(authorUser.userId);
    expect(notifiedUserIds).toContain(voterUser.userId);
    expect(notifiedUserIds).toContain(commenterUser.userId);
    expect(notifiedUserIds).not.toContain(adminUser.userId); // Actor is excluded!
  });

  it("groups repeated status changes into a single notification row per user (LOOP-04)", async () => {
    // Author creates another post
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 2,
        title: "Multi-Status Move Post",
        statusId: plannedStatus.id,
        authorId: authorUser.userId,
      })
      .returning();

    // First status change: to In Progress
    const res1 = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/2/status`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        version: post.version,
        note: "Move 1 note",
      });
    expect(res1.status).toBe(200);

    // Verify 1 notification exists for author
    let authorNotifs = await testApp.db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.postId, post.id),
          eq(schema.notifications.userId, authorUser.userId)
        )
      );
    expect(authorNotifs.length).toBe(1);
    expect(authorNotifs[0].readAt).toBeNull();

    // Author marks it read
    await request(testApp.http)
      .post(`/api/v1/notifications/${post.id}/read`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    // Second status change: to Completed
    const res2 = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/2/status`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: completedStatus.id,
        version: res1.body.version,
        note: "Move 2 note - shipped!",
      });
    expect(res2.status).toBe(200);

    // Verify still exactly 1 notification exists for author (NO DUPLICATE ROWS), and readAt is reset to null!
    authorNotifs = await testApp.db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.postId, post.id),
          eq(schema.notifications.userId, authorUser.userId)
        )
      );
    expect(authorNotifs.length).toBe(1);
    expect(authorNotifs[0].readAt).toBeNull();
  });

  it("fans out notifications when post status changes through a roadmap item move", async () => {
    // 1. Author creates a post in Planned
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 3,
        title: "Roadmap Linked Post",
        statusId: plannedStatus.id,
        authorId: authorUser.userId,
      })
      .returning();

    // 2. Admin creates roadmap item in Planned and links the post
    const createItemRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatus.id,
        internalTitle: "Roadmap Feature Item",
        postIds: [post.id],
      });
    expect(createItemRes.status).toBe(201);
    const itemId = createItemRes.body.id;

    // 3. Admin moves roadmap item to In Progress
    const moveRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${itemId}/move`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: inProgressStatus.id,
        targetRank: "a5",
      });
    expect(moveRes.status).toBe(200);

    // 4. Verify author received notification from the roadmap cascade
    const authorNotifs = await testApp.db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.postId, post.id),
          eq(schema.notifications.userId, authorUser.userId)
        )
      );
    expect(authorNotifs.length).toBe(1);
    expect(authorNotifs[0].readAt).toBeNull();
  });

  it("notifies stakeholders when linking moves a post to the item's status (LOOP-03)", async () => {
    const [viaCreate, viaLink] = await testApp.db
      .insert(schema.posts)
      .values([
        { productId: prodId, number: 4, title: "Linked on create", statusId: plannedStatus.id, authorId: authorUser.userId },
        { productId: prodId, number: 5, title: "Linked later", statusId: plannedStatus.id, authorId: authorUser.userId },
      ])
      .returning();
    await testApp.db.insert(schema.votes).values([
      { postId: viaCreate.id, userId: voterUser.userId },
      { postId: viaLink.id, userId: voterUser.userId },
    ]);

    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ statusId: inProgressStatus.id, internalTitle: "Link Fanout", postIds: [viaCreate.id] });
    expect(createRes.status).toBe(201);

    const linkRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/roadmap/${createRes.body.id}/link`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ postId: viaLink.id });
    expect(linkRes.status).toBe(201);
    expect(linkRes.body.linkedPostCount).toBe(2);

    for (const post of [viaCreate, viaLink]) {
      const notified = await testApp.db
        .select({ userId: schema.notifications.userId })
        .from(schema.notifications)
        .where(eq(schema.notifications.postId, post.id));
      expect(notified.map((n) => n.userId).sort()).toEqual(
        [authorUser.userId, voterUser.userId].sort()
      );
    }
  });

  it("retrieves unread count, lists notifications, and marks as read", async () => {
    // Check unread count for author
    const countRes = await request(testApp.http)
      .get("/api/v1/notifications/unread-count")
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(countRes.status).toBe(200);
    expect(countRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    // List notifications
    const listRes = await request(testApp.http)
      .get("/api/v1/notifications")
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(listRes.status).toBe(200);
    expect(listRes.body.notifications).toBeInstanceOf(Array);
    expect(listRes.body.notifications.length).toBeGreaterThanOrEqual(1);
    const firstNotif = listRes.body.notifications[0];
    expect(firstNotif.post).toBeDefined();
    expect(firstNotif.activity).toBeDefined();

    // Mark all read
    const markAllRes = await request(testApp.http)
      .post("/api/v1/notifications/mark-read")
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({});

    expect(markAllRes.status).toBe(201);
    expect(markAllRes.body.success).toBe(true);

    // Verify unread count is now 0
    const countAfterRes = await request(testApp.http)
      .get("/api/v1/notifications/unread-count")
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(countAfterRes.status).toBe(200);
    expect(countAfterRes.body.unreadCount).toBe(0);
  });

  it("pages notifications 20 at a time and hides ones whose post was deleted", async () => {
    const pager = await signedInCookie(testApp.test, {
      name: "Notif Pager",
      email: "pager@notif.test",
      emailVerified: true,
    });
    const created = await testApp.db
      .insert(schema.posts)
      .values(
        Array.from({ length: 21 }, (_, i) => ({
          productId: prodId,
          number: 100 + i,
          title: `Paged post ${i}`,
          statusId: inProgressStatus.id,
          authorId: authorUser.userId,
        }))
      )
      .returning({ id: schema.posts.id });
    const acts = await testApp.db
      .insert(schema.postActivity)
      .values(
        created.map((p) => ({
          postId: p.id,
          kind: "status_changed" as const,
          toStatusId: inProgressStatus.id,
          statusName: inProgressStatus.name,
          statusColor: "#000000",
        }))
      )
      .returning({ id: schema.postActivity.id, postId: schema.postActivity.postId });
    await testApp.db.insert(schema.notifications).values(
      acts.map((a) => ({
        userId: pager.userId,
        workspaceId: wsId,
        productId: prodId,
        postId: a.postId,
        postActivityId: a.id,
      }))
    );

    const get = (path: string) =>
      request(testApp.http).get(`/api/v1/notifications${path}`).set("Cookie", pager.cookie);

    const page1 = await get("");
    expect(page1.status).toBe(200);
    expect(page1.body.notifications).toHaveLength(20);
    expect(page1.body.unreadCount).toBe(21);
    expect(page1.body.nextCursor).not.toBeNull();
    const page2 = await get(`?cursor=${encodeURIComponent(page1.body.nextCursor)}`);
    expect(page2.body.notifications).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();

    await testApp.db
      .update(schema.posts)
      .set({ deletedAt: new Date() })
      .where(eq(schema.posts.id, created[0].id));

    const afterDelete = await get("");
    expect(afterDelete.body.notifications).toHaveLength(20);
    expect(afterDelete.body.nextCursor).toBeNull();
    expect(afterDelete.body.notifications.map((n: any) => n.post.id)).not.toContain(created[0].id);
    expect((await get("/unread-count")).body.unreadCount).toBe(20);
  });
});
