import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { inviteState, hashInviteToken } from "../src/invites/invites.service.js";
import type { InviteCreated, InviteRow } from "@userhq/types";

describe("Platform Owner Console & Invites API (Plan 02-05)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerCookie: string;
  let ownerUserId: string;
  let nonOwnerCookie: string;
  const createdInviteIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "platform-owner@userhq.test",
    });

    const owner = await signedInCookie(testApp.test, {
      name: "Platform Owner",
      email: "platform-owner@userhq.test",
      emailVerified: true,
    });
    ownerCookie = owner.cookie;
    ownerUserId = owner.userId;

    const nonOwner = await signedInCookie(testApp.test, {
      name: "Regular User",
      email: "regular@userhq.test",
      emailVerified: true,
    });
    nonOwnerCookie = nonOwner.cookie;
  });

  afterAll(async () => {
    if (createdInviteIds.length > 0) {
      await testApp.db
        .delete(schema.invites)
        .where(inArray(schema.invites.id, createdInviteIds));
    }
    if (createdWorkspaceIds.length > 0) {
      await testApp.db
        .delete(schema.workspaces)
        .where(inArray(schema.workspaces.id, createdWorkspaceIds));
    }
    await testApp.close();
  });

  describe("inviteState pure unit logic", () => {
    it("expires_at === now is expired, expires_at > now is pending", () => {
      const now = new Date(1700000000000);
      expect(
        inviteState({ usedAt: null, revokedAt: null, expiresAt: now }, now)
      ).toBe("expired");

      expect(
        inviteState(
          {
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(now.getTime() - 1),
          },
          now
        )
      ).toBe("expired");

      expect(
        inviteState(
          {
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(now.getTime() + 1),
          },
          now
        )
      ).toBe("pending");
    });

    it("revoked takes precedence over used, and used takes precedence over expired", () => {
      const past = new Date(1600000000000);
      const now = new Date(1700000000000);
      // Both revoked and used
      expect(
        inviteState({ usedAt: past, revokedAt: past, expiresAt: past }, now)
      ).toBe("revoked");

      // Used only
      expect(
        inviteState({ usedAt: past, revokedAt: null, expiresAt: past }, now)
      ).toBe("used");
    });
  });

  it("tracer: owner creates a platform invite and lists it", async () => {
    const postRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email: "Founder@Acme.example" });

    expect(postRes.status).toBe(201);
    const body = postRes.body as InviteCreated;
    expect(body.email).toBe("founder@acme.example");

    const tokenMatch = body.link.match(
      new RegExp(`^${testApp.env.PUBLIC_URL}/invite/([A-Za-z0-9_-]{43})$`)
    );
    expect(tokenMatch).not.toBeNull();
    const rawToken = tokenMatch![1];

    // Verify DB row
    const rows = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.email, "founder@acme.example"));

    expect(rows).toHaveLength(1);
    const dbRow = rows[0];
    createdInviteIds.push(dbRow.id);

    expect(dbRow.tokenHash).toBe(
      createHash("sha256").update(rawToken).digest("hex")
    );
    // Raw token is never stored in DB
    expect(JSON.stringify(dbRow)).not.toContain(rawToken);

    // Verify expires_at is roughly 7 days from now (± 1 minute)
    const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(dbRow.expiresAt.getTime() - expectedExpiry)).toBeLessThan(
      60_000
    );

    // GET /platform/invites
    const getRes = await request(testApp.http)
      .get("/api/v1/platform/invites")
      .set("Cookie", ownerCookie);

    expect(getRes.status).toBe(200);
    const list = getRes.body as InviteRow[];
    const item = list.find((i) => i.email === "founder@acme.example");
    expect(item).toBeDefined();
    expect(item!.state).toBe("pending");
    expect(item!.usedAt).toBeNull();
    expect(item!.revokedAt).toBeNull();
    expect(item!.usedByName).toBeNull();
    expect(item!.workspaceName).toBeNull();
  });

  describe("PLAT-07 404 Access Matrix", () => {
    const dummyId = "00000000-0000-0000-0000-000000000000";

    it("anonymous callers get 404 code not_found on GET, POST, DELETE", async () => {
      const getRes = await request(testApp.http).get("/api/v1/platform/invites");
      expect(getRes.status).toBe(404);
      expect(getRes.body.code).toBe("not_found");

      const postRes = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email: "test@example.com" });
      expect(postRes.status).toBe(404);
      expect(postRes.body.code).toBe("not_found");

      const delRes = await request(testApp.http)
        .delete(`/api/v1/platform/invites/${dummyId}`)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delRes.status).toBe(404);
      expect(delRes.body.code).toBe("not_found");
    });

    it("verified non-owners get 404 code not_found", async () => {
      const getRes = await request(testApp.http)
        .get("/api/v1/platform/invites")
        .set("Cookie", nonOwnerCookie);
      expect(getRes.status).toBe(404);
      expect(getRes.body.code).toBe("not_found");

      const postRes = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", nonOwnerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email: "test@example.com" });
      expect(postRes.status).toBe(404);
      expect(postRes.body.code).toBe("not_found");

      const delRes = await request(testApp.http)
        .delete(`/api/v1/platform/invites/${dummyId}`)
        .set("Cookie", nonOwnerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delRes.status).toBe(404);
      expect(delRes.body.code).toBe("not_found");
    });

    it("unverified-owner-email callers get 404 code not_found", async () => {
      await testApp.db
        .update(schema.user)
        .set({ emailVerified: false })
        .where(eq(schema.user.id, ownerUserId));

      try {
        const getRes = await request(testApp.http)
          .get("/api/v1/platform/invites")
          .set("Cookie", ownerCookie);
        expect(getRes.status).toBe(404);
        expect(getRes.body.code).toBe("not_found");

        const postRes = await request(testApp.http)
          .post("/api/v1/platform/invites")
          .set("Cookie", ownerCookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ email: "test@example.com" });
        expect(postRes.status).toBe(404);
        expect(postRes.body.code).toBe("not_found");

        const delRes = await request(testApp.http)
          .delete(`/api/v1/platform/invites/${dummyId}`)
          .set("Cookie", ownerCookie)
          .set("Origin", testApp.env.PUBLIC_URL);
        expect(delRes.status).toBe(404);
        expect(delRes.body.code).toBe("not_found");
      } finally {
        await testApp.db
          .update(schema.user)
          .set({ emailVerified: true })
          .where(eq(schema.user.id, ownerUserId));
      }
    });

    it("POST with foreign Origin as owner returns 403 forbidden", async () => {
      const postRes = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", ownerCookie)
        .set("Origin", "https://evil-attacker.com")
        .send({ email: "victim@example.com" });

      expect(postRes.status).toBe(403);
      expect(postRes.body.code).toBe("forbidden");
    });
  });

  describe("Validation, Idempotency & Concurrency", () => {
    it("POST not-an-email returns 400 invalid_email", async () => {
      const res = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email: "not-an-email" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid_email");
    });

    it("POST while invite is pending returns 409 invite_pending", async () => {
      const email = `pending-${Date.now()}@example.com`;
      const res1 = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      expect(res1.status).toBe(201);

      const res2 = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("invite_pending");
    });

    it("5 concurrent POSTs for the same email result in exactly one 201 and 4 409s", async () => {
      const email = `race-${Date.now()}@example.com`;
      const attempts = await Promise.all(
        Array.from({ length: 5 }).map(() =>
          request(testApp.http)
            .post("/api/v1/platform/invites")
            .set("Cookie", ownerCookie)
            .set("Origin", testApp.env.PUBLIC_URL)
            .send({ email })
        )
      );

      const statuses = attempts.map((a) => a.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);

      const rows = await testApp.db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.email, email));
      expect(rows).toHaveLength(1);
      createdInviteIds.push(rows[0].id);
    });
  });

  describe("Revoke & Re-inviting", () => {
    it("owner revokes a pending invite, then can invite the same email again", async () => {
      const email = `revokable-${Date.now()}@example.com`;
      const createRes = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      expect(createRes.status).toBe(201);
      const rows = await testApp.db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.email, email));
      const inviteId = rows[0].id;
      createdInviteIds.push(inviteId);

      // Revoke
      const delRes = await request(testApp.http)
        .delete(`/api/v1/platform/invites/${inviteId}`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delRes.status).toBe(204);

      // Verify row revoked_at
      const updatedRows = await testApp.db
        .select()
        .from(schema.invites)
        .where(eq(schema.invites.id, inviteId));
      expect(updatedRows[0].revokedAt).not.toBeNull();

      // Second revoke on already-revoked invite returns 404
      const secondDel = await request(testApp.http)
        .delete(`/api/v1/platform/invites/${inviteId}`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(secondDel.status).toBe(404);

      // Re-inviting the same email now succeeds (201)
      const reInviteRes = await request(testApp.http)
        .post("/api/v1/platform/invites")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });
      expect(reInviteRes.status).toBe(201);
    });

    it("DELETE on malformed id returns 404 code not_found", async () => {
      const res = await request(testApp.http)
        .delete("/api/v1/platform/invites/not-a-uuid")
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("not_found");
    });
  });

  describe("Listing and Ordering", () => {
    it("orders by created_at desc, ties broken by id desc", async () => {
      // Seed workspace and user
      const wsSlug = `seed-ws-${Date.now()}`;
      const [seededWs] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: wsSlug,
          name: "Acme",
        })
        .returning();
      createdWorkspaceIds.push(seededWs.id);

      const [danaUser] = await testApp.db
        .insert(schema.user)
        .values({
          id: `dana-${Date.now()}`,
          name: "Dana",
          email: `dana-${Date.now()}@example.com`,
          emailVerified: true,
        })
        .returning();

      const baseTime = Date.now() - 100_000;

      // Seed 4 rows with distinct created_at
      // 1. Used invite
      const [usedInvite] = await testApp.db
        .insert(schema.invites)
        .values({
          kind: "platform",
          workspaceId: seededWs.id,
          email: "dana-used@example.com",
          tokenHash: hashInviteToken("token-used"),
          createdById: ownerUserId,
          expiresAt: new Date(baseTime + 100_000_000),
          usedAt: new Date(baseTime + 5000),
          usedById: danaUser.id,
          createdAt: new Date(baseTime + 1000),
        })
        .returning();

      // 2. Expired invite
      const [expiredInvite] = await testApp.db
        .insert(schema.invites)
        .values({
          kind: "platform",
          workspaceId: null,
          email: "expired@example.com",
          tokenHash: hashInviteToken("token-expired"),
          createdById: ownerUserId,
          expiresAt: new Date(baseTime - 1000),
          createdAt: new Date(baseTime + 2000),
        })
        .returning();

      // 3. Revoked invite
      const [revokedInvite] = await testApp.db
        .insert(schema.invites)
        .values({
          kind: "platform",
          workspaceId: null,
          email: "revoked@example.com",
          tokenHash: hashInviteToken("token-revoked"),
          createdById: ownerUserId,
          expiresAt: new Date(baseTime + 100_000_000),
          revokedAt: new Date(baseTime + 3000),
          createdAt: new Date(baseTime + 3000),
        })
        .returning();

      // 4. Pending invite
      const [pendingInvite] = await testApp.db
        .insert(schema.invites)
        .values({
          kind: "platform",
          workspaceId: null,
          email: "pending-seed@example.com",
          tokenHash: hashInviteToken("token-pending"),
          createdById: ownerUserId,
          expiresAt: new Date(Date.now() + 100_000_000),
          createdAt: new Date(baseTime + 4000),
        })
        .returning();

      createdInviteIds.push(
        usedInvite.id,
        expiredInvite.id,
        revokedInvite.id,
        pendingInvite.id
      );

      // DELETE on used and expired returns 404
      const delUsed = await request(testApp.http)
        .delete(`/api/v1/platform/invites/${usedInvite.id}`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delUsed.status).toBe(404);

      const delExpired = await request(testApp.http)
        .delete(`/api/v1/platform/invites/${expiredInvite.id}`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delExpired.status).toBe(404);

      // List all platform invites
      const getRes = await request(testApp.http)
        .get("/api/v1/platform/invites")
        .set("Cookie", ownerCookie);

      expect(getRes.status).toBe(200);
      const list = getRes.body as InviteRow[];

      const seededItems = list.filter((i) =>
        [usedInvite.id, expiredInvite.id, revokedInvite.id, pendingInvite.id].includes(
          i.id
        )
      );

      // Must be ordered newest first (pendingInvite, revokedInvite, expiredInvite, usedInvite)
      expect(seededItems.map((i) => i.id)).toEqual([
        pendingInvite.id,
        revokedInvite.id,
        expiredInvite.id,
        usedInvite.id,
      ]);

      const foundUsed = seededItems.find((i) => i.id === usedInvite.id)!;
      expect(foundUsed.state).toBe("used");
      expect(foundUsed.usedByName).toBe("Dana");
      expect(foundUsed.workspaceName).toBe("Acme");

      const foundExpired = seededItems.find((i) => i.id === expiredInvite.id)!;
      expect(foundExpired.state).toBe("expired");

      const foundRevoked = seededItems.find((i) => i.id === revokedInvite.id)!;
      expect(foundRevoked.state).toBe("revoked");

      const foundPending = seededItems.find((i) => i.id === pendingInvite.id)!;
      expect(foundPending.state).toBe("pending");
    });
  });
});
