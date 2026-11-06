import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import webpush from "web-push";
import {
  DB,
  type Db,
  pushDeliveries,
  pushSubscriptions,
  pushPreferences,
} from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { getVapidKeys } from "./push.config.js";
import { OutboundHttp, OutboundError } from "../common/outbound-http.js";

const BACKOFF_MS = [
  5 * 1000, // 5 seconds
  30 * 1000, // 30 seconds
  2 * 60 * 1000, // 2 minutes
];

@Injectable()
export class PushWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly outbound: OutboundHttp
  ) {}

  onModuleInit() {
    // Ensure VAPID keys are initialized
    getVapidKeys(this.env);

    if (this.env.NODE_ENV !== "test") {
      this.timer = setInterval(() => {
        void this.processPending();
      }, 5000);
      this.timer.unref();
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async processPending(limit = 20): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      // Claim pending deliveries
      const claimedRows = await this.db.execute(sql`
        UPDATE push_deliveries
        SET status = 'sending', claimed_at = now()
        WHERE id IN (
          SELECT id FROM push_deliveries
          WHERE status = 'pending'
            AND next_attempt_at <= now()
          ORDER BY created_at ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, subscription_id, user_id, event_type, title, body, url, data, attempts
      `);

      const items: any[] = claimedRows.rows ?? claimedRows;
      if (items.length === 0) return 0;

      for (const item of items) {
        await this.deliverSingle(item);
      }

      return items.length;
    } catch (err) {
      this.logger.error("Error processing pending push deliveries", err);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  private async deliverSingle(item: {
    id: string;
    subscription_id: string;
    user_id: string;
    event_type: string;
    title: string;
    body: string;
    url?: string | null;
    data?: any;
    attempts: number;
  }): Promise<void> {
    const attempts = item.attempts + 1;

    // Check user push preferences before sending (D-02, D-10)
    const [pref] = await this.db
      .select({ enabled: pushPreferences.enabled })
      .from(pushPreferences)
      .where(eq(pushPreferences.userId, item.user_id))
      .limit(1);

    if (pref && !pref.enabled) {
      // User disabled notifications; mark as failed/canceled
      await this.db
        .update(pushDeliveries)
        .set({
          status: "failed",
          errorMessage: "Push notifications disabled by user preference",
        })
        .where(eq(pushDeliveries.id, item.id));
      return;
    }

    // Lookup subscription
    const [sub] = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.id, item.subscription_id))
      .limit(1);

    if (!sub) {
      await this.db
        .update(pushDeliveries)
        .set({
          status: "failed",
          errorMessage: "Subscription no longer exists",
        })
        .where(eq(pushDeliveries.id, item.id));
      return;
    }

    // One notification per post: a repeat event with the same tag replaces it and re-alerts.
    const postId = typeof item.data?.postId === "string" ? item.data.postId : null;
    const payload = JSON.stringify({
      title: item.title,
      body: item.body,
      url: item.url ?? "/",
      data: item.data ?? {},
      ...(postId ? { tag: `post-${postId}`, renotify: true } : {}),
    });

    try {
      // Generate encrypted bytes locally; the shared transport owns the single
      // DNS-to-response deadline and all network I/O.
      const details = webpush.generateRequestDetails(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      const result = await this.outbound.post(details.endpoint, details.headers, details.body ?? undefined);
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw Object.assign(new Error(`HTTP ${result.statusCode}`), { statusCode: result.statusCode });
      }

      // Successful delivery
      await this.db
        .update(pushDeliveries)
        .set({
          status: "delivered",
          attempts,
          deliveredAt: new Date(),
          errorMessage: null,
        })
        .where(eq(pushDeliveries.id, item.id));
    } catch (err: any) {
      const statusCode = err?.statusCode;
      const errorMessage = err instanceof OutboundError ? err.message
        : typeof statusCode === "number" ? `HTTP ${statusCode}` : "Push delivery failed";

      // 404 Not Found or 410 Gone means the subscription has expired or unsubscribed
      if (statusCode === 404 || statusCode === 410) {
        this.logger.warn(
          `Push subscription ${sub.id} expired (${statusCode}), removing.`
        );
        await this.db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));

        await this.db
          .update(pushDeliveries)
          .set({
            status: "failed",
            attempts,
            errorMessage: `Subscription expired (${statusCode})`,
          })
          .where(eq(pushDeliveries.id, item.id));
        return;
      }

      if (attempts >= 3) {
        await this.db
          .update(pushDeliveries)
          .set({
            status: "failed",
            attempts,
            errorMessage,
          })
          .where(eq(pushDeliveries.id, item.id));
      } else {
        const delay = BACKOFF_MS[attempts - 1] ?? 60 * 1000;
        const nextAttemptAt = new Date(Date.now() + delay);

        await this.db
          .update(pushDeliveries)
          .set({
            status: "pending",
            attempts,
            nextAttemptAt,
            errorMessage,
          })
          .where(eq(pushDeliveries.id, item.id));
      }
    }
  }
}
