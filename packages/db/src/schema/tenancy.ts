import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  check,
  unique,
} from "drizzle-orm/pg-core";
import { uploads } from "./uploads.js";

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    logoUploadId: uuid("logo_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    websiteUrl: text("website_url"),
    directoryEnabled: boolean("directory_enabled").notNull().default(true),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "workspaces_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 2 AND 32`
    ),
  ]
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    logoUploadId: uuid("logo_upload_id").references(() => uploads.id, { onDelete: "set null" }),
    accentColor: text("accent_color").notNull().default("#2563EB"),
    tagline: text("tagline"),
    websiteUrl: text("website_url"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("products_workspace_slug_unique").on(table.workspaceId, table.slug),
    check(
      "products_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 2 AND 32`
    ),
    check("products_accent_hex", sql`${table.accentColor} ~ '^#[0-9A-F]{6}$'`),
  ]
);

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  logo: one(uploads, {
    fields: [workspaces.logoUploadId],
    references: [uploads.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [products.workspaceId],
    references: [workspaces.id],
  }),
  logo: one(uploads, {
    fields: [products.logoUploadId],
    references: [uploads.id],
  }),
}));
