import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Comments API (Plan 03-08)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let userA: { cookie: string; userId: string; name: string };
  let userB: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let postNumber: number;

  beforeAll(async () => {
    testApp = await createTestApp();

    userA = await signedInCookie(testApp.test, {
      name: "Author Alice",
      email: "alice@comments.test",
      emailVerified: true,
    });

    userB = await signedInCookie(testApp.test, {
      name: "Commenter Bob",
      email: "bob@comments.test",
      emailVerified: true,
    });

    wsSlug = "ws-comments-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Comments Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: userA.userId,
      role: "owner",
    });

    prodSlug = "comments-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Comments Product",
        accentColor: "#2563EB",
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
          isDefault: s.type === "review",
        }))
      )
      .returning();

    const defaultStatus = seeded.find((s) => s.isDefault)!;

    // Create a post by User A
    const [createdPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Initial Post by Alice",
        description: "Post description for comments testing",
        statusId: defaultStatus.id,
        authorId: userA.userId,
        authorIsAdmin: true,
        voteCount: 1,
      })
      .returning();

    postNumber = createdPost.number;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: a signed-in user comments and the post page returns it", async () => {
    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Same here\nPlease" });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.body).toBe("Same here\nPlease");
    expect(commentRes.body.author.name).toBe("Commenter Bob");
    expect(commentRes.body.author.isAdmin).toBe(false);
    expect(commentRes.body.author.email).toBeUndefined();
    expect(commentRes.body.email).toBeUndefined();
    expect(commentRes.body.authorId).toBeUndefined();

    // Verify GET post returns the comment in timeline
    const postRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Cookie", userB.cookie);

    expect(postRes.status).toBe(200);
    expect(postRes.body.kind).toBe("post");
    expect(Array.isArray(postRes.body.timeline)).toBe(true);
    expect(postRes.body.timeline.length).toBe(1);

    const item = postRes.body.timeline[0];
    expect(item.kind).toBe("comment");
    expect(item.comment.body).toBe("Same here\nPlease");
    expect(item.comment.author.name).toBe("Commenter Bob");
    expect(item.comment.author.isAdmin).toBe(false);

    // Verify the JSON contains neither B's email nor B's user ID
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain("bob@comments.test");
    expect(serialized).not.toContain(userB.userId);
  });
});
