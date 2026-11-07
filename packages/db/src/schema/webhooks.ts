import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy.js";
import { user } from "./auth.js";

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    productRestrictions: jsonb("product_restrictions").$type<string[] | null>(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("webhook_subscriptions_workspace_id_idx").on(t.workspaceId),
  ]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => webhookSubscriptions.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, any>>().notNull(),
    status: text("status")
      .$type<"pending" | "sending" | "delivered" | "failed" | "suppressed">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    responseStatusCode: integer("response_status_code"),
    responseBody: text("response_body"),
    errorMessage: text("error_message"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("webhook_deliveries_workspace_id_idx").on(t.workspaceId),
    index("webhook_deliveries_subscription_id_created_at_idx").on(
      t.subscriptionId,
      t.createdAt
    ),
    index("webhook_deliveries_status_next_attempt_idx").on(
      t.status,
      t.nextAttemptAt
    ),
  ]
);

export const webhookSubscriptionsRelations = relations(
  webhookSubscriptions,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [webhookSubscriptions.workspaceId],
      references: [workspaces.id],
    }),
    createdByUser: one(user, {
      fields: [webhookSubscriptions.createdByUserId],
      references: [user.id],
    }),
    deliveries: many(webhookDeliveries),
  })
);

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    subscription: one(webhookSubscriptions, {
      fields: [webhookDeliveries.subscriptionId],
      references: [webhookSubscriptions.id],
    }),
    workspace: one(workspaces, {
      fields: [webhookDeliveries.workspaceId],
      references: [workspaces.id],
    }),
  })
);

export type WebhookSubscriptionRow = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscriptionRow = typeof webhookSubscriptions.$inferInsert;
export type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDeliveryRow = typeof webhookDeliveries.$inferInsert;
