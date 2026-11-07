import {
  Injectable,
  Inject,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  products,
  webhookDeliveries,
  webhookSubscriptions,
} from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { signWebhookPayload } from "./signature.js";
import { OutboundHttp, OutboundError } from "../common/outbound-http.js";
import { webhookEventModule } from "./outbox.js";
import { featureEnabled, pickFeatures, productFeatureColumns } from "../portal/product-features.js";

export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_RETENTION_DAYS = 30;
export const WEBHOOK_CONCURRENCY = 5;

const BACKOFF_MINUTES = [1, 5, 30, 120]; // between attempts 1-2, 2-3, 3-4, 4-5
const BACKOFF_CAP_MINUTES = 360;
// A row stuck in 'sending' (crashed worker) is reclaimed after this long.
const STUCK_CLAIM_MS = 10 * 60_000;
const PURGE_EVERY_MS = 60 * 60_000;

/** Minutes to wait after the given failed attempt (1-based), never more than 6 hours. */
export function backoffMinutes(attempt: number): number {
  return BACKOFF_MINUTES[attempt - 1] ?? BACKOFF_CAP_MINUTES;
}

type ClaimedDelivery = {
  id: string;
  subscription_id: string;
  workspace_id: string;
  event_type: string;
  payload: any;
  /** Already incremented by the claim: the attempt number this claimant owns. */
  attempts: number;
};

export interface WebhookRunResult {
  claimed: number;
  delivered: number;
  failed: number;
  suppressed: number;
}

