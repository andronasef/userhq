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
      expect(res.body.items[0].author.name).toBe("Customer Bob");
      expect(res.body.items[0].author.email).toBe("bob@ws-feedback.test");
      expect(res.body.items[0].author).toHaveProperty("location");

      expect(res.body.items[1].title).toBe("Add export to CSV");
      expect(res.body.items[1].product.slug).toBe(prodBSlug);
      expect(res.body.items[1].author.email).toBe("bob@ws-feedback.test");
      expect(res.body.items[1].author).toHaveProperty("location");
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
      expect(res.body.items[0].author.name).toBe("Customer Bob");
      expect(res.body.items[0].author.email).toBe("bob@ws-feedback.test");
      expect(res.body.items[0].author).toHaveProperty("location");
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

describe("Inbox shared handled state (quick-261107-1a5)", () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  let adminA: { cookie: string; userId: string };
  let adminB: { cookie: string; userId: string };
  let adminGone: { cookie: string; userId: string };
  let cust: { cookie: string; userId: string };
  const wsSlug = "ws-inbox-handled";
  let prod: { id: string; slug: string };
  let statusId: string;
  let nextNumber = 1;

  const mkPost = async () => {
    const number = nextNumber++;
    const [row] = await t.db
      .insert(schema.posts)
      .values({ productId: prod.id, number, title: `Handled post ${number}`, statusId, authorId: cust.userId })
      .returning();
    return row;
  };
  const mkComment = async (postId: string, extra: Partial<typeof schema.comments.$inferInsert> = {}) => {
    const [row] = await t.db
      .insert(schema.comments)
      .values({ postId, authorId: cust.userId, isAdmin: false, body: "needs a look", ...extra })
      .returning();
    return row;
  };
  const row = async (id: string) =>
    (await t.db.select().from(schema.comments).where(eq(schema.comments.id, id)))[0];
  const list = (cookie: string, attention: string) =>
    request(t.http)
      .get(`/api/v1/workspaces/${wsSlug}/comments?attention=${attention}&limit=50`)
      .set("Cookie", cookie)
      .expect(200);
  const post = (cookie: string, path: string, body?: unknown) =>
    request(t.http).post(`/api/v1/workspaces/${wsSlug}${path}`).set("Cookie", cookie).set("Origin", t.env.PUBLIC_URL).send(body as any);

  beforeAll(async () => {
    t = await createTestApp();
    adminA = await signedInCookie(t.test, { name: "Admin Ann", email: "ann@inbox-handled.test", emailVerified: true });
    adminB = await signedInCookie(t.test, { name: "Admin Ben", email: "ben@inbox-handled.test", emailVerified: true });
    adminGone = await signedInCookie(t.test, { name: "Admin Gone", email: "gone@inbox-handled.test", emailVerified: true });
    cust = await signedInCookie(t.test, { name: "Customer Cy", email: "cy@inbox-handled.test", emailVerified: true });
    const [ws] = await t.db.insert(schema.workspaces).values({ slug: wsSlug, name: "Handled WS" }).returning();
    await t.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: adminA.userId, role: "owner" },
      { workspaceId: ws.id, userId: adminB.userId, role: "admin" },
      { workspaceId: ws.id, userId: adminGone.userId, role: "admin" },
    ]);
    const [p] = await t.db
      .insert(schema.products)
      .values({ workspaceId: ws.id, slug: "handled-prod", name: "Handled", accentColor: "#2563EB" })
      .returning();
    prod = { id: p.id, slug: p.slug };
    const seeded = await t.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: p.id,
          name: s.name,
          color: s.color,
          type: s.type,
          position: idx,
          isDefault: s.type === "review",
        }))
      )
      .returning();
    statusId = seeded.find((x) => x.type === "review")!.id;
  });

  afterAll(async () => {
    await t?.close();
  });

  it("a second admin marking an already-handled comment keeps the first handler and time", async () => {
    const post1 = await mkPost();
    const c = await mkComment(post1.id);
    await post(adminA.cookie, `/comments/${c.id}/handled`).expect(204);
    const first = await row(c.id);
    expect(first.handledById).toBe(adminA.userId);

    await post(adminB.cookie, `/comments/${c.id}/handled`).expect(204);
    const second = await row(c.id);
    expect(second.handledById).toBe(adminA.userId);
    expect(second.handledAt?.toISOString()).toBe(first.handledAt?.toISOString());

    const seenByB = await list(adminB.cookie, "handled");
    const item = seenByB.body.items.find((i: any) => i.id === c.id);
    expect(item.handledBy.name).toBe("Admin Ann");
  });

  it("keeps unread state personal in both directions while handled state is shared", async () => {
    const post1 = await mkPost();
    const c = await mkComment(post1.id);
    const unreadFor = async (cookie: string) =>
      (await list(cookie, "all")).body.items.find((i: any) => i.id === c.id).isUnread;

    expect(await unreadFor(adminA.cookie)).toBe(true);
    expect(await unreadFor(adminB.cookie)).toBe(true);
    await post(adminA.cookie, `/comments/${c.id}/read`).expect(204);
    expect(await unreadFor(adminA.cookie)).toBe(false);
    expect(await unreadFor(adminB.cookie)).toBe(true);
    await post(adminB.cookie, `/comments/${c.id}/read`).expect(204);
    await t.db.delete(schema.commentReads).where(eq(schema.commentReads.userId, adminA.userId));
    expect(await unreadFor(adminA.cookie)).toBe(true);
    expect(await unreadFor(adminB.cookie)).toBe(false);

    await post(adminA.cookie, `/comments/${c.id}/handled`).expect(204);
    const handledForB = (await list(adminB.cookie, "handled")).body.items.find((i: any) => i.id === c.id);
    expect(handledForB.handledAt).not.toBeNull();
    expect(handledForB.isUnread).toBe(false);
  });

  it("does not name a deleted handler", async () => {
    const post1 = await mkPost();
    const c = await mkComment(post1.id);
    await post(adminGone.cookie, `/comments/${c.id}/handled`).expect(204);
    await t.db.update(schema.user).set({ deletedAt: new Date() }).where(eq(schema.user.id, adminGone.userId));

    const item = (await list(adminA.cookie, "handled")).body.items.find((i: any) => i.id === c.id);
    expect(item.handledBy).toEqual({ name: null, image: null, isAdmin: false, deleted: true, email: null, location: null });
  });

  it("story 16: a new customer reply in a handled thread is itself Needs attention", async () => {
    const post1 = await mkPost();
    const root = await mkComment(post1.id);
    const before = (await list(adminA.cookie, "needs_attention")).body.needsAttentionCount;

    const reply = await post(adminA.cookie, `/comments/${root.id}/reply`, { body: "On it" }).expect(201);
    expect(reply.body.isAdmin).toBe(true);
    expect((await list(adminA.cookie, "needs_attention")).body.needsAttentionCount).toBe(before - 1);

    const follow = await request(t.http)
      .post(`/api/v1/portal/${wsSlug}/${prod.slug}/posts/${post1.number}/comments`)
      .set("Cookie", cust.cookie)
      .set("Origin", t.env.PUBLIC_URL)
      .send({ body: "Thanks, one more thing", parentId: root.id })
      .expect(201);

    const needs = await list(adminA.cookie, "needs_attention");
    expect(needs.body.needsAttentionCount).toBe(before);
    expect(needs.body.items.map((i: any) => i.id)).toContain(follow.body.id);
    expect((await row(root.id)).handledAt).not.toBeNull();
  });

  it("rejects a whitespace-only inbox reply with 400", async () => {
    const post1 = await mkPost();
    const c = await mkComment(post1.id);
    const res = await post(adminA.cookie, `/comments/${c.id}/reply`, { body: "   \n  " });
    expect(res.status).toBe(400);
    expect((await row(c.id)).handledAt).toBeNull();
  });
});

