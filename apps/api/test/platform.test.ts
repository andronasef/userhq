import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, inArray, sql } from "drizzle-orm";
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
        .delete(schema.statuses)
        .where(
          inArray(
            schema.statuses.productId,
            testApp.db
              .select({ id: schema.products.id })
              .from(schema.products)
              .where(inArray(schema.products.workspaceId, createdWorkspaceIds))
          )
        );
      await testApp.db
        .delete(schema.products)
        .where(inArray(schema.products.workspaceId, createdWorkspaceIds));
      await testApp.db
        .delete(schema.invites)
        .where(inArray(schema.invites.workspaceId, createdWorkspaceIds));
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

  describe("Workspaces Oversight & Detail (Plan 02-11 Task 1)", () => {
    it("tracer: owner lists workspaces with counts and opens one", async () => {
      const ts = Date.now();
      const wsSlug1 = `ws-trace1-${ts}`;
      const wsSlug2 = `ws-trace2-${ts}`;

      // Workspace 1: 2 products (1 live, 1 deleted), 2 members
      const [ws1] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: wsSlug1,
          name: `Alpha Tracer ${ts}`,
          createdAt: new Date(ts + 2000),
        })
        .returning();
      createdWorkspaceIds.push(ws1.id);

      // Workspace 2: 0 products, 1 member
      const [ws2] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: wsSlug2,
          name: `Beta Tracer ${ts}`,
          createdAt: new Date(ts + 1000),
        })
        .returning();
      createdWorkspaceIds.push(ws2.id);

      // Members for ws1
      const user1 = await signedInCookie(testApp.test, {
        name: "Trace User 1",
        emailVerified: true,
      });
      const user2 = await signedInCookie(testApp.test, {
        name: "Trace User 2",
        emailVerified: true,
      });

      await testApp.db.insert(schema.workspaceMembers).values([
        { workspaceId: ws1.id, userId: user1.userId, role: "owner", createdAt: new Date(ts + 2100) },
        { workspaceId: ws1.id, userId: user2.userId, role: "admin", createdAt: new Date(ts + 2200) },
        { workspaceId: ws2.id, userId: user1.userId, role: "owner", createdAt: new Date(ts + 1100) },
      ]);

      // Products for ws1: 1 live, 1 deleted
      const [prodLive] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: ws1.id,
          slug: `live-prod-${ts}`,
          name: "Live Product",
          createdAt: new Date(ts + 2300),
        })
        .returning();

      const [prodDeleted] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: ws1.id,
          slug: `del-prod-${ts}`,
          name: "Deleted Product",
          deletedAt: new Date(ts + 2400),
          createdAt: new Date(ts + 2350),
        })
        .returning();

      // Owner queries GET /api/v1/platform/workspaces?q=Tracer {ts}
      const listRes = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=Tracer ${ts}`)
        .set("Cookie", ownerCookie);

      expect(listRes.status).toBe(200);
      const listData = listRes.body;
      expect(listData.rows.length).toBe(2);

      // Newest first
      expect(listData.rows[0].id).toBe(ws1.id);
      expect(listData.rows[1].id).toBe(ws2.id);

      // ws1 counts: productCount 1 (deleted excluded), memberCount 2, postCount 0, voteCount 0
      expect(listData.rows[0].productCount).toBe(1);
      expect(listData.rows[0].memberCount).toBe(2);
      expect(listData.rows[0].postCount).toBe(0);
      expect(listData.rows[0].voteCount).toBe(0);
      expect(listData.rows[0].suspended).toBe(false);

      // ws2 counts: productCount 0, memberCount 1, postCount 0, voteCount 0
      expect(listData.rows[1].productCount).toBe(0);
      expect(listData.rows[1].memberCount).toBe(1);
      expect(listData.rows[1].postCount).toBe(0);
      expect(listData.rows[1].voteCount).toBe(0);

      // Detail: GET /api/v1/platform/workspaces/:id
      const detailRes = await request(testApp.http)
        .get(`/api/v1/platform/workspaces/${ws1.id}`)
        .set("Cookie", ownerCookie);

      expect(detailRes.status).toBe(200);
      const detail = detailRes.body;
      expect(detail.id).toBe(ws1.id);
      expect(detail.name).toBe(`Alpha Tracer ${ts}`);
      expect(detail.productCount).toBe(1);
      expect(detail.memberCount).toBe(2);

      // Products include deleted with live flags
      expect(detail.products.length).toBe(2);
      const liveP = detail.products.find((p: any) => p.slug === prodLive.slug);
      expect(liveP).toBeDefined();
      expect(liveP.live).toBe(true);
      expect(liveP.postCount).toBe(0);
      expect(liveP.voteCount).toBe(0);

      const delP = detail.products.find((p: any) => p.slug === prodDeleted.slug);
      expect(delP).toBeDefined();
      expect(delP.live).toBe(false);

      // Members
      expect(detail.members.length).toBe(2);
      const m1 = detail.members.find((m: any) => m.name === "Trace User 1");
      expect(m1).toBeDefined();
      expect(m1.role).toBe("owner");
      const m2 = detail.members.find((m: any) => m.name === "Trace User 2");
      expect(m2).toBeDefined();
      expect(m2.role).toBe("admin");
    });

    it("PLAT-04: 50 vs 51 boundary pagination", async () => {
      const ts = Date.now();
      const prefix = `boundary-${ts}`;

      // Seed 51 workspaces
      const values = Array.from({ length: 51 }, (_, i) => ({
        slug: `bws-${i}-${ts}`,
        name: `${prefix} WS ${i.toString().padStart(2, "0")}`,
        createdAt: new Date(ts + i * 100),
      }));

      const inserted = await testApp.db
        .insert(schema.workspaces)
        .values(values)
        .returning();
      createdWorkspaceIds.push(...inserted.map((w) => w.id));

      // Page 1 with 51 matches -> exactly 50 rows, hasNext: true
      const page1Res = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=${prefix}&page=1`)
        .set("Cookie", ownerCookie);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.rows.length).toBe(50);
      expect(page1Res.body.page).toBe(1);
      expect(page1Res.body.hasNext).toBe(true);

      // Page 2 with 51 matches -> exactly 1 row (the 51st), hasNext: false
      const page2Res = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=${prefix}&page=2`)
        .set("Cookie", ownerCookie);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.rows.length).toBe(1);
      expect(page2Res.body.page).toBe(2);
      expect(page2Res.body.hasNext).toBe(false);

      // Now delete the 51st workspace so exactly 50 matching rows remain
      await testApp.db
        .delete(schema.workspaces)
        .where(eq(schema.workspaces.id, inserted[0].id));
      const idx = createdWorkspaceIds.indexOf(inserted[0].id);
      if (idx !== -1) createdWorkspaceIds.splice(idx, 1);

      // Exactly 50 matches -> 50 rows, hasNext: false
      const pageExact50Res = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=${prefix}&page=1`)
        .set("Cookie", ownerCookie);

      expect(pageExact50Res.status).toBe(200);
      expect(pageExact50Res.body.rows.length).toBe(50);
      expect(pageExact50Res.body.hasNext).toBe(false);
    });

    it("PLAT-04: wildcard escapes (% and _) and query validation", async () => {
      const ts = Date.now();
      const [wsPercent] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: `pct-${ts}`,
          name: `Special 100% Promo ${ts}`,
        })
        .returning();
      createdWorkspaceIds.push(wsPercent.id);

      const [wsUnder] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: `und-${ts}`,
          name: `Special a_b Group ${ts}`,
        })
        .returning();
      createdWorkspaceIds.push(wsUnder.id);

      const [wsNormal] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: `norm-${ts}`,
          name: `Special axb Normal ${ts}`,
        })
        .returning();
      createdWorkspaceIds.push(wsNormal.id);

      // Search "% Promo" -> should match only wsPercent
      const resPct = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=% Promo ${ts}`)
        .set("Cookie", ownerCookie);
      expect(resPct.status).toBe(200);
      expect(resPct.body.rows.length).toBe(1);
      expect(resPct.body.rows[0].id).toBe(wsPercent.id);

      // Search "a_b Group" -> should match ONLY wsUnder, NOT wsNormal
      const resUnder = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=a_b Group ${ts}`)
        .set("Cookie", ownerCookie);
      expect(resUnder.status).toBe(200);
      expect(resUnder.body.rows.length).toBe(1);
      expect(resUnder.body.rows[0].id).toBe(wsUnder.id);

      // Search with 101 characters -> 400 validation_failed
      const longQ = "a".repeat(101);
      const resLong = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=${longQ}`)
        .set("Cookie", ownerCookie);
      expect(resLong.status).toBe(400);
      expect(resLong.body.code).toBe("validation_failed");

      // No match search -> empty array, hasNext false
      const resNone = await request(testApp.http)
        .get(`/api/v1/platform/workspaces?q=nonexistent-term-random-string-${ts}`)
        .set("Cookie", ownerCookie);
      expect(resNone.status).toBe(200);
      expect(resNone.body.rows).toEqual([]);
      expect(resNone.body.hasNext).toBe(false);
    });

    it("GET platform/workspaces/:id returns 404 for malformed or unknown id", async () => {
      const malformedRes = await request(testApp.http)
        .get("/api/v1/platform/workspaces/not-a-valid-uuid")
        .set("Cookie", ownerCookie);
      expect(malformedRes.status).toBe(404);
      expect(malformedRes.body.code).toBe("not_found");

      const unknownRes = await request(testApp.http)
        .get("/api/v1/platform/workspaces/00000000-0000-0000-0000-000000000000")
        .set("Cookie", ownerCookie);
      expect(unknownRes.status).toBe(404);
      expect(unknownRes.body.code).toBe("not_found");
    });
  });

  describe("Workspace Suspension & Lift (Plan 02-11 Task 2)", () => {
    it("suspend and lift is non-destructive snapshot and restores exact access", async () => {
      const ts = Date.now();
      const wsSlug = `sus-ws-${ts}`;

      // 1. Seed workspace
      const [ws] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: wsSlug,
          name: `Suspended Workspace ${ts}`,
        })
        .returning();
      createdWorkspaceIds.push(ws.id);

      // 2. Seed owner and admin member
      const wsOwner = await signedInCookie(testApp.test, {
        name: "WS Owner",
        email: `ws-owner-${ts}@example.com`,
        emailVerified: true,
      });
      const wsAdmin = await signedInCookie(testApp.test, {
        name: "WS Admin",
        email: `ws-admin-${ts}@example.com`,
        emailVerified: true,
      });

      await testApp.db.insert(schema.workspaceMembers).values([
        { workspaceId: ws.id, userId: wsOwner.userId, role: "owner" },
        { workspaceId: ws.id, userId: wsAdmin.userId, role: "admin" },
      ]);

      // 3. Seed product and default status
      const [prod] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: ws.id,
          slug: `app-${ts}`,
          name: "Main App",
        })
        .returning();

      await testApp.db
        .insert(schema.statuses)
        .values({
          productId: prod.id,
          name: "Backlog",
          color: "#2563EB",
          type: "review",
          position: 0,
          isDefault: true,
        })
        .returning();

      // 4. Seed teammate invite
      const inviteEmail = `invited-mate-${ts}@example.com`;
      const createInvRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${ws.slug}/invites`)
        .set("Cookie", wsOwner.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email: inviteEmail });

      expect(createInvRes.status).toBe(201);
      const inviteToken = createInvRes.body.link.split("/invite/")[1];

      // SNAPSHOT BEFORE SUSPEND
      const [membersCountBefore] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, ws.id));
      const [productsCountBefore] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, ws.id));
      const [statusesCountBefore] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.statuses)
        .where(eq(schema.statuses.productId, prod.id));
      const [invitesCountBefore] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.invites)
        .where(eq(schema.invites.workspaceId, ws.id));

      expect(membersCountBefore.count).toBe(2);
      expect(productsCountBefore.count).toBe(1);
      expect(statusesCountBefore.count).toBe(1);
      expect(invitesCountBefore.count).toBe(1);

      // SUSPEND: POST /platform/workspaces/:id/suspend
      const suspendRes1 = await request(testApp.http)
        .post(`/api/v1/platform/workspaces/${ws.id}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(suspendRes1.status).toBe(204);

      // Suspend again -> 204 idempotent
      const suspendRes2 = await request(testApp.http)
        .post(`/api/v1/platform/workspaces/${ws.id}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(suspendRes2.status).toBe(204);

      // SNAPSHOT AFTER SUSPEND (strictly identical)
      const [membersCountSus] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, ws.id));
      const [productsCountSus] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, ws.id));
      const [statusesCountSus] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.statuses)
        .where(eq(schema.statuses.productId, prod.id));
      const [invitesCountSus] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.invites)
        .where(eq(schema.invites.workspaceId, ws.id));

      expect(membersCountSus.count).toBe(membersCountBefore.count);
      expect(productsCountSus.count).toBe(productsCountBefore.count);
      expect(statusesCountSus.count).toBe(statusesCountBefore.count);
      expect(invitesCountSus.count).toBe(invitesCountBefore.count);

      // VERIFY LOCKED ACCESS (403 workspace_suspended on all workspace routes)
      // 1. GET /workspaces/:ws
      const getWsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}`)
        .set("Cookie", wsAdmin.cookie);
      expect(getWsRes.status).toBe(403);
      expect(getWsRes.body.code).toBe("workspace_suspended");

      // 2. GET /workspaces/:ws/members
      const getMembersRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}/members`)
        .set("Cookie", wsAdmin.cookie);
      expect(getMembersRes.status).toBe(403);
      expect(getMembersRes.body.code).toBe("workspace_suspended");

      // 3. GET /workspaces/:ws/invites
      const getInvitesRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}/invites`)
        .set("Cookie", wsAdmin.cookie);
      expect(getInvitesRes.status).toBe(403);
      expect(getInvitesRes.body.code).toBe("workspace_suspended");

      // 4. GET /workspaces/:ws/products
      const getProductsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}/products`)
        .set("Cookie", wsAdmin.cookie);
      expect(getProductsRes.status).toBe(403);
      expect(getProductsRes.body.code).toBe("workspace_suspended");

      // 5. GET /workspaces/:ws/products/:prod/statuses
      const getStatusesRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}/products/${prod.slug}/statuses`)
        .set("Cookie", wsAdmin.cookie);
      expect(getStatusesRes.status).toBe(403);
      expect(getStatusesRes.body.code).toBe("workspace_suspended");

      // 6. Non-member gets 404 not_found
      const outsider = await signedInCookie(testApp.test, {
        name: "Outsider",
        emailVerified: true,
      });
      const outsiderRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}`)
        .set("Cookie", outsider.cookie);
      expect(outsiderRes.status).toBe(404);
      expect(outsiderRes.body.code).toBe("not_found");

      // 7. Portal API -> 403 workspace_suspended
      const portalDirRes = await request(testApp.http)
        .get(`/api/v1/portal/${ws.slug}`);
      expect(portalDirRes.status).toBe(403);
      expect(portalDirRes.body.code).toBe("workspace_suspended");

      const portalProdRes = await request(testApp.http)
        .get(`/api/v1/portal/${ws.slug}/${prod.slug}`);
      expect(portalProdRes.status).toBe(403);
      expect(portalProdRes.body.code).toBe("workspace_suspended");

      // 8. Accepting teammate invite -> 403 workspace_suspended
      const invitedUser = await signedInCookie(testApp.test, {
        name: "Invited Teammate",
        email: inviteEmail,
        emailVerified: true,
      });
      const claimRes = await request(testApp.http)
        .post(`/api/v1/invites/${inviteToken}/accept`)
        .set("Cookie", invitedUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(claimRes.status).toBe(403);
      expect(claimRes.body.code).toBe("workspace_suspended");

      // LIFT SUSPENSION: DELETE /platform/workspaces/:id/suspend
      const liftRes1 = await request(testApp.http)
        .delete(`/api/v1/platform/workspaces/${ws.id}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(liftRes1.status).toBe(204);

      // Lift again -> 204 idempotent
      const liftRes2 = await request(testApp.http)
        .delete(`/api/v1/platform/workspaces/${ws.id}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(liftRes2.status).toBe(204);

      // SNAPSHOT AFTER LIFT (strictly identical)
      const [membersCountLift] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.workspaceMembers)
        .where(eq(schema.workspaceMembers.workspaceId, ws.id));
      const [productsCountLift] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, ws.id));
      const [statusesCountLift] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.statuses)
        .where(eq(schema.statuses.productId, prod.id));
      const [invitesCountLift] = await testApp.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.invites)
        .where(eq(schema.invites.workspaceId, ws.id));

      expect(membersCountLift.count).toBe(membersCountBefore.count);
      expect(productsCountLift.count).toBe(productsCountBefore.count);
      expect(statusesCountLift.count).toBe(statusesCountBefore.count);
      expect(invitesCountLift.count).toBe(invitesCountBefore.count);

      // RESTORED ACCESS
      const restoredWsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${ws.slug}`)
        .set("Cookie", wsAdmin.cookie);
      expect(restoredWsRes.status).toBe(200);
      expect(restoredWsRes.body.role).toBe("admin");

      const restoredPortalRes = await request(testApp.http)
        .get(`/api/v1/portal/${ws.slug}`);
      expect(restoredPortalRes.status).toBe(200);

      // Claim invite now succeeds
      const restoredClaimRes = await request(testApp.http)
        .post(`/api/v1/invites/${inviteToken}/accept`)
        .set("Cookie", invitedUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(restoredClaimRes.status).toBe(200);
      expect(restoredClaimRes.body.workspaceSlug).toBe(ws.slug);
    });

    it("suspending and lifting on unknown or invalid id returns 404", async () => {
      const malformedId = "not-a-valid-uuid";
      const unknownId = "00000000-0000-0000-0000-000000000000";

      // POST suspend
      const malformedPost = await request(testApp.http)
        .post(`/api/v1/platform/workspaces/${malformedId}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(malformedPost.status).toBe(404);

      const unknownPost = await request(testApp.http)
        .post(`/api/v1/platform/workspaces/${unknownId}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(unknownPost.status).toBe(404);

      // DELETE suspend
      const malformedDel = await request(testApp.http)
        .delete(`/api/v1/platform/workspaces/${malformedId}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(malformedDel.status).toBe(404);

      const unknownDel = await request(testApp.http)
        .delete(`/api/v1/platform/workspaces/${unknownId}/suspend`)
        .set("Cookie", ownerCookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(unknownDel.status).toBe(404);
    });
  });
});