@Injectable()
export class WebhookWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WebhookWorker.name);
  private intervalRef?: NodeJS.Timeout;
  private running = false;
  private lastPurgeAt = 0;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly outbound: OutboundHttp
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.NODE_ENV !== "test") {
      this.intervalRef = setInterval(() => {
        this.tick().catch((err) =>
          this.logger.error(`Webhook worker tick failed: ${err?.message ?? err}`)
        );
      }, 15_000);
      this.intervalRef.unref?.();
      this.logger.log("Webhook worker started with 15s interval");
    }
  }

  onApplicationShutdown(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = undefined;
    }
  }

  /** One interval pass: never overlaps itself, purges old rows at most hourly. Null when a pass is already running. */
  async tick(now: Date = new Date()): Promise<WebhookRunResult | null> {
    if (this.running) return null;
    this.running = true;
    try {
      const result = await this.runOnce(now);
      if (now.getTime() - this.lastPurgeAt >= PURGE_EVERY_MS) {
        this.lastPurgeAt = now.getTime();
        await this.purgeOldDeliveries(now);
      }
      return result;
    } finally {
      this.running = false;
    }
  }

  /**
   * Deletes final deliveries (delivered, failed, suppressed) whose last claim, else creation, is older than the
   * retention period. Pending and sending rows are never purged.
   * ponytail: one statement, no batching; add LIMIT batches if the table ever reaches millions of rows.
   */
  async purgeOldDeliveries(now: Date = new Date(), days: number = WEBHOOK_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60_000);
    const res = await this.db.execute(sql`
      WITH purged AS (
        DELETE FROM webhook_deliveries
        WHERE status IN ('delivered', 'failed', 'suppressed')
          AND coalesce(claimed_at, created_at) < ${cutoff}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM purged
    `);
    const rows = ((res as any).rows ?? res) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  async runOnce(now: Date = new Date()): Promise<WebhookRunResult> {
    const result: WebhookRunResult = { claimed: 0, delivered: 0, failed: 0, suppressed: 0 };
    const reclaimThreshold = new Date(now.getTime() - STUCK_CLAIM_MS);

    // The attempt is counted here, by the claimant, so a crash loop consumes attempts and
    // completion can be conditional on a value only the current claimant holds.
    const claimed = await this.db.transaction(async (tx) => {
      const res = await tx.execute<ClaimedDelivery>(sql`
        UPDATE webhook_deliveries SET status = 'sending', claimed_at = now(), attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM webhook_deliveries
          WHERE (status = 'pending' AND next_attempt_at <= ${now})
             OR (status = 'sending' AND claimed_at < ${reclaimThreshold})
          ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        RETURNING id, subscription_id, workspace_id, event_type, payload, attempts;
      `);
      return ((res as any).rows ?? res) as ClaimedDelivery[];
    });
    result.claimed = claimed.length;

    let next = 0;
    const loop = async () => {
      while (next < claimed.length) {
        const delivery = claimed[next++];
        try {
          await this.deliver(delivery, now, result);
        } catch (err: any) {
          // Left in 'sending'; reclaimed after the stuck timeout and bounded by the attempt cap.
          this.logger.error(`Webhook delivery ${delivery.id} errored: ${err?.message ?? err}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(WEBHOOK_CONCURRENCY, claimed.length) }, loop));

    return result;
  }

  /** Writes the outcome only if this claimant still owns the row; a taken-over row is left as the new owner has it. */
  private async complete(
    delivery: ClaimedDelivery,
    set: Partial<typeof webhookDeliveries.$inferInsert>
  ): Promise<boolean> {
    const rows = await this.db
      .update(webhookDeliveries)
      .set(set)
      .where(
        and(
          eq(webhookDeliveries.id, delivery.id),
          eq(webhookDeliveries.status, "sending"),
          eq(webhookDeliveries.attempts, delivery.attempts)
        )
      )
      .returning({ id: webhookDeliveries.id });
    if (rows.length === 0) {
      this.logger.warn(`Webhook delivery ${delivery.id} was taken over by another worker; dropping this result`);
      return false;
    }
    return true;
  }

  /** D-08/D-10: the module may have been switched off since the event was queued. Terminal, never replayed (D-14). */
  private async suppressionReason(delivery: ClaimedDelivery): Promise<string | null> {
    const module = webhookEventModule(delivery.event_type);
    const productId = delivery.payload?.product?.id;
    if (!module || typeof productId !== "string") return null;
    const [prod] = await this.db
      .select({ deletedAt: products.deletedAt, ...productFeatureColumns })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!prod || prod.deletedAt || !featureEnabled(pickFeatures(prod), module)) return `${module}_unavailable`;
    return null;
  }

  private async deliver(delivery: ClaimedDelivery, now: Date, result: WebhookRunResult): Promise<void> {
    if (delivery.attempts > WEBHOOK_MAX_ATTEMPTS) {
      // Every earlier claim crashed before completing; this one must not send.
      if (await this.complete(delivery, { status: "failed", errorMessage: "Maximum attempts reached" })) result.failed++;
      return;
    }

    const [sub] = await this.db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, delivery.subscription_id))
      .limit(1);

    if (!sub || !sub.isActive) {
      const errorMessage = !sub ? "Subscription not found" : "Subscription inactive";
      if (await this.complete(delivery, { status: "failed", errorMessage })) result.failed++;
      return;
    }

    const suppressed = await this.suppressionReason(delivery);
    if (suppressed) {
      if (await this.complete(delivery, { status: "suppressed", errorMessage: suppressed })) result.suppressed++;
      return;
    }

    // Signed at send time from the row just read, so a rotated secret applies to the very next attempt.
    const payloadString = JSON.stringify(delivery.payload);
    const { header, timestamp } = signWebhookPayload(payloadString, sub.secret);

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let isSuccess = false;
    let errorMsg: string | null = null;

    try {
      const res = await this.outbound.post(sub.url, {
        "Content-Type": "application/json",
        "User-Agent": "UserHQ-Webhooks/1.0",
        "X-UserHQ-Event": delivery.event_type,
        "X-UserHQ-Delivery": delivery.id,
        "X-UserHQ-Timestamp": String(timestamp),
        "X-UserHQ-Signature": header,
      }, payloadString);

      statusCode = res.statusCode;
      responseBody = res.body.slice(0, 1000);

      if (statusCode >= 200 && statusCode < 300) {
        isSuccess = true;
      } else {
        errorMsg = `HTTP ${statusCode}`;
      }
    } catch (err: any) {
      errorMsg = err instanceof OutboundError ? err.message : "Outbound request failed";
    }

    if (isSuccess) {
      const ok = await this.complete(delivery, {
        status: "delivered",
        responseStatusCode: statusCode,
        responseBody,
        errorMessage: null,
        deliveredAt: new Date(),
      });
      if (ok) result.delivered++;
    } else if (delivery.attempts >= WEBHOOK_MAX_ATTEMPTS) {
      const ok = await this.complete(delivery, {
        status: "failed",
        responseStatusCode: statusCode,
        responseBody,
        errorMessage: errorMsg,
      });
      if (ok) result.failed++;
    } else {
      await this.complete(delivery, {
        status: "pending",
        responseStatusCode: statusCode,
        responseBody,
        errorMessage: errorMsg,
        nextAttemptAt: new Date(now.getTime() + backoffMinutes(delivery.attempts) * 60_000),
      });
    }
  }
}
