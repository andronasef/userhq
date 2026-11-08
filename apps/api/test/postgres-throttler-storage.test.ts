import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { ThrottlerStorageService } from "@nestjs/throttler";
import pg from "pg";
import { eq } from "drizzle-orm";
import { createDb, schema, type Db } from "@userhq/db";
import { PostgresThrottlerStorage, RateLimitSweeper } from "../src/common/postgres-throttler-storage.js";
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

  describe("block mode", () => {
    it("matches the throttler package's own storage step by step, in both modes", async () => {
      for (const block of [0, 60_000]) {
        const oracle = new ThrottlerStorageService();
        const k = key();
        for (let i = 1; i <= 6; i++) {
          const want = await oracle.increment(k, 60_000, 3, block, "t");
          const got = await store.increment(k, 60_000, 3, block, "t");
          expect(got.isBlocked, `block ${block} step ${i} isBlocked`).toBe(want.isBlocked);
          expect(got.totalHits, `block ${block} step ${i} totalHits`).toBe(want.totalHits);
          expect(Math.abs(got.timeToExpire - want.timeToExpire), `block ${block} step ${i} timeToExpire`).toBeLessThanOrEqual(1);
          // The package reports a meaningless negative value when not blocked; callers read it only when blocked.
          if (want.isBlocked) {
            expect(Math.abs(got.timeToBlockExpire - want.timeToBlockExpire), `block ${block} step ${i} timeToBlockExpire`).toBeLessThanOrEqual(1);
          }
        }
        oracle.onApplicationShutdown();
      }
    });

    it("keeps a blocked key refused without counting new hits, then resets after the block", async () => {
      const k = key();
      const now = Date.now();
      await db.insert(rateLimitHits).values({
        key: k, hits: [now - 1000, now - 900, now - 800, now - 700], blockedUntil: now + 30_000, touchedAt: now, expiresAt: now + 60_000,
      });
      const r = await store.increment(k, 60_000, 3, 60_000, "t");
      expect(r.isBlocked).toBe(true);
      expect(r.timeToBlockExpire).toBeGreaterThanOrEqual(29);
      expect(r.timeToBlockExpire).toBeLessThanOrEqual(30);
      expect((await row(k)).hits).toHaveLength(4);

      await db.update(rateLimitHits).set({ blockedUntil: Date.now() - 1000 }).where(eq(rateLimitHits.key, k));
      const after = await store.increment(k, 60_000, 3, 60_000, "t");
      expect(after.isBlocked).toBe(false);
      const fresh = await row(k);
      expect(fresh.hits).toHaveLength(1);
      expect(fresh.blockedUntil).toBe(0);
    });

    it("issues exactly one query per increment in block mode", async () => {
      const calls: unknown[] = [];
      const spyPool = { query: (...args: unknown[]) => (calls.push(args), pool.query(...(args as [string, unknown[]]))) } as unknown as pg.Pool;
      await new PostgresThrottlerStorage(spyPool).increment(key(), 60_000, 5, 60_000, "t");
      expect(calls).toHaveLength(1);
    });
  });

  describe("housekeeping", () => {
    it("purgeExpired deletes only rows with no live hit and no live block", async () => {
      const now = Date.now();
      const base = { touchedAt: now - 200_000 };
      await db.insert(rateLimitHits).values([
        { key: "purge-dead", hits: [now - 190_000], blockedUntil: 0, expiresAt: now - 100_000, ...base },
        { key: "purge-dead-block", hits: [now - 190_000], blockedUntil: now - 5_000, expiresAt: now - 100_000, ...base },
        { key: "purge-live-hit", hits: [now - 1_000], blockedUntil: 0, expiresAt: now + 59_000, ...base },
        { key: "purge-blocked", hits: [now - 190_000], blockedUntil: now + 20_000, expiresAt: now - 100_000, ...base },
      ]);
      expect(await store.purgeExpired()).toBe(2);
      const left = (await db.select({ key: rateLimitHits.key }).from(rateLimitHits)).map((r) => r.key);
      expect(left).toEqual(expect.arrayContaining(["purge-live-hit", "purge-blocked"]));
      expect(left).not.toContain("purge-dead");
      expect(left).not.toContain("purge-dead-block");
    });

    it("sweeper ticks never overlap, never throw, and no interval starts under NODE_ENV test", async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let purges = 0;
      const fake = { purgeExpired: async () => (purges++, await gate, 0) } as unknown as PostgresThrottlerStorage;
      const sweeper = new RateLimitSweeper(fake, { NODE_ENV: "test" } as never);
      const first = sweeper.tick();
      expect(await sweeper.tick()).toBeNull();
      release();
      expect(await first).toBe(0);
      expect(purges).toBe(1);

      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      sweeper.onApplicationBootstrap();
      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();

      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      const broken = new RateLimitSweeper(new PostgresThrottlerStorage({ query: async () => { throw new Error("relation \"rate_limit_hits\" does not exist"); } } as unknown as pg.Pool), { NODE_ENV: "test" } as never);
      await expect(broken.tick()).resolves.toBeNull();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("failure mode (fail open)", () => {
    it("allows the request and logs a warning when the store errors, never naming the key", async () => {
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
      const broken = new PostgresThrottlerStorage({ query: async () => { throw new Error("connection refused"); } } as unknown as pg.Pool);
      const r = await broken.increment("super-secret-key-id", 60_000, 5, 0, "api-key");
      expect(r).toEqual({ totalHits: 0, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 });
      const text = warn.mock.calls.map((c) => String(c[0])).join("\n");
      expect(text).toContain("fail open");
      expect(text).toContain("connection refused");
      expect(text).toContain("api-key");
      expect(text).not.toContain("super-secret-key-id");
      warn.mockRestore();
    });
  });
});
