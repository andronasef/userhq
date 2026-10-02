import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import {
  slugify,
  RESERVED_WORKSPACE_SLUGS,
  type MeResponse,
} from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Workspaces API (Plan 02-03)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerCookie: string;

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@example.test",
    });

    const owner = await signedInCookie(testApp.test, {
      name: "Platform Owner",
      email: "owner@example.test",
      emailVerified: true,
    });
    ownerCookie = owner.cookie;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: platform owner creates a workspace and reads it back", async () => {
    const createRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Acme Corp", slug: "acme" });

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual({ slug: "acme" });

    const getRes = await request(testApp.http)
      .get("/api/v1/workspaces/acme")
      .set("Cookie", ownerCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({
      slug: "acme",
      name: "Acme Corp",
      logoUrl: null,
      role: "owner",
    });

    const meRes = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", ownerCookie);

    expect(meRes.status).toBe(200);
    const meBody = meRes.body as MeResponse;
    expect(meBody.isPlatformOwner).toBe(true);
    expect(meBody.canCreateWorkspace).toBe(true);
    expect(meBody.workspaces).toContainEqual({
      slug: "acme",
      name: "Acme Corp",
      logoUrl: null,
      role: "owner",
    });
  });

  it("non-owner POST /api/v1/workspaces returns 403 not_allowed", async () => {
    const nonOwner = await signedInCookie(testApp.test, {
      name: "Regular User",
      email: "user@example.test",
      emailVerified: true,
    });

    const res = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", nonOwner.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "User Workspace", slug: "user-ws" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("not_allowed");
  });

  it("anonymous POST /api/v1/workspaces returns 401 unauthorized", async () => {
    const res = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Anon Workspace", slug: "anon-ws" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("unauthorized");
  });

  it("unverified user with platform owner email cannot create workspace", async () => {
    await testApp.db
      .update(schema.user)
      .set({ emailVerified: false })
      .where(eq(schema.user.email, "owner@example.test"));

    try {
      const meRes = await request(testApp.http)
        .get("/api/v1/me")
        .set("Cookie", ownerCookie);
      expect(meRes.status).toBe(200);
      expect(meRes.body.isPlatformOwner).toBe(false);

      const postRes = await request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Fake WS", slug: "fake-ws" });
      expect(postRes.status).toBe(403);
      expect(postRes.body.code).toBe("not_allowed");
    } finally {
      await testApp.db
        .update(schema.user)
        .set({ emailVerified: true })
        .where(eq(schema.user.email, "owner@example.test"));
    }
  });

  it("uppercase OWNER@EXAMPLE.TEST verified is recognized as platform owner", async () => {
    await testApp.db
      .update(schema.user)
      .set({ email: "OWNER@EXAMPLE.TEST" })
      .where(eq(schema.user.email, "owner@example.test"));

    try {
      const meRes = await request(testApp.http)
        .get("/api/v1/me")
        .set("Cookie", ownerCookie);
      expect(meRes.status).toBe(200);
      expect(meRes.body.isPlatformOwner).toBe(true);
    } finally {
      await testApp.db
        .update(schema.user)
        .set({ email: "owner@example.test" })
        .where(eq(schema.user.email, "OWNER@EXAMPLE.TEST"));
    }
  });

  it("platform owner who is not a member of workspace B gets 404", async () => {
    const otherUser = await signedInCookie(testApp.test, {
      name: "Other User",
      email: "other@example.test",
      emailVerified: true,
    });

    const [wsB] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: "ws-b",
        name: "Workspace B",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsB.id,
      userId: otherUser.userId,
      role: "owner",
    });

    const res = await request(testApp.http)
      .get("/api/v1/workspaces/ws-b")
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });

  it("member of suspended workspace gets 403, non-member gets 404", async () => {
    const member = await signedInCookie(testApp.test, {
      name: "Suspended Member",
      emailVerified: true,
    });

    const nonMember = await signedInCookie(testApp.test, {
      name: "Suspended Non-Member",
      emailVerified: true,
    });

    const [susWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: "suspended-org",
        name: "Suspended Org",
        suspendedAt: new Date(),
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: susWs.id,
      userId: member.userId,
      role: "owner",
    });

    const memberRes = await request(testApp.http)
      .get("/api/v1/workspaces/suspended-org")
      .set("Cookie", member.cookie);
    expect(memberRes.status).toBe(403);
    expect(memberRes.body.code).toBe("workspace_suspended");

    const nonMemberRes = await request(testApp.http)
      .get("/api/v1/workspaces/suspended-org")
      .set("Cookie", nonMember.cookie);
    expect(nonMemberRes.status).toBe(404);
    expect(nonMemberRes.body.code).toBe("not_found");
  });

  describe("Validation errors", () => {
    for (const reserved of RESERVED_WORKSPACE_SLUGS) {
      it(`reserved slug '${reserved}' returns 400 slug_reserved`, async () => {
        const res = await request(testApp.http)
          .post("/api/v1/workspaces")
          .set("Cookie", ownerCookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ name: "Valid Name", slug: reserved });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("slug_reserved");
      });
    }

    const invalidSlugs = ["Acme", "-acme", "acme-", "a", "a".repeat(33), ""];
    for (const inv of invalidSlugs) {
      it(`invalid slug '${inv}' returns 400 slug_invalid`, async () => {
        const res = await request(testApp.http)
          .post("/api/v1/workspaces")
          .set("Cookie", ownerCookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ name: "Valid Name", slug: inv });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("slug_invalid");
      });
    }

    it("empty name returns 400 name_required", async () => {
      const res = await request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "   ", slug: "valid-slug" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("name_required");
    });

    it("name over 50 chars returns 400 name_too_long", async () => {
      const res = await request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "A".repeat(51), slug: "valid-slug" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("name_too_long");
    });

    it("body containing role:'admin' or workspaceId is stripped, creator is still owner", async () => {
      const res = await request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          name: "Stripped Body",
          slug: "stripped-body",
          role: "admin",
          workspaceId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(201);

      const getRes = await request(testApp.http)
        .get("/api/v1/workspaces/stripped-body")
        .set("Cookie", ownerCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.role).toBe("owner");
    });
  });

  describe("Idempotency & Concurrency", () => {
    it("sequential create with same slug returns 201 then 409 slug_taken", async () => {
      const res1 = await request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Seq WS", slug: "seq-ws" });
      expect(res1.status).toBe(201);

      const res2 = await request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Seq WS", slug: "seq-ws" });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("slug_taken");
    });

    it("concurrent create with same slug yields [201, 409] and single row", async () => {
      const slug = "concurrent-ws";
      const [resA, resB] = await Promise.all([
        request(testApp.http)
          .post("/api/v1/workspaces")
          .set("Cookie", ownerCookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ name: "Concurrent WS", slug }),
        request(testApp.http)
          .post("/api/v1/workspaces")
          .set("Cookie", ownerCookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ name: "Concurrent WS", slug }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const wsRows = await testApp.db
        .select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.slug, slug));
      expect(wsRows).toHaveLength(1);

      const memberRows = await testApp.db
        .select()
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, wsRows[0].id));
      expect(memberRows).toHaveLength(1);
      expect(memberRows[0].role).toBe("owner");
    });
  });

  describe("slugify behavior", () => {
    it("decomposes diacritics: Café Été -> cafe-ete", () => {
      expect(slugify("Café Été")).toBe("cafe-ete");
    });

    it("handles punctuation and spaces:   Hello,  World!!  -> hello-world", () => {
      expect(slugify("  Hello,  World!! ")).toBe("hello-world");
    });

    it("truncates to 32 chars without trailing hyphen", () => {
      const longName = "A Very Long Workspace Name That Exceeds Thirty Two Characters";
      const result = slugify(longName);
      expect(result.length).toBeLessThanOrEqual(32);
      expect(result.endsWith("-")).toBe(false);
    });
  });
});
