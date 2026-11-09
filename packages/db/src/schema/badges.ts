import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { products } from "./tenancy.js";

export const productBadges = pgTable(
  "product_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#0284c7"),
    textColor: text("text_color").notNull().default("#ffffff"),
    icon: text("icon"),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("product_badges_product_slug_idx").on(t.productId, t.slug),
    index("product_badges_product_id_idx").on(t.productId),
    index("product_badges_priority_idx").on(t.productId, t.priority),
  ]
);

export const productBadgeRules = pgTable(
  "product_badge_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => productBadges.id, { onDelete: "cascade" }),
    paramKey: text("param_key").notNull(),
    matchType: text("match_type").notNull().default("exact"), // "exact" | "regex"
    matchValue: text("match_value").notNull(),
    secretToken: text("secret_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("product_badge_rules_product_id_idx").on(t.productId),
    index("product_badge_rules_badge_id_idx").on(t.badgeId),
    index("product_badge_rules_param_key_idx").on(t.productId, t.paramKey),
  ]
);

export const userProductBadges = pgTable(
  "user_product_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => productBadges.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("rule"), // "rule" | "manual"
    matchedParamValue: text("matched_param_value"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("user_product_badges_user_product_badge_idx").on(
      t.userId,
      t.productId,
      t.badgeId
    ),
    index("user_product_badges_product_user_idx").on(t.productId, t.userId),
    index("user_product_badges_badge_id_idx").on(t.badgeId),
  ]
);

export const productBadgesRelations = relations(productBadges, ({ one, many }) => ({
  product: one(products, {
    fields: [productBadges.productId],
    references: [products.id],
  }),
  rules: many(productBadgeRules),
  userBadges: many(userProductBadges),
}));

export const productBadgeRulesRelations = relations(productBadgeRules, ({ one }) => ({
  product: one(products, {
    fields: [productBadgeRules.productId],
    references: [products.id],
  }),
  badge: one(productBadges, {
    fields: [productBadgeRules.badgeId],
    references: [productBadges.id],
  }),
}));

export const userProductBadgesRelations = relations(userProductBadges, ({ one }) => ({
  user: one(user, {
    fields: [userProductBadges.userId],
    references: [user.id],
  }),
  product: one(products, {
    fields: [userProductBadges.productId],
    references: [products.id],
  }),
  badge: one(productBadges, {
    fields: [userProductBadges.badgeId],
    references: [productBadges.id],
  }),
  grantedBy: one(user, {
    fields: [userProductBadges.grantedByUserId],
    references: [user.id],
  }),
}));
