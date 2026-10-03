import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, sql, asc } from "drizzle-orm";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    expect(portalProdRes.body.categories).toContainEqual({
      id: categoryId,
      name: "Integrations",
    });

    // 6. Admin lists categories: postCount is 1
    const listCatRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories`)
      .set("cookie", ownerUser.cookie);
    expect(listCatRes.status).toBe(200);
    const item = listCatRes.body.find((c: any) => c.id === categoryId);
    expect(item).toEqual({
      id: categoryId,
      name: "Integrations",
      postCount: 1,
    });
  });

  it("POST /workspaces/{ws}/products seeds Feature Request and Bug in creation order", async () => {
    const createProdRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products`)
      .set("cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Auto Seeded Product",
        slug: "seeded-prod",
      });

    expect(createProdRes.status).toBe(201);

    const catRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/seeded-prod/categories`)
      .set("cookie", ownerUser.cookie);

    expect(catRes.status).toBe(200);
    expect(catRes.body.map((c: any) => c.name)).toEqual([
      "Feature Request",
      "Bug",
    ]);
  });

  it("executing 0008's SQL on a category-less product backfills Feature Request and Bug idempotently", async () => {
    const [catlessProd] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: "catless-prod",
        name: "Category-less Product",
        accentColor: "#2563EB",
      })
      .returning();

    const sqlPath = path.resolve(
      __dirname,
      "../../../packages/db/migrations/0008_backfill_categories.sql"
    );
    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    // Run statements first time
    for (const stmt of statements) {
      await testApp.db.execute(sql.raw(stmt));
    }

    const rowsAfterFirst = await testApp.db
      .select({ name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.productId, catlessProd.id))
      .orderBy(asc(schema.categories.createdAt), asc(schema.categories.id));

    expect(rowsAfterFirst.map((r) => r.name)).toEqual([
      "Feature Request",
      "Bug",
    ]);

    // Run statements second time (idempotency check)
    for (const stmt of statements) {
      await testApp.db.execute(sql.raw(stmt));
    }

    const rowsAfterSecond = await testApp.db
      .select({ name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.productId, catlessProd.id))
      .orderBy(asc(schema.categories.createdAt), asc(schema.categories.id));

    expect(rowsAfterSecond.map((r) => r.name)).toEqual([
      "Feature Request",
      "Bug",
    ]);
  });

  it("rename category: 409 on collision (case-insensitive), 200 when casing itself", async () => {
    await testApp.db
      .insert(schema.categories)
      .values({
        productId: prodId,
        name: "Alpha Category",
      });

    const [catB] = await testApp.db
      .insert(schema.categories)
      .values({
        productId: prodId,
        name: "Beta Category",
      })
      .returning();

    // Renaming Beta to "alpha category" (conflict with Alpha) -> 409 category_name_taken
    const conflictRes = await request(testApp.http)
      .patch(
        `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories/${catB.id}`
      )
      .set("cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "alpha category" });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.code).toBe("category_name_taken");

    // Renaming Beta to "BETA CATEGORY" (self rename with diff case) -> 200
    const selfRenameRes = await request(testApp.http)
      .patch(
        `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories/${catB.id}`
      )
      .set("cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "BETA CATEGORY" });

    expect(selfRenameRes.status).toBe(200);
    expect(selfRenameRes.body.name).toBe("BETA CATEGORY");
  });

  it("DELETE category nullifies category_id on posts, returns 204, then 404 on repeat", async () => {
    const [tempCat] = await testApp.db
      .insert(schema.categories)
      .values({
        productId: prodId,
        name: "Temporary Category",
      })
      .returning();

    // Create 2 posts under this category
    const p1 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", customerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Post to be orphaned 1",
        description: "Orphan description 1",
        categoryId: tempCat.id,
      });
    expect(p1.status).toBe(201);

    const p2 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", customerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Post to be orphaned 2",
        description: "Orphan description 2",
        categoryId: tempCat.id,
      });
    expect(p2.status).toBe(201);

    // Delete category
    const delRes = await request(testApp.http)
      .delete(
        `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories/${tempCat.id}`
      )
      .set("cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delRes.status).toBe(204);

    // Posts remain on board with category null
    const boardRes = await request(testApp.http).get(
      `/api/v1/portal/${wsSlug}/${prodSlug}/posts`
    );
    const post1 = boardRes.body.posts.find((p: any) => p.number === p1.body.number);
    const post2 = boardRes.body.posts.find((p: any) => p.number === p2.body.number);
    expect(post1.category).toBeNull();
    expect(post2.category).toBeNull();

    // Delete again -> 404
    const repeatDelRes = await request(testApp.http)
      .delete(
        `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/categories/${tempCat.id}`
      )
      .set("cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(repeatDelRes.status).toBe(404);
    expect(repeatDelRes.body.code).toBe("not_found");
  });

  it("post category validation: required when product has categories, invalid if foreign", async () => {
    // 1. Post creation without categoryId on a product with categories -> 400 category_required
    const missingCatRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", customerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Missing category post",
        description: "Description",
      });

    expect(missingCatRes.status).toBe(400);
    expect(missingCatRes.body.code).toBe("category_required");

    // 2. Post creation with foreign category ID -> 400 category_invalid
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    const invalidCatRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", customerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Invalid category post",
        description: "Description",
        categoryId: fakeUuid,
      });

    expect(invalidCatRes.status).toBe(400);
    expect(invalidCatRes.body.code).toBe("category_invalid");
  });
});
