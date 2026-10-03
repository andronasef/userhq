import { relations, sql, type SQL } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  customType,
  unique,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { products, statuses, workspaces } from "./tenancy.js";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("categories_id_product_unique").on(t.id, t.productId),
    uniqueIndex("categories_product_name_ci").on(t.productId, sql`lower(${t.name})`),
  ]
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"), // null when empty
    statusId: uuid("status_id").notNull(),
    categoryId: uuid("category_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    authorIsAdmin: boolean("author_is_admin").notNull().default(false), // snapshot, server-decided
    voteCount: integer("vote_count").notNull().default(0),
    version: integer("version").notNull().default(1), // D-27
    editedAt: timestamp("edited_at", { withTimezone: true }), // D-15
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: text("deleted_by_id").references(() => user.id, { onDelete: "set null" }),
    mergedIntoId: uuid("merged_into_id"), // self-ref, set on merge (D-04)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    search: tsvector("search")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`setweight(to_tsvector('english', ${posts.title}), 'A') || setweight(to_tsvector('english', coalesce(${posts.description}, '')), 'B')`
      ),
  },
  (t) => [
    uniqueIndex("posts_product_number").on(t.productId, t.number),
    unique("posts_id_product_unique").on(t.id, t.productId),
    foreignKey({
      name: "posts_status_fk",
      columns: [t.statusId, t.productId],
      foreignColumns: [statuses.id, statuses.productId],
    }).onDelete("restrict"),
    foreignKey({
      name: "posts_category_fk",
      columns: [t.categoryId, t.productId],
      foreignColumns: [categories.id, categories.productId],
    }), // NO ACTION (default); category delete nulls explicitly first
    foreignKey({
      name: "posts_merged_into_fk",
      columns: [t.mergedIntoId, t.productId],
      foreignColumns: [t.id, t.productId],
    }),
    index("posts_board_top")
      .on(t.productId, t.voteCount.desc(), t.createdAt.desc())
      .where(sql`${t.deletedAt} IS NULL AND ${t.mergedIntoId} IS NULL`),
    index("posts_board_new")
      .on(t.productId, t.createdAt.desc())
      .where(sql`${t.deletedAt} IS NULL AND ${t.mergedIntoId} IS NULL`),
    index("posts_search_gin").using("gin", t.search),
    check(
      "posts_no_self_merge",
      sql`${t.mergedIntoId} IS NULL OR ${t.mergedIntoId} <> ${t.id}`
    ),
  ]
);

export const votes = pgTable(
  "votes",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.userId] }),
    index("votes_user_idx").on(t.userId),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    isAdmin: boolean("is_admin").notNull().default(false), // CMNT-02 snapshot
    body: text("body").notNull(),
    version: integer("version").notNull().default(1),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: text("deleted_by_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("comments_id_post_unique").on(t.id, t.postId),
    // NO ACTION (default) is required, so merge's single UPDATE of post_id passes (probed, Pitfall 7)
    foreignKey({
      name: "comments_parent_fk",
      columns: [t.parentId, t.postId],
      foreignColumns: [t.id, t.postId],
    }),
    index("comments_post_created").on(t.postId, t.createdAt),
    index("comments_author_idx").on(t.authorId),
  ]
);

export const postActivityKind = pgEnum("post_activity_kind", ["status_changed"]);

export const postActivity = pgTable(
  "post_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    kind: postActivityKind("kind").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    toStatusId: uuid("to_status_id"), // no FK: snapshot must outlive status deletes
    statusName: text("status_name").notNull(), // snapshot (UI-SPEC ActivityItem)
    statusColor: text("status_color").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("post_activity_post_created").on(t.postId, t.createdAt)]
);

export const postMutes = pgTable(
  "post_mutes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })]
);

export const emailBatchStatus = pgEnum("email_batch_status", [
  "pending",
  "sending",
  "retrying",
  "sent",
  "failed",
  "cancelled",
]);

export const commentEmailBatches = pgTable(
  "comment_email_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    status: emailBatchStatus("status").notNull().default("pending"),
    sendAfter: timestamp("send_after", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("comment_email_batches_one_pending")
      .on(t.userId, t.workspaceId)
      .where(sql`${t.status} = 'pending'`),
    index("comment_email_batches_due").on(t.status, t.sendAfter),
  ]
);

export const commentEmailItems = pgTable(
  "comment_email_items",
  {
    batchId: uuid("batch_id")
      .notNull()
      .references(() => commentEmailBatches.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.commentId] })]
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  product: one(products, {
    fields: [categories.productId],
    references: [products.id],
  }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  product: one(products, {
    fields: [posts.productId],
    references: [products.id],
  }),
  status: one(statuses, {
    fields: [posts.statusId],
    references: [statuses.id],
  }),
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id],
  }),
  author: one(user, {
    fields: [posts.authorId],
    references: [user.id],
  }),
  deletedBy: one(user, {
    fields: [posts.deletedById],
    references: [user.id],
  }),
  mergedInto: one(posts, {
    fields: [posts.mergedIntoId],
    references: [posts.id],
  }),
  votes: many(votes),
  comments: many(comments),
  activity: many(postActivity),
  mutes: many(postMutes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  post: one(posts, {
    fields: [votes.postId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [votes.userId],
    references: [user.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
  }),
  replies: many(comments),
  author: one(user, {
    fields: [comments.authorId],
    references: [user.id],
  }),
  deletedBy: one(user, {
    fields: [comments.deletedById],
    references: [user.id],
  }),
}));

export const postActivityRelations = relations(postActivity, ({ one }) => ({
  post: one(posts, {
    fields: [postActivity.postId],
    references: [posts.id],
  }),
  actor: one(user, {
    fields: [postActivity.actorId],
    references: [user.id],
  }),
}));

export const postMutesRelations = relations(postMutes, ({ one }) => ({
  user: one(user, {
    fields: [postMutes.userId],
    references: [user.id],
  }),
  post: one(posts, {
    fields: [postMutes.postId],
    references: [posts.id],
  }),
}));

export const commentEmailBatchesRelations = relations(commentEmailBatches, ({ one, many }) => ({
  user: one(user, {
    fields: [commentEmailBatches.userId],
    references: [user.id],
  }),
  workspace: one(workspaces, {
    fields: [commentEmailBatches.workspaceId],
    references: [workspaces.id],
  }),
  items: many(commentEmailItems),
}));

export const commentEmailItemsRelations = relations(commentEmailItems, ({ one }) => ({
  batch: one(commentEmailBatches, {
    fields: [commentEmailItems.batchId],
    references: [commentEmailBatches.id],
  }),
  comment: one(comments, {
    fields: [commentEmailItems.commentId],
    references: [comments.id],
  }),
}));
