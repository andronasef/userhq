import { eq, and } from "drizzle-orm";
import {
  type Db,
  webhookSubscriptions,
  webhookDeliveries,
  workspaces,
  products,
} from "@userhq/db";
import { randomBytes } from "node:crypto";
import type { WebhookEvent, WebhookEventPayload } from "@userhq/types";

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
    const [prod] = await tx
      .select({ id: products.id, slug: products.slug, name: products.name })
      .from(products)
      .where(eq(products.id, opts.productId))
      .limit(1);
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

    if (opts.productId && sub.productRestrictions && sub.productRestrictions.length > 0) {
      if (!sub.productRestrictions.includes(opts.productId)) {
        continue;
      }
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
