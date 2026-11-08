import { eq, and, or, like, inArray, sql } from "drizzle-orm";
import {
  type Db,
  webhookSubscriptions,
  webhookDeliveries,
  workspaces,
  products,
} from "@userhq/db";
import { randomBytes } from "node:crypto";
import type { WebhookEvent, WebhookEventPayload } from "@userhq/types";
import { isProductAllowed } from "../api-keys/authorization.js";
import { featureEnabled, productFeatureColumns, pickFeatures } from "../portal/product-features.js";

/** Event-type prefixes per product module: the single source for enqueue, delivery and suppression. */
export const WEBHOOK_MODULE_PREFIXES = {
  board: ["post.", "comment."],
  changelog: ["changelog."],
} as const;
export type WebhookModule = keyof typeof WEBHOOK_MODULE_PREFIXES;

/** The product module an event type belongs to; pings and unknown types belong to none. One mapping for enqueue and delivery. */
export function webhookEventModule(eventType: string): WebhookModule | null {
  for (const [module, prefixes] of Object.entries(WEBHOOK_MODULE_PREFIXES)) {
    if (prefixes.some((p) => eventType.startsWith(p))) return module as WebhookModule;
  }
  return null;
}

/**
 * D-14: when a module is switched off, its queued deliveries for that product are marked suppressed
 * in the same transaction as the switch, so re-enabling can never send them. Finished deliveries,
 * pings, other products, other workspaces and the other module's events are untouched.
 */
export async function suppressQueuedWebhooks(
  tx: Db | any,
  opts: { workspaceId: string; productId: string; module: WebhookModule }
): Promise<void> {
  await tx
    .update(webhookDeliveries)
    .set({ status: "suppressed", errorMessage: `${opts.module}_unavailable` })
    .where(
      and(
        eq(webhookDeliveries.workspaceId, opts.workspaceId),
        inArray(webhookDeliveries.status, ["pending", "sending"]),
        sql`${webhookDeliveries.payload}->'product'->>'id' = ${opts.productId}`,
        or(...WEBHOOK_MODULE_PREFIXES[opts.module].map((p) => like(webhookDeliveries.eventType, `${p}%`)))
      )
    );
}

export async function enqueueWebhookEvent(
  tx: Db | any,
  opts: {
    workspaceId: string;
    productId?: string | null;
    eventType: WebhookEvent;
    data: Record<string, any>;
  }
): Promise<number> {
  const subs = await tx
    .select({
      id: webhookSubscriptions.id,
      events: webhookSubscriptions.events,
      productRestrictions: webhookSubscriptions.productRestrictions,
    })
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.workspaceId, opts.workspaceId),
        eq(webhookSubscriptions.isActive, true)
      )
    );

  if (!subs || subs.length === 0) return 0;

  const [ws] = await tx
    .select({ id: workspaces.id, slug: workspaces.slug })
    .from(workspaces)
    .where(eq(workspaces.id, opts.workspaceId))
    .limit(1);

  if (!ws) return 0;

  let productInfo: { id: string; slug: string; name: string } | null = null;
  if (opts.productId) {
    // Share-lock the product row until the caller's transaction ends: a concurrent Board or Changelog
    // disable (UPDATE products) waits for this enqueue, so its suppression always sees the delivery (D-14).
    const [prod] = await tx
      .select({ id: products.id, slug: products.slug, name: products.name, ...productFeatureColumns })
      .from(products)
      .where(and(eq(products.id, opts.productId), eq(products.workspaceId, opts.workspaceId)))
      .limit(1)
      .for("share");
    // D-08/D-10: a disabled module's events never enter the outbox.
    const eventModule = webhookEventModule(opts.eventType);
    if (prod && eventModule && !featureEnabled(pickFeatures(prod), eventModule)) return 0;
    if (prod) {
      productInfo = { id: prod.id, slug: prod.slug, name: prod.name };
    }
  }

  let count = 0;
  for (const sub of subs) {
    const eventsList = (sub.events as string[]) ?? [];
    if (!eventsList.includes(opts.eventType) && !eventsList.includes("*")) {
      continue;
    }

    if (opts.productId && !isProductAllowed(sub.productRestrictions, opts.productId)) {
      continue;
    }

    const eventId = `evt_${randomBytes(16).toString("hex")}`;
    const payload: WebhookEventPayload = {
      id: eventId,
      event: opts.eventType,
      createdAt: new Date().toISOString(),
      workspace: { id: ws.id, slug: ws.slug },
      product: productInfo,
      data: opts.data,
    };

    await tx.insert(webhookDeliveries).values({
      subscriptionId: sub.id,
      workspaceId: opts.workspaceId,
      eventType: opts.eventType,
      payload,
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    });
    count++;
  }

  return count;
}
