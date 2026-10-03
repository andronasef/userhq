import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Categories API (Plan 03-05)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string };
  let customerUser: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let prodId: string;
  let prodSlug: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    ownerUser = await signedInCookie(testApp.test, {
      name: "Category Admin",
      email: "admin@categories.test",
      emailVerified: true,
    });

    customerUser = await signedInCookie(testApp.test, {
      name: "Customer Bob",
      email: "bob@categories.test",
      emailVerified: true,
    });

    wsSlug = "ws-cat-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Category Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "cat-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Category Product",
        accentColor: "#2563EB",
      })
      .returning();
    prodId = prod.id;

    // Seed default 5 statuses
    await testApp.db.insert(schema.statuses).values(
      SEEDED_STATUSES.map((s, idx) => ({
        productId: prodId,
        name: s.name,
        type: s.type,
        color: s.color,
        position: idx,
        isDefault: s.type === "review",
      }))
    );
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: an admin adds a category and a customer files a post under it", async () => {
    // 1. Admin creates a category
    const createCatRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories`)
      .set("cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Integrations" });

    expect(createCatRes.status).toBe(201);
    expect(createCatRes.body.name).toBe("Integrations");
    expect(createCatRes.body.id).toBeDefined();
    expect(createCatRes.body.postCount).toBe(0);
    const categoryId = createCatRes.body.id;

    // 2. Customer creates a post under this category
    const createPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", customerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Slack integration support",
        description: "Need slack notifications for high-priority tickets.",
        categoryId,
      });

    expect(createPostRes.status).toBe(201);
    expect(createPostRes.body.number).toBe(1);

    // 3. GET board lists the post with category
    const boardRes = await request(testApp.http).get(
      `/api/v1/portal/${wsSlug}/${prodSlug}/posts`
    );
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.posts).toHaveLength(1);
    expect(boardRes.body.posts[0].category).toEqual({
      id: categoryId,
      name: "Integrations",
    });

    // 4. GET post permalink has category
    const permalinkRes = await request(testApp.http).get(
      `/api/v1/portal/${wsSlug}/${prodSlug}/posts/1`
    );
    expect(permalinkRes.status).toBe(200);
    expect(permalinkRes.body.kind).toBe("post");
    expect(permalinkRes.body.post.category).toEqual({
      id: categoryId,
      name: "Integrations",
    });

    // 5. GET portal product lists the category
    const portalProdRes = await request(testApp.http).get(
      `/api/v1/portal/${wsSlug}/${prodSlug}`
    );
    expect(portalProdRes.status).toBe(200);
    expect(portalProdRes.body.categories).toEqual([
      { id: categoryId, name: "Integrations" },
    ]);

    // 6. Admin lists categories: postCount is 1
    const listCatRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories`)
      .set("cookie", ownerUser.cookie);
    expect(listCatRes.status).toBe(200);
    expect(listCatRes.body).toHaveLength(1);
    expect(listCatRes.body[0]).toEqual({
      id: categoryId,
      name: "Integrations",
      postCount: 1,
    });
  });
});
