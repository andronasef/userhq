import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testUtils } from "better-auth/plugins";
import { createDb } from "@userhq/db";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { createAuth } from "../../src/auth/auth.js";
import type { Env } from "../../src/env.js";
import { signedInCookie } from "../support/test-app.js";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const databaseUrl = process.env.E2E_DATABASE_URL!;

describe("Session Flow E2E (Plan 01-06)", () => {
  let dbInstance: ReturnType<typeof createDb>;
  let sessionData: { cookie: string; userId: string; email: string };
  const collectedHtml: string[] = [];

  beforeAll(async () => {
    dbInstance = createDb(databaseUrl);

    const env: Env = {
      NODE_ENV: "production",
      PORT: 4000,
      DATABASE_URL: databaseUrl,
      PUBLIC_URL: baseUrl,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "428905b3e64f89d34cb01676f112e472652b0475f32ebf25091bcae52d3eb03a",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "dummy-google-client-id",
      GOOGLE_CLIENT_SECRET:
        process.env.GOOGLE_CLIENT_SECRET ?? "dummy-google-client-secret",
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "dummy-github-client-id",
      GITHUB_CLIENT_SECRET:
        process.env.GITHUB_CLIENT_SECRET ?? "dummy-github-client-secret",
      UPLOAD_DIR: "/data/uploads",
    };

    const auth = createAuth(dbInstance.db, env, [testUtils()]);
    const ctx = await (auth as any).$context;
    sessionData = await signedInCookie(ctx.test, { name: "E2E User" });
  });

  afterAll(async () => {
    if (sessionData?.userId && dbInstance) {
      await dbInstance.db
        .delete(schema.user)
        .where(eq(schema.user.id, sessionData.userId));
    }
    if (dbInstance?.pool) {
      await dbInstance.pool.end();
    }
  });

  it("case 1: GET / with cookie twice returns 200 with user identity and menu trigger", async () => {
    const res1 = await fetch(`${baseUrl}/`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(res1.status).toBe(200);
    const html1 = await res1.text();
    collectedHtml.push(html1);
    expect(html1).toContain("Workspace creation is invite-only");
    expect(html1).toContain('aria-label="Open account menu"');

    const res2 = await fetch(`${baseUrl}/`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(res2.status).toBe(200);
    const html2 = await res2.text();
    collectedHtml.push(html2);
    expect(html2).toContain("Workspace creation is invite-only");
    expect(html2).toContain('aria-label="Open account menu"');
  });

  it("case 2: GET /this-page-does-not-exist with cookie returns 404 with menu trigger", async () => {
    const res = await fetch(`${baseUrl}/this-page-does-not-exist`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(res.status).toBe(404);
    const html = await res.text();
    collectedHtml.push(html);
    expect(html).toContain('aria-label="Open account menu"');
  });

  it("case 3: GET /login?next=%2F with cookie redirects to safeNext(next)", async () => {
    const res = await fetch(`${baseUrl}/login?next=%2F`, {
      headers: { Cookie: sessionData.cookie },
      redirect: "manual",
    });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    const location = res.headers.get("location") ?? "";
    expect(location.endsWith("/")).toBe(true);
  });

  it("case 4: minted email never appears anywhere in rendered HTML", () => {
    for (const html of collectedHtml) {
      expect(html).not.toContain(sessionData.email);
    }
  });

  it("case 5: sign-out revokes session, /api/v1/me returns null, and / renders signed out", async () => {
    const signOutRes = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        Cookie: sessionData.cookie,
        Origin: baseUrl,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(signOutRes.status).toBe(200);

    const meRes = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(meRes.status).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.user).toBeNull();

    const homeRes = await fetch(`${baseUrl}/`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(homeRes.status).toBe(200);
    const homeHtml = await homeRes.text();
    expect(homeHtml).toMatch(/not signed in/i);
    expect(homeHtml).toContain("/login");
  });

  it("case 6: GET / without cookie shows signed-out state and link to /login", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/not signed in/i);
    expect(html).toContain("/login");
  });
});
