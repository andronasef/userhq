import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Votes API (Plan 03-06)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let userA: { cookie: string; userId: string };
  let userB: { cookie: string; userId: string };
  let wsSlug: string;
  let prodSlug: string;
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

    // Seed default 5 statuses
    await testApp.db.insert(schema.statuses).values(
      SEEDED_STATUSES.map((s, idx) => ({
        productId: prod.id,
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
          productId: prod.id,
          name: "Feature Request",
        },
      ])
      .returning();

    // Create a post by Alice
    const createPostRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Initial Post for Voting",
        description: "Post description",
        categoryId: cat.id,
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
});
