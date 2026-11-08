import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { eq } from "drizzle-orm";
import { createDb, schema, type Db } from "@userhq/db";
import { PostgresThrottlerStorage } from "../src/common/postgres-throttler-storage.js";
import { createTestDatabase } from "./support/test-app.js";

const { rateLimitHits } = schema;

describe("PostgresThrottlerStorage (no-block mode)", () => {
  let dbInfo: Awaited<ReturnType<typeof createTestDatabase>>;
  let db: Db;
  let pool: pg.Pool;
  let pool2: pg.Pool;
  let store: PostgresThrottlerStorage;
  let n = 0;
  const key = () => `test-key-${++n}`;

  beforeAll(async () => {
    dbInfo = await createTestDatabase();
    ({ db, pool } = createDb(dbInfo.url));
    ({ pool: pool2 } = createDb(dbInfo.url));
    store = new PostgresThrottlerStorage(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await pool2?.end();
    await dbInfo?.drop();
  });

  const seed = async (k: string, agesSeconds: number[], blockedUntil = 0) => {
    const now = Date.now();
    await db.insert(rateLimitHits).values({
      key: k,
      hits: agesSeconds.map((age) => now - age * 1000),
      blockedUntil,
      touchedAt: now,
      expiresAt: now + 60_000,
    });
  };
  const row = async (k: string) => (await db.select().from(rateLimitHits).where(eq(rateLimitHits.key, k)))[0];

  it("allows exactly the limit for 50 parallel calls, from one store and from two pools", async () => {
    const one = await Promise.all(
      Array.from({ length: 50 }, () => store.increment("parallel-one", 60_000, 20, 0, "t"))
    );
    expect(one.filter((r) => !r.isBlocked)).toHaveLength(20);
    expect(one.filter((r) => r.isBlocked)).toHaveLength(30);

    const second = new PostgresThrottlerStorage(pool2);
    const stores = [store, second];
    const two = await Promise.all(
      Array.from({ length: 50 }, (_, i) => stores[i % 2].increment("parallel-two", 60_000, 20, 0, "t"))
    );
    expect(two.filter((r) => !r.isBlocked)).toHaveLength(20);
    expect(two.filter((r) => r.isBlocked)).toHaveLength(30);
  });

  it("does not consume a slot on a refused call, and reports limit plus one", async () => {
    const k = key();
    for (let i = 0; i < 3; i++) expect((await store.increment(k, 60_000, 3, 0, "t")).isBlocked).toBe(false);
    const refused = await store.increment(k, 60_000, 3, 0, "t");
    expect(refused.isBlocked).toBe(true);
    expect(refused.totalHits).toBe(4);
    expect((await row(k)).hits).toHaveLength(3);
    // The window passes: age every hit out.
    await seed(`${k}-aged`, [61, 62, 63]);
    expect((await store.increment(`${k}-aged`, 60_000, 3, 0, "t")).isBlocked).toBe(false);
  });

  it("keeps keys independent", async () => {
    const k1 = key();
    const k2 = key();
    for (let i = 0; i < 2; i++) await store.increment(k1, 60_000, 2, 0, "t");
    expect((await store.increment(k1, 60_000, 2, 0, "t")).isBlocked).toBe(true);
    expect((await store.increment(k2, 60_000, 2, 0, "t")).isBlocked).toBe(false);
  });

  it("answers Retry-After as the seconds until the oldest counted hit leaves the window", async () => {
    const k = key();
    await seed(k, [45, ...Array.from({ length: 119 }, () => 1)]);
    const r = await store.increment(k, 60_000, 120, 0, "api-key");
    expect(r.isBlocked).toBe(true);
    expect(r.timeToBlockExpire).toBeGreaterThanOrEqual(14);
    expect(r.timeToBlockExpire).toBeLessThanOrEqual(15);
  });

  it("slides: expired hits free slots and the window is not fixed", async () => {
    const stale = key();
    await seed(stale, [70, 80, 90]);
    expect((await store.increment(stale, 60_000, 3, 0, "t")).isBlocked).toBe(false);
    expect((await row(stale)).hits).toHaveLength(1);

    const sliding = key();
    await seed(sliding, [50, 40, 30]);
    const refused = await store.increment(sliding, 60_000, 3, 0, "t");
    expect(refused.isBlocked).toBe(true);
    expect(refused.timeToBlockExpire).toBeGreaterThanOrEqual(9);
    expect(refused.timeToBlockExpire).toBeLessThanOrEqual(10);

    const moved = key();
    await seed(moved, [61, 40, 30]);
    expect((await store.increment(moved, 60_000, 3, 0, "t")).isBlocked).toBe(false);
  });

  it("stores only the key and epoch-ms integers", async () => {
    const k = key();
    await store.increment(k, 60_000, 5, 0, "secret-throttler-name");
    const r = await row(k);
    expect(Object.keys(r).sort()).toEqual(["blockedUntil", "expiresAt", "hits", "key", "touchedAt"]);
    for (const h of r.hits) expect(Number.isInteger(h)).toBe(true);
    expect(JSON.stringify(r)).not.toContain("secret-throttler-name");
  });

  it("issues exactly one query per increment", async () => {
    const calls: unknown[] = [];
    const spyPool = { query: (...args: unknown[]) => (calls.push(args), pool.query(...(args as [string, unknown[]]))) } as unknown as pg.Pool;
    const spied = new PostgresThrottlerStorage(spyPool);
    await spied.increment(key(), 60_000, 5, 0, "t");
    expect(calls).toHaveLength(1);
  });
});
