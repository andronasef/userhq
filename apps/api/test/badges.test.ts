import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("User Badging & Attribution Engine API", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let customerUser: { cookie: string; userId: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@badges.test",
    });

    adminUser = await signedInCookie(testApp.test, {
      name: "Badge Admin",
      email: "admin@badges.test",
      emailVerified: true,
    });

    customerUser = await signedInCookie(testApp.test, {
      name: "VIP Customer",
      email: "vip@badges.test",
      emailVerified: true,
    });

    wsSlug = "ws-badges-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Badges Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "badges-product";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Badges Product",
      })
      .returning();
    prodId = prod.id;
  });

  afterAll(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

  let createdBadgeId: string;

  it("creates a badge with custom styling and priority", async () => {
    const res = await request(testApp.server)
      .post(`/api/workspaces/${wsSlug}/products/${prodSlug}/badges`)
      .set("Cookie", adminUser.cookie)
      .send({
        name: "VIP Customer",
        slug: "vip",
        description: "Special VIP patron",
        color: "#fbbf24",
        textColor: "#000000",
        icon: "crown",
        priority: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.slug).toBe("vip");
    expect(res.body.name).toBe("VIP Customer");
    expect(res.body.priority).toBe(10);
    createdBadgeId = res.body.id;
  });

  it("rejects duplicate badge slug within the same product", async () => {
    const res = await request(testApp.server)
      .post(`/api/workspaces/${wsSlug}/products/${prodSlug}/badges`)
      .set("Cookie", adminUser.cookie)
      .send({
        name: "VIP Duplicate",
        slug: "vip",
        color: "#10b981",
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("badge_conflict");
  });

  it("lists badges with rules", async () => {
    const res = await request(testApp.server)
      .get(`/api/workspaces/${wsSlug}/products/${prodSlug}/badges`)
      .set("Cookie", adminUser.cookie);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].slug).toBe("vip");
  });

  it("adds an exact match rule with HMAC secret", async () => {
    const res = await request(testApp.server)
      .post(`/api/workspaces/${wsSlug}/products/${prodSlug}/badges/${createdBadgeId}/rules`)
      .set("Cookie", adminUser.cookie)
      .send({
        paramKey: "tier",
        matchType: "exact",
        matchValue: "pro",
        secretToken: "super-secret-key-123",
      });

    expect(res.status).toBe(201);
    expect(res.body.paramKey).toBe("tier");
    expect(res.body.matchType).toBe("exact");
    expect(res.body.matchValue).toBe("pro");
    expect(res.body.secretToken).toBe("super-secret-key-123");
  });

  it("evaluates public attribution via portal endpoint with HMAC validation", async () => {
    const hmac = crypto.createHmac("sha256", "super-secret-key-123");
    hmac.update("pro");
    const validSig = hmac.digest("hex");

    // Invalid signature -> no match
    const failRes = await request(testApp.server)
      .post(`/api/portal/${wsSlug}/${prodSlug}/badges/attribute`)
      .send({
        searchParams: {
          tier: "pro",
          tier_sig: "wrong-signature",
        },
      });
    expect(failRes.status).toBe(201);
    expect(failRes.body.matchedBadges).toEqual([]);

    // Valid signature -> matched badge returned + cookie set
    const successRes = await request(testApp.server)
      .post(`/api/portal/${wsSlug}/${prodSlug}/badges/attribute`)
      .send({
        searchParams: {
          tier: "pro",
          tier_sig: validSig,
        },
      });
    expect(successRes.status).toBe(201);
    expect(successRes.body.matchedBadges).toHaveLength(1);
    expect(successRes.body.matchedBadges[0].slug).toBe("vip");
    expect(successRes.headers["set-cookie"]).toBeDefined();
  });

  it("manually assigns and revokes badges for a user", async () => {
    // Assign badge
    const assignRes = await request(testApp.server)
      .post(`/api/workspaces/${wsSlug}/products/${prodSlug}/users/${customerUser.userId}/badges`)
      .set("Cookie", adminUser.cookie)
      .send({
        badgeId: createdBadgeId,
      });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.success).toBe(true);

    // List users in product directory
    const listRes = await request(testApp.server)
      .get(`/api/workspaces/${wsSlug}/products/${prodSlug}/users`)
      .set("Cookie", adminUser.cookie);
    expect(listRes.status).toBe(200);
    const userInDir = listRes.body.items.find((u: any) => u.id === customerUser.userId);
    expect(userInDir).toBeDefined();
    expect(userInDir.badges).toHaveLength(1);
    expect(userInDir.badges[0].slug).toBe("vip");

    // Revoke badge
    const revokeRes = await request(testApp.server)
      .delete(`/api/workspaces/${wsSlug}/products/${prodSlug}/users/${customerUser.userId}/badges/${createdBadgeId}`)
      .set("Cookie", adminUser.cookie);
    expect(revokeRes.status).toBe(204);

    // Check directory again
    const listAfterRes = await request(testApp.server)
      .get(`/api/workspaces/${wsSlug}/products/${prodSlug}/users`)
      .set("Cookie", adminUser.cookie);
    const userAfter = listAfterRes.body.items.find((u: any) => u.id === customerUser.userId);
    expect(userAfter?.badges ?? []).toHaveLength(0);
  });
});
