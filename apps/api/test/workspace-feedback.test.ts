import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
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
