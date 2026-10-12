import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
  index,
  foreignKey,
  jsonb,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { products } from "./tenancy.js";

// 1. Changelog Entries (Release Notes)
export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary"), // Optional short snippet for timeline excerpt and OpenGraph description
    content: jsonb("content").notNull(), // ProseMirror JSON AST
    publishedAt: timestamp("published_at", { withTimezone: true }), // null = draft (CHLG-04)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("changelog_entries_id_product_unique").on(t.id, t.productId),
    unique("changelog_entries_product_slug_unique").on(t.productId, t.slug),
    index("changelog_entries_product_published_idx").on(t.productId, t.publishedAt),
  ]
);

// 2. Changelog Tags (Seeded: New, Improved, Fixed; Admin CRUD)
export const changelogTags = pgTable(
  "changelog_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(), // Hex code, e.g., '#10B981', '#3B82F6', '#F59E0B'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("changelog_tags_id_product_unique").on(t.id, t.productId),
    uniqueIndex("changelog_tags_product_name_ci").on(t.productId, sql`lower(${t.name})`),
  ]
);

// 3. Changelog Entry Tags Join Table
export const changelogEntryTags = pgTable(
  "changelog_entry_tags",
  {
    entryId: uuid("entry_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.tagId] }),
    foreignKey({
      name: "changelog_entry_tags_entry_fk",
      columns: [t.entryId, t.productId],
      foreignColumns: [changelogEntries.id, changelogEntries.productId],
    }).onDelete("cascade"),
    foreignKey({
      name: "changelog_entry_tags_tag_fk",
      columns: [t.tagId, t.productId],
      foreignColumns: [changelogTags.id, changelogTags.productId],
    }).onDelete("cascade"),
  ]
);
