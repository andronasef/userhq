import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, and } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Public Posts API (Plan 03-02)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let authorUser: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let prodId: string;
  let prodSlug: string;
  let defaultStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    authorUser = await signedInCookie(testApp.test, {
      name: "Tracer Author",
      email: "tracer@feedback.test",
      emailVerified: true,
    });

    wsSlug = "ws-posts-tracer";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Posts Tracer Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: authorUser.userId,
      role: "owner",
    });

    prodSlug = "tracer-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Tracer Product",
      })
      .returning();
    prodId = prod.id;

    // Seed default 5 statuses
    const seeded = await testApp.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: prodId,
          name: s.name,
          type: s.type,
          color: s.color,
          position: idx,
          isDefault: s.isDefault,
        }))
      )
      .returning();

    const def = seeded.find((s) => s.isDefault);
    defaultStatusId = def!.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: a signed-in user creates a post and reads it back", async () => {
    const postRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Tracer First Post",
        description: "Details for tracer post",
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body).toEqual({
      number: 1,
      slug: "tracer-first-post",
    });

    // Read back through single post endpoint
    const getRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/1`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(getRes.status).toBe(200);
    expect(getRes.body.kind).toBe("post");
    expect(getRes.body.post).toMatchObject({
      number: 1,
      slug: "tracer-first-post",
      title: "Tracer First Post",
      description: "Details for tracer post",
      voteCount: 1,
      status: {
        id: defaultStatusId,
        name: "Under Review",
        type: "review",
      },
      category: null,
      author: {
        name: "Tracer Author",
        isAdmin: true,
        deleted: false,
      },
    });
    expect(getRes.body.viewer).toMatchObject({
      signedIn: true,
      voted: true,
      isAuthor: true,
      isAdmin: true,
      canEdit: true,
      canDelete: true,
    });

    // Read back through board list
    const boardRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(boardRes.status).toBe(200);
    expect(boardRes.body.posts).toHaveLength(1);
    expect(boardRes.body.posts[0]).toMatchObject({
      number: 1,
      slug: "tracer-first-post",
      title: "Tracer First Post",
      voteCount: 1,
      voted: true,
      commentCount: 0,
    });
  });

  it("submitting the same title twice creates two posts with distinct numbers", async () => {
    const post1 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Duplicate Title Post" });

    const post2 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Duplicate Title Post" });

    expect(post1.status).toBe(201);
    expect(post2.status).toBe(201);
    expect(post1.body.slug).toBe(post2.body.slug);
    expect(post1.body.number).not.toBe(post2.body.number);
  });

  it("validates titles and details according to shared Zod constraints", async () => {
    // Empty title after trimming -> title_required
    const emptyRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "   " });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.code).toBe("title_required");

    // Title 1-2 chars after trimming -> title_too_short
    const shortRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "  ab  " });
    expect(shortRes.status).toBe(400);
    expect(shortRes.body.code).toBe("title_too_short");

    // Title 121 chars -> title_too_long
    const longRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "a".repeat(121) });
    expect(longRes.status).toBe(400);
    expect(longRes.body.code).toBe("title_too_long");

    // Description 5,001 chars -> description_too_long
    const longDescRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Valid Title", description: "a".repeat(5001) });
    expect(longDescRes.status).toBe(400);
    expect(longDescRes.body.code).toBe("description_too_long");

    // Description "   " -> stored as NULL
    const emptyDescRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Valid Post Empty Description", description: "   " });
    expect(emptyDescRes.status).toBe(201);

    const getEmptyDesc = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${emptyDescRes.body.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(getEmptyDesc.status).toBe(200);
    expect(getEmptyDesc.body.post.description).toBeNull();
  });

  it("handles merged posts by redirecting or 404 if target is gone", async () => {
    // Create target post
    const targetRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Merge Target Post" });
    expect(targetRes.status).toBe(201);

    // Create post to merge
    const sourceRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Source Post To Merge" });
    expect(sourceRes.status).toBe(201);

    // Get target row id from db
    const [targetRow] = await testApp.db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, targetRes.body.number)
        )
      );

    // Set merged_into_id on source
    await testApp.db
      .update(schema.posts)
      .set({ mergedIntoId: targetRow.id })
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, sourceRes.body.number)
        )
      );

    // GET source post -> returns redirect kind
    const redirectRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${sourceRes.body.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(redirectRes.status).toBe(200);
    expect(redirectRes.body).toEqual({
      kind: "redirect",
      number: targetRes.body.number,
      slug: targetRes.body.slug,
    });

    // Soft delete target post -> GET source post returns 404 post_not_found
    await testApp.db
      .update(schema.posts)
      .set({ deletedAt: new Date() })
      .where(eq(schema.posts.id, targetRow.id));

    const goneRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${sourceRes.body.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(goneRes.status).toBe(404);
    expect(goneRes.body.code).toBe("post_not_found");
  });

  it("returns 404 post_not_found for deleted post, unknown number, 0, or non-numeric", async () => {
    // Deleted post
    const delPost = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "To Be Deleted Post" });
    expect(delPost.status).toBe(201);

    await testApp.db
      .update(schema.posts)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, delPost.body.number)
        )
      );

    const resDeleted = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${delPost.body.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(resDeleted.status).toBe(404);
    expect(resDeleted.body.code).toBe("post_not_found");

    // Unknown number 999999
    const resUnknown = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/999999`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(resUnknown.status).toBe(404);
    expect(resUnknown.body.code).toBe("post_not_found");

    // Number 0
    const resZero = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/0`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(resZero.status).toBe(404);
    expect(resZero.body.code).toBe("post_not_found");

    // Non-numeric "abc"
    const resAbc = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/abc`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(resAbc.status).toBe(404);
    expect(resAbc.body.code).toBe("post_not_found");
  });

  it("never leaks author email or user id (canary test), and handles deleted authors and unicode names", async () => {
    const canaryEmail = `canary-${Date.now()}@leak.test`;
    const complexName = "👨‍👩‍👧‍👦 René e\u0301";

    const canaryUser = await signedInCookie(testApp.test, {
      name: complexName,
      email: canaryEmail,
      emailVerified: true,
    });

    const createRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", canaryUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ title: "Canary Post Title", description: "Canary Post Details" });
    expect(createRes.status).toBe(201);
    const postNumber = createRes.body.number;

    // Check single post response JSON
    const postRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(postRes.status).toBe(200);

    const postJson = JSON.stringify(postRes.body);
    expect(postJson).not.toContain(canaryEmail);
    expect(postJson).not.toContain(canaryUser.userId);
    expect(postRes.body.post.author.name).toBe(complexName);

    // Check board response JSON
    const boardRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(boardRes.status).toBe(200);

    const boardJson = JSON.stringify(boardRes.body);
    expect(boardJson).not.toContain(canaryEmail);
    expect(boardJson).not.toContain(canaryUser.userId);

    // Soft delete author user
    await testApp.db
      .update(schema.user)
      .set({ deletedAt: new Date() })
      .where(eq(schema.user.id, canaryUser.userId));

    const deletedAuthorRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(deletedAuthorRes.status).toBe(200);
    expect(deletedAuthorRes.body.post.author).toEqual({
      name: null,
      image: null,
      isAdmin: false,
      deleted: true,
    });
  });

  it("prevents forged authorIsAdmin / isAdmin fields in request body", async () => {
    const regularUser = await signedInCookie(testApp.test, {
      name: "Regular Non-Member User",
      email: "regular@user.test",
      emailVerified: true,
    });

    const res = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", regularUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Trying to forge admin badge",
        authorIsAdmin: true,
        isAdmin: true,
      } as any);

    expect(res.status).toBe(201);

    const getRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${res.body.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(getRes.status).toBe(200);
    expect(getRes.body.post.author.isAdmin).toBe(false);
  });

  it("allocates numbers sequentially under concurrency (20 parallel creates by 20 distinct users)", async () => {
    // Create dedicated product for clean 1..20 allocation test
    const concurrentProdSlug = "concurrent-prod";
    const [cProd] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: concurrentProdSlug,
        name: "Concurrent Product",
        nextPostNumber: 1,
      })
      .returning();

    await testApp.db.insert(schema.statuses).values({
      productId: cProd.id,
      name: "Under Review",
      type: "review",
      color: "#EA580C",
      position: 0,
      isDefault: true,
    });

    // Create 20 distinct users
    const users = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        signedInCookie(testApp.test, {
          name: `Concurrent User ${i + 1}`,
          email: `concurrent-${i + 1}-${Date.now()}@test.local`,
          emailVerified: true,
        })
      )
    );

    // Fire 20 parallel creates
    const results = await Promise.all(
      users.map((u, i) =>
        request(testApp.http)
          .post(`/api/v1/portal/${wsSlug}/${concurrentProdSlug}/posts`)
          .set("Cookie", u.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ title: `Concurrent Post ${i + 1}` })
      )
    );

    for (const r of results) {
      expect(r.status).toBe(201);
    }

    const numbers = results.map((r) => r.body.number).sort((a, b) => a - b);
    const expected = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(numbers).toEqual(expected);

    // Verify products.next_post_number in db is 21
    const [finalProd] = await testApp.db
      .select({ nextPostNumber: schema.products.nextPostNumber })
      .from(schema.products)
      .where(eq(schema.products.id, cProd.id));
    expect(finalProd.nextPostNumber).toBe(21);
  });
});
