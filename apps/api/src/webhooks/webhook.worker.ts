import {
  Injectable,
  Inject,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  webhookDeliveries,
  webhookSubscriptions,
} from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { signWebhookPayload } from "./signature.js";
import { OutboundHttp, OutboundError } from "../common/outbound-http.js";

const BACKOFF_MINUTES = [1, 5, 30, 120, 360]; // 1m, 5m, 30m, 2h, 6h
const MAX_ATTEMPTS = 5;

@Injectable()
export class WebhookWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WebhookWorker.name);
  private intervalRef?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly outbound: OutboundHttp
  ) {}

  onApplicationBootstrap(): void {
    if (this.env.NODE_ENV !== "test") {
      this.intervalRef = setInterval(() => {
        this.runOnce(new Date()).catch((err) =>
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

  async runOnce(now: Date = new Date()): Promise<{
    claimed: number;
    delivered: number;
    failed: number;
  }> {
    let deliveredCount = 0;
    let failedCount = 0;

    const reclaimThreshold = new Date(now.getTime() - 10 * 60_000);

    const claimedDeliveries = await this.db.transaction(async (tx) => {
      const res = await tx.execute<{
        id: string;
        subscription_id: string;
        workspace_id: string;
        event_type: string;
        payload: any;
        attempts: number;
      }>(sql`
        UPDATE webhook_deliveries SET status = 'sending', claimed_at = now()
        WHERE id IN (
          SELECT id FROM webhook_deliveries
          WHERE (status = 'pending' AND next_attempt_at <= ${now})
             OR (status = 'sending' AND claimed_at < ${reclaimThreshold})
          ORDER BY next_attempt_at LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        RETURNING id, subscription_id, workspace_id, event_type, payload, attempts;
      `);
      return ((res as any).rows ?? res) as Array<{
        id: string;
        subscription_id: string;
        workspace_id: string;
        event_type: string;
        payload: any;
        attempts: number;
      }>;
    });

    for (const delivery of claimedDeliveries) {
      const [sub] = await this.db
        .select()
        .from(webhookSubscriptions)
        .where(eq(webhookSubscriptions.id, delivery.subscription_id))
        .limit(1);

      if (!sub || !sub.isActive) {
        await this.db
          .update(webhookDeliveries)
          .set({
            status: "failed",
            errorMessage: !sub ? "Subscription not found" : "Subscription inactive",
          })
          .where(eq(webhookDeliveries.id, delivery.id));
        failedCount++;
        continue;
      }

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

      const newAttempts = delivery.attempts + 1;

      if (isSuccess) {
        await this.db
          .update(webhookDeliveries)
          .set({
            status: "delivered",
            attempts: newAttempts,
            responseStatusCode: statusCode,
            responseBody,
            errorMessage: null,
            deliveredAt: new Date(),
          })
          .where(eq(webhookDeliveries.id, delivery.id));
        deliveredCount++;
      } else {
        if (newAttempts >= MAX_ATTEMPTS) {
          await this.db
            .update(webhookDeliveries)
            .set({
              status: "failed",
              attempts: newAttempts,
              responseStatusCode: statusCode,
              responseBody,
              errorMessage: errorMsg,
            })
            .where(eq(webhookDeliveries.id, delivery.id));
          failedCount++;
        } else {
          const delayMinutes = BACKOFF_MINUTES[newAttempts - 1] ?? 360;
          const nextAttempt = new Date(now.getTime() + delayMinutes * 60_000);
          await this.db
            .update(webhookDeliveries)
            .set({
              status: "pending",
              attempts: newAttempts,
              responseStatusCode: statusCode,
              responseBody,
              errorMessage: errorMsg,
              nextAttemptAt: nextAttempt,
            })
            .where(eq(webhookDeliveries.id, delivery.id));
        }
      }
    }

    return {
      claimed: claimedDeliveries.length,
      delivered: deliveredCount,
      failed: failedCount,
    };
  }
}
