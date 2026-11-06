import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Workspace Feedback Inbox API (Plan 08-02)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string; name: string };
  let customer: { cookie: string; userId: string; name: string };
  let otherAdmin: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let prodAId: string;
  let prodBId: string;
  let prodASlug: string;
  let prodBSlug: string;
  let openStatusId: string;
  let completedStatusId: string;
  let categoryAId: string;
  let post1Id: string;
  let post2Id: string;
  let comment1Id: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    admin = await signedInCookie(testApp.test, {
      name: "Admin Alice",
      email: "alice@ws-feedback.test",
      emailVerified: true,
    });

    customer = await signedInCookie(testApp.test, {
      name: "Customer Bob",
      email: "bob@ws-feedback.test",
      emailVerified: true,
    });

    otherAdmin = await signedInCookie(testApp.test, {
      name: "Other Eve",
      email: "eve@ws-feedback.test",
      emailVerified: true,
    });

    wsSlug = "ws-feedback-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Feedback Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: admin.userId,
      role: "owner",
    });

    // Create Product A
    prodASlug = "product-alpha";
    const [prodA] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodASlug,
        name: "Alpha Product",
        accentColor: "#2563EB",
        nextPostNumber: 2,
      })
      .returning();
    prodAId = prodA.id;

    // Create Product B
    prodBSlug = "product-beta";
    const [prodB] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodBSlug,
        name: "Beta Product",
        accentColor: "#10B981",
        nextPostNumber: 2,
      })
      .returning();
    prodBId = prodB.id;

    // Seed statuses for Product A
    const seededA = await testApp.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: prodA.id,
          name: s.name,
          color: s.color,
          type: s.type,
          position: idx,
          isDefault: s.type === "review",
        }))
      )
      .returning();
    openStatusId = seededA.find((s) => s.type === "review")!.id;
    completedStatusId = seededA.find((s) => s.type === "completed")!.id;

    // Seed statuses for Product B
    const seededB = await testApp.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: prodB.id,
          name: s.name,
          color: s.color,
          type: s.type,
          position: idx,
          isDefault: s.type === "review",
        }))
      )
      .returning();
    const openStatusBId = seededB.find((s) => s.type === "review")!.id;

    // Create Category in Product A
    const [catA] = await testApp.db
      .insert(schema.categories)
      .values({
        productId: prodA.id,
        name: "Performance",
      })
      .returning();
    categoryAId = catA.id;

    // Create Post 1 in Product A (votes: 5, category: catA)
    const [p1] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodA.id,
        number: 1,
        title: "Speed up dashboard load time",
        description: "Dashboard feels sluggish on mobile networks",
        statusId: openStatusId,
        categoryId: categoryAId,
        authorId: customer.userId,
        voteCount: 5,
      })
      .returning();
    post1Id = p1.id;

    // Create Post 2 in Product B (votes: 2)
    const [p2] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodB.id,
        number: 1,
        title: "Add export to CSV",
        description: "Need to export tables to Excel or CSV",
        statusId: openStatusBId,
        authorId: customer.userId,
        voteCount: 2,
      })
      .returning();
    post2Id = p2.id;

    // Create Customer Comment on Post 1 (needs attention)
    const [c1] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: post1Id,
        authorId: customer.userId,
        isAdmin: false,
        body: "Any updates on this performance issue?",
      })
      .returning();
    comment1Id = c1.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe("GET /api/v1/workspaces/:ws/requests", () => {
    it("returns cross-product requests across both Alpha and Beta products", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/requests`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(res.body.totalCount).toBe(2);
      expect(res.body.items).toHaveLength(2);
      // Sorted by top by default: Post 1 (5 votes) then Post 2 (2 votes)
      expect(res.body.items[0].title).toBe("Speed up dashboard load time");
      expect(res.body.items[0].product.slug).toBe(prodASlug);
      expect(res.body.items[0].category.name).toBe("Performance");
      expect(res.body.items[0].commentCount).toBe(1);

      expect(res.body.items[1].title).toBe("Add export to CSV");
      expect(res.body.items[1].product.slug).toBe(prodBSlug);
    });

    it("filters requests by product", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/requests?product=${prodASlug}`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(res.body.totalCount).toBe(1);
      expect(res.body.items[0].product.slug).toBe(prodASlug);
    });

    it("filters requests by category", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/requests?categoryId=${categoryAId}`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(res.body.totalCount).toBe(1);
      expect(res.body.items[0].category.id).toBe(categoryAId);
    });

    it("searches requests across products", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/requests?search=export`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(res.body.totalCount).toBe(1);
      expect(res.body.items[0].title).toBe("Add export to CSV");
    });

    it("enforces tenant isolation (non-members receive 404)", async () => {
      await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/requests`)
        .set("Cookie", otherAdmin.cookie)
        .expect(404);
    });
  });

  describe("GET /api/v1/workspaces/:ws/comments", () => {
    it("returns cross-product comments and counts needs_attention items", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/comments?attention=needs_attention`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(res.body.needsAttentionCount).toBe(1);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(comment1Id);
      expect(res.body.items[0].body).toBe("Any updates on this performance issue?");
      expect(res.body.items[0].post.title).toBe("Speed up dashboard load time");
      expect(res.body.items[0].product.name).toBe("Alpha Product");
      expect(res.body.items[0].handledAt).toBeNull();
      expect(res.body.items[0].isUnread).toBe(true);
    });
  });

  describe("Comment Attention Management & Reply", () => {
    it("marks a comment as handled and decrements needsAttentionCount", async () => {
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/comments/${comment1Id}/handled`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .expect(204);

      const check = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/comments?attention=needs_attention`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(check.body.needsAttentionCount).toBe(0);
      expect(check.body.items).toHaveLength(0);

      const handledCheck = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/comments?attention=handled`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(handledCheck.body.items).toHaveLength(1);
      expect(handledCheck.body.items[0].handledAt).not.toBeNull();
      expect(handledCheck.body.items[0].handledBy?.name).toBe("Admin Alice");
    });

    it("reopens a handled comment back to needs_attention", async () => {
      await request(testApp.http)
        .delete(`/api/v1/workspaces/${wsSlug}/comments/${comment1Id}/handled`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .expect(204);

      const check = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/comments?attention=needs_attention`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(check.body.needsAttentionCount).toBe(1);
      expect(check.body.items).toHaveLength(1);
    });

    it("admin reply to comment automatically marks parent comment handled", async () => {
      const replyRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/comments/${comment1Id}/reply`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ body: "We are profiling it right now, fix coming soon!" })
        .expect(201);

      expect(replyRes.body.body).toBe("We are profiling it right now, fix coming soon!");
      expect(replyRes.body.isAdmin).toBe(true);

      // Verify parent comment is now handled
      const check = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/comments?attention=needs_attention`)
        .set("Cookie", admin.cookie)
        .expect(200);

      expect(check.body.needsAttentionCount).toBe(0);
    });

    it("marks comment read for current admin without changing team handled state", async () => {
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/comments/${comment1Id}/read`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .expect(204);

      const check = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/comments?attention=all`)
        .set("Cookie", admin.cookie)
        .expect(200);

      const found = check.body.items.find((c: any) => c.id === comment1Id);
      expect(found.isUnread).toBe(false);
    });
  });
});

