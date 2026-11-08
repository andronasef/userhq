import { Injectable, Inject, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, type Db } from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { enqueueWebhookEvent } from "../webhooks/outbox.js";

type DueEntry = {
  id: string;
  product_id: string;
  workspace_id: string;
  title: string;
  summary: string | null;
  published_at: Date;
};

@Injectable()
export class ChangelogScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ChangelogScheduler.name);
  private intervalRef?: NodeJS.Timeout;
  private running = false;

  constructor(@Inject(DB) private readonly db: Db, @Inject(ENV) private readonly env: Env) {}

  onApplicationBootstrap(): void {
    if (this.env.NODE_ENV === "test") return;
    this.intervalRef = setInterval(() => {
      this.tick().catch((error) => this.logger.error(`Changelog scheduler tick failed: ${error?.message ?? error}`));
    }, 60_000);
    this.intervalRef.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.intervalRef = undefined;
  }

  /** Returns the number of due entries processed, including events suppressed by the module gate. */
  async tick(now: Date = new Date()): Promise<number | null> {
    if (this.running) return null;
    this.running = true;
    try {
      // ponytail: one batch of at most 100 entries per tick; any enqueue failure rolls back the batch
      // and leaves its entries available for retry on the next tick.
      return await this.db.transaction(async (tx) => {
        const claimed = await tx.execute<DueEntry>(sql`
          WITH due AS (
            SELECT e.id, p.workspace_id
            FROM changelog_entries e
            JOIN products p ON p.id = e.product_id
            JOIN workspaces w ON w.id = p.workspace_id
            WHERE e.announced_at IS NULL
              AND e.published_at <= ${now.toISOString()}::timestamptz
              AND p.deleted_at IS NULL AND w.deleted_at IS NULL
            ORDER BY e.published_at, e.id
            LIMIT 100
            FOR UPDATE OF e SKIP LOCKED
          )
          UPDATE changelog_entries e
          SET announced_at = ${now.toISOString()}::timestamptz
          FROM due
          WHERE e.id = due.id AND e.announced_at IS NULL
          RETURNING e.id, e.product_id, due.workspace_id, e.title, e.summary, e.published_at
        `);
        for (const entry of claimed.rows) {
          // Keep the claim even when Changelog is off: suppressed events must never replay on re-enable.
          await enqueueWebhookEvent(tx, {
            workspaceId: entry.workspace_id,
            productId: entry.product_id,
            eventType: "changelog.published",
            data: { id: entry.id, title: entry.title, summary: entry.summary, publishedAt: new Date(entry.published_at).toISOString() },
          });
        }
        return claimed.rows.length;
      });
    } finally {
      this.running = false;
    }
  }
}
