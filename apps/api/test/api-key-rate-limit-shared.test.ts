import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { API_KEY_RATE_LIMIT } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

type TestApp = Awaited<ReturnType<typeof createTestApp>>;

/**
 * Two (or more) API instances on ONE database must jointly enforce each limit: the counters live in
 * PostgreSQL, not in a process (quick-261108-qrv).
 */
describe("rate limits are shared across API instances", () => {
  let a: TestApp;
  let b: TestApp;
  let admin: { cookie: string; userId: string };
  let wsSlug: string;
  const extra: TestApp[] = [];

  const mint = async (name: string) => {
    const res = await request(a.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", a.env.PUBLIC_URL)
      .send({ name, scopes: ["requests:read"] });
    expect(res.status).toBe(201);
    return res.body.token as string;
  };
  const url = () => `/api/v1/workspaces/${wsSlug}/requests?limit=1`;
  const hit = (app: TestApp, token: string) =>
    request(app.http).get(url()).set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    a = await createTestApp();
    b = await createTestApp({ DATABASE_URL: a.env.DATABASE_URL });
    admin = await signedInCookie(a.test, { name: "Shared Admin", email: "admin@shared-limit.test", emailVerified: true });
    wsSlug = `ws-shared-${Date.now()}`;
    const [ws] = await a.db.insert(schema.workspaces).values({ name: "Shared", slug: wsSlug }).returning();
    await a.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: admin.userId, role: "owner" });
  });

  afterAll(async () => {
    for (const app of extra) await app.close();
    await b?.close();
    await a?.close();
  });

  it("jointly enforces API_KEY_RATE_LIMIT across two instances, per key, and never limits humans", async () => {
    const token = await mint("Shared A");
    const other = await mint("Shared B");
    const apps = [a, b];
    for (let i = 0; i < API_KEY_RATE_LIMIT.limit; i++) {
      const res = await hit(apps[i % 2], token);
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
    for (const app of apps) {
      const blocked = await hit(app, token);
      expect(blocked.status).toBe(429);
      expect(blocked.body.code).toBe("rate_limited");
      expect(blocked.headers["retry-after"]).toMatch(/^\d+$/);
      const retry = Number(blocked.headers["retry-after"]);
      expect(retry).toBeGreaterThanOrEqual(1);
      expect(retry).toBeLessThanOrEqual(API_KEY_RATE_LIMIT.windowSeconds);

      expect((await hit(app, other)).status).toBe(200);
      const human = await request(app.http).get(url()).set("Cookie", admin.cookie);
      expect(human.status).toBe(200);
    }

    // A new instance does not reset counters, and neither does a restart.
    const c = await createTestApp({ DATABASE_URL: a.env.DATABASE_URL });
    expect((await hit(c, token)).status).toBe(429);
    await c.close();
    const d = await createTestApp({ DATABASE_URL: a.env.DATABASE_URL });
    extra.push(d);
    expect((await hit(d, token)).status).toBe(429);
  });

  it("admits exactly the limit for 130 parallel requests across two instances", async () => {
    const token = await mint("Parallel");
    const apps = [a, b];
    const results = await Promise.all(Array.from({ length: 130 }, (_, i) => hit(apps[i % 2], token)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(API_KEY_RATE_LIMIT.limit);
    expect(statuses.filter((s) => s === 429)).toHaveLength(130 - API_KEY_RATE_LIMIT.limit);
  });
});
