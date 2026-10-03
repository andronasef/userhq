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
});
