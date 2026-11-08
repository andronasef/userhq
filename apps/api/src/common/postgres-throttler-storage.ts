import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type pg from "pg";
import { ENV, type Env } from "../env.js";

/**
 * Rate-limit counters shared by every API instance, kept in the `rate_limit_hits` table.
 *
 * One INSERT ... ON CONFLICT DO UPDATE per call, one round trip: the row lock makes concurrent callers
 * (also across replicas) serialize, so the limit is exact. The database clock is the only clock used, so
 * replica clock skew cannot matter.
 *
 * `blocked_until` means "refused until this epoch-ms". With blockDuration 0 (API keys) it is the moment the
 * oldest counted hit leaves the window, and a refused hit is not counted (sliding window). With
 * blockDuration above 0 (the @Throttle routes) the exceeding hit is counted, the key is blocked for
 * blockDuration, and on expiry it restarts from one fresh hit. Both match the throttler package's own
 * in-process storage; a parity test pins that.
 *
 * The throttler name is not stored: keys already embed it (ThrottlerGuard) or are unique (api-key:{id}).
 *
 * Failure policy (decided, not accidental): FAIL OPEN. If the store errors, the request is allowed and a
 * warning is logged. Counters protect availability and abuse, not secrets: no throttled route guards
 * credentials (API-key authentication runs before and independent of this limiter, and sign-in throttling
 * belongs to Better Auth), so a store outage must not become an API outage. A future limiter that guards a
 * secret must not reuse this path silently.
 *
 * ponytail: no batching of the purge DELETE (the table holds only active limiter keys) and no query timeout
 * (a hung store waits like any other call on the shared pool). Add LIMIT batches or a statement_timeout if
 * either ever shows up.
 */

/** Hits still inside the window, as of this call's database time. */
const LIVE = `ARRAY(SELECT h FROM unnest(r.hits) AS h WHERE h > excluded.touched_at - $2::bigint)`;
/** Live hits, or none once a block has run out. */
const AFTER_BLOCK = `CASE WHEN r.blocked_until > 0 AND r.blocked_until <= excluded.touched_at THEN '{}'::bigint[] ELSE ${LIVE} END`;
const STILL_BLOCKED = `r.blocked_until > excluded.touched_at`;

const HEAD = `
INSERT INTO rate_limit_hits AS r (key, hits, blocked_until, touched_at, expires_at)
SELECT $1::text, ARRAY[c.n], 0, c.n, c.n + $2::bigint
FROM (SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS n) AS c
ON CONFLICT (key) DO UPDATE SET`;
const TAIL = `
  touched_at = excluded.touched_at,
  expires_at = excluded.touched_at + $2::bigint
RETURNING cardinality(hits)::int AS hits_count,
          (SELECT min(h) FROM unnest(hits) AS h) AS oldest, blocked_until, touched_at`;

/** blockDuration 0: sliding window; at the limit the hit is refused and not counted. */
const NO_BLOCK_SQL = `${HEAD}
  hits = CASE WHEN cardinality(${LIVE}) >= $3::int THEN ${LIVE} ELSE ${LIVE} || excluded.touched_at END,
  blocked_until = CASE WHEN cardinality(${LIVE}) >= $3::int
                       THEN (SELECT min(h) FROM unnest(${LIVE}) AS h) + $2::bigint ELSE 0 END,${TAIL}`;

/** blockDuration above 0: count the exceeding hit, then block for $4 ms. */
const BLOCK_SQL = `${HEAD}
  hits = CASE WHEN ${STILL_BLOCKED} THEN ${LIVE} ELSE (${AFTER_BLOCK}) || excluded.touched_at END,
  blocked_until = CASE WHEN ${STILL_BLOCKED} THEN r.blocked_until
                       WHEN cardinality(${AFTER_BLOCK}) >= $3::int THEN excluded.touched_at + $4::bigint
                       ELSE 0 END,${TAIL}`;

export class PostgresThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger("RateLimitStore");

  constructor(private readonly pool: pg.Pool) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    if (limit < 1) throw new Error("PostgresThrottlerStorage needs a limit of at least 1.");
    try {
      const block = blockDuration > 0;
      const { rows } = await this.pool.query(
        block ? BLOCK_SQL : NO_BLOCK_SQL,
        block ? [key, ttl, limit, blockDuration] : [key, ttl, limit]
      );
      const row = rows[0];
      const touched = Number(row.touched_at);
      const blockedUntil = Number(row.blocked_until);
      const rejected = blockedUntil > touched;
      return {
        // The in-process storage reports limit + 1 for a refused hit that it did not count.
        totalHits: row.hits_count + (rejected && !block ? 1 : 0),
        timeToExpire: Math.ceil((Number(row.oldest) + ttl - touched) / 1000),
        isBlocked: rejected,
        timeToBlockExpire: rejected ? Math.ceil((blockedUntil - touched) / 1000) : 0,
      };
    } catch (err) {
      // Never log the key: it identifies a caller.
      this.logger.warn(
        `Rate limit store failed, allowing the request (fail open): ${(err as Error)?.message ?? err} [throttler ${throttlerName}]`
      );
      return { totalHits: 0, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  /** Deletes rows with no live hit and no live block. Returns the deleted count. */
  async purgeExpired(): Promise<number> {
    const { rows } = await this.pool.query(
      `WITH purged AS (
         DELETE FROM rate_limit_hits
         WHERE expires_at < (extract(epoch FROM clock_timestamp()) * 1000)::bigint
           AND blocked_until < (extract(epoch FROM clock_timestamp()) * 1000)::bigint
         RETURNING 1
       ) SELECT count(*)::int AS count FROM purged`
    );
    return rows[0]?.count ?? 0;
  }
}

/** Interval job, shaped like WebhookWorker: skipped under NODE_ENV test, unref'd, never overlaps itself. */
@Injectable()
export class RateLimitSweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RateLimitSweeper.name);
  private intervalRef?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @Inject(PostgresThrottlerStorage) private readonly storage: PostgresThrottlerStorage,
    @Inject(ENV) private readonly env: Env
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.NODE_ENV !== "test") {
      this.intervalRef = setInterval(() => void this.tick(), 60_000);
      this.intervalRef.unref?.();
    }
  }

  onApplicationShutdown(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = undefined;
    }
  }

  /** Purge count, or null when a pass is already running or the purge failed (logged, never thrown: a timer must not crash the process). */
  async tick(): Promise<number | null> {
    if (this.running) return null;
    this.running = true;
    try {
      return await this.storage.purgeExpired();
    } catch (err) {
      this.logger.warn(`Rate limit purge failed: ${(err as Error)?.message ?? err}`);
      return null;
    } finally {
      this.running = false;
    }
  }
}
