import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { maskEmail, hashInviteToken } from "../src/invites/invites.service.js";

describe("Invites API & Consumption (Plan 02-06)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerCookie: string;
  let ownerUserId: string;
  const createdInviteIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdUploadIds: string[] = [];

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
    if (createdUploadIds.length > 0) {
      await testApp.db
        .delete(schema.uploads)
        .where(inArray(schema.uploads.id, createdUploadIds));
    }
    await testApp.close();
  });

  describe("maskEmail unit tests", () => {
    it("masks email to first character + ••• + @ + domain", () => {
      expect(maskEmail("holder@acme.example")).toBe("h•••@acme.example");
      expect(maskEmail("alice@example.com")).toBe("a•••@example.com");
      expect(maskEmail("b@domain.org")).toBe("b•••@domain.org");
    });
  });

  it("tracer: platform invite holder creates a workspace and the invite is used", async () => {
    const holderEmail = `holder-${Date.now()}@acme.example`;
    const holderSlug = `acme-${Date.now()}`;

    // 1. Owner creates platform invite
    const createRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email: holderEmail });
    expect(createRes.status).toBe(201);
    const link = createRes.body.link as string;
    const token = link.split("/invite/")[1];
    expect(token).toHaveLength(43);

    // Track invite id
    const tokenHash = hashInviteToken(token);
    const [inviteRow] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, tokenHash));
    expect(inviteRow).toBeDefined();
    createdInviteIds.push(inviteRow.id);

    // 2. Mint holder user with matching verified email
    const holder = await signedInCookie(testApp.test, {
      name: "Acme Founder",
      email: holderEmail,
      emailVerified: true,
    });

    // 3. Holder checks GET /api/v1/invites/:token
    const lookupRes = await request(testApp.http)
      .get(`/api/v1/invites/${token}`)
      .set("Cookie", holder.cookie);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body).toEqual({
      kind: "platform",
      state: "pending",
      emailMatches: true,
      maskedEmail: null,
      workspaceName: null,
      workspaceSlug: null,
      alreadyMember: false,
      workspaceSuspended: false,
    });

    // 4. Holder checks GET /api/v1/me -> canCreateWorkspace is true
    const meBefore = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", holder.cookie);
    expect(meBefore.status).toBe(200);
    expect(meBefore.body.canCreateWorkspace).toBe(true);

    // 5. Holder creates workspace
    const wsRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", holder.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Acme Corp",
        slug: holderSlug,
      });
    expect(wsRes.status).toBe(201);
    expect(wsRes.body.slug).toBe(holderSlug);

    const [wsRow] = await testApp.db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.slug, holderSlug));
    expect(wsRow).toBeDefined();
    createdWorkspaceIds.push(wsRow.id);

    // 6. Owner views platform invites: invite is state "used" with usedByName and workspaceName
    const listRes = await request(testApp.http)
      .get("/api/v1/platform/invites")
      .set("Cookie", ownerCookie);
    expect(listRes.status).toBe(200);
    const usedInvite = (listRes.body as any[]).find((r) => r.id === inviteRow.id);
    expect(usedInvite).toBeDefined();
    expect(usedInvite.state).toBe("used");
    expect(usedInvite.usedByName).toBe("Acme Founder");
    expect(usedInvite.workspaceName).toBe("Acme Corp");

    // 7. Holder's /me lists the workspace with role "owner" and canCreateWorkspace false
    const meAfter = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", holder.cookie);
    expect(meAfter.status).toBe(200);
    expect(meAfter.body.canCreateWorkspace).toBe(false);
    expect(meAfter.body.workspaces).toHaveLength(1);
    expect(meAfter.body.workspaces[0]).toMatchObject({
      slug: holderSlug,
      name: "Acme Corp",
      role: "owner",
    });
  });

  it("unverified user with matching email gets emailMatches false, maskedEmail, and 403 on create", async () => {
    const unverifiedEmail = `unverified-${Date.now()}@example.com`;

    const createRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email: unverifiedEmail });
    expect(createRes.status).toBe(201);
    const token = (createRes.body.link as string).split("/invite/")[1];

    const tokenHash = hashInviteToken(token);
    const [row] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, tokenHash));
    createdInviteIds.push(row.id);

    const unverifiedUser = await signedInCookie(testApp.test, {
      name: "Unverified Person",
      email: unverifiedEmail,
      emailVerified: false,
    });

    const lookupRes = await request(testApp.http)
      .get(`/api/v1/invites/${token}`)
      .set("Cookie", unverifiedUser.cookie);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.emailMatches).toBe(false);
    expect(lookupRes.body.maskedEmail).toBe(maskEmail(unverifiedEmail));

    const postWsRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", unverifiedUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Unverified Workspace",
        slug: `unverified-ws-${Date.now()}`,
      });
    expect(postWsRes.status).toBe(403);
    expect(postWsRes.body.code).toBe("not_allowed");

    // Invite stays pending
    const [afterRow] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.id, row.id));
    expect(afterRow.usedAt).toBeNull();
  });

  it("different-email user sees only maskedEmail, never raw email in JSON response", async () => {
    const secretEmail = `secret-target-${Date.now()}@targetcorp.example`;

    const createRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email: secretEmail });
    expect(createRes.status).toBe(201);
    const token = (createRes.body.link as string).split("/invite/")[1];

    const tokenHash = hashInviteToken(token);
    const [row] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, tokenHash));
    createdInviteIds.push(row.id);

    const stranger = await signedInCookie(testApp.test, {
      name: "Stranger",
      email: `stranger-${Date.now()}@other.example`,
      emailVerified: true,
    });

    const lookupRes = await request(testApp.http)
      .get(`/api/v1/invites/${token}`)
      .set("Cookie", stranger.cookie);
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.emailMatches).toBe(false);
    expect(lookupRes.body.maskedEmail).toBe(maskEmail(secretEmail));
    expect(lookupRes.body.workspaceName).toBeNull();

    // Verify raw email does NOT leak anywhere in response
    expect(JSON.stringify(lookupRes.body)).not.toContain(secretEmail);
  });

  it("lookup of malformed token and unknown token both return identical 404 not_found", async () => {
    const caller = await signedInCookie(testApp.test, {
      name: "Caller",
      email: `caller-${Date.now()}@test.example`,
      emailVerified: true,
    });

    const malformedRes = await request(testApp.http)
      .get("/api/v1/invites/abc")
      .set("Cookie", caller.cookie);
    expect(malformedRes.status).toBe(404);
    expect(malformedRes.body.code).toBe("not_found");

    const unknownToken = randomBytes(32).toString("base64url");
    const unknownRes = await request(testApp.http)
      .get(`/api/v1/invites/${unknownToken}`)
      .set("Cookie", caller.cookie);
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body.code).toBe("not_found");

    // Identical error bodies
    expect(malformedRes.body).toEqual(unknownRes.body);
  });

  it("expired, revoked, and used invites return state and reject workspace creation", async () => {
    const email = `lifecycle-${Date.now()}@lifecycle.example`;
    const user = await signedInCookie(testApp.test, {
      name: "Lifecycle User",
      email,
      emailVerified: true,
    });

    // 1. Expired invite
    const expiredToken = randomBytes(32).toString("base64url");
    const [expiredRow] = await testApp.db
      .insert(schema.invites)
      .values({
        kind: "platform",
        email,
        tokenHash: hashInviteToken(expiredToken),
        expiresAt: new Date(Date.now() - 1000), // 1s ago
      })
      .returning({ id: schema.invites.id });
    createdInviteIds.push(expiredRow.id);

    const expiredLookup = await request(testApp.http)
      .get(`/api/v1/invites/${expiredToken}`)
      .set("Cookie", user.cookie);
    expect(expiredLookup.status).toBe(200);
    expect(expiredLookup.body.state).toBe("expired");

    const expiredCreate = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Fail Expired", slug: `fail-exp-${Date.now()}` });
    expect(expiredCreate.status).toBe(403);

    // 2. Revoked invite
    const revokedToken = randomBytes(32).toString("base64url");
    const [revokedRow] = await testApp.db
      .insert(schema.invites)
      .values({
        kind: "platform",
        email,
        tokenHash: hashInviteToken(revokedToken),
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: new Date(),
      })
      .returning({ id: schema.invites.id });
    createdInviteIds.push(revokedRow.id);

    const revokedLookup = await request(testApp.http)
      .get(`/api/v1/invites/${revokedToken}`)
      .set("Cookie", user.cookie);
    expect(revokedLookup.status).toBe(200);
    expect(revokedLookup.body.state).toBe("revoked");

    const revokedCreate = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Fail Revoked", slug: `fail-rev-${Date.now()}` });
    expect(revokedCreate.status).toBe(403);
  });

  it("holder POST with taken slug returns 409 and leaves invite usable for retry", async () => {
    // Seed an existing workspace with slug "taken-slug"
    const takenSlug = `taken-slug-${Date.now()}`;
    const [existing] = await testApp.db
      .insert(schema.workspaces)
      .values({ name: "Existing WS", slug: takenSlug })
      .returning({ id: schema.workspaces.id });
    createdWorkspaceIds.push(existing.id);

    const email = `retry-${Date.now()}@retry.example`;
    const user = await signedInCookie(testApp.test, {
      name: "Retry User",
      email,
      emailVerified: true,
    });

    const createRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email });
    expect(createRes.status).toBe(201);
    const token = (createRes.body.link as string).split("/invite/")[1];
    const [inviteRow] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, hashInviteToken(token)));
    createdInviteIds.push(inviteRow.id);

    // Attempt create with taken slug -> 409
    const failRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "My New WS", slug: takenSlug });
    expect(failRes.status).toBe(409);
    expect(failRes.body.code).toBe("slug_taken");

    // Invite is still pending and usable!
    const [invAfterFail] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.id, inviteRow.id));
    expect(invAfterFail.usedAt).toBeNull();

    // Retry with a free slug -> 201 success!
    const freeSlug = `free-slug-${Date.now()}`;
    const successRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "My New WS", slug: freeSlug });
    expect(successRes.status).toBe(201);
    expect(successRes.body.slug).toBe(freeSlug);

    const [wsSuccess] = await testApp.db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.slug, freeSlug));
    createdWorkspaceIds.push(wsSuccess.id);

    // Invite is now used!
    const [invAfterSuccess] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.id, inviteRow.id));
    expect(invAfterSuccess.usedAt).not.toBeNull();
  });

  it("two concurrent holder POSTs with different slugs create exactly one workspace", async () => {
    const email = `race-${Date.now()}@race.example`;
    const user = await signedInCookie(testApp.test, {
      name: "Race User",
      email,
      emailVerified: true,
    });

    const createRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email });
    expect(createRes.status).toBe(201);
    const token = (createRes.body.link as string).split("/invite/")[1];
    const [inviteRow] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, hashInviteToken(token)));
    createdInviteIds.push(inviteRow.id);

    const slug1 = `race-slug-1-${Date.now()}`;
    const slug2 = `race-slug-2-${Date.now()}`;

    const [res1, res2] = await Promise.all([
      request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", user.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Race WS 1", slug: slug1 }),
      request(testApp.http)
        .post("/api/v1/workspaces")
        .set("Cookie", user.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Race WS 2", slug: slug2 }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 403]);

    // Check cleanup of created workspace
    const successfulSlug = res1.status === 201 ? slug1 : slug2;
    const [ws] = await testApp.db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.slug, successfulSlug));
    if (ws) createdWorkspaceIds.push(ws.id);

    // Exactly one workspace exists for user
    const memberships = await testApp.db
      .select()
      .from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.userId, user.userId));
    expect(memberships).toHaveLength(1);
  });

  it("POST /workspaces with logoUploadId checks ownership", async () => {
    const email = `logo-${Date.now()}@logo.example`;
    const user = await signedInCookie(testApp.test, {
      name: "Logo User",
      email,
      emailVerified: true,
    });

    const createRes = await request(testApp.http)
      .post("/api/v1/platform/invites")
      .set("Cookie", ownerCookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email });
    const token = (createRes.body.link as string).split("/invite/")[1];
    const [inviteRow] = await testApp.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.tokenHash, hashInviteToken(token)));
    createdInviteIds.push(inviteRow.id);

    // Seed an upload belonging to another user
    const [otherUpload] = await testApp.db
      .insert(schema.uploads)
      .values({
        storageKey: `other-${Date.now()}.webp`,
        uploaderId: ownerUserId,
        bytes: 1000,
        width: 100,
        height: 100,
      })
      .returning({ id: schema.uploads.id });
    createdUploadIds.push(otherUpload.id);

    // User tries to use another user's upload -> 400 validation_failed
    const failRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Logo WS",
        slug: `logo-fail-${Date.now()}`,
        logoUploadId: otherUpload.id,
      });
    expect(failRes.status).toBe(400);
    expect(failRes.body.code).toBe("validation_failed");

    // Seed an upload belonging to the user
    const [userUpload] = await testApp.db
      .insert(schema.uploads)
      .values({
        storageKey: `user-${Date.now()}.webp`,
        uploaderId: user.userId,
        bytes: 1000,
        width: 100,
        height: 100,
      })
      .returning({ id: schema.uploads.id });
    createdUploadIds.push(userUpload.id);

    // User uses own upload -> 201
    const slug = `logo-ok-${Date.now()}`;
    const okRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", user.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Logo WS",
        slug,
        logoUploadId: userUpload.id,
      });
    expect(okRes.status).toBe(201);

    const [ws] = await testApp.db
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.slug, slug));
    createdWorkspaceIds.push(ws.id);
    expect(ws.logoUploadId).toBe(userUpload.id);
  });
});
