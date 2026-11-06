import { z } from "zod";

export const PushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});
export type PushSubscriptionKeys = z.infer<typeof PushSubscriptionKeysSchema>;

export const RegisterPushSubscriptionInputSchema = z.object({
  endpoint: z.string().url(),
  keys: PushSubscriptionKeysSchema,
  userAgent: z.string().optional(),
});
export type RegisterPushSubscriptionInput = z.infer<
  typeof RegisterPushSubscriptionInputSchema
>;

export const PushSubscriptionResponseSchema = z.object({
  id: z.string().uuid(),
  endpoint: z.string(),
  userAgent: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type PushSubscriptionResponse = z.infer<
  typeof PushSubscriptionResponseSchema
>;

export const PushPreferencesSchema = z.object({
  enabled: z.boolean(),
  includePreviews: z.boolean(),
  notifyReplies: z.boolean(),
  notifyStatusChanges: z.boolean(),
  notifyNewPosts: z.boolean(),
  notifyNewComments: z.boolean(),
});
export type PushPreferences = z.infer<typeof PushPreferencesSchema>;

export const UpdatePushPreferencesInputSchema = PushPreferencesSchema.partial();
export type UpdatePushPreferencesInput = z.infer<
  typeof UpdatePushPreferencesInputSchema
>;

export const FollowedProductItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  productSlug: z.string(),
  workspaceSlug: z.string(),
  createdAt: z.string(),
});
export type FollowedProductItem = z.infer<typeof FollowedProductItemSchema>;

export const VapidPublicKeyResponseSchema = z.object({
  publicKey: z.string(),
});
export type VapidPublicKeyResponse = z.infer<
  typeof VapidPublicKeyResponseSchema
>;

export const PushTestResponseSchema = z.object({
  success: z.boolean(),
  enqueuedCount: z.number(),
});
export type PushTestResponse = z.infer<typeof PushTestResponseSchema>;
