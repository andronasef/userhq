import { z } from "zod";

export const NotificationPostStatusSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
});
export type NotificationPostStatus = z.infer<typeof NotificationPostStatusSchema>;

export const NotificationPostRefSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  status: NotificationPostStatusSchema,
});
export type NotificationPostRef = z.infer<typeof NotificationPostRefSchema>;

export const NotificationActivityRefSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  fromStatus: NotificationPostStatusSchema.nullable(),
  toStatus: NotificationPostStatusSchema.nullable(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type NotificationActivityRef = z.infer<typeof NotificationActivityRefSchema>;

export const NotificationItemSchema = z.object({
  id: z.string().uuid(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  post: NotificationPostRefSchema,
  activity: NotificationActivityRefSchema,
});
export type NotificationItem = z.infer<typeof NotificationItemSchema>;

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationItemSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export const UnreadNotificationCountResponseSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});
export type UnreadNotificationCountResponse = z.infer<typeof UnreadNotificationCountResponseSchema>;

export const ActivityItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  post: NotificationPostRefSchema,
  fromStatus: NotificationPostStatusSchema.nullable(),
  toStatus: NotificationPostStatusSchema.nullable(),
  hasNewStatus: z.boolean(),
  hasNewComments: z.boolean(),
  commentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type ActivityItem = z.infer<typeof ActivityItemSchema>;

export const ActivityListResponseSchema = z.object({
  activities: z.array(ActivityItemSchema),
  hasUnread: z.boolean(),
});
export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;

export const MarkReadInputSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
});
export type MarkReadInput = z.infer<typeof MarkReadInputSchema>;

export const MarkReadResponseSchema = z.object({
  success: z.boolean(),
});
export type MarkReadResponse = z.infer<typeof MarkReadResponseSchema>;
