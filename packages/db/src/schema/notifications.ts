import { pgTable, uuid, text, timestamp, unique, index, primaryKey } from "drizzle-orm/pg-core";
import { workspaces, products } from "./tenancy.js";
import { user } from "./auth.js";
import { posts, postActivity } from "./feedback.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    postActivityId: uuid("post_activity_id")
      .notNull()
      .references(() => postActivity.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Groups repeated status changes for a post into ONE notification row per user
    unique("notifications_user_post_unique").on(t.userId, t.postId),
    index("notifications_user_read_created_idx").on(t.userId, t.readAt, t.createdAt),
  ]
);

export const userProductActivityVisits = pgTable(
  "user_product_activity_visits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    lastVisitedAt: timestamp("last_visited_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({
      name: "user_product_activity_visits_user_product_pk",
      columns: [t.userId, t.productId],
    }),
    unique("user_product_activity_visits_user_product_unique").on(t.userId, t.productId),
  ]
);
