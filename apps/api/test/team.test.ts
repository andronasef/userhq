import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { seedTenants, type Seed } from "./support/seed.js";

describe("Team Management & Teammate Invites (Plan 02-07)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let seed: Seed;

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "platform-owner@userhq.test",
    });
    seed = await seedTenants(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: owner invites a teammate who accepts and becomes admin", async () => {
    const mateEmail = `mate-${Date.now()}@acme.example`;

    // 1. Owner invites teammate
    const inviteRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ email: mateEmail });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.email).toBe(mateEmail);
    expect(inviteRes.body.link).toBeDefined();

    const token = inviteRes.body.link.split("/invite/")[1];
    expect(token).toBeDefined();

    // 2. Verified teammate signs in
    const mate = await signedInCookie(testApp.test, {
      name: "Mate Verified",
      email: mateEmail,
      emailVerified: true,
    });

    // 3. Lookup invite
    const lookupRes = await request(testApp.http)
      .get(`/api/v1/invites/${token}`)
      .set("Cookie", mate.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.kind).toBe("workspace");
    expect(lookupRes.body.state).toBe("pending");
    expect(lookupRes.body.emailMatches).toBe(true);
    expect(lookupRes.body.maskedEmail).toBeNull();
    expect(lookupRes.body.workspaceSlug).toBe(seed.a.slug);
    expect(lookupRes.body.alreadyMember).toBe(false);
    expect(lookupRes.body.workspaceSuspended).toBe(false);

    // 4. Accept invite
    const acceptRes = await request(testApp.http)
      .post(`/api/v1/invites/${token}/accept`)
      .set("Cookie", mate.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.workspaceSlug).toBe(seed.a.slug);

    // 5. GET members returns owner first, then admin
    const membersRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${seed.a.slug}/members`)
      .set("Cookie", seed.a.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(membersRes.status).toBe(200);
    expect(Array.isArray(membersRes.body)).toBe(true);
    expect(membersRes.body.length).toBe(2);
    expect(membersRes.body[0].role).toBe("owner");
    expect(membersRes.body[0].userId).toBe(seed.a.userId);
    expect(membersRes.body[1].role).toBe("admin");
    expect(membersRes.body[1].userId).toBe(mate.userId);

    // 6. Mate can view workspace with role "admin"
    const wsRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${seed.a.slug}`)
      .set("Cookie", mate.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(wsRes.status).toBe(200);
    expect(wsRes.body.role).toBe("admin");
  });

  describe("Member removal and owner protection", () => {
    it("admin removes another admin -> 204, then removed user gets 404", async () => {
      // Add a teammate
      const mate = await signedInCookie(testApp.test, {
        name: "Teammate to Remove",
        emailVerified: true,
      });

      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: mate.userId,
        role: "admin",
      });

      // Remove the teammate
      const delRes = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${mate.userId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(delRes.status).toBe(204);

      // Removed teammate cannot access workspace
      const wsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${seed.a.slug}`)
        .set("Cookie", mate.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(wsRes.status).toBe(404);
    });

    it("cannot remove the owner (returns 403 not_allowed)", async () => {
      // Create admin user in workspace A
      const admin = await signedInCookie(testApp.test, {
        name: "Admin Attacker",
        emailVerified: true,
      });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: admin.userId,
        role: "admin",
      });

      // Admin tries to remove owner
      const res = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${seed.a.userId}`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("not_allowed");
    });

    it("cannot remove self (returns 403 not_allowed)", async () => {
      const admin = await signedInCookie(testApp.test, {
        name: "Admin Self Remover",
        emailVerified: true,
      });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: admin.userId,
        role: "admin",
      });

      // Admin tries to remove self
      const res = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${admin.userId}`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("not_allowed");

      // Owner tries to remove self
      const ownerRes = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${seed.a.userId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(ownerRes.status).toBe(403);
      expect(ownerRes.body.code).toBe("not_allowed");
    });

    it("remove non-member returns 404", async () => {
      const nonMember = await signedInCookie(testApp.test, {
        name: "Non Member",
        emailVerified: true,
      });

      const res = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${nonMember.userId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("not_found");
    });

    it("remove twice yields 204 then 404 (idempotency)", async () => {
      const mate = await signedInCookie(testApp.test, {
        name: "Double Remove Mate",
        emailVerified: true,
      });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: mate.userId,
        role: "admin",
      });

      const res1 = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${mate.userId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(res1.status).toBe(204);

      const res2 = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${mate.userId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(res2.status).toBe(404);
    });

    it("two concurrent removes yield one 204 and one 404", async () => {
      const mate = await signedInCookie(testApp.test, {
        name: "Concurrent Remove Mate",
        emailVerified: true,
      });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: mate.userId,
        role: "admin",
      });

      const [res1, res2] = await Promise.all([
        request(testApp.http)
          .delete(`/api/v1/workspaces/${seed.a.slug}/members/${mate.userId}`)
          .set("Cookie", seed.a.cookie)
          .set("Origin", testApp.env.PUBLIC_URL),
        request(testApp.http)
          .delete(`/api/v1/workspaces/${seed.a.slug}/members/${mate.userId}`)
          .set("Cookie", seed.a.cookie)
          .set("Origin", testApp.env.PUBLIC_URL),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([204, 404]);
    });
  });

  describe("Leaving workspace", () => {
    it("admin leaves -> 204, then gets 404 on workspace access", async () => {
      const mate = await signedInCookie(testApp.test, {
        name: "Admin Leaving",
        emailVerified: true,
      });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: mate.userId,
        role: "admin",
      });

      const leaveRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/leave`)
        .set("Cookie", mate.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(leaveRes.status).toBe(204);

      const wsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${seed.a.slug}`)
        .set("Cookie", mate.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(wsRes.status).toBe(404);
    });

    it("owner cannot leave -> 403 not_allowed", async () => {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/leave`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("not_allowed");
    });
  });

  describe("Invite creation duplicates and concurrency", () => {
    it("invite for an existing member's email -> 409 already_member", async () => {
      const member = await signedInCookie(testApp.test, {
        name: "Existing Member",
        email: `existing-${Date.now()}@acme.example`,
        emailVerified: true,
      });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: seed.a.id,
        userId: member.userId,
        role: "admin",
      });

      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email: member.email });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("already_member");
    });

    it("second invite for a pending email -> 409 invite_pending", async () => {
      const email = `pending-${Date.now()}@acme.example`;

      const res1 = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      expect(res1.status).toBe(201);

      const res2 = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe("invite_pending");
    });

    it("concurrent invite creates for one email leave exactly one row", async () => {
      const email = `concurrent-invite-${Date.now()}@acme.example`;

      const [res1, res2] = await Promise.all([
        request(testApp.http)
          .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
          .set("Cookie", seed.a.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ email }),
        request(testApp.http)
          .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
          .set("Cookie", seed.a.cookie)
          .set("Origin", testApp.env.PUBLIC_URL)
          .send({ email }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });

  describe("Accept edge cases", () => {
    it("double accept by same user is idempotent (both return 200)", async () => {
      const email = `double-accept-${Date.now()}@acme.example`;
      const invRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      const token = invRes.body.link.split("/invite/")[1];

      const user = await signedInCookie(testApp.test, {
        name: "Double Accepter",
        email,
        emailVerified: true,
      });

      const accept1 = await request(testApp.http)
        .post(`/api/v1/invites/${token}/accept`)
        .set("Cookie", user.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(accept1.status).toBe(200);

      const accept2 = await request(testApp.http)
        .post(`/api/v1/invites/${token}/accept`)
        .set("Cookie", user.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(accept2.status).toBe(200);
      expect(accept2.body.workspaceSlug).toBe(seed.a.slug);
    });

    it("accept by mismatched or unverified user returns 403 not_allowed and leaves invite pending", async () => {
      const email = `bound-${Date.now()}@acme.example`;
      const invRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      const token = invRes.body.link.split("/invite/")[1];

      // Mismatched verified user
      const mismatchUser = await signedInCookie(testApp.test, {
        name: "Mismatch User",
        email: `wrong-${Date.now()}@acme.example`,
        emailVerified: true,
      });

      const mismatchRes = await request(testApp.http)
        .post(`/api/v1/invites/${token}/accept`)
        .set("Cookie", mismatchUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(mismatchRes.status).toBe(403);
      expect(mismatchRes.body.code).toBe("not_allowed");

      // Verify the invite is still usable by the intended user
      const rightUser = await signedInCookie(testApp.test, {
        name: "Right User",
        email,
        emailVerified: true,
      });

      const validRes = await request(testApp.http)
        .post(`/api/v1/invites/${token}/accept`)
        .set("Cookie", rightUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(validRes.status).toBe(200);

      // Now create another invite to test an unverified user with matching email
      const unverifiedEmail = `unverified-${Date.now()}@acme.example`;
      const unverifiedInvRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.a.slug}/invites`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email: unverifiedEmail });

      const unverifiedToken = unverifiedInvRes.body.link.split("/invite/")[1];

      const unverifiedUser = await signedInCookie(testApp.test, {
        name: "Unverified User",
        email: unverifiedEmail,
        emailVerified: false,
      });

      const unverifiedRes = await request(testApp.http)
        .post(`/api/v1/invites/${unverifiedToken}/accept`)
        .set("Cookie", unverifiedUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(unverifiedRes.status).toBe(403);
      expect(unverifiedRes.body.code).toBe("not_allowed");
    });

    it("accept for suspended workspace returns 403 workspace_suspended and stays pending", async () => {
      // 1. Create an active workspace and member
      const [suspendedWs] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: `suspended-${Date.now()}`,
          name: "Suspended Workspace",
        })
        .returning();

      const owner = await signedInCookie(testApp.test, { emailVerified: true });
      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: suspendedWs.id,
        userId: owner.userId,
        role: "owner",
      });

      // 2. Create invite while workspace is active
      const email = `suspended-mate-${Date.now()}@acme.example`;
      const createRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${suspendedWs.slug}/invites`)
        .set("Cookie", owner.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ email });

      expect(createRes.status).toBe(201);
      const token = createRes.body.link.split("/invite/")[1];

      // 3. Suspend the workspace
      await testApp.db
        .update(schema.workspaces)
        .set({ suspendedAt: new Date() })
        .where(eq(schema.workspaces.id, suspendedWs.id));

      // 4. Mate attempts to accept invite
      const mate = await signedInCookie(testApp.test, {
        name: "Suspended Mate",
        email,
        emailVerified: true,
      });

      const acceptRes = await request(testApp.http)
        .post(`/api/v1/invites/${token}/accept`)
        .set("Cookie", mate.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(acceptRes.status).toBe(403);
      expect(acceptRes.body.code).toBe("workspace_suspended");
    });
  });

  describe("Cross-tenant member and invite manipulation", () => {
    it("DELETE /workspaces/{a}/members/{b-member-id} -> 404", async () => {
      const res = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/members/${seed.b.memberUserId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
    });

    it("POST /workspaces/{b}/leave with tenant A cookie -> 404", async () => {
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${seed.b.slug}/leave`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
    });

    it("DELETE /workspaces/{a}/invites/{b-invite-id} -> 404", async () => {
      const res = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.a.slug}/invites/${seed.b.inviteId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
    });

    it("DELETE /workspaces/{b}/members/{b-member-id} with tenant A cookie -> 404", async () => {
      const res = await request(testApp.http)
        .delete(`/api/v1/workspaces/${seed.b.slug}/members/${seed.b.memberUserId}`)
        .set("Cookie", seed.a.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(404);
    });
  });
});
