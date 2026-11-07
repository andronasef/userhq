import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "*",
  "post.created",
  "post.updated",
  "post.status_changed",
  "post.deleted",
  "comment.created",
  "comment.deleted",
  "changelog.published",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const webhookEventSchema = z.enum(WEBHOOK_EVENTS);

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2000, "URL must be 2000 characters or fewer"),
  events: z.array(webhookEventSchema).min(1, "Select at least one event type"),
  productRestrictions: z.array(z.string().uuid()).nullable().optional(),
  description: z.string().trim().max(200, "Description must be 200 characters or fewer").nullable().optional(),
});

export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionSchema>;

export const updateWebhookSubscriptionSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2000).optional(),
  events: z.array(webhookEventSchema).min(1, "Select at least one event type").optional(),
  productRestrictions: z.array(z.string().uuid()).nullable().optional(),
  description: z.string().trim().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookSubscriptionInput = z.infer<typeof updateWebhookSubscriptionSchema>;

export const webhookSubscriptionSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  url: z.string(),
  events: z.array(webhookEventSchema),
  productRestrictions: z.array(z.string().uuid()).nullable(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WebhookSubscription = z.infer<typeof webhookSubscriptionSchema>;

/** Only create and rotate-secret return the signing secret; it is never readable afterwards. */
export const webhookSubscriptionWithSecretSchema = webhookSubscriptionSchema.extend({
  secret: z.string(),
});

export type WebhookSubscriptionWithSecret = z.infer<typeof webhookSubscriptionWithSecretSchema>;

export const webhookSubscriptionListResponseSchema = z.object({
  subscriptions: z.array(webhookSubscriptionSchema),
});

export type WebhookSubscriptionListResponse = z.infer<
  typeof webhookSubscriptionListResponseSchema
>;

export const webhookDeliveryStatusSchema = z.enum([
  "pending",
  "sending",
  "delivered",
  "failed",
]);

export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>;

export const webhookDeliverySchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  eventType: z.string(),
  payload: z.record(z.string(), z.any()),
  status: webhookDeliveryStatusSchema,
  attempts: z.number().int(),
  responseStatusCode: z.number().int().nullable(),
  responseBody: z.string().nullable(),
  errorMessage: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
});

export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;

export const webhookDeliveryListResponseSchema = z.object({
  deliveries: z.array(webhookDeliverySchema),
  total: z.number().int(),
});

export type WebhookDeliveryListResponse = z.infer<
  typeof webhookDeliveryListResponseSchema
>;

export interface WebhookEventPayload<T = Record<string, any>> {
  id: string; // evt_...
  event: WebhookEvent | "ping";
  createdAt: string;
  workspace: {
    id: string;
    slug: string;
  };
  product: {
    id: string;
    slug: string;
    name: string;
  } | null;
  data: T;
}
