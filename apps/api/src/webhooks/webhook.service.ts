import { Injectable, Inject } from "@nestjs/common";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  webhookSubscriptions,
  webhookDeliveries,
  workspaces,
} from "@userhq/db";
import { randomBytes } from "node:crypto";
import { ApiException } from "../common/api-error.filter.js";
import { OutboundHttp } from "../common/outbound-http.js";
import { resolveProductRestrictions } from "../api-keys/authorization.js";
import { WEBHOOK_MAX_ATTEMPTS } from "./webhook.worker.js";
import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookSubscription,
  WebhookSubscriptionWithSecret,
  WebhookDelivery,
  WebhookEventPayload,
} from "@userhq/types";

const newSigningSecret = (): string => `whsec_${randomBytes(24).toString("base64url")}`;

@Injectable()
export class WebhookService {
  constructor(@Inject(DB) private readonly db: Db, private readonly outbound: OutboundHttp) {}

  async listSubscriptions(workspaceId: string): Promise<WebhookSubscription[]> {
    const rows = await this.db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.workspaceId, workspaceId))
      .orderBy(desc(webhookSubscriptions.createdAt));

    return rows.map((r) => this.formatSubscription(r));
  }

  async getSubscription(
    workspaceId: string,
    id: string
  ): Promise<WebhookSubscription> {
    const [row] = await this.db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.id, id),
          eq(webhookSubscriptions.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException(
        "not_found",
        404,
        "Webhook subscription not found."
      );
    }

    return this.formatSubscription(row);
  }

  async createSubscription(
    workspaceId: string,
    userId: string | null,
    input: CreateWebhookSubscriptionInput
  ): Promise<WebhookSubscriptionWithSecret> {
    await this.outbound.validateTarget(input.url);
    const productRestrictions = await resolveProductRestrictions(this.db, workspaceId, input.productRestrictions);
    const secret = newSigningSecret();

    const [row] = await this.db
      .insert(webhookSubscriptions)
      .values({
        workspaceId,
        url: input.url,
        secret,
        events: input.events,
        productRestrictions,
        description: input.description ?? null,
        isActive: true,
        createdByUserId: userId,
      })
      .returning();

    return { ...this.formatSubscription(row), secret };
  }

  /** Immediate rotation: the worker signs at send time from this row, so the next attempt uses the new secret. */
  async rotateSecret(workspaceId: string, id: string): Promise<WebhookSubscriptionWithSecret> {
    const secret = newSigningSecret();
    const [row] = await this.db
      .update(webhookSubscriptions)
      .set({ secret, updatedAt: new Date() })
      .where(
        and(
          eq(webhookSubscriptions.id, id),
          eq(webhookSubscriptions.workspaceId, workspaceId)
        )
      )
      .returning();

    if (!row) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return { ...this.formatSubscription(row), secret };
  }

  async updateSubscription(
    workspaceId: string,
    id: string,
    input: UpdateWebhookSubscriptionInput
  ): Promise<WebhookSubscription> {
    const existing = await this.getSubscription(workspaceId, id);
    if (input.url !== undefined) await this.outbound.validateTarget(input.url);

    const updates: Partial<typeof webhookSubscriptions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.url !== undefined) updates.url = input.url;
    if (input.events !== undefined) updates.events = input.events;
    if (input.productRestrictions !== undefined)
      updates.productRestrictions = await resolveProductRestrictions(this.db, workspaceId, input.productRestrictions);
    if (input.description !== undefined) updates.description = input.description;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const [row] = await this.db
      .update(webhookSubscriptions)
      .set(updates)
      .where(
        and(
          eq(webhookSubscriptions.id, id),
          eq(webhookSubscriptions.workspaceId, workspaceId)
        )
      )
      .returning();

    return this.formatSubscription(row);
  }

  async deleteSubscription(workspaceId: string, id: string): Promise<void> {
    const res = await this.db
      .delete(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.id, id),
          eq(webhookSubscriptions.workspaceId, workspaceId)
        )
      )
      .returning({ id: webhookSubscriptions.id });

    if (res.length === 0) {
      throw new ApiException(
        "not_found",
        404,
        "Webhook subscription not found."
      );
    }
  }

  async pingSubscription(
    workspaceId: string,
    id: string
  ): Promise<{ enqueued: boolean; deliveryId: string }> {
    const sub = await this.getSubscription(workspaceId, id);

    const [ws] = await this.db
      .select({ id: workspaces.id, slug: workspaces.slug })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const eventId = `evt_${randomBytes(16).toString("hex")}`;
    const payload: WebhookEventPayload = {
      id: eventId,
      event: "ping",
      createdAt: new Date().toISOString(),
      workspace: { id: ws.id, slug: ws.slug },
      product: null,
      data: {
        message: "Test ping from UserHQ",
      },
    };

    const [delivery] = await this.db
      .insert(webhookDeliveries)
      .values({
        subscriptionId: sub.id,
        workspaceId,
        eventType: "ping",
        payload,
        status: "pending",
        attempts: 0,
        nextAttemptAt: new Date(),
      })
      .returning({ id: webhookDeliveries.id });

    return { enqueued: true, deliveryId: delivery.id };
  }

  async listDeliveries(
    workspaceId: string,
    subscriptionId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
    await this.getSubscription(workspaceId, subscriptionId);

    const offset = Math.max(0, (page - 1) * limit);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.subscriptionId, subscriptionId),
          eq(webhookDeliveries.workspaceId, workspaceId)
        )
      );

    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.subscriptionId, subscriptionId),
          eq(webhookDeliveries.workspaceId, workspaceId)
        )
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      deliveries: rows.map((r) => this.formatDelivery(r)),
      total: countRow?.count ?? 0,
    };
  }

  async retryDelivery(
    workspaceId: string,
    subscriptionId: string,
    deliveryId: string
  ): Promise<WebhookDelivery> {
    const sub = await this.getSubscription(workspaceId, subscriptionId);
    if (!sub.isActive) {
      throw new ApiException("webhook_inactive", 409, "This webhook is paused. Activate it before redelivering.");
    }

    // One conditional UPDATE: only a final delivery can be re-queued, so two callers or a worker claim cannot both win.
    // Attempts are not reset; the cap keeps at least one attempt available (LEAST) so a redelivery always sends once more.
    const [updated] = await this.db
      .update(webhookDeliveries)
      .set({
        status: "pending",
        nextAttemptAt: new Date(),
        errorMessage: null,
        attempts: sql`LEAST(${webhookDeliveries.attempts}, ${WEBHOOK_MAX_ATTEMPTS - 1})`,
      })
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.subscriptionId, subscriptionId),
          eq(webhookDeliveries.workspaceId, workspaceId),
          inArray(webhookDeliveries.status, ["delivered", "failed", "suppressed"])
        )
      )
      .returning();

    if (updated) return this.formatDelivery(updated);

    const [exists] = await this.db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.subscriptionId, subscriptionId),
          eq(webhookDeliveries.workspaceId, workspaceId)
        )
      )
      .limit(1);
    if (!exists) throw new ApiException("not_found", 404, "Delivery record not found.");
    throw new ApiException("delivery_not_final", 409, "That delivery is still in progress.");
  }

  private formatSubscription(row: any): WebhookSubscription {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      url: row.url,
      events: row.events as any,
      productRestrictions: (row.productRestrictions as string[] | null) ?? null,
      description: row.description ?? null,
      isActive: Boolean(row.isActive),
      createdByUserId: row.createdByUserId ?? null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  private formatDelivery(row: any): WebhookDelivery {
    return {
      id: row.id,
      subscriptionId: row.subscriptionId,
      workspaceId: row.workspaceId,
      eventType: row.eventType,
      payload: row.payload,
      status: row.status as any,
      attempts: row.attempts,
      responseStatusCode: row.responseStatusCode ?? null,
      responseBody: row.responseBody ?? null,
      errorMessage: row.errorMessage ?? null,
      deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    };
  }
}
