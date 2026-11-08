import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { API_KEY_SCOPES, API_KEY_RATE_LIMIT } from "@userhq/types";
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

  describe("createKey input validation (quick-261108-bzd)", () => {
    const invalidBodies: Array<[string, Record<string, unknown>]> = [
      ["an unknown scope", { name: "Bad scope", scopes: ["not:a:scope"] }],
      ["an empty scope list", { name: "No scopes", scopes: [] }],
      ["scopes given as a string", { name: "String scopes", scopes: "requests:read" }],
      ["a missing name", { scopes: ["requests:read"] }],
      ["expiresInDays above ten years", { name: "Too long", scopes: ["requests:read"], expiresInDays: 4000 }],
    ];

    it.each(invalidBodies)("returns 400 validation_failed for %s and creates no key", async (_label, body) => {
      const before = await testApp.db.select().from(schema.workspaceApiKeys);
      const res = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("validation_failed");
      expect(typeof res.body.message).toBe("string");
      const after = await testApp.db.select().from(schema.workspaceApiKeys);
      expect(after.length).toBe(before.length);
    });
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

  it("rejects API keys before Better Auth can use an accompanying human session", async () => {
    const key = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Auth boundary", scopes: ["admin"] });
    expect(key.status).toBe(201);
    for (const [method, path] of [["get", "get-session"], ["post", "sign-out"]] as const) {
      const res = await request(testApp.http)[method](`/api/auth/${path}`)
        .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
        .set("Authorization", `Bearer ${key.body.token}`).send({});
      expect(res.status, path).toBe(403);
      expect(res.body.code).toBe("api_key_route_forbidden");
    }
    const account = await request(testApp.http).get("/api/v1/account").set("Cookie", admin.cookie);
    expect(account.status).toBe(200);
  });

  it("recognizes case-insensitive Bearer schemes without falling back to human cookies", async () => {
    const key = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Bearer syntax", scopes: ["requests:read"] });
    expect(key.status).toBe(201);
    for (const scheme of ["bearer ", "BEARER   ", "BeArEr\t"]) {
      for (const path of ["/api/v1/account", "/api/auth/get-session"]) {
        const res = await request(testApp.http).get(path).set("Cookie", admin.cookie)
          .set("Authorization", `${scheme}${key.body.token}`);
        expect(res.status, `${scheme} ${path}`).toBe(403);
        expect(res.body.code).toBe("api_key_route_forbidden");
      }
      const allowed = await request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/requests`)
        .set("Authorization", `${scheme}${key.body.token}`);
      expect(allowed.status, scheme).toBe(200);
    }
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

  it("denies product-restricted keys on workspace resources including webhooks and aggregates", async () => {
    const key = await request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie).set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Product only", scopes: ["admin"], productRestrictions: [prodAId] });
    expect(key.status).toBe(201);
    for (const path of ["webhooks", "requests", "comments", "export/feedback"]) {
      const res = await request(testApp.http).get(`/api/v1/workspaces/${wsSlug}/${path}`)
        .set("Authorization", `Bearer ${key.body.token}`);
      expect(res.status, path).toBe(403);
      expect(res.body.code).toBe("product_restricted");
    }
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

  describe("unambiguous productRestrictions (quick-261108-unx, D-05, D-11)", () => {
    let foreignProdId: string;
    let deletedProdId: string;
    const keysUrl = () => `/api/v1/workspaces/${wsSlug}/api-keys`;
    const create = (body: Record<string, unknown>) =>
      request(testApp.http)
        .post(keysUrl())
        .set("Cookie", admin.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Restriction key", scopes: ["admin"], ...body });

    beforeAll(async () => {
      const [foreign] = await testApp.db
        .insert(schema.products)
        .values({ workspaceId: otherWsId, name: "Foreign", slug: `foreign-${Date.now()}` })
        .returning();
      foreignProdId = foreign.id;
      const [deleted] = await testApp.db
        .insert(schema.products)
        .values({ workspaceId: wsId, name: "Gone", slug: `gone-${Date.now()}`, deletedAt: new Date() })
        .returning();
      deletedProdId = deleted.id;
    });

    const rejected: Array<[string, () => unknown]> = [
      ["an empty list", () => []],
      ["a product of another workspace", () => [foreignProdId]],
      ["a valid and a foreign product", () => [prodAId, foreignProdId]],
      ["a soft-deleted product", () => [deletedProdId]],
      ["an unknown uuid", () => ["00000000-0000-4000-8000-000000000000"]],
    ];

    it.each(rejected)("returns 400 validation_failed for %s and stores no key", async (_label, ids) => {
      const before = await testApp.db.select().from(schema.workspaceApiKeys);
      const res = await create({ productRestrictions: ids() });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("validation_failed");
      const after = await testApp.db.select().from(schema.workspaceApiKeys);
      expect(after.length).toBe(before.length);
    });

    it("gives foreign, deleted and unknown ids the same message", async () => {
      const messages = new Set<string>();
      for (const id of [foreignProdId, deletedProdId, "00000000-0000-4000-8000-000000000000"]) {
        const res = await create({ productRestrictions: [id] });
        expect(res.status).toBe(400);
        messages.add(res.body.message);
      }
      expect(messages.size).toBe(1);
    });

    it("treats omitted and null as unrestricted and stores duplicate ids once", async () => {
      const omitted = await create({});
      expect(omitted.status).toBe(201);
      expect(omitted.body.key.productRestrictions).toBeNull();
      const nulled = await create({ productRestrictions: null });
      expect(nulled.status).toBe(201);
      expect(nulled.body.key.productRestrictions).toBeNull();
      const dup = await create({ productRestrictions: [prodAId, prodAId] });
      expect(dup.status).toBe(201);
      expect(dup.body.key.productRestrictions).toEqual([prodAId]);
    });

    it("denies a key whose stored list was forced to [] on product and workspace-wide routes", async () => {
      const forced = await create({});
      const open = await create({});
      expect(forced.status).toBe(201);
      await testApp.db
        .update(schema.workspaceApiKeys)
        .set({ productRestrictions: [] })
        .where(eq(schema.workspaceApiKeys.id, forced.body.key.id));

      for (const path of [`/products/${prodASlug}/posts`, "/comments"]) {
        const denied = await request(testApp.http)
          .get(`/api/v1/workspaces/${wsSlug}${path}`)
          .set("Authorization", `Bearer ${forced.body.token}`);
        expect(denied.status).toBe(403);
        expect(denied.body.code).toBe("product_restricted");

        const allowed = await request(testApp.http)
          .get(`/api/v1/workspaces/${wsSlug}${path}`)
          .set("Authorization", `Bearer ${open.body.token}`);
        expect(allowed.status).toBe(200);
      }
    });
  });
});

describe("API key traffic policy (quick-261107-flq)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let admin: { cookie: string; userId: string };
  let wsSlug: string;
  let wsId: string;

  const asAdmin = () => ({ Cookie: admin.cookie, Origin: testApp.env.PUBLIC_URL });
  const mint = async (name: string, scopes: readonly string[]) => {
    const res = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set(asAdmin())
      .send({ name, scopes });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return { token: res.body.token as string, id: res.body.key.id as string };
  };
  const keyCount = async () =>
    (await testApp.db.select().from(schema.workspaceApiKeys).where(eq(schema.workspaceApiKeys.workspaceId, wsId))).length;

  beforeAll(async () => {
    testApp = await createTestApp();
    admin = await signedInCookie(testApp.test, {
      name: "Policy Admin",
      email: `policy-admin-${Date.now()}@userhq.test`,
      emailVerified: true,
    });
    wsSlug = `ws-policy-${Date.now()}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({ name: "Policy Workspace", slug: wsSlug })
      .returning();
    wsId = ws.id;
    await testApp.db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: wsId, userId: admin.userId, role: "owner" });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("a key holding every scope, and an admin-only key, cannot list, create or revoke keys", async () => {
    const victim = await mint("Victim", ["requests:read"]);
    const attackers = [
      await mint("All scopes", API_KEY_SCOPES),
      await mint("Admin only", ["admin"]),
    ];
    const before = await keyCount();
    const responses: string[] = [];
    for (const attacker of attackers) {
      const auth = { Authorization: `Bearer ${attacker.token}` };
      const base = `/api/v1/workspaces/${wsSlug}/api-keys`;
      const calls = [
        await request(testApp.http).get(base).set(auth),
        await request(testApp.http).post(base).set(auth).send({ name: "Minted", scopes: ["admin"] }),
        await request(testApp.http).delete(`${base}/${victim.id}`).set(auth),
      ];
      for (const res of calls) {
        expect(res.status, JSON.stringify(res.body)).toBe(403);
        expect(res.body.code).toBe("api_key_route_forbidden");
        responses.push(JSON.stringify(res.body));
      }
    }
    expect(await keyCount()).toBe(before);
    const [row] = await testApp.db.select().from(schema.workspaceApiKeys).where(eq(schema.workspaceApiKeys.id, victim.id));
    expect(row.revokedAt).toBeNull();
    const read = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", `Bearer ${victim.token}`);
    expect(read.status).toBe(200);
    for (const body of responses) {
      expect(body).not.toContain(row.keyHash);
      expect(body).not.toContain("uhq_live_");
      expect(body).not.toContain("token");
    }
  });

  it("limits each key to API_KEY_RATE_LIMIT with a numeric Retry-After, independent of other keys and humans", async () => {
    const a = await mint("Limited A", ["requests:read"]);
    const b = await mint("Limited B", ["requests:read"]);
    const url = `/api/v1/workspaces/${wsSlug}/requests?limit=1`;
    for (let i = 0; i < API_KEY_RATE_LIMIT.limit; i++) {
      const res = await request(testApp.http).get(url).set("Authorization", `Bearer ${a.token}`);
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
    const blocked = await request(testApp.http).get(url).set("Authorization", `Bearer ${a.token}`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("rate_limited");
    expect(blocked.headers["retry-after"]).toMatch(/^\d+$/);
    const retry = Number(blocked.headers["retry-after"]);
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(API_KEY_RATE_LIMIT.windowSeconds);

    const other = await request(testApp.http).get(url).set("Authorization", `Bearer ${b.token}`);
    expect(other.status).toBe(200);
    const human = await request(testApp.http).get(url).set("Cookie", admin.cookie);
    expect(human.status).toBe(200);
  });

  it("an invalid token is 401 and creates no limiter bucket", async () => {
    const keys = async () => (await testApp.db.select({ key: schema.rateLimitHits.key }).from(schema.rateLimitHits)).map((r) => r.key).sort();
    const before = await keys();
    const res = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/requests`)
      .set("Authorization", "Bearer uhq_live_definitelynotarealkey0000000000");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("api_key_invalid");
    expect(await keys()).toEqual(before);
  });
});
