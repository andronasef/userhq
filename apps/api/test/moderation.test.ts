import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Moderation API (Plan 03-09)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let postNumber: number;
  let defaultStatusId: string;
  let plannedStatusId: string;
  let plannedStatusName: string;
  let plannedStatusColor: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    ownerUser = await signedInCookie(testApp.test, {
      name: "Workspace Owner",
      email: "owner@moderation.test",
      emailVerified: true,
    });

    wsSlug = "ws-moderation-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Moderation Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "moderation-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Moderation Product",
        accentColor: "#2563EB",
        nextPostNumber: 2,
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
    defaultStatusId = defaultStatus.id;

    const plannedStatus = seeded.find((s) => s.type === "planned")!;
    plannedStatusId = plannedStatus.id;
    plannedStatusName = plannedStatus.name;
    plannedStatusColor = plannedStatus.color;

    // Create a post
    const [createdPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Feature idea needing moderation",
        description: "Post description for moderation testing",
        statusId: defaultStatusId,
        authorId: ownerUser.userId,
        authorIsAdmin: true,
        voteCount: 1,
      })
      .returning();

    postNumber = createdPost.number;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: an admin changes status with a note and the post page shows the activity", async () => {
    const putRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/status`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatusId,
        note: "Next sprint",
        version: 1,
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.version).toBe(2);
    expect(putRes.body.status.id).toBe(plannedStatusId);
    expect(putRes.body.status.name).toBe(plannedStatusName);
    expect(putRes.body.activity).toMatchObject({
      note: "Next sprint",
      statusName: plannedStatusName,
      statusColor: plannedStatusColor,
      actor: {
        name: "Workspace Owner",
        isAdmin: true,
        deleted: false,
      },
    });

    // Verify GET post returns the updated status and activity timeline entry
    const getRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(getRes.status).toBe(200);
    expect(getRes.body.post.status.id).toBe(plannedStatusId);
    expect(getRes.body.post.version).toBe(2);
    expect(getRes.body.timeline).toHaveLength(1);
    expect(getRes.body.timeline[0]).toMatchObject({
      kind: "activity",
      activity: {
        note: "Next sprint",
        statusName: plannedStatusName,
        statusColor: plannedStatusColor,
        actor: {
          name: "Workspace Owner",
          isAdmin: true,
          deleted: false,
        },
      },
    });
  });

  it("same-status change -> 200, version unchanged, no new activity row", async () => {
    // Current post is at plannedStatusId, version 2
    const putRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/status`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: plannedStatusId,
        note: "Should be no-op",
        version: 2,
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.version).toBe(2);
    expect(putRes.body.status.id).toBe(plannedStatusId);
    expect(putRes.body.activity).toBeNull();

    // Verify activity count in DB for this post is still 1
    const activities = await testApp.db
      .select()
      .from(schema.postActivity);
    expect(activities).toHaveLength(1);
  });

  it("note '   ' -> activity.note null; 1,001-character note -> 400 note_too_long", async () => {
    // 1,001-character note -> 400
    const longNoteRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/status`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: defaultStatusId,
        note: "a".repeat(1001),
        version: 2,
      });

    expect(longNoteRes.status).toBe(400);
    expect(longNoteRes.body.code).toBe("note_too_long");

    // Whitespace-only note -> null
    const spaceNoteRes = await request(testApp.http)
      .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/status`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        statusId: defaultStatusId,
        note: "   ",
        version: 2,
      });

    expect(spaceNoteRes.status).toBe(200);
    expect(spaceNoteRes.body.version).toBe(3);
    expect(spaceNoteRes.body.activity.note).toBeNull();
  });

  it("activity and comments with interleaved timestamps come back in created_at order; equal timestamps order by id", async () => {
    // Create a new post
    const [timelinePost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 200,
        title: "Interleaved timeline post",
        description: "Testing timeline sort",
        statusId: defaultStatusId,
        authorId: ownerUser.userId,
        authorIsAdmin: true,
        voteCount: 1,
      })
      .returning();

    const t1 = new Date("2026-01-01T10:00:00Z");
    const t2 = new Date("2026-01-01T11:00:00Z");
    const t3 = new Date("2026-01-01T12:00:00Z");
    const t4 = new Date("2026-01-01T13:00:00Z");

    // Comment at t1
    const [c1] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: timelinePost.id,
        authorId: ownerUser.userId,
        body: "First comment (t1)",
        version: 1,
        createdAt: t1,
      })
      .returning();

    // Activity at t2
    const [a1] = await testApp.db
      .insert(schema.postActivity)
      .values({
        postId: timelinePost.id,
        kind: "status_changed",
        actorId: ownerUser.userId,
        toStatusId: plannedStatusId,
        statusName: plannedStatusName,
        statusColor: plannedStatusColor,
        note: "Activity at t2",
        createdAt: t2,
      })
      .returning();

    // Comment at t3
    const [c2] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: timelinePost.id,
        authorId: ownerUser.userId,
        body: "Second comment (t3)",
        version: 1,
        createdAt: t3,
      })
      .returning();

    // Activity at t4
    const [a2] = await testApp.db
      .insert(schema.postActivity)
      .values({
        postId: timelinePost.id,
        kind: "status_changed",
        actorId: ownerUser.userId,
        toStatusId: defaultStatusId,
        statusName: "Under Review",
        statusColor: "#E2E8F0",
        note: "Activity at t4",
        createdAt: t4,
      })
      .returning();

    // Two items with equal timestamp t5 to test secondary id tie-breaker
    const t5 = new Date("2026-01-01T14:00:00Z");
    const idA = "11111111-1111-4111-8111-111111111111";
    const idB = "22222222-2222-4222-8222-222222222222";

    await testApp.db.insert(schema.comments).values({
      id: idB,
      postId: timelinePost.id,
      authorId: ownerUser.userId,
      body: "Equal time comment (B)",
      version: 1,
      createdAt: t5,
    });

    await testApp.db.insert(schema.postActivity).values({
      id: idA,
      postId: timelinePost.id,
      kind: "status_changed",
      actorId: ownerUser.userId,
      toStatusId: plannedStatusId,
      statusName: plannedStatusName,
      statusColor: plannedStatusColor,
      createdAt: t5,
    });

    const getRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${timelinePost.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(getRes.status).toBe(200);
    const { timeline } = getRes.body;
    expect(timeline).toHaveLength(6);

    // Verify ordering
    expect(timeline[0].kind).toBe("comment");
    expect(timeline[0].comment.id).toBe(c1.id);

    expect(timeline[1].kind).toBe("activity");
    expect(timeline[1].activity.id).toBe(a1.id);

    expect(timeline[2].kind).toBe("comment");
    expect(timeline[2].comment.id).toBe(c2.id);

    expect(timeline[3].kind).toBe("activity");
    expect(timeline[3].activity.id).toBe(a2.id);

    // Equal timestamp t5: sorted by id ascending -> idA before idB
    expect(timeline[4].kind).toBe("activity");
    expect(timeline[4].activity.id).toBe(idA);

    expect(timeline[5].kind).toBe("comment");
    expect(timeline[5].comment.id).toBe(idB);
  });
});