describe("Inbox keyset paging, cursor validation and date filters (quick-261107-1a5)", () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string };
  let cust: { cookie: string; userId: string };
  const wsSlug = "ws-inbox-paging";
  let pagingStatusId: string;
  let pagingProdId: string;
  const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const get = (path: string) => request(t.http).get(`/api/v1/workspaces/${wsSlug}${path}`).set("Cookie", admin.cookie);

  const setPostTs = (id: string, ts: string) =>
    t.db.execute(sql`UPDATE posts SET created_at = ${ts}::timestamptz WHERE id = ${id}`);
  const setCommentTs = (id: string, ts: string) =>
    t.db.execute(sql`UPDATE comments SET created_at = ${ts}::timestamptz WHERE id = ${id}`);

  const pageThrough = async (base: string, limit: number) => {
    const ids: string[] = [];
    const counts: number[] = [];
    let cursor: string | null = null;
    let last: any = null;
    for (let guard = 0; guard < 20; guard++) {
      const res: any = await get(`${base}${base.includes("?") ? "&" : "?"}limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`).expect(200);
      ids.push(...res.body.items.map((i: any) => i.id));
      counts.push(res.body.totalCount ?? res.body.needsAttentionCount);
      last = res.body;
      cursor = res.body.nextCursor;
      if (!cursor) break;
    }
    return { ids, counts, last };
  };
  const mutateCursor = (cursor: string, fn: (p: any) => void) => {
    const p = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    fn(p);
    return Buffer.from(JSON.stringify(p)).toString("base64url");
  };

  beforeAll(async () => {
    t = await createTestApp();
    admin = await signedInCookie(t.test, { name: "Admin Ann", email: "ann@inbox-paging.test", emailVerified: true });
    cust = await signedInCookie(t.test, { name: "Customer Cy", email: "cy@inbox-paging.test", emailVerified: true });
    const [ws] = await t.db.insert(schema.workspaces).values({ slug: wsSlug, name: "Paging WS" }).returning();
    await t.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: admin.userId, role: "owner" });

    const mkProduct = async (slug: string) => {
      const [p] = await t.db
        .insert(schema.products)
        .values({ workspaceId: ws.id, slug, name: slug, accentColor: "#2563EB" })
        .returning();
      const seeded = await t.db
        .insert(schema.statuses)
        .values(
          SEEDED_STATUSES.map((s, idx) => ({
            productId: p.id,
            name: s.name,
            color: s.color,
            type: s.type,
            position: idx,
            isDefault: s.type === "review",
          }))
        )
        .returning();
      return { id: p.id, status: seeded.find((x) => x.type === "review")!.id };
    };
    const paging = await mkProduct("paging");
    const dates = await mkProduct("dates");
    pagingProdId = paging.id;
    pagingStatusId = paging.status;

    // posts: [number, votes, created_at]; ties on id order, on exact time, on same-ms-different-micro, on votes
    const fixtures: Array<[number, number, string]> = [
      [1, 3, "2026-03-01T10:00:00.123900Z"],
      [2, 3, "2026-03-01T10:00:00.123100Z"],
      [3, 3, "2026-03-01T10:00:00.123100Z"],
      [4, 5, "2026-03-01T09:00:00Z"],
      [5, 0, "2026-03-01T11:00:00Z"],
      [6, 3, "2026-03-01T10:00:00.123900Z"],
      [7, 5, "2026-03-01T09:00:00Z"],
    ];
    for (const [n, votes, ts] of fixtures) {
      await t.db.insert(schema.posts).values({
        id: uid(n),
        productId: paging.id,
        number: n,
        title: `Paging post ${n}`,
        statusId: paging.status,
        authorId: cust.userId,
        voteCount: votes,
      });
      await setPostTs(uid(n), ts);
    }
    // activity: same millisecond, different microsecond; a newer deleted comment must be ignored
    const mkC = async (n: number, postN: number, ts: string, extra: Partial<typeof schema.comments.$inferInsert> = {}) => {
      await t.db.insert(schema.comments).values({
        id: uid(100 + n),
        postId: uid(postN),
        authorId: cust.userId,
        isAdmin: false,
        body: `c${n}`,
        ...extra,
      });
      await setCommentTs(uid(100 + n), ts);
    };
    await mkC(1, 4, "2026-03-02T00:00:00.000500Z");
    await mkC(2, 2, "2026-03-02T00:00:00.000900Z");
    await mkC(3, 5, "2026-03-09T00:00:00Z", { deletedAt: new Date() });
    // comments feed ordering fixtures on post 1 (ties: exact time, same ms differing micro)
    await mkC(4, 1, "2026-03-05T10:00:00.000900Z");
    await mkC(5, 1, "2026-03-05T10:00:00.000100Z");
    await mkC(6, 1, "2026-03-05T10:00:00.000100Z");
    await mkC(7, 1, "2026-03-04T10:00:00Z", { isAdmin: true });

    // dates product
    const dateFixtures: Array<[number, string]> = [
      [1, "2026-04-01T10:00:00Z"],
      [2, "2026-04-02T23:59:59.999999Z"],
      [3, "2026-04-03T00:00:00Z"],
      [4, "2026-04-05T12:00:00Z"],
    ];
    for (const [n, ts] of dateFixtures) {
      await t.db.insert(schema.posts).values({
        id: uid(200 + n),
        productId: dates.id,
        number: n,
        title: `Dated post ${n}`,
        statusId: dates.status,
        authorId: cust.userId,
      });
      await setPostTs(uid(200 + n), ts);
    }
  });

  afterAll(async () => {
    await t?.close();
  });

  const expectedOrder: Record<string, number[]> = {
    new: [5, 6, 1, 3, 2, 7, 4],
    top: [7, 4, 6, 1, 3, 2, 5],
    activity: [1, 2, 4, 5, 6, 3, 7],
  };
  for (const sort of ["new", "top", "activity"] as const) {
    for (const limit of [1, 2, 3]) {
      it(`pages requests sorted by ${sort} with limit ${limit} without skipping or repeating rows`, async () => {
        const { ids, counts, last } = await pageThrough(`/requests?product=paging&sort=${sort}`, limit);
        expect(ids).toEqual(expectedOrder[sort].map(uid));
        expect(new Set(counts)).toEqual(new Set([7]));
        expect(last.nextCursor).toBeNull();
      });
    }
  }

  it("does not repeat a row when a newer request arrives between pages", async () => {
    const page1 = await get("/requests?product=paging&sort=new&limit=3").expect(200);
    expect(page1.body.items.map((i: any) => i.id)).toEqual([5, 6, 1].map(uid));
    await t.db.insert(schema.posts).values({
      id: uid(99),
      productId: pagingProdId,
      number: 99,
      title: "Late arrival",
      statusId: pagingStatusId,
      authorId: cust.userId,
    });
    try {
      const page2 = await get(
        `/requests?product=paging&sort=new&limit=3&cursor=${encodeURIComponent(page1.body.nextCursor)}`
      ).expect(200);
      expect(page2.body.items.map((i: any) => i.id)).toEqual([3, 2, 7].map(uid));
      expect(page2.body.totalCount).toBe(8);
    } finally {
      await t.db.delete(schema.posts).where(eq(schema.posts.id, uid(99)));
    }
  });

  it("does not repeat a comment when a newer one arrives between comment pages", async () => {
    const page1 = await get("/comments?product=paging&attention=all&limit=2").expect(200);
    expect(page1.body.items.map((i: any) => i.id)).toEqual([104, 106].map(uid));
    await t.db.insert(schema.comments).values({
      id: uid(190),
      postId: uid(1),
      authorId: cust.userId,
      isAdmin: false,
      body: "late",
    });
    try {
      const page2 = await get(
        `/comments?product=paging&attention=all&limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`
      ).expect(200);
      expect(page2.body.items.map((i: any) => i.id)).toEqual([105, 107].map(uid));
    } finally {
      await t.db.delete(schema.comments).where(eq(schema.comments.id, uid(190)));
    }
  });

  it("pages the comments feed by cursor over same-millisecond and tied rows", async () => {
    const expected = [104, 106, 105, 107, 102, 101].map(uid);
    for (const limit of [1, 2, 4]) {
      const { ids, counts, last } = await pageThrough("/comments?product=paging&attention=all", limit);
      expect(ids).toEqual(expected);
      expect(new Set(counts).size).toBe(1);
      expect(last.nextCursor).toBeNull();
    }
  });

  describe("cursor tampering returns 400 validation_failed", () => {
    const expectInvalid = async (path: string) => {
      const res = await get(path);
      expect(res.status, path).toBe(400);
      expect(res.body.code, path).toBe("validation_failed");
    };
    const firstCursor = async (path: string) => {
      const res = await get(`${path}${path.includes("?") ? "&" : "?"}limit=1`).expect(200);
      expect(res.body.nextCursor).toBeTruthy();
      return res.body.nextCursor as string;
    };
    const enc = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

    for (const sort of ["new", "top", "activity"] as const) {
      it(`rejects malformed requests/${sort} cursors`, async () => {
        const base = `/requests?product=paging&sort=${sort}`;
        const good = await firstCursor(base);
        const q = (c: string) => `${base}&cursor=${encodeURIComponent(c)}`;
        await expectInvalid(q("not base64 !!"));
        await expectInvalid(q(enc("not json at all")));
        await expectInvalid(q(enc({ o: 20 })));
        await expectInvalid(q(mutateCursor(good, (p) => (p.i = "not-a-uuid"))));
        await expectInvalid(q(mutateCursor(good, (p) => (p.t = "2026-02-30 10:00:00+00"))));
        await expectInvalid(q(mutateCursor(good, (p) => (p.t = "1969-12-31 23:59:59+00"))));
        await expectInvalid(q(mutateCursor(good, (p) => (p.t = "3000-01-01 00:00:00+00"))));
        await expectInvalid(q(mutateCursor(good, (p) => (p.t = "'; drop table posts; --"))));
        await expectInvalid(q(mutateCursor(good, (p) => (p.k = "comments"))));
        await expectInvalid(q("A".repeat(5000)));
      });
    }

    it("rejects cursors minted for a different sort or for the other feed", async () => {
      const newCursor = await firstCursor("/requests?product=paging&sort=new");
      const topCursor = await firstCursor("/requests?product=paging&sort=top");
      const commentsCursor = await firstCursor("/comments?product=paging&attention=all");
      await expectInvalid(`/requests?product=paging&sort=top&cursor=${encodeURIComponent(newCursor)}`);
      await expectInvalid(`/requests?product=paging&sort=activity&cursor=${encodeURIComponent(topCursor)}`);
      await expectInvalid(`/requests?product=paging&sort=new&cursor=${encodeURIComponent(commentsCursor)}`);
      await expectInvalid(`/comments?product=paging&attention=all&cursor=${encodeURIComponent(newCursor)}`);
    });

    it("rejects negative, oversized and missing vote counts on top cursors", async () => {
      const good = await firstCursor("/requests?product=paging&sort=top");
      const q = (c: string) => `/requests?product=paging&sort=top&cursor=${encodeURIComponent(c)}`;
      await expectInvalid(q(mutateCursor(good, (p) => (p.v = -1))));
      await expectInvalid(q(mutateCursor(good, (p) => (p.v = 2147483648))));
      await expectInvalid(q(mutateCursor(good, (p) => (p.v = 1.5))));
      await expectInvalid(q(mutateCursor(good, (p) => delete p.v)));
    });

    it("rejects malformed comments cursors", async () => {
      const good = await firstCursor("/comments?product=paging&attention=all");
      const q = (c: string) => `/comments?product=paging&attention=all&cursor=${encodeURIComponent(c)}`;
      await expectInvalid(q(enc({ o: 1 })));
      await expectInvalid(q(mutateCursor(good, (p) => (p.i = "123"))));
      await expectInvalid(q(mutateCursor(good, (p) => (p.t = "2026-13-01 00:00:00+00"))));
    });
  });

  describe("created date filters", () => {
    const total = async (qs: string) => {
      const res = await get(`/requests?product=dates&${qs}`).expect(200);
      return { count: res.body.totalCount, ids: res.body.items.map((i: any) => i.id).sort() };
    };
    it("filters from-only, to-only inclusive of the end day, and ranges", async () => {
      expect((await total("createdFrom=2026-04-02")).ids).toEqual([uid(202), uid(203), uid(204)].sort());
      expect((await total("createdTo=2026-04-02")).ids).toEqual([uid(201), uid(202)].sort());
      const range = await total("createdFrom=2026-04-02&createdTo=2026-04-03");
      expect(range.ids).toEqual([uid(202), uid(203)].sort());
      expect(range.count).toBe(2);
      expect((await total("")).count).toBe(4);
    });
    it("rejects reversed ranges and malformed dates", async () => {
      for (const qs of [
        "createdFrom=2026-04-03&createdTo=2026-04-02",
        "createdFrom=2026-4-2",
        "createdTo=2026-02-30",
        "createdFrom=yesterday",
      ]) {
        const res = await get(`/requests?product=dates&${qs}`);
        expect(res.status, qs).toBe(400);
      }
    });
  });
});
