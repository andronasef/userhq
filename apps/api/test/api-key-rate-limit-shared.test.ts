import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import pg from "pg";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { API_KEY_RATE_LIMIT } from "@userhq/types";
import { REDELIVER_THROTTLE } from "../src/webhooks/webhooks.controller.js";
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

  it("initializes fresh integration actors under parallel first use without server errors", async () => {
    for (let wave = 0; wave < 8; wave++) {
      const token = await mint(`First use ${wave}`);
      const apps = [a, b];
      const results = await Promise.all(Array.from({ length: 130 }, (_, i) => hit(apps[i % 2], token)));
      const counts = results.reduce<Record<number, number>>((all, res) => {
        all[res.status] = (all[res.status] ?? 0) + 1;
        return all;
      }, {});
      expect(counts).toEqual({ 200: API_KEY_RATE_LIMIT.limit, 429: 130 - API_KEY_RATE_LIMIT.limit });
    }
  });

  it("fails closed if an integration email belongs to a different identity", async () => {
    const key = await request(a.http)
      .post(`/api/v1/workspaces/${wsSlug}/api-keys`)
      .set("Cookie", admin.cookie)
      .set("Origin", a.env.PUBLIC_URL)
      .send({ name: "Identity conflict", scopes: ["requests:read"] });
    expect(key.status).toBe(201);
    const personId = randomUUID();
    await a.db.insert(schema.user).values({ id: personId, name: "Unrelated person", email: `${key.body.key.id}@api.userhq.invalid` });
    expect((await hit(a, key.body.token)).status).toBe(500);
    const [person] = await a.db.select().from(schema.user).where(eq(schema.user.id, personId));
    expect(person.name).toBe("Unrelated person");
    const actors = await a.db.select().from(schema.user).where(eq(schema.user.id, `integration:${key.body.key.id}`));
    expect(actors).toHaveLength(0);
  });

  it("shares the redeliver limit (REDELIVER_THROTTLE) across two instances", async () => {
    const who = await signedInCookie(a.test, { name: "Redeliverer", email: "redeliver@shared-limit.test", emailVerified: true });
    const [ws] = await a.db.select().from(schema.workspaces).limit(1);
    await a.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: who.userId, role: "admin" });
    const apps = [a, b];
    const post = (app: TestApp) =>
      request(app.http)
        .post(`/api/v1/workspaces/${wsSlug}/webhooks/${randomUUID()}/deliveries/${randomUUID()}/redeliver`)
        .set("Cookie", who.cookie)
        .set("Origin", app.env.PUBLIC_URL);
    for (let i = 0; i < REDELIVER_THROTTLE.limit; i++) {
      expect((await post(apps[i % 2])).status, `call ${i + 1}`).not.toBe(429);
    }
    for (const app of apps) {
      const res = await post(app);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("rate_limited");
      expect(res.headers["retry-after"]).toMatch(/^\d+$/);
    }
  });

  it("shares another @Throttle route (account preferences, 30 per minute) across two instances", async () => {
    const who = await signedInCookie(a.test, { name: "Prefs", email: "prefs@shared-limit.test", emailVerified: true });
    const apps = [a, b];
    const patch = (app: TestApp) =>
      request(app.http).patch("/api/v1/account/preferences").set("Cookie", who.cookie).set("Origin", app.env.PUBLIC_URL).send({ commentEmails: true });
    for (let i = 0; i < 30; i++) expect((await patch(apps[i % 2])).status, `call ${i + 1}`).toBe(200);
    expect((await patch(a)).status).toBe(429);
    expect((await patch(b)).status).toBe(429);
  });

  it("fails open with a logged warning when the counter store is unavailable, and resumes after", async () => {
    const token = await mint("Fail open");
    const admin2 = new pg.Client({ connectionString: a.env.DATABASE_URL });
    await admin2.connect();
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    try {
      await admin2.query("ALTER TABLE rate_limit_hits RENAME TO rate_limit_hits_away");
      const res = await hit(a, token);
      expect(res.status).toBe(200);
      expect(warn.mock.calls.some((c) => String(c[0]).includes("fail open"))).toBe(true);
    } finally {
      await admin2.query("ALTER TABLE IF EXISTS rate_limit_hits_away RENAME TO rate_limit_hits");
      await admin2.end();
      warn.mockRestore();
    }
    for (let i = 0; i < API_KEY_RATE_LIMIT.limit; i++) expect((await hit(a, token)).status).toBe(200);
    expect((await hit(b, token)).status).toBe(429);
  });
});
