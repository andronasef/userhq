import { Injectable, Inject } from "@nestjs/common";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  webhookSubscriptions,
  webhookDeliveries,
  workspaces,
} from "@userhq/db";
import { randomBytes } from "node:crypto";
import { ApiException } from "../common/api-error.filter.js";
import type {
  CreateWebhookSubscriptionInput,
  UpdateWebhookSubscriptionInput,
  WebhookSubscription,
  WebhookDelivery,
  WebhookEventPayload,
} from "@userhq/types";

@Injectable()
export class WebhookService {
  constructor(@Inject(DB) private readonly db: Db) {}

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
  ): Promise<WebhookSubscription> {
    const secret = `whsec_${randomBytes(24).toString("base64url")}`;

    const [row] = await this.db
      .insert(webhookSubscriptions)
      .values({
        workspaceId,
        url: input.url,
        secret,
        events: input.events,
        productRestrictions: input.productRestrictions ?? null,
        description: input.description ?? null,
        isActive: true,
        createdByUserId: userId,
      })
      .returning();

    return this.formatSubscription(row);
  }

  async updateSubscription(
    workspaceId: string,
    id: string,
    input: UpdateWebhookSubscriptionInput
  ): Promise<WebhookSubscription> {
    const existing = await this.getSubscription(workspaceId, id);

    const updates: Partial<typeof webhookSubscriptions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.url !== undefined) updates.url = input.url;
    if (input.events !== undefined) updates.events = input.events;
    if (input.productRestrictions !== undefined)
      updates.productRestrictions = input.productRestrictions;
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
    await this.getSubscription(workspaceId, subscriptionId);

    const [delivery] = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.id, deliveryId),
          eq(webhookDeliveries.subscriptionId, subscriptionId),
          eq(webhookDeliveries.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!delivery) {
      throw new ApiException("not_found", 404, "Delivery record not found.");
    }

    const [updated] = await this.db
      .update(webhookDeliveries)
      .set({
        status: "pending",
        nextAttemptAt: new Date(),
        errorMessage: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId))
      .returning();

    return this.formatDelivery(updated);
  }

  private formatSubscription(row: any): WebhookSubscription {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      url: row.url,
      secret: row.secret,
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
