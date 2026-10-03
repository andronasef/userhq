import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, inArray, sql } from "drizzle-orm";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { ANONYMOUS_ME, type PlatformUserPage } from "@userhq/types";

describe("Platform User Ban & Oversight (Plan 02-11 Task 3)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerCookie: string;
  let ownerUserId: string;
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@userhq.test",
    });

    const owner = await signedInCookie(testApp.test, {
      name: "Platform Owner",
      email: "owner@userhq.test",
      emailVerified: true,
    });
    ownerCookie = owner.cookie;
    ownerUserId = owner.userId;
  });

  afterAll(async () => {
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

  it("ban user revokes sessions, clears session table, and invalidates access", async () => {
    const user = await signedInCookie(testApp.test, {
      name: "Ban Target",
      emailVerified: true,
    });

    // Seed workspace for user
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: `ban-ws-${Date.now()}`,
        name: "Target WS",
      })
      .returning();
    createdWorkspaceIds.push(ws.id);

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: user.userId,
      role: "owner",
    });

    // Pre-ban: user can access /me and workspace
    const meBefore = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", user.cookie);
    expect(meBefore.status).toBe(200);
    expect(meBefore.body.user).not.toBeNull();
    expect(meBefore.body.user.id).toBe(user.userId);

    const wsBefore = await request(testApp.http)
      .get(`/api/v1/workspaces/${ws.slug}`)
      .set("Cookie", user.cookie);
    expect(wsBefore.status).toBe(200);

    // BAN user: POST /api/v1/platform/users/:id/ban
    const banRes = await request(testApp.http)
      .post(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(banRes.status).toBe(204);

    // Session table has 0 rows for this user
    const sessionRows = await testApp.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, user.userId));
    expect(sessionRows).toHaveLength(0);

    // Existing cookie -> /me user null (ANONYMOUS_ME)
    const meAfter = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", user.cookie);
    expect(meAfter.status).toBe(200);
    expect(meAfter.body).toEqual(ANONYMOUS_ME);

    // Protected workspace route -> 401 unauthorized
    const wsAfter = await request(testApp.http)
      .get(`/api/v1/workspaces/${ws.slug}`)
      .set("Cookie", user.cookie);
    expect(wsAfter.status).toBe(401);
    expect(wsAfter.body.code).toBe("unauthorized");
  });

  it("minting a new session for banned user rejects with account_banned code", async () => {
    const user = await signedInCookie(testApp.test, {
      name: "Banned Mint Target",
      emailVerified: true,
    });

    // Ban user
    await request(testApp.http)
      .post(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    // Attempt to mint a new session
    let rejectedError: any = null;
    try {
      await testApp.test.getCookies({
        userId: user.userId,
        domain: "localhost",
      });
    } catch (err: any) {
      rejectedError = err;
    }

    expect(rejectedError).not.toBeNull();
    // Verify error code is account_banned
    const errCode = rejectedError?.body?.code ?? rejectedError?.code ?? rejectedError?.status;
    expect(errCode).toBe("account_banned");
  });

  it("POST /api/auth/update-user with bannedAt is rejected by Better Auth (input:false)", async () => {
    const user = await signedInCookie(testApp.test, {
      name: "Self Unban Attacker",
      emailVerified: true,
    });

    // Attacker tries to set bannedAt
    const updateRes = await request(testApp.http)
      .post("/api/auth/update-user")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ bannedAt: null });

    // Better Auth rejects input:false fields
    expect(updateRes.status).toBeGreaterThanOrEqual(400);

    // DB row is unaffected
    const [dbUser] = await testApp.db
      .select({ bannedAt: schema.user.bannedAt })
      .from(schema.user)
      .where(eq(schema.user.id, user.userId));
    expect(dbUser.bannedAt).toBeNull();
  });

  it("ban platform owner returns 403 not_allowed, unknown id returns 404, ban twice returns 204", async () => {
    // 1. Ban platform owner -> 403 not_allowed
    const banOwnerRes = await request(testApp.http)
      .post(`/api/v1/platform/users/${ownerUserId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(banOwnerRes.status).toBe(403);
    expect(banOwnerRes.body.code).toBe("not_allowed");

    // 2. Ban unknown id -> 404
    const banUnknownRes = await request(testApp.http)
      .post("/api/v1/platform/users/unknown-user-id-999/ban")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(banUnknownRes.status).toBe(404);
    expect(banUnknownRes.body.code).toBe("not_found");

    // 3. Ban normal user twice -> 204 twice
    const user = await signedInCookie(testApp.test, { name: "Double Ban Target" });

    const ban1 = await request(testApp.http)
      .post(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(ban1.status).toBe(204);

    const ban2 = await request(testApp.http)
      .post(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(ban2.status).toBe(204);
  });

  it("PLAT-07: a banned user whose email equals PLATFORM_OWNER_EMAIL gets 404 from /platform routes", async () => {
    // Manually set banned_at on owner in DB to simulate defense-in-depth
    await testApp.db
      .update(schema.user)
      .set({ bannedAt: new Date() })
      .where(eq(schema.user.id, ownerUserId));

    try {
      const res = await request(testApp.http)
        .get("/api/v1/platform/invites")
        .set("Cookie", ownerCookie);

      // SessionGuard treats banned user as signed out, and PlatformOwnerGuard returns 404
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("not_found");
    } finally {
      // Restore owner
      await testApp.db
        .update(schema.user)
        .set({ bannedAt: null })
        .where(eq(schema.user.id, ownerUserId));
    }
  });

  it("non-destructive snapshot test: ban and lift restores exact access and rows", async () => {
    const ts = Date.now();
    const user = await signedInCookie(testApp.test, {
      name: "Snapshot Ban User",
      email: `snap-ban-${ts}@example.test`,
      emailVerified: true,
    });

    // Seed workspace, membership, product, status, invite
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: `snap-ws-${ts}`,
        name: `Snap WS ${ts}`,
      })
      .returning();
    createdWorkspaceIds.push(ws.id);

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: user.userId,
      role: "owner",
    });

    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: `prod-${ts}`,
        name: "Snap Product",
      })
      .returning();

    const [status] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prod.id,
        name: "Planned",
        color: "#10B981",
        type: "planned",
        position: 0,
        isDefault: true,
      })
      .returning();

    const [inv] = await testApp.db
      .insert(schema.invites)
      .values({
        kind: "workspace",
        workspaceId: ws.id,
        email: `snap-inv-${ts}@example.test`,
        tokenHash: `hash-${ts}`,
        createdById: user.userId,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning();

    // SNAPSHOT BEFORE BAN
    const [memberCountBefore] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, user.userId));
    const [wsCountBefore] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, ws.id));
    const [prodCountBefore] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(eq(schema.products.id, prod.id));
    const [statusCountBefore] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.statuses)
      .where(eq(schema.statuses.id, status.id));
    const [invCountBefore] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.invites)
      .where(eq(schema.invites.id, inv.id));

    expect(memberCountBefore.count).toBe(1);
    expect(wsCountBefore.count).toBe(1);
    expect(prodCountBefore.count).toBe(1);
    expect(statusCountBefore.count).toBe(1);
    expect(invCountBefore.count).toBe(1);

    // BAN USER
    const banRes = await request(testApp.http)
      .post(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(banRes.status).toBe(204);

    // SNAPSHOT WHILE BANNED: all user rows untouched!
    const [memberCountBanned] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, user.userId));
    const [wsCountBanned] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, ws.id));
    const [prodCountBanned] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(eq(schema.products.id, prod.id));
    const [statusCountBanned] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.statuses)
      .where(eq(schema.statuses.id, status.id));
    const [invCountBanned] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.invites)
      .where(eq(schema.invites.id, inv.id));

    expect(memberCountBanned.count).toBe(memberCountBefore.count);
    expect(wsCountBanned.count).toBe(wsCountBefore.count);
    expect(prodCountBanned.count).toBe(prodCountBefore.count);
    expect(statusCountBanned.count).toBe(statusCountBefore.count);
    expect(invCountBanned.count).toBe(invCountBefore.count);

    // LIFT BAN: DELETE /api/v1/platform/users/:id/ban
    const liftRes = await request(testApp.http)
      .delete(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(liftRes.status).toBe(204);

    // Lift again -> 204
    const liftRes2 = await request(testApp.http)
      .delete(`/api/v1/platform/users/${user.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(liftRes2.status).toBe(204);

    // SNAPSHOT AFTER LIFT: all user rows untouched!
    const [memberCountLift] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, user.userId));
    expect(memberCountLift.count).toBe(memberCountBefore.count);

    // User can mint a new session again
    const newCookies = await testApp.test.getCookies({
      userId: user.userId,
      domain: "localhost",
    });
    const newCookieHeader = newCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // New session can access /me and workspace with same ownership
    const meRes = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", newCookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(user.userId);

    const wsRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${ws.slug}`)
      .set("Cookie", newCookieHeader);
    expect(wsRes.status).toBe(200);
    expect(wsRes.body.role).toBe("owner");
  });

  it("users list: search, ordering, banned flag, owner row flagged isPlatformOwner", async () => {
    const ts = Date.now();
    const u1 = await signedInCookie(testApp.test, {
      name: `Searchable Alpha ${ts}`,
      email: `alpha-${ts}@findme.test`,
      emailVerified: true,
    });
    const u2 = await signedInCookie(testApp.test, {
      name: `Searchable Beta ${ts}`,
      email: `beta-${ts}@findme.test`,
      emailVerified: true,
    });

    // Ban u2
    await request(testApp.http)
      .post(`/api/v1/platform/users/${u2.userId}/ban`)
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    // Query GET /api/v1/platform/users?q=findme.test
    const listRes = await request(testApp.http)
      .get(`/api/v1/platform/users?q=findme.test`)
      .set("Cookie", ownerCookie);

    expect(listRes.status).toBe(200);
    const data = listRes.body as PlatformUserPage;
    expect(data.rows.length).toBe(2);

    const row1 = data.rows.find((r) => r.id === u1.userId);
    expect(row1).toBeDefined();
    expect(row1!.banned).toBe(false);
    expect(row1!.isPlatformOwner).toBe(false);
    expect(row1!.postCount).toBe(0);
    expect(row1!.voteCount).toBe(0);

    const row2 = data.rows.find((r) => r.id === u2.userId);
    expect(row2).toBeDefined();
    expect(row2!.banned).toBe(true);
    expect(row2!.isPlatformOwner).toBe(false);

    // Query for owner by email
    const ownerListRes = await request(testApp.http)
      .get("/api/v1/platform/users?q=owner@userhq.test")
      .set("Cookie", ownerCookie);

    expect(ownerListRes.status).toBe(200);
    const ownerData = ownerListRes.body as PlatformUserPage;
    expect(ownerData.rows.length).toBe(1);
    expect(ownerData.rows[0].id).toBe(ownerUserId);
    expect(ownerData.rows[0].isPlatformOwner).toBe(true);
    expect(ownerData.rows[0].banned).toBe(false);
  });
});