describe("Inbox reply shares the portal comment path (quick-261107-1a5)", () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  let adminA: { cookie: string; userId: string };
  let adminB: { cookie: string; userId: string };
  let custC: { cookie: string; userId: string };
  let custD: { cookie: string; userId: string };
  let wsId: string;
  const wsSlug = "ws-inbox-reply";
  let p1: { id: string; slug: string };
  let p2: { id: string; slug: string };
  let statusP1: string;
  let statusP2: string;
  let nextNumber = 1;

  const mkPost = async (
    product: { id: string },
    statusId: string,
    extra: Partial<typeof schema.posts.$inferInsert> = {}
  ) => {
    const number = nextNumber++;
    const [row] = await t.db
      .insert(schema.posts)
      .values({
        productId: product.id,
        number,
        title: `Inbox reply post ${number}`,
        statusId,
        authorId: custC.userId,
        ...extra,
      })
      .returning();
    return row;
  };
  const mkComment = async (
    postId: string,
    authorId: string,
    extra: Partial<typeof schema.comments.$inferInsert> = {}
  ) => {
    const [row] = await t.db
      .insert(schema.comments)
      .values({ postId, authorId, isAdmin: false, body: "seed", ...extra })
      .returning();
    return row;
  };
  const getComment = async (id: string) => {
    const [row] = await t.db.select().from(schema.comments).where(eq(schema.comments.id, id));
    return row;
  };
  const inboxReply = (cookie: string, commentId: string, body = "Reply from the inbox") =>
    request(t.http)
      .post(`/api/v1/workspaces/${wsSlug}/comments/${commentId}/reply`)
      .set("Cookie", cookie)
      .set("Origin", t.env.PUBLIC_URL)
      .send({ body });
  const emailRecipients = async (commentId: string) => {
    const rows = await t.db
      .select({ userId: schema.commentEmailBatches.userId })
      .from(schema.commentEmailItems)
      .innerJoin(
        schema.commentEmailBatches,
        eq(schema.commentEmailItems.batchId, schema.commentEmailBatches.id)
      )
      .where(eq(schema.commentEmailItems.commentId, commentId));
    return rows.map((r) => r.userId).sort();
  };

  beforeAll(async () => {
    t = await createTestApp();
    adminA = await signedInCookie(t.test, { name: "Admin Ann", email: "ann@inbox-reply.test", emailVerified: true });
    adminB = await signedInCookie(t.test, { name: "Admin Ben", email: "ben@inbox-reply.test", emailVerified: true });
    custC = await signedInCookie(t.test, { name: "Customer Cy", email: "cy@inbox-reply.test", emailVerified: true });
    custD = await signedInCookie(t.test, { name: "Customer Di", email: "di@inbox-reply.test", emailVerified: true });

    const [ws] = await t.db.insert(schema.workspaces).values({ slug: wsSlug, name: "Inbox Reply WS" }).returning();
    wsId = ws.id;
    await t.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: adminA.userId, role: "owner" },
      { workspaceId: ws.id, userId: adminB.userId, role: "admin" },
    ]);

    const mkProduct = async (slug: string, boardEnabled: boolean) => {
      const [prod] = await t.db
        .insert(schema.products)
        .values({ workspaceId: ws.id, slug, name: slug, accentColor: "#2563EB", boardEnabled })
        .returning();
      const seeded = await t.db
        .insert(schema.statuses)
        .values(
          SEEDED_STATUSES.map((s, idx) => ({
            productId: prod.id,
            name: s.name,
            color: s.color,
            type: s.type,
            position: idx,
            isDefault: s.type === "review",
          }))
        )
        .returning();
      return { prod, status: seeded.find((s) => s.type === "review")!.id };
    };
    const a = await mkProduct("inbox-board-on", true);
    const b = await mkProduct("inbox-board-off", false);
    p1 = { id: a.prod.id, slug: a.prod.slug };
    p2 = { id: b.prod.id, slug: b.prod.slug };
    statusP1 = a.status;
    statusP2 = b.status;
  });

  afterAll(async () => {
    await t?.close();
  });

  it("folds a reply to a customer reply onto the thread root and shows it in both timelines", async () => {
    const post = await mkPost(p1, statusP1);
    const root = await mkComment(post.id, custC.userId);
    const customerReply = await mkComment(post.id, custD.userId, { parentId: root.id });

    const res = await inboxReply(adminA.cookie, customerReply.id, "Folded inbox reply");
    expect(res.status).toBe(201);
    expect(res.body.isAdmin).toBe(true);

    const stored = await getComment(res.body.id);
    expect(stored.parentId).toBe(root.id);

    const adminDetail = await request(t.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${p1.slug}/posts/${post.number}`)
      .set("Cookie", adminA.cookie)
      .expect(200);
    const adminItem = adminDetail.body.timeline.find((i: any) => i.kind === "comment" && i.comment.id === root.id);
    expect(adminItem.replies.map((r: any) => r.id)).toContain(res.body.id);

    const publicDetail = await request(t.http)
      .get(`/api/v1/portal/${wsSlug}/${p1.slug}/posts/${post.number}`)
      .set("Cookie", custC.cookie)
      .expect(200);
    const publicItem = publicDetail.body.timeline.find((i: any) => i.kind === "comment" && i.comment.id === root.id);
    expect(publicItem.replies.map((r: any) => r.id)).toContain(res.body.id);
  });

  it("queues comment email for the post author and commenters, like a portal reply", async () => {
    const post = await mkPost(p1, statusP1);
    const root = await mkComment(post.id, custD.userId);

    const res = await inboxReply(adminA.cookie, root.id);
    expect(res.status).toBe(201);

    const recipients = await emailRecipients(res.body.id);
    expect(recipients).toEqual([custC.userId, custD.userId].sort());
    expect(recipients).not.toContain(adminA.userId);
  });

  it("replies on a Board-disabled product succeed and queue no email (D-09, D-10)", async () => {
    const post = await mkPost(p2, statusP2);
    const root = await mkComment(post.id, custD.userId);

    const res = await inboxReply(adminA.cookie, root.id);
    expect(res.status).toBe(201);
    expect(await emailRecipients(res.body.id)).toEqual([]);
    expect((await getComment(res.body.id)).parentId).toBe(root.id);
  });

  it("rejects a reply under a merged post with 404 post_not_found and inserts nothing", async () => {
    const target = await mkPost(p1, statusP1);
    const merged = await mkPost(p1, statusP1, { mergedIntoId: target.id });
    const root = await mkComment(merged.id, custD.userId);
    const before = await t.db.select({ id: schema.comments.id }).from(schema.comments).where(eq(schema.comments.postId, merged.id));

    const res = await inboxReply(adminA.cookie, root.id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("post_not_found");

    const after = await t.db.select({ id: schema.comments.id }).from(schema.comments).where(eq(schema.comments.postId, merged.id));
    expect(after.length).toBe(before.length);
  });

  it("emits exactly one comment.created webhook delivery with the folded parentId", async () => {
    await t.db.insert(schema.webhookSubscriptions).values({
      workspaceId: wsId,
      url: "https://example.com/hook",
      secret: "whsec_test",
      events: ["comment.created"],
    });
    const post = await mkPost(p1, statusP1);
    const root = await mkComment(post.id, custC.userId);
    const customerReply = await mkComment(post.id, custD.userId, { parentId: root.id });

    const res = await inboxReply(adminA.cookie, customerReply.id);
    expect(res.status).toBe(201);

    const deliveries = await t.db
      .select({ payload: schema.webhookDeliveries.payload })
      .from(schema.webhookDeliveries)
      .where(
        and(
          eq(schema.webhookDeliveries.eventType, "comment.created"),
          sql`${schema.webhookDeliveries.payload}->'data'->>'id' = ${res.body.id}`
        )
      );
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].payload.data.parentId).toBe(root.id);
  });

  it("still stamps createdByApiKeyId and the integration actor for API key inbox replies", async () => {
    const key = await request(t.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", adminA.cookie)
      .set("Origin", t.env.PUBLIC_URL)
      .send({ name: "Inbox bot", scopes: ["comments:write"] })
      .expect(201);
    const post = await mkPost(p1, statusP1);
    const root = await mkComment(post.id, custD.userId);

    const res = await request(t.http)
      .post(`/api/v1/workspaces/${wsSlug}/comments/${root.id}/reply`)
      .set("Authorization", `Bearer ${key.body.token}`)
      .send({ body: "Bot reply" });
    expect(res.status).toBe(201);

    const stored = await getComment(res.body.id);
    expect(stored.createdByApiKeyId).toBe(key.body.key.id);
    expect(stored.authorId.startsWith("integration:")).toBe(true);
    expect(stored.isAdmin).toBe(true);
    // the customer root is resolved by the integration actor too
    expect((await getComment(root.id)).handledAt).not.toBeNull();
  });

  describe("any admin reply resolves the customer thread with attribution", () => {
    const portalComment = (cookie: string, productSlug: string, number: number, body: Record<string, unknown>) =>
      request(t.http)
        .post(`/api/v1/portal/${wsSlug}/${productSlug}/posts/${number}/comments`)
        .set("Cookie", cookie)
        .set("Origin", t.env.PUBLIC_URL)
        .send(body);
    const handledSnapshot = async (ids: string[]) => {
      const rows = await t.db.select().from(schema.comments).where(inArray(schema.comments.id, ids));
      return Object.fromEntries(
        rows.map((r) => [r.id, { at: r.handledAt?.toISOString() ?? null, by: r.handledById }])
      );
    };

    it("portal admin reply to a customer reply handles the target and thread-mates only", async () => {
      const post = await mkPost(p1, statusP1);
      const root = await mkComment(post.id, custC.userId);
      const mate = await mkComment(post.id, custD.userId, { parentId: root.id });
      const target = await mkComment(post.id, custC.userId, { parentId: root.id });
      const previouslyHandledAt = new Date("2026-01-02T03:04:05.000Z");
      const alreadyHandled = await mkComment(post.id, custD.userId, {
        parentId: root.id,
        handledAt: previouslyHandledAt,
        handledById: adminB.userId,
      });
      const deletedMate = await mkComment(post.id, custD.userId, { parentId: root.id, deletedAt: new Date() });
      const otherThread = await mkComment(post.id, custD.userId);
      const adminRoot = await mkComment(post.id, adminB.userId, { isAdmin: true });

      const res = await portalComment(adminA.cookie, p1.slug, post.number, {
        body: "Admin portal reply",
        parentId: target.id,
      });
      expect(res.status).toBe(201);

      const snap = await handledSnapshot([root.id, mate.id, target.id, alreadyHandled.id, deletedMate.id, otherThread.id, adminRoot.id]);
      expect(snap[root.id].by).toBe(adminA.userId);
      expect(snap[mate.id].by).toBe(adminA.userId);
      expect(snap[target.id].by).toBe(adminA.userId);
      expect(snap[root.id].at).not.toBeNull();
      expect(snap[alreadyHandled.id]).toEqual({ at: previouslyHandledAt.toISOString(), by: adminB.userId });
      expect(snap[deletedMate.id]).toEqual({ at: null, by: null });
      expect(snap[otherThread.id]).toEqual({ at: null, by: null });
      expect(snap[adminRoot.id]).toEqual({ at: null, by: null });
    });

    it("resolves a thread whose root is an admin comment without touching the root", async () => {
      const post = await mkPost(p1, statusP1);
      const adminRoot = await mkComment(post.id, adminB.userId, { isAdmin: true });
      const c1 = await mkComment(post.id, custC.userId, { parentId: adminRoot.id });
      const c2 = await mkComment(post.id, custD.userId, { parentId: adminRoot.id });

      const res = await inboxReply(adminA.cookie, c1.id);
      expect(res.status).toBe(201);

      const snap = await handledSnapshot([adminRoot.id, c1.id, c2.id]);
      expect(snap[adminRoot.id]).toEqual({ at: null, by: null });
      expect(snap[c1.id].by).toBe(adminA.userId);
      expect(snap[c2.id].by).toBe(adminA.userId);
    });

    it("a top-level admin comment changes no handled state", async () => {
      const post = await mkPost(p1, statusP1);
      const c1 = await mkComment(post.id, custC.userId);
      const c2 = await mkComment(post.id, custD.userId, { parentId: c1.id });

      const res = await portalComment(adminA.cookie, p1.slug, post.number, { body: "General note" });
      expect(res.status).toBe(201);

      const snap = await handledSnapshot([c1.id, c2.id]);
      expect(snap[c1.id]).toEqual({ at: null, by: null });
      expect(snap[c2.id]).toEqual({ at: null, by: null });
    });

    it("a customer reply never changes anyone's handled state", async () => {
      const post = await mkPost(p1, statusP1);
      const c1 = await mkComment(post.id, custC.userId);
      const handledAt = new Date("2026-02-03T04:05:06.000Z");
      const c2 = await mkComment(post.id, custC.userId, { parentId: c1.id, handledAt, handledById: adminB.userId });

      const res = await portalComment(custD.cookie, p1.slug, post.number, { body: "Me too", parentId: c1.id });
      expect(res.status).toBe(201);

      const snap = await handledSnapshot([c1.id, c2.id]);
      expect(snap[c1.id]).toEqual({ at: null, by: null });
      expect(snap[c2.id]).toEqual({ at: handledAt.toISOString(), by: adminB.userId });
    });
  });
});
