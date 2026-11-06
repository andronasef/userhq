import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import {
  DB,
  type Db,
  pushDeliveries,
  pushSubscriptions,
  pushPreferences,
  pushFollowedProducts,
  user,
} from "@userhq/db";
import { ENV, type Env } from "../env.js";
import { getVapidKeys } from "./push.config.js";
import { OutboundHttp, OutboundError } from "../common/outbound-http.js";
import { isWorkspaceAdmin } from "../feedback/membership.js";

const BACKOFF_MS = [
  5 * 1000, // 5 seconds
  30 * 1000, // 30 seconds
  2 * 60 * 1000, // 2 minutes
];

// A row stuck in 'sending' (crashed worker) is reclaimed after this long; same as the email worker.
const STUCK_CLAIM_MS = 10 * 60_000;

// The preference column that gates each event type. Test events are exempt.
const EVENT_FLAG = {
  status_change: "notifyStatusChanges",
  comment_reply: "notifyReplies",
  new_post: "notifyNewPosts",
  new_comment: "notifyNewComments",
} as const;

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
      const stuckBefore = new Date(Date.now() - STUCK_CLAIM_MS);
      // Claim pending deliveries, plus rows stuck in 'sending' past the visibility timeout
      const claimedRows = await this.db.execute(sql`
        UPDATE push_deliveries
        SET status = 'sending', claimed_at = now()
        WHERE id IN (
          SELECT id FROM push_deliveries
          WHERE (status = 'pending' AND next_attempt_at <= now())
             OR (status = 'sending' AND claimed_at < ${stuckBefore})
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

  /** Returns a pinned suppression reason, or null when the delivery is still allowed. */
  private async suppressionReason(item: {
    user_id: string;
    event_type: string;
    data?: any;
  }): Promise<string | null> {
    const [pref] = await this.db
      .select()
      .from(pushPreferences)
      .where(eq(pushPreferences.userId, item.user_id))
      .limit(1);
    // A missing preferences row means every flag is on.
    if (pref && !pref.enabled) return "preferences_disabled";
    const flag = EVENT_FLAG[item.event_type as keyof typeof EVENT_FLAG];
    if (pref && flag && !pref[flag]) return "event_disabled";

    const [recipient] = await this.db
      .select({ bannedAt: user.bannedAt, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, item.user_id))
      .limit(1);
    if (!recipient || recipient.bannedAt || recipient.deletedAt) return "recipient_inactive";

    const productId = item.data?.productId;
    if (typeof productId !== "string") return null; // test events carry no product

    const postId = typeof item.data.postId === "string" ? item.data.postId : null;
    const commentId = typeof item.data.commentId === "string" ? item.data.commentId : null;
    const res = await this.db.execute(sql`
      SELECT p.board_enabled, p.deleted_at AS product_deleted_at, p.workspace_id,
             w.deleted_at AS ws_deleted_at, w.suspended_at,
             po.id AS post_id, po.deleted_at AS post_deleted_at, po.merged_into_id,
             c.id AS comment_id, c.deleted_at AS comment_deleted_at,
             EXISTS (SELECT 1 FROM post_mutes m WHERE m.user_id = ${item.user_id} AND m.post_id = po.id) AS muted
      FROM products p
      JOIN workspaces w ON w.id = p.workspace_id
      LEFT JOIN posts po ON po.id = ${postId}::uuid AND po.product_id = p.id
      LEFT JOIN comments c ON c.id = ${commentId}::uuid AND c.post_id = po.id
      WHERE p.id = ${productId}::uuid
    `);
    const ctx = ((res as any).rows ?? res)[0];
    if (!ctx || !ctx.board_enabled || ctx.product_deleted_at || ctx.ws_deleted_at || ctx.suspended_at) {
      return "board_unavailable";
    }
    if (postId && (!ctx.post_id || ctx.post_deleted_at || ctx.merged_into_id)) return "post_unavailable";
    if (commentId && (!ctx.comment_id || ctx.comment_deleted_at)) return "comment_deleted";
    if (ctx.muted) return "post_muted";

    // Product-wide alerts go only to admins who still follow the product.
    if (item.event_type === "new_post" || item.event_type === "new_comment") {
      const [follow] = await this.db
        .select({ userId: pushFollowedProducts.userId })
        .from(pushFollowedProducts)
        .where(and(eq(pushFollowedProducts.userId, item.user_id), eq(pushFollowedProducts.productId, productId)))
        .limit(1);
      if (!follow) return "not_following";
      if (!(await isWorkspaceAdmin(this.db, item.user_id, ctx.workspace_id))) return "not_workspace_admin";
    }
    return null;
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

    // Re-validate against current state; suppression is terminal, never retried or replayed (D-02, D-10, D-14).
    const reason = await this.suppressionReason(item);
    if (reason) {
      await this.db
        .update(pushDeliveries)
        .set({ status: "suppressed", errorMessage: reason })
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

      // 404/410: expired or unsubscribed. 401/403: the push service rejects our VAPID identity for
      // this subscription (e.g. created under other keys). Either way it can never succeed, so remove
      // it; push_deliveries.subscription_id cascades, which drops this and its other queued rows.
      if (statusCode === 404 || statusCode === 410 || statusCode === 401 || statusCode === 403) {
        this.logger.warn(
          `Push subscription ${sub.id} rejected (${statusCode}), removing.`
        );
        await this.db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
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
