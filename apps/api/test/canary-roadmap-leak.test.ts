import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes, randomUUID } from "node:crypto";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("ROAD-12 Automated Canary Leak Seam Test", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let assigneeUser: { cookie: string; userId: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let postNumber: number;
  let roadmapItemId: string;

  // High-entropy canary strings
  const canarySalt = randomBytes(8).toString("hex");
  const CANARY_INTERNAL_TITLE = `CANARY_INTERNAL_TITLE_${canarySalt}_${randomUUID()}`;
  const CANARY_INTERNAL_DESC = `CANARY_INTERNAL_DESC_${canarySalt}_${randomUUID()}`;
  const CANARY_INTERNAL_NOTES = `CANARY_INTERNAL_NOTES_${canarySalt}_${randomUUID()}`;
  const CANARY_ASSIGNEE_NAME = `CANARY_ASSIGNEE_${canarySalt}_${randomUUID()}`;
  const CANARY_DEADLINE_TEXT = `CANARY_DEADLINE_${canarySalt}_${randomUUID()}`;

  const allCanaries = [
    CANARY_INTERNAL_TITLE,
    CANARY_INTERNAL_DESC,
    CANARY_INTERNAL_NOTES,
    CANARY_ASSIGNEE_NAME,
    CANARY_DEADLINE_TEXT,
  ];

  beforeAll(async () => {
    testApp = await createTestApp();

    adminUser = await signedInCookie(testApp.test, {
      name: "Canary Admin",
      email: "canary-admin@roadmap.test",
      emailVerified: true,
    });

    assigneeUser = await signedInCookie(testApp.test, {
      name: CANARY_ASSIGNEE_NAME,
      email: `assignee-${canarySalt}@roadmap.test`,
      emailVerified: true,
    });

    wsSlug = `ws-canary-${canarySalt}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Canary Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values([
      {
        workspaceId: ws.id,
        userId: adminUser.userId,
        role: "owner",
      },
      {
        workspaceId: ws.id,
        userId: assigneeUser.userId,
        role: "admin",
      },
    ]);

    prodSlug = `prod-canary-${canarySalt}`;
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Canary Product",
      })
      .returning();
    prodId = prod.id;

    // Create public status
    const [status] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prodId,
        name: "Planned Public",
        color: "#2563EB",
        type: "planned",
        position: 0,
        isPublicRoadmap: true,
      })
      .returning();

    // Create public roadmap item with planted canary values in internal table
    const [item] = await testApp.db
      .insert(schema.roadmapItems)
      .values({
        productId: prodId,
        statusId: status.id,
        publicTitle: "Safe Public Roadmap Title",
        publicDescription: "Safe public roadmap description for customers.",
        isPublic: true,
        rank: "a0",
      })
      .returning();
    roadmapItemId = item.id;

    await testApp.db.insert(schema.roadmapItemInternals).values({
      itemId: item.id,
      productId: prodId,
      internalTitle: CANARY_INTERNAL_TITLE,
      internalDescription: CANARY_INTERNAL_DESC,
      internalNotes: CANARY_INTERNAL_NOTES,
      assigneeId: assigneeUser.userId,
      deadlineText: CANARY_DEADLINE_TEXT,
      deadlineDate: new Date("2026-12-31"),
    });

    // Create a linked feedback post
    postNumber = 1;
    await testApp.db.insert(schema.posts).values({
      productId: prodId,
      number: postNumber,
      title: "Linked Public Post",
      description: "Public post description",
      statusId: status.id,
      authorId: adminUser.userId,
      roadmapItemId: item.id,
      voteCount: 7,
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("never leaks any internal roadmap field into GET /portal/:ws/:product/roadmap", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    const bodyText = res.text;

    for (const canary of allCanaries) {
      expect(bodyText).not.toContain(canary);
    }
  });

  it("never leaks any internal roadmap field into GET /portal/:ws/:product/roadmap/:id", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/roadmap/${roadmapItemId}`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    const bodyText = res.text;

    for (const canary of allCanaries) {
      expect(bodyText).not.toContain(canary);
    }
  });

  it("never leaks any internal roadmap field into GET /portal/:ws/:product/posts", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    const bodyText = res.text;

    for (const canary of allCanaries) {
      expect(bodyText).not.toContain(canary);
    }
  });

  it("never leaks any internal roadmap field into GET /portal/:ws/:product/posts/:number", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    const bodyText = res.text;

    for (const canary of allCanaries) {
      expect(bodyText).not.toContain(canary);
    }
  });

  it("never leaks any internal roadmap field into GET /portal/:ws/:product", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(200);
    const bodyText = res.text;

    for (const canary of allCanaries) {
      expect(bodyText).not.toContain(canary);
    }
  });
});
