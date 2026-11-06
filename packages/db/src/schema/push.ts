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
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { products } from "./tenancy.js";
import { user } from "./auth.js";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_unique_idx").on(t.endpoint),
    index("push_subscriptions_user_id_idx").on(t.userId),
  ]
);

export const pushPreferences = pgTable("push_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  includePreviews: boolean("include_previews").notNull().default(false),
  notifyReplies: boolean("notify_replies").notNull().default(true),
  notifyStatusChanges: boolean("notify_status_changes").notNull().default(true),
  notifyNewPosts: boolean("notify_new_posts").notNull().default(true),
  notifyNewComments: boolean("notify_new_comments").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pushFollowedProducts = pgTable(
  "push_followed_products",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({
      name: "push_followed_products_user_product_pk",
      columns: [t.userId, t.productId],
    }),
    index("push_followed_products_product_id_idx").on(t.productId),
  ]
);

export const pushDeliveries = pgTable(
  "push_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    data: jsonb("data").$type<Record<string, any>>(),
    status: text("status")
      .$type<"pending" | "sending" | "delivered" | "failed" | "suppressed">()
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    errorMessage: text("error_message"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("push_deliveries_status_next_attempt_idx").on(
      t.status,
      t.nextAttemptAt
    ),
    index("push_deliveries_user_id_created_at_idx").on(t.userId, t.createdAt),
  ]
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one, many }) => ({
    user: one(user, {
      fields: [pushSubscriptions.userId],
      references: [user.id],
    }),
    deliveries: many(pushDeliveries),
  })
);

export const pushDeliveriesRelations = relations(pushDeliveries, ({ one }) => ({
  subscription: one(pushSubscriptions, {
    fields: [pushDeliveries.subscriptionId],
    references: [pushSubscriptions.id],
  }),
  user: one(user, {
    fields: [pushDeliveries.userId],
    references: [user.id],
  }),
}));

export const pushFollowedProductsRelations = relations(
  pushFollowedProducts,
  ({ one }) => ({
    user: one(user, {
      fields: [pushFollowedProducts.userId],
      references: [user.id],
    }),
    product: one(products, {
      fields: [pushFollowedProducts.productId],
      references: [products.id],
    }),
  })
);
