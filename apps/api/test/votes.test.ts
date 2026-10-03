import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq, sql } from "drizzle-orm";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Votes API (Plan 03-06)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let userA: { cookie: string; userId: string };
  let userB: { cookie: string; userId: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let catId: string;
  let postNumber: number;

  beforeAll(async () => {
    testApp = await createTestApp();

    userA = await signedInCookie(testApp.test, {
      name: "Author Alice",
      email: "alice@votes.test",
      emailVerified: true,
    });

    userB = await signedInCookie(testApp.test, {
      name: "Voter Bob",
      email: "bob@votes.test",
      emailVerified: true,
    });

    wsSlug = "ws-votes-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Votes Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: userA.userId,
      role: "owner",
    });

    prodSlug = "votes-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Votes Product",
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

    // Seed categories
    const [cat] = await testApp.db
      .insert(schema.categories)
      .values([
        {
          productId: prodId,
          name: "Feature Request",
        },
      ])
      .returning();
    catId = cat.id;

    // Create a post by Alice
    const createPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Initial Post for Voting",
        description: "Post description",
        categoryId: catId,
      });

    expect(createPostRes.status).toBe(201);
    postNumber = createPostRes.body.number;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: PUT then DELETE vote round-trips with an exact count", async () => {
    // 1. Initial post created by Alice has voteCount 1 (Alice's auto-vote)
    const initialGet = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("cookie", userB.cookie);

    expect(initialGet.status).toBe(200);
    expect(initialGet.body.kind).toBe("post");
    expect(initialGet.body.post.voteCount).toBe(1);
    expect(initialGet.body.viewer.voted).toBe(false);

    // 2. Bob upvotes the post via PUT
    const putVoteRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(putVoteRes.status).toBe(200);
    expect(putVoteRes.body).toEqual({
      voted: true,
      voteCount: 2,
    });

    // 3. GET post as Bob reflects voted: true and voteCount: 2
    const afterPutGet = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("cookie", userB.cookie);

    expect(afterPutGet.status).toBe(200);
    expect(afterPutGet.body.kind).toBe("post");
    expect(afterPutGet.body.post.voteCount).toBe(2);
    expect(afterPutGet.body.viewer.voted).toBe(true);

    // 4. Bob unvotes via DELETE
    const deleteVoteRes = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(deleteVoteRes.status).toBe(200);
    expect(deleteVoteRes.body).toEqual({
      voted: false,
      voteCount: 1,
    });

    // 5. GET post as Bob reflects voted: false and voteCount: 1
    const afterDeleteGet = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("cookie", userB.cookie);

    expect(afterDeleteGet.status).toBe(200);
    expect(afterDeleteGet.body.kind).toBe("post");
    expect(afterDeleteGet.body.post.voteCount).toBe(1);
    expect(afterDeleteGet.body.viewer.voted).toBe(false);
  });

  it("idempotency: PUT twice and DELETE twice by same user keep vote count unchanged", async () => {
    const freshUser = await signedInCookie(testApp.test, {
      name: "Idempotent Voter",
      emailVerified: true,
    });

    // 1st PUT -> voted true, voteCount 2
    const put1 = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", freshUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(put1.status).toBe(200);
    expect(put1.body).toEqual({ voted: true, voteCount: 2 });

    // 2nd PUT -> voted true, voteCount 2 (unchanged)
    const put2 = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", freshUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(put2.status).toBe(200);
    expect(put2.body).toEqual({ voted: true, voteCount: 2 });

    // 1st DELETE -> voted false, voteCount 1
    const del1 = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", freshUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(del1.status).toBe(200);
    expect(del1.body).toEqual({ voted: false, voteCount: 1 });

    // 2nd DELETE -> voted false, voteCount 1 (unchanged)
    const del2 = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", freshUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(del2.status).toBe(200);
    expect(del2.body).toEqual({ voted: false, voteCount: 1 });
  });

  it("concurrency: 50 parallel PUTs by one fresh user leave exactly 1 vote row and vote_count = previous + 1", async () => {
    const freshUser = await signedInCookie(testApp.test, {
      name: "Parallel Hammer User",
      emailVerified: true,
    });

    const [postBefore] = await testApp.db
      .select({ id: schema.posts.id, voteCount: schema.posts.voteCount })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, postNumber)
        )
      );

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        request(testApp.http)
          .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
          .set("cookie", freshUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
      )
    );

    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.voted).toBe(true);
      expect(res.body.voteCount).toBe(postBefore.voteCount + 1);
    }

    const voteRows = await testApp.db
      .select()
      .from(schema.votes)
      .where(
        and(
          eq(schema.votes.postId, postBefore.id),
          eq(schema.votes.userId, freshUser.userId)
        )
      );

    expect(voteRows).toHaveLength(1);

    // Clean up vote for next tests
    await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", freshUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
  });

  it("concurrency: 20 fresh users PUT in parallel leave vote_count = COUNT(*) FROM votes = 21", async () => {
    // Create a fresh post for this test
    const createPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Post for 20 Concurrent Voters",
        categoryId: catId,
      });
    expect(createPostRes.status).toBe(201);
    const testPostNumber = createPostRes.body.number;

    // Mint 20 users
    const voters = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        signedInCookie(testApp.test, {
          name: `Concurrent Voter ${i}`,
          emailVerified: true,
        })
      )
    );

    // 20 parallel PUTs
    const putResults = await Promise.all(
      voters.map((u) =>
        request(testApp.http)
          .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${testPostNumber}/vote`)
          .set("cookie", u.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
      )
    );

    for (const res of putResults) {
      expect(res.status).toBe(200);
      expect(res.body.voted).toBe(true);
    }

    const [postRow] = await testApp.db
      .select({ id: schema.posts.id, voteCount: schema.posts.voteCount })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, testPostNumber)
        )
      );

    const countRows = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.votes)
      .where(eq(schema.votes.postId, postRow.id));

    expect(postRow.voteCount).toBe(21); // Alice (1) + 20 voters
    expect(countRows[0].count).toBe(21);
  });

  it("vote error cases: deleted post, merged post, number 999, foreign product return 404 post_not_found", async () => {
    // 1. Unknown number 999 -> 404
    const notFoundRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/999/vote`)
      .set("cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.code).toBe("post_not_found");

    // 2. Soft-deleted post -> 404
    const deletedPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "To Be Deleted Post",
        categoryId: catId,
      });
    const delNumber = deletedPostRes.body.number;

    await testApp.db
      .update(schema.posts)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, delNumber)
        )
      );

    const voteDeletedRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${delNumber}/vote`)
      .set("cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(voteDeletedRes.status).toBe(404);
    expect(voteDeletedRes.body.code).toBe("post_not_found");

    // 3. Merged post -> 404
    const mergedPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Duplicate Post",
        categoryId: catId,
      });
    const dupNumber = mergedPostRes.body.number;

    const [targetPost] = await testApp.db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, postNumber)
        )
      );

    await testApp.db
      .update(schema.posts)
      .set({ mergedIntoId: targetPost.id })
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, dupNumber)
        )
      );

    const voteMergedRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${dupNumber}/vote`)
      .set("cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(voteMergedRes.status).toBe(404);
    expect(voteMergedRes.body.code).toBe("post_not_found");

    // 4. Tenant B's number on Tenant A's product -> 404
    const foreignNumberRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/88888/vote`)
      .set("cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(foreignNumberRes.status).toBe(404);
    expect(foreignNumberRes.body.code).toBe("post_not_found");
  });

  it("posts.version is unchanged after any number of votes", async () => {
    const [pBefore] = await testApp.db
      .select({ version: schema.posts.version })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, postNumber)
        )
      );

    const voter = await signedInCookie(testApp.test, {
      name: "Version Test Voter",
      emailVerified: true,
    });

    // PUT
    await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", voter.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    // DELETE
    await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", voter.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    // PUT again
    await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", voter.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    const [pAfter] = await testApp.db
      .select({ version: schema.posts.version })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, prodId),
          eq(schema.posts.number, postNumber)
        )
      );

    expect(pAfter.version).toBe(pBefore.version);
  });

  it("throttling: 61 sequential vote requests by one user return 429 rate_limited on 61st", async () => {
    const throttledUser = await signedInCookie(testApp.test, {
      name: "Throttled Voter",
      emailVerified: true,
    });

    // Send 60 requests sequentially within a minute
    for (let i = 0; i < 60; i++) {
      const res = await request(testApp.http)
        .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
        .set("cookie", throttledUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(res.status).toBe(200);
    }

    // 61st request should be throttled
    const res61 = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("cookie", throttledUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(res61.status).toBe(429);
    expect(res61.body.code).toBe("rate_limited");
  });

  it("unauthenticated PUT returns 401 unauthorized", async () => {
    const unauthRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.code).toBe("unauthorized");
  });
});
