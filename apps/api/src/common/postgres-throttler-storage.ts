import { ThrottlerStorageService } from "@nestjs/throttler";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type pg from "pg";

/**
 * Rate-limit counters shared by every API instance, kept in the `rate_limit_hits` table.
 *
 * One INSERT ... ON CONFLICT DO UPDATE per call: the row lock makes concurrent callers (also across
 * replicas) serialize, so the limit is exact. The database clock is the only clock used, so replica
 * clock skew cannot matter. `blocked_until` is "refused until this epoch-ms".
 *
 * The throttler name is not stored: keys already embed it (ThrottlerGuard) or are unique (api-key:{id}).
 */

/** Hits still inside the window, as of this call's database time. */
const LIVE = `ARRAY(SELECT h FROM unnest(r.hits) AS h WHERE h > excluded.touched_at - $2::bigint)`;

const NO_BLOCK_SQL = `
INSERT INTO rate_limit_hits AS r (key, hits, blocked_until, touched_at, expires_at)
SELECT $1::text, ARRAY[c.n], 0, c.n, c.n + $2::bigint
FROM (SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS n) AS c
ON CONFLICT (key) DO UPDATE SET
  hits = CASE WHEN cardinality(${LIVE}) >= $3::int THEN ${LIVE} ELSE ${LIVE} || excluded.touched_at END,
  blocked_until = CASE WHEN cardinality(${LIVE}) >= $3::int
                       THEN (SELECT min(h) FROM unnest(${LIVE}) AS h) + $2::bigint ELSE 0 END,
  touched_at = excluded.touched_at,
  expires_at = excluded.touched_at + $2::bigint
RETURNING cardinality(hits)::int AS hits_count,
          (SELECT min(h) FROM unnest(hits) AS h) AS oldest, blocked_until, touched_at`;

export class PostgresThrottlerStorage implements ThrottlerStorage {
  // Task 1 sequencing: block mode (the @Throttle routes) still runs in process until the shared statement lands.
  private readonly blockMode = new ThrottlerStorageService();

  constructor(private readonly pool: pg.Pool) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    if (limit < 1) throw new Error("PostgresThrottlerStorage needs a limit of at least 1.");
    if (blockDuration > 0) return this.blockMode.increment(key, ttl, limit, blockDuration, throttlerName);

    const { rows } = await this.pool.query(NO_BLOCK_SQL, [key, ttl, limit]);
    const row = rows[0];
    const touched = Number(row.touched_at);
    const blockedUntil = Number(row.blocked_until);
    const rejected = blockedUntil > touched;
    return {
      totalHits: row.hits_count + (rejected ? 1 : 0),
      timeToExpire: Math.ceil((Number(row.oldest) + ttl - touched) / 1000),
      isBlocked: rejected,
      timeToBlockExpire: rejected ? Math.ceil((blockedUntil - touched) / 1000) : 0,
    };
  }
}
