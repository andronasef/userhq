import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Dashboard Board API (Plan 03-11)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string; name: string };
  let voterUser: { cookie: string; userId: string; name: string };
  let _otherUser: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let postNumber: number;
  let _reviewStatusId: string;
  let _plannedStatusId: string;
  let _completedStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    ownerUser = await signedInCookie(testApp.test, {
      name: "Workspace Owner",
      email: "owner@dashboard-board.test",
      emailVerified: true,
    });

    voterUser = await signedInCookie(testApp.test, {
      name: "Customer Voter",
      email: "voter@dashboard-board.test",
      emailVerified: true,
    });

    _otherUser = await signedInCookie(testApp.test, {
      name: "Other User",
      email: "other@dashboard-board.test",
      emailVerified: true,
    });

    wsSlug = "ws-dash-board-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Dashboard Board Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "dash-board-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Dashboard Board Product",
        accentColor: "#2563EB",
        nextPostNumber: 1,
      })
      .returning();
    prodId = prod.id;

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

    _reviewStatusId = seeded.find((s) => s.type === "review")!.id;
    _plannedStatusId = seeded.find((s) => s.type === "planned")!.id;
    _completedStatusId = seeded.find((s) => s.type === "completed")!.id;

    // Create a post
    const res = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", voterUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Tracer Feedback Post",
        description: "A description of the feedback",
      });
    expect(res.status).toBe(201);
    postNumber = res.body.number;

    // Add another vote from owner
    const voteRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(voteRes.status).toBe(200);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: an admin lists posts, opens one, sees voters, and replies with an Admin badge", async () => {
    // 1. Owner lists posts
    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts`)
      .set("Cookie", ownerUser.cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.posts).toBeDefined();
    expect(listRes.body.posts.some((p: any) => p.number === postNumber)).toBe(true);

    // 2. Owner opens detail
    const detailRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}`)
      .set("Cookie", ownerUser.cookie);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.kind).toBe("post");
    expect(detailRes.body.deleted).toBe(false);
    expect(detailRes.body.post.number).toBe(postNumber);
    expect(detailRes.body.viewer.isAdmin).toBe(true);

    // 3. Owner gets voters
    const votersRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/voters`)
      .set("Cookie", ownerUser.cookie);

    expect(votersRes.status).toBe(200);
    expect(votersRes.body.total).toBe(2);
    expect(votersRes.body.voters.length).toBe(2);

    // Crucial privacy check: no "email" key anywhere in JSON response
    const jsonString = JSON.stringify(votersRes.body);
    expect(jsonString.toLowerCase()).not.toContain("email");

    // 4. Owner posts comment through portal endpoint
    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Official response from the team." });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.author.isAdmin).toBe(true);

    // 5. Public GET of post shows that comment with author.isAdmin true
    const publicRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.kind).toBe("post");
    const commentItem = publicRes.body.timeline.find(
      (t: any) => t.kind === "comment" && t.comment.body === "Official response from the team."
    );
    expect(commentItem).toBeDefined();
    expect(commentItem.comment.author.isAdmin).toBe(true);
  });
});
