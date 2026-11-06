import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Bulk Feedback Export & Automation API (Plan 09-03)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let otherWsSlug: string;
  let otherWsId: string;
  let prodASlug: string;
  let prodAId: string;
  let prodBSlug: string;
  let prodBId: string;
  let categoryId: string;
  let defaultStatusId: string;

  let exportApiKey: string;
  let writeApiKey: string;
  let writeApiKeyId: string;
  let adminApiKey: string;
  let noExportApiKey: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    admin = await signedInCookie(testApp.test, {
      name: "Admin Alice",
      email: `alice-export-${Date.now()}@userhq.test`,
      emailVerified: true,
    });

    // Workspace 1
    wsSlug = `ws-export-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "Export Test Workspace",
        slug: wsSlug,
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: admin.userId,
      role: "owner",
    });

    // Workspace 2 (for cross-tenant checks)
    otherWsSlug = `other-export-${Date.now()}`;
    const [otherWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "Other Workspace",
        slug: otherWsSlug,
      })
      .returning();
    otherWsId = otherWs.id;

    // Product A in Workspace 1
    prodASlug = `prod-a-${Date.now()}`;
    const [prodA] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Product Alpha",
        slug: prodASlug,
      })
      .returning();
    prodAId = prodA.id;

    // Default status for Product A
    const [status] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodAId,
        name: "Under Review",
        color: "#F59E0B",
        type: "review",
        isDefault: true,
        position: 0,
      })
      .returning();
    defaultStatusId = status.id;

    // Category for Product A
    const [cat] = await testApp.db
      .insert(schema.categories)
      .values({
        productId: prodAId,
        name: "Integrations",
      })
      .returning();
    categoryId = cat.id;

    // Product B in Workspace 1
    prodBSlug = `prod-b-${Date.now()}`;
    const [prodB] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Product Beta",
        slug: prodBSlug,
      })
      .returning();
    prodBId = prodB.id;

    await testApp.db.insert(schema.statuses).values({
      productId: prodBId,
      name: "Open",
      color: "#3B82F6",
      type: "review",
      isDefault: true,
      position: 0,
    });

    // Create API Keys via POST /api/v1/workspaces/:ws/api-keys
    const resExportKey = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Export Only Key",
        scopes: ["export:read"],
      });
    exportApiKey = resExportKey.body.token;

    const resWriteKey = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Write Key",
        scopes: ["requests:write", "comments:write", "export:read"],
      });
    writeApiKey = resWriteKey.body.token;
    writeApiKeyId = resWriteKey.body.key.id;

    const resAdminKey = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Admin Key",
        scopes: ["admin"],
      });
    adminApiKey = resAdminKey.body.token;

    const resNoExportKey = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Roadmap Only Key",
        scopes: ["roadmap:read"],
      });
    noExportApiKey = resNoExportKey.body.token;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("rejects unauthenticated requests to export feedback", async () => {
    const res = await request(testApp.http).get(
      `/api/v1/workspaces/${wsSlug}/export/feedback`
    );
    expect(res.status).toBe(401);
  });

  it("rejects API key without export:read scope", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/export/feedback`)
      .set("Authorization", `Bearer ${noExportApiKey}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("insufficient_scope");
  });

  it("creates posts and comments with API key and stamps createdByApiKeyId", async () => {
    // 1. Create post via admin endpoint with writeApiKey
    const postRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodASlug}/posts`)
      .set("Authorization", `Bearer ${writeApiKey}`)
      .send({
        title: "Automated Feedback Item 1",
        description: "Created by automated integration script",
        categoryId,
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.number).toBe(1);

    // Verify createdByApiKeyId is stamped in DB
    const [dbPost] = await testApp.db
      .select({
        id: schema.posts.id,
        number: schema.posts.number,
        createdByApiKeyId: schema.posts.createdByApiKeyId,
      })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodAId));

    expect(dbPost.createdByApiKeyId).toBe(writeApiKeyId);

    // 2. Add comment to post via writeApiKey
    const commentRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodASlug}/posts/1/comments`)
      .set("Authorization", `Bearer ${writeApiKey}`)
      .send({
        body: "Automated status reply comment",
      });

    expect(commentRes.status).toBe(201);

    // Verify comment createdByApiKeyId in DB
    const [dbComment] = await testApp.db
      .select({
        id: schema.comments.id,
        createdByApiKeyId: schema.comments.createdByApiKeyId,
      })
      .from(schema.comments)
      .where(eq(schema.comments.postId, dbPost.id));

    expect(dbComment.createdByApiKeyId).toBe(writeApiKeyId);

    // 3. Create second post under Product B (no comments)
    const postBRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodBSlug}/posts`)
      .set("Authorization", `Bearer ${writeApiKey}`)
      .send({
        title: "Product B Feedback",
        description: "Second product post",
      });

    expect(postBRes.status).toBe(201);
  });

  it("exports all feedback across products using exportApiKey", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/export/feedback`)
      .set("Authorization", `Bearer ${exportApiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.items).toHaveLength(2);

    const post1 = res.body.items.find(
      (p: any) => p.title === "Automated Feedback Item 1"
    );
    expect(post1).toBeDefined();
    expect(post1.author.id).not.toBe(admin.userId);
    expect(post1.author.name).toBe("Write Key (integration)");
    expect(post1.comments[0].author.id).toBe(post1.author.id);
    expect(post1.comments[0].author.name).toBe("Write Key (integration)");
    expect(post1.comments[0].isAdmin).toBe(true);
    expect(post1.voteCount).toBe(0);
    expect(post1.createdByApiKeyId).toBe(writeApiKeyId);
    expect(post1.commentCount).toBe(1);
    expect(post1.comments).toHaveLength(1);
    expect(post1.comments[0].body).toBe("Automated status reply comment");
    expect(post1.comments[0].createdByApiKeyId).toBe(writeApiKeyId);
    expect(post1.product.id).toBe(prodAId);
    expect(post1.category?.id).toBe(categoryId);
  });

  it("supports admin scope API key to access export endpoint", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/export/feedback`)
      .set("Authorization", `Bearer ${adminApiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
  });

  it("filters feedback export by productId", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/export/feedback?productId=${prodBId}`)
      .set("Authorization", `Bearer ${exportApiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].product.id).toBe(prodBId);
  });

  it("filters feedback export by since timestamp", async () => {
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/export/feedback?since=${futureDate}`)
      .set("Authorization", `Bearer ${exportApiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it("supports cursor pagination with limit", async () => {
    // Page 1: limit=1
    const res1 = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/export/feedback?limit=1`)
      .set("Authorization", `Bearer ${exportApiKey}`);

    expect(res1.status).toBe(200);
    expect(res1.body.items).toHaveLength(1);
    expect(res1.body.hasMore).toBe(true);
    expect(res1.body.nextCursor).toBeDefined();

    // Page 2: with cursor
    const res2 = await request(testApp.http)
      .get(
        `/api/v1/workspaces/${wsSlug}/export/feedback?limit=1&cursor=${res1.body.nextCursor}`
      )
      .set("Authorization", `Bearer ${exportApiKey}`);

    expect(res2.status).toBe(200);
    expect(res2.body.items).toHaveLength(1);
    expect(res2.body.items[0].id).not.toBe(res1.body.items[0].id);
  });

  it("enforces cross-workspace isolation on export endpoint", async () => {
    // exportApiKey is for wsSlug. Trying to export otherWsSlug should fail with 404
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${otherWsSlug}/export/feedback`)
      .set("Authorization", `Bearer ${exportApiKey}`);

    expect(res.status).toBe(404);
  });

  it("keeps integration moderation and inbox replies working without team membership", async () => {
    const base = `/api/v1/workspaces/${wsSlug}/products/${prodASlug}/posts`;
    const post = await request(testApp.http).post(base)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Human submitted moderation target", description: "Human request for moderation", categoryId });
    expect(post.status, JSON.stringify(post.body)).toBe(201);
    const number = post.body.number;
    const detail = await request(testApp.http).get(`${base}/${number}`)
      .set("Authorization", `Bearer ${adminApiKey}`);
    expect(detail.status).toBe(200);
    const edited = await request(testApp.http).patch(`${base}/${number}`)
      .set("Authorization", `Bearer ${writeApiKey}`)
      .send({ title: "Integration moderated title", categoryId, version: detail.body.post.version });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    const humanComment = await request(testApp.http).post(`${base}/${number}/comments`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "A human comment" });
    expect(humanComment.status).toBe(201);
    const reply = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/comments/${humanComment.body.id}/reply`)
      .set("Authorization", `Bearer ${writeApiKey}`).send({ body: "Integration reply" });
    expect(reply.status).toBe(201);
    expect(reply.body.author.name).toBe("Write Key (integration)");
    const removed = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodASlug}/comments/${humanComment.body.id}`)
      .set("Authorization", `Bearer ${writeApiKey}`);
    expect(removed.status).toBe(204);
    const members = await request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/members`)
      .set("Cookie", admin.cookie);
    expect(members.status).toBe(200);
    expect(JSON.stringify(members.body)).not.toContain("integration:");
    expect(JSON.stringify(members.body)).not.toContain("Write Key (integration)");
    const deleted = await request(testApp.http).delete(`${base}/${number}`)
      .set("Authorization", `Bearer ${writeApiKey}`);
    expect(deleted.status).toBe(204);
  });
});
