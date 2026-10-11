import { pgTable, uuid, text, boolean, timestamp, unique, index, foreignKey } from "drizzle-orm/pg-core";
import { products, statuses } from "./tenancy.js";
import { user } from "./auth.js";

// 1. Public-safe roadmap items table (Strictly contains no internal fields)
export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    statusId: uuid("status_id").notNull(),
    publicTitle: text("public_title"), // Nullable until made public
    publicDescription: text("public_description"),
    isPublic: boolean("is_public").notNull().default(false),
    rank: text("rank").notNull(), // LexoRank string (e.g. "a0", "a0V", "a1")
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("roadmap_items_id_product_unique").on(t.id, t.productId),
    foreignKey({
      name: "roadmap_items_status_fk",
      columns: [t.statusId, t.productId],
      foreignColumns: [statuses.id, statuses.productId],
    }).onDelete("restrict"),
    index("roadmap_items_product_status_rank_idx").on(t.productId, t.statusId, t.rank),
    index("roadmap_items_product_public_idx").on(t.productId, t.isPublic),
  ]
);

// 2. Internal metadata table (1:1 extension, NEVER joined in public routes)
export const roadmapItemInternals = pgTable(
  "roadmap_item_internals",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => roadmapItems.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    internalTitle: text("internal_title").notNull(),
    internalDescription: text("internal_description"),
    internalNotes: text("internal_notes"),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    deadlineText: text("deadline_text"), // e.g. "Q4 2026", "Nov 2026", "Oct 15"
    deadlineDate: timestamp("deadline_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("roadmap_item_internals_item_product_unique").on(t.itemId, t.productId),
    index("roadmap_item_internals_product_assignee_idx").on(t.productId, t.assigneeId),
  ]
);
