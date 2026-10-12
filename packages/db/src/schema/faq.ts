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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { products } from "./tenancy.js";

// 1. FAQ Categories
export const faqCategories = pgTable(
  "faq_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rank: text("rank").notNull(), // LexoRank string (e.g. "a0", "a1")
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("faq_categories_id_product_unique").on(t.id, t.productId),
    uniqueIndex("faq_categories_product_name_ci").on(t.productId, sql`lower(${t.name})`),
    index("faq_categories_product_rank_idx").on(t.productId, t.rank),
  ]
);

// 2. FAQ Questions
export const faqQuestions = pgTable(
  "faq_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull(),
    question: text("question").notNull(),
    answer: jsonb("answer").notNull(), // ProseMirror JSON AST
    rank: text("rank").notNull(), // LexoRank string within category
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("faq_questions_id_product_unique").on(t.id, t.productId),
    foreignKey({
      name: "faq_questions_category_fk",
      columns: [t.categoryId, t.productId],
      foreignColumns: [faqCategories.id, faqCategories.productId],
    }).onDelete("cascade"),
    index("faq_questions_product_category_rank_idx").on(t.productId, t.categoryId, t.rank),
  ]
);
