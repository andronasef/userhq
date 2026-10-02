import { relations } from "drizzle-orm";
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  uploaderId: text("uploader_id").references(() => user.id, { onDelete: "set null" }),
  bytes: integer("bytes").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const uploadsRelations = relations(uploads, ({ one }) => ({
  uploader: one(user, {
    fields: [uploads.uploaderId],
    references: [user.id],
  }),
}));
