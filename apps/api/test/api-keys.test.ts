import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Workspace Admin API Keys (Plan 09-02)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string; name: string };
  let otherAdmin: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let otherWsSlug: string;
  let otherWsId: string;
  let prodASlug: string;
  let prodAId: string;
  let prodBSlug: string;
  let prodBId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    admin = await signedInCookie(testApp.test, {
      name: "Admin Alice",
      email: "alice@api-keys.test",
      emailVerified: true,
    });

    otherAdmin = await signedInCookie(testApp.test, {
      name: "Other Eve",
      email: "eve@api-keys.test",
      emailVerified: true,
    });

    // Create workspace 1
    wsSlug = `ws-api-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "API Test Workspace",
        slug: wsSlug,
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: admin.userId,
      role: "owner",
    });

    // Create workspace 2
    otherWsSlug = `other-api-${Date.now()}`;
    const [otherWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        name: "Other Workspace",
        slug: otherWsSlug,
      })
      .returning();
    otherWsId = otherWs.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: otherWsId,
      userId: otherAdmin.userId,
      role: "owner",
    });

    // Create two products in workspace 1
    prodASlug = `prod-a-${Date.now()}`;
    const [prodA] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Product A",
        slug: prodASlug,
      })
      .returning();
    prodAId = prodA.id;

    prodBSlug = `prod-b-${Date.now()}`;
    const [prodB] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        name: "Product B",
        slug: prodBSlug,
      })
      .returning();
    prodBId = prodB.id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("denies API keys access to their creator's personal account even with a session cookie", async () => {
    const key = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Limited integration", scopes: ["requests:read"] });
    expect(key.status).toBe(201);

    const res = await request(testApp.http)
      .get("/api/v1/account")
      .set("Cookie", admin.cookie)
      .set("Authorization", `Bearer ${key.body.token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("api_key_route_forbidden");
  });

  it("creates an API key with scopes and product restrictions, returning token once", async () => {
    const res = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Zapier Sync",
        scopes: ["requests:read", "requests:write"],
        productRestrictions: [prodAId],
        expiresInDays: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^uhq_live_[A-Za-z0-9_-]{20,}$/);
    expect(res.body.key.name).toBe("Zapier Sync");
    expect(res.body.key.keyPrefix).toMatch(/^uhq_live_/);
    expect(res.body.key.scopes).toEqual(["requests:read", "requests:write"]);
    expect(res.body.key.productRestrictions).toEqual([prodAId]);
    expect(res.body.key.expiresAt).not.toBeNull();
    expect(res.body.key.revokedAt).toBeNull();
    expect(res.body.key.keyHash).toBeUndefined(); // Sensitive hash should not be exposed
  });

  it("keeps personal, public, team and credential routes session-only for every key scope", async () => {
    for (const scopes of [["requests:read"], ["admin"]]) {
      const key = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/api-keys`)
        .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Route policy", scopes });
      const paths = [
        ["post", "/api/v1/account/delete"],
        ["delete", `/api/v1/workspaces/${wsSlug}`],
        ["post", `/api/v1/workspaces/${wsSlug}/invites`],
        ["post", `/api/v1/workspaces/${wsSlug}/api-keys`],
        ["get", `/api/v1/workspaces/${wsSlug}/api-keys`],
        ["delete", `/api/v1/workspaces/${wsSlug}/api-keys/${key.body.key.id}`],
        ["get", `/api/v1/portal/${wsSlug}/${prodASlug}/posts`],
        ["post", `/api/v1/portal/${wsSlug}/${prodASlug}/posts`],
        ["post", `/api/v1/portal/${wsSlug}/${prodASlug}/posts/1/comments`],
        ["put", `/api/v1/portal/${wsSlug}/${prodASlug}/posts/1/vote`],
      ] as const;
      for (const [method, path] of paths) {
        const res = await request(testApp.http)[method](path)
          .set("Authorization", `Bearer ${key.body.token}`).send({});
        expect(res.status, `${method} ${path}`).toBe(403);
        expect(res.body.code).toBe("api_key_route_forbidden");
      }
    }
    const account = await request(testApp.http).get("/api/v1/account").set("Cookie", admin.cookie);
    expect(account.status).toBe(200);
    expect(account.body.name).toBe("Admin Alice");
  });

  it("lists API keys for workspace with metadata and prefix only", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys.length).toBeGreaterThanOrEqual(1);

    const key = res.body.keys.find((item: any) => item.name === "Zapier Sync");
    expect(key.name).toBe("Zapier Sync");
    expect(key.keyPrefix).toBeDefined();
    expect(key.token).toBeUndefined();
    expect(key.keyHash).toBeUndefined();
  });

  it("authenticates requests using Bearer token without origin header", async () => {
    // Create an unrestricted key with requests:read
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "CLI Reader",
        scopes: ["requests:read"],
      });

    const token = createRes.body.token;

    // Call workspace feedback requests endpoint using Bearer token
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("rejects invalid, malformed, or fake tokens with 401 api_key_invalid", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", "Bearer uhq_live_completely_fake_token_value_here");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("api_key_invalid");
  });

  it("enforces product restrictions on API keys", async () => {
    // Create a key restricted ONLY to Product A
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Product A Dedicated Key",
        scopes: ["admin"],
        productRestrictions: [prodAId],
      });

    const token = createRes.body.token;

    // Product A should be accessible
    const resA = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodASlug}/posts`)
      .set("Authorization", `Bearer ${token}`);
    expect(resA.status).toBe(200);

    // Product B should be rejected with 403 product_restricted
    const resB = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodBSlug}/posts`)
      .set("Authorization", `Bearer ${token}`);
    expect(resB.status).toBe(403);
    expect(resB.body.code).toBe("product_restricted");
  });

  it("revokes an API key and blocks subsequent requests with 401 api_key_revoked", async () => {
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Temporary Key",
        scopes: ["requests:read"],
      });

    const keyId = createRes.body.key.id;
    const token = createRes.body.token;

    // Valid before revoke
    const beforeRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", `Bearer ${token}`);
    expect(beforeRes.status).toBe(200);

    // Revoke key
    const revokeRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/api-keys/${keyId}`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.key.revokedAt).not.toBeNull();

    // Blocked after revoke
    const afterRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", `Bearer ${token}`);
    expect(afterRes.status).toBe(401);
    expect(afterRes.body.code).toBe("api_key_revoked");
  });

  it("prevents using an API key from Workspace A on Workspace B", async () => {
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Workspace A Key",
        scopes: ["admin"],
      });

    const token = createRes.body.token;

    // Attempt to access other workspace
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${otherWsSlug}/requests`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("enforces granular scopes (e.g. requests:read rejected when comments:read required)", async () => {
    // Key with ONLY requests:read
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Requests Only Key",
        scopes: ["requests:read"],
      });

    const token = createRes.body.token;

    // Requests endpoint works
    const okRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", `Bearer ${token}`);
    expect(okRes.status).toBe(200);

    // Comments endpoint requires comments:read -> rejected with 403 insufficient_scope
    const forbiddenRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/comments`)
      .set("Authorization", `Bearer ${token}`);
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.code).toBe("insufficient_scope");

    // Key with admin scope can access comments endpoint
    const adminKeyRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Super Admin Key",
        scopes: ["admin"],
      });

    const adminToken = adminKeyRes.body.token;
    const adminAccessRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/comments`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminAccessRes.status).toBe(200);
  });
});
