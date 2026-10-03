import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  check,
  unique,
  primaryKey,
  uniqueIndex,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { uploads } from "./uploads.js";
import { user } from "./auth.js";

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

export const statusType = pgEnum("status_type", [
  "review",
  "planned",
  "active",
  "completed",
  "closed",
]);

export const statuses = pgTable(
  "statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    type: statusType("type").notNull(),
    position: integer("position").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("statuses_id_product_unique").on(table.id, table.productId),
    uniqueIndex("statuses_product_name_ci").on(
      table.productId,
      sql`lower(${table.name})`
    ),
    uniqueIndex("statuses_one_default")
      .on(table.productId)
      .where(sql`${table.isDefault}`),
    index("statuses_product_position_idx").on(table.productId, table.position),
    check("statuses_color_hex", sql`${table.color} ~ '^#[0-9A-F]{6}$'`),
  ]
);

export const memberRole = pgEnum("member_role", ["owner", "admin"]);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    uniqueIndex("workspace_members_one_owner")
      .on(table.workspaceId)
      .where(sql`${table.role} = 'owner'`),
    index("workspace_members_user_idx").on(table.userId),
  ]
);

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  logo: one(uploads, {
    fields: [workspaces.logoUploadId],
    references: [uploads.id],
  }),
  products: many(products),
  members: many(workspaceMembers),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [products.workspaceId],
    references: [workspaces.id],
  }),
  logo: one(uploads, {
    fields: [products.logoUploadId],
    references: [uploads.id],
  }),
  statuses: many(statuses),
}));

export const statusesRelations = relations(statuses, ({ one }) => ({
  product: one(products, {
    fields: [statuses.productId],
    references: [products.id],
  }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(user, {
    fields: [workspaceMembers.userId],
    references: [user.id],
  }),
}));

export const inviteKind = pgEnum("invite_kind", ["platform", "workspace"]);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: inviteKind("kind").notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedById: text("used_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "invites_workspace_kind",
      sql`${table.kind} = 'platform' OR ${table.workspaceId} IS NOT NULL`
    ),
    check("invites_email_lower", sql`${table.email} = lower(${table.email})`),
    index("invites_lookup_idx").on(table.kind, table.workspaceId, table.email),
  ]
);

export const invitesRelations = relations(invites, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [invites.workspaceId],
    references: [workspaces.id],
  }),
  createdBy: one(user, {
    fields: [invites.createdById],
    references: [user.id],
  }),
  usedBy: one(user, {
    fields: [invites.usedById],
    references: [user.id],
  }),
}));
