import { pgTable, text, bigint } from "drizzle-orm/pg-core";

/**
 * Shared counters behind the API's rate limiters. Global infrastructure, not tenant data: rows are keyed by
 * opaque limiter keys (an api-key id or an md5 of route and caller) and hold only epoch-ms timestamps.
 * No index: every request rewrites its row, and an index on expires_at would block in-place updates.
 */
export const rateLimitHits = pgTable("rate_limit_hits", {
  key: text("key").primaryKey(),
  hits: bigint("hits", { mode: "number" }).array().notNull(),
  blockedUntil: bigint("blocked_until", { mode: "number" }).notNull().default(0),
  touchedAt: bigint("touched_at", { mode: "number" }).notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});
