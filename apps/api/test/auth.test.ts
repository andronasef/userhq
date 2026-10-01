import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Controller, Get, Post, Body, HttpCode } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { Public } from "../src/auth/decorators.js";
import { createTestApp, signedInCookie } from "./support/test-app.js";

@Controller("test")
class TestExtraController {
  @Get("protected")
  getProtected() {
    return { ok: true };
  }

  @Public()
  @Post("echo")
  @HttpCode(200)
  postEcho(@Body() body: any) {
    return body;
  }
}

describe("Auth & Session Hardening (Plan 01-03)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    testApp = await createTestApp({
      extraControllers: [TestExtraController],
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  // Tracer cases from Task 1
  it("anonymous GET /api/v1/me returns { user: null }", async () => {
    const res = await request(testApp.http).get("/api/v1/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("signed-in GET /api/v1/me returns the user with exactly id, name, image (no email)", async () => {
    const { cookie, userId } = await signedInCookie(testApp.test, {
      name: "Tracer User",
      image: "https://example.com/avatar.png",
    });

    const res = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.name).toBe("Tracer User");
    expect(res.body.user.image).toBe("https://example.com/avatar.png");
    expect(Object.keys(res.body.user).sort()).toEqual(["id", "image", "name"]);
    expect(res.body.user.email).toBeUndefined();
  });

  // Task 2 behaviors
  it("google start: returns accounts.google.com url with exact callback redirect_uri and minimal scopes", async () => {
    const res = await request(testApp.http)
      .post("/api/auth/sign-in/social")
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ provider: "google", callbackURL: "/" });

    expect(res.status).toBe(200);
    expect(res.body?.url).toBeDefined();

    const parsed = new URL(res.body.url);
    expect(parsed.host).toBe("accounts.google.com");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      `${testApp.env.PUBLIC_URL}/api/auth/callback/google`
    );

    const rawScopes = parsed.searchParams.get("scope") ?? "";
    const scopes = new Set(rawScopes.split(/[ +]/));
    expect(scopes).toEqual(new Set(["openid", "email", "profile"]));
  });

  it("github start: returns github.com authorize url with exact callback redirect_uri and minimal scopes", async () => {
    const res = await request(testApp.http)
      .post("/api/auth/sign-in/social")
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ provider: "github", callbackURL: "/" });

    expect(res.status).toBe(200);
    expect(res.body?.url).toBeDefined();

    const parsed = new URL(res.body.url);
    expect(parsed.host).toBe("github.com");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      `${testApp.env.PUBLIC_URL}/api/auth/callback/github`
    );

    const rawScopes = parsed.searchParams.get("scope") ?? "";
    const scopes = rawScopes.split(/[ +]/);
    const allowedScopes = new Set(["read:user", "user:email"]);
    for (const scope of scopes) {
      expect(allowedScopes.has(scope)).toBe(true);
    }
  });

  it("open redirect: external callbackURL is rejected", async () => {
    const res = await request(testApp.http)
      .post("/api/auth/sign-in/social")
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ provider: "google", callbackURL: "https://evil.example/x" });

    expect(res.status).not.toBe(200);
    expect(res.body?.code).toBe("INVALID_CALLBACK_URL");
  });

  it("refresh via /me does not slide", async () => {
    const { cookie } = await signedInCookie(testApp.test);
    const match = cookie.match(/better-auth\.session_token=([^.;]+)/);
    const token = match![1];

    const initialExpiry = new Date(Date.now() + 13 * 86400 * 1000 - 60000);
    await testApp.db
      .update(schema.session)
      .set({ expiresAt: initialExpiry })
      .where(eq(schema.session.token, token));

    const res = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();

    const setCookies = res.headers["set-cookie"] ?? [];
    expect(setCookies.some((c: string) => c.includes("session_token"))).toBe(false);

    const [afterSession] = await testApp.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.token, token));
    expect(afterSession.expiresAt.getTime()).toBe(initialExpiry.getTime());
  });

  it("refresh via get-session slides", async () => {
    const { cookie } = await signedInCookie(testApp.test);
    const match = cookie.match(/better-auth\.session_token=([^.;]+)/);
    const token = match![1];

    const initialExpiry = new Date(Date.now() + 13 * 86400 * 1000 - 60000);
    await testApp.db
      .update(schema.session)
      .set({ expiresAt: initialExpiry })
      .where(eq(schema.session.token, token));

    const res = await request(testApp.http)
      .get("/api/auth/get-session")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);

    const setCookies = res.headers["set-cookie"] ?? [];
    const tokenCookie = setCookies.find((c: string) => c.includes("session_token"));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain("Max-Age=1209600");

    const [afterSession] = await testApp.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.token, token));

    const expectedMin = Date.now() + 14 * 86400 * 1000 - 120000;
    const expectedMax = Date.now() + 14 * 86400 * 1000 + 120000;
    expect(afterSession.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(afterSession.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it("expired session: returns { user: null } from /me", async () => {
    const { cookie } = await signedInCookie(testApp.test);
    const match = cookie.match(/better-auth\.session_token=([^.;]+)/);
    const token = match![1];

    await testApp.db
      .update(schema.session)
      .set({ expiresAt: new Date(Date.now() - 60000) })
      .where(eq(schema.session.token, token));

    const res = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("sign-out revokes session in DB and invalidates subsequent calls", async () => {
    const { cookie, userId } = await signedInCookie(testApp.test);

    const signOutRes = await request(testApp.http)
      .post("/api/auth/sign-out")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(signOutRes.status).toBe(200);

    const remainingSessions = await testApp.db
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, userId));
    expect(remainingSessions).toHaveLength(0);

    const meRes = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", cookie);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({ user: null });
  });

  it("default-deny 401: non-public route requires session", async () => {
    // Anonymous call fails with 401
    const anonRes = await request(testApp.http).get("/api/v1/test/protected");
    expect(anonRes.status).toBe(401);
    expect(anonRes.body.code).toBe("unauthorized");

    // Signed-in call succeeds with 200
    const { cookie } = await signedInCookie(testApp.test);
    const authRes = await request(testApp.http)
      .get("/api/v1/test/protected")
      .set("Cookie", cookie);
    expect(authRes.status).toBe(200);
    expect(authRes.body).toEqual({ ok: true });
  });

  it("origin 403: cross-site or missing Origin rejected on non-GET routes", async () => {
    // Missing Origin -> 403
    const missingRes = await request(testApp.http)
      .post("/api/v1/test/echo")
      .send({ hello: "world" });
    expect(missingRes.status).toBe(403);
    expect(missingRes.body.code).toBe("forbidden");

    // Foreign Origin -> 403
    const foreignRes = await request(testApp.http)
      .post("/api/v1/test/echo")
      .set("Origin", "https://evil.example")
      .send({ hello: "world" });
    expect(foreignRes.status).toBe(403);
    expect(foreignRes.body.code).toBe("forbidden");

    // Matching Origin -> 200 echoing parsed JSON body
    const validRes = await request(testApp.http)
      .post("/api/v1/test/echo")
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ hello: "world" });
    expect(validRes.status).toBe(200);
    expect(validRes.body).toEqual({ hello: "world" });
  });

  it("cookie attributes http: issues better-auth.session_token with HttpOnly and SameSite=Lax without Secure", async () => {
    const { cookie } = await signedInCookie(testApp.test);
    const match = cookie.match(/better-auth\.session_token=([^.;]+)/);
    const token = match![1];

    const targetExpiry = new Date(Date.now() + 13 * 86400 * 1000 - 60000);
    await testApp.db
      .update(schema.session)
      .set({ expiresAt: targetExpiry })
      .where(eq(schema.session.token, token));

    const res = await request(testApp.http)
      .get("/api/auth/get-session")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    const setCookies = res.headers["set-cookie"] ?? [];
    const tokenCookie = setCookies.find((c: string) => c.includes("session_token"));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain("better-auth.session_token=");
    expect(tokenCookie).not.toContain("__Secure-");
    expect(tokenCookie).toContain("HttpOnly");
    expect(tokenCookie).toContain("SameSite=Lax");
    expect(tokenCookie).not.toContain("Secure;");
  });

  it("cookie attributes https: issues __Secure-better-auth.session_token with HttpOnly, Secure, and SameSite=Lax", async () => {
    const httpsApp = await createTestApp({
      PUBLIC_URL: "https://userhq.test",
    });
    try {
      const { cookie } = await signedInCookie(httpsApp.test);
      const match = cookie.match(/__Secure-better-auth\.session_token=([^.;]+)/);
      const token = match![1];

      const targetExpiry = new Date(Date.now() + 13 * 86400 * 1000 - 60000);
      await httpsApp.db
        .update(schema.session)
        .set({ expiresAt: targetExpiry })
        .where(eq(schema.session.token, token));

      const res = await request(httpsApp.http)
        .get("/api/auth/get-session")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      const setCookies = res.headers["set-cookie"] ?? [];
      const tokenCookie = setCookies.find((c: string) => c.includes("session_token"));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain("__Secure-better-auth.session_token=");
      expect(tokenCookie).toContain("HttpOnly");
      expect(tokenCookie).toContain("Secure");
      expect(tokenCookie).toContain("SameSite=Lax");
    } finally {
      await httpsApp.close();
    }
  });

  it("config assertions: asserts D-01, D-03, D-04 invariants on auth config", () => {
    const opts = (testApp.auth as any).options;
    expect(opts.session?.expiresIn).toBe(1209600);
    expect(opts.session?.updateAge).toBe(86400);
    expect(opts.account?.accountLinking?.trustedProviders).toBeUndefined();
    expect(opts.account?.accountLinking?.enabled).not.toBe(false);
    expect(opts.account?.accountLinking?.disableImplicitLinking).not.toBe(true);
    expect(opts.account?.accountLinking?.updateUserInfoOnLink).not.toBe(true);
    expect(opts.trustedOrigins).toBeUndefined();
  });
});
