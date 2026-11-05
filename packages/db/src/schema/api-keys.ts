import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy.js";
import { user } from "./auth.js";

export const workspaceApiKeys = pgTable(
  "workspace_api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    productRestrictions: jsonb("product_restrictions").$type<string[] | null>(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("workspace_api_keys_workspace_id_idx").on(t.workspaceId),
    index("workspace_api_keys_key_hash_idx").on(t.keyHash),
  ]
);

export const workspaceApiKeysRelations = relations(
  workspaceApiKeys,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceApiKeys.workspaceId],
      references: [workspaces.id],
    }),
    createdByUser: one(user, {
      fields: [workspaceApiKeys.createdByUserId],
      references: [user.id],
    }),
  })
);

export type WorkspaceApiKey = typeof workspaceApiKeys.$inferSelect;
export type NewWorkspaceApiKey = typeof workspaceApiKeys.$inferInsert;
