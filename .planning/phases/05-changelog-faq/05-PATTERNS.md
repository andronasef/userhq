# Phase 05: Changelog & FAQ — Pattern Mapping

**Phase:** Phase 05 — Changelog & FAQ  
**Target Directory:** `.planning/phases/05-changelog-faq`  
**Consumes:** `05-CONTEXT.md`, `05-RESEARCH.md`, `05-UI-SPEC.md`  
**Status:** Complete & Ready for Planning  

---

## 1. Executive Summary & File Classification Matrix

This document provides a concrete pattern map for all new and modified files in Phase 05 across `@userhq/db`, `@userhq/types`, `@userhq/api`, and `@userhq/web`. Every newly authored file is mapped to its closest git-tracked analog in the repository, with exact code excerpts illustrating imports, authentication guards, data flow, error handling, validation, and testing contracts.

### Complete File Inventory & Analog Mapping

| Package | Target File Path | Role | Data Flow | Closest Git-Tracked Analog |
|---|---|---|---|---|
| **`packages/db`** | `src/schema/changelog.ts` | Model / DB Schema | Storage / Relational | `src/schema/roadmap.ts` & `src/schema/tenancy.ts` |
| **`packages/db`** | `src/schema/faq.ts` | Model / DB Schema | Storage / Relational | `src/schema/roadmap.ts` & `src/schema/tenancy.ts` |
| **`packages/db`** | `src/index.ts` | Schema Export Barrel | Aggregation | `src/index.ts` (Phase 4 roadmap additions) |
| **`packages/db`** | `migrations/0010_changelog_faq.sql` | SQL DDL Migration | Schema Evolution | `migrations/0009_roadmap_notifications.sql` |
| **`packages/types`** | `src/rich-text.ts` | Schema / Contract | Validation / Transform | `src/roadmap.ts` (Title schemas) & `src/tenancy.ts` |
| **`packages/types`** | `src/changelog.ts` | Contract / DTOs | Request-Response | `src/roadmap.ts` |
| **`packages/types`** | `src/faq.ts` | Contract / DTOs | Request-Response | `src/roadmap.ts` & `src/feedback.ts` |
| **`packages/types`** | `src/index.ts` | Barrel / Error Codes | Aggregation | `src/index.ts` |
| **`packages/types`** | `test/changelog-faq.test.ts` | Unit Test | Assertion | `test/rank.test.ts` |
| **`apps/api`** | `src/changelog/changelog.module.ts` | NestJS Module | DI Configuration | `src/roadmap/roadmap.module.ts` |
| **`apps/api`** | `src/changelog/changelog.service.ts` | Business Service | CRUD / Transactional | `src/roadmap/roadmap.service.ts` |
| **`apps/api`** | `src/changelog/changelog.controller.ts` | Admin Controller | HTTP / TenantGuard | `src/roadmap/roadmap.controller.ts` |
| **`apps/api`** | `src/changelog/portal-changelog.controller.ts` | Public Controller | HTTP / PortalGuard | `src/roadmap/portal-roadmap.controller.ts` |
| **`apps/api`** | `src/faq/faq.module.ts` | NestJS Module | DI Configuration | `src/roadmap/roadmap.module.ts` |
| **`apps/api`** | `src/faq/faq.service.ts` | Business Service | CRUD / Reordering | `src/roadmap/roadmap.service.ts` & `src/feedback/categories.controller.ts` |
| **`apps/api`** | `src/faq/faq.controller.ts` | Admin Controller | HTTP / TenantGuard | `src/roadmap/roadmap.controller.ts` & `src/feedback/categories.controller.ts` |
| **`apps/api`** | `src/faq/portal-faq.controller.ts` | Public Controller | HTTP / PortalGuard | `src/roadmap/portal-roadmap.controller.ts` |
| **`apps/api`** | `src/app.module.ts` | Root Module | DI Registration | `src/app.module.ts` (existing register method) |
| **`apps/api`** | `src/products/products.controller.ts` | Product Controller | Seed Lifecycle | `src/products/products.controller.ts` (seed statuses/categories) |
| **`apps/api`** | `test/changelog.test.ts` | Integration Test | E2E Seam / Supertest | `test/roadmap.test.ts` |
| **`apps/api`** | `test/portal-changelog.test.ts` | Integration Test | Public Contract / Leak | `test/portal-roadmap.test.ts` |
| **`apps/api`** | `test/faq.test.ts` | Integration Test | E2E Seam / Supertest | `test/roadmap.test.ts` & `test/categories.test.ts` |
| **`apps/api`** | `test/portal-faq.test.ts` | Integration Test | Public Contract / Leak | `test/portal-roadmap.test.ts` |
| **`apps/web`** | `lib/api-server.ts` | Server Data Fetcher | RSC Fetch / Cache | `lib/api-server.ts` (`getPublicRoadmap`, `getAdminRoadmap`) |
| **`apps/web`** | `lib/api-errors.ts` | Client Error Mapper | Error Code -> UI Copy | `lib/api-errors.ts` (`API_ERROR_COPY`, `FIELD_FOR_CODE`) |
| **`apps/web`** | `components/portal/portal-tabs.tsx` | UI Component | Navigation Bar | `components/portal/portal-tabs.tsx` |
| **`apps/web`** | `components/dashboard/sidebar.tsx` | UI Component | Dashboard Sidebar | `components/dashboard/sidebar.tsx` |
| **`apps/web`** | `components/rich-text/rich-text-viewer.tsx` | UI Component (RSC Safe) | AST -> JSX Rendering | `components/plain-text.tsx` |
| **`apps/web`** | `components/rich-text/rich-text-editor.tsx` | UI Component ("use client") | Rich Text Authoring | `components/ui/textarea.tsx` & `components/roadmap/roadmap-item-modal.tsx` |
| **`apps/web`** | `components/rich-text/editor-toolbar.tsx` | UI Component ("use client") | Command Dispatch | `components/ui/button.tsx` |
| **`apps/web`** | `components/changelog/changelog-feed.tsx` | UI Component | Timeline Stream | `components/roadmap/public-roadmap-board.tsx` |
| **`apps/web`** | `components/changelog/changelog-timeline-item.tsx` | UI Component ("use client") | Expandable Entry | `components/roadmap/public-roadmap-card.tsx` |
| **`apps/web`** | `components/changelog/changelog-article.tsx` | UI Component (RSC Safe) | Standalone Reader | `components/activity-feed.tsx` |
| **`apps/web`** | `components/changelog/changelog-studio.tsx` | UI Component ("use client") | Table / List Management | `components/roadmap/roadmap-view.tsx` |
| **`apps/web`** | `components/changelog/changelog-editor.tsx` | UI Component ("use client") | Studio Authoring Canvas | `components/roadmap/roadmap-item-modal.tsx` |
| **`apps/web`** | `components/changelog/changelog-preview-modal.tsx` | UI Component ("use client") | Modal Preview | `components/roadmap/public-roadmap-modal.tsx` |
| **`apps/web`** | `components/changelog/changelog-tag-dialog.tsx` | UI Component ("use client") | Tag Management Dialog | `components/feedback/status-change-dialog.tsx` |
| **`apps/web`** | `components/faq/faq-portal.tsx` | UI Component ("use client") | State / Search Orchestrator | `components/roadmap/public-roadmap-view.tsx` |
| **`apps/web`** | `components/faq/faq-sidebar-nav.tsx` | UI Component ("use client") | Sticky Anchor Navigation | `components/tab-nav.tsx` |
| **`apps/web`** | `components/faq/faq-search-bar.tsx` | UI Component ("use client") | Input / Instant Filter | `components/ui/input.tsx` |
| **`apps/web`** | `components/faq/faq-section.tsx` | UI Component | Category Anchor Section | `components/roadmap/kanban-column.tsx` |
| **`apps/web`** | `components/faq/faq-accordion-item.tsx` | UI Component ("use client") | Multi-Open Collapsible | `components/post-row.tsx` |
| **`apps/web`** | `components/faq/faq-highlight.tsx` | Utility / UI Component | Keyword Text Splitter | `lib/linkify.ts` |
| **`apps/web`** | `components/faq/faq-not-found-prompt.tsx` | UI Component | Feedback Redirect Banner | `components/empty-state.tsx` |
| **`apps/web`** | `components/faq/faq-manager.tsx` | UI Component ("use client") | DnD Category / Question Hub | `components/roadmap/kanban-board.tsx` |
| **`apps/web`** | `components/faq/faq-category-item.tsx` | UI Component ("use client") | Draggable Category Card | `components/roadmap/kanban-column.tsx` |
| **`apps/web`** | `components/faq/faq-category-dialog.tsx` | UI Component ("use client") | Category CRUD Dialog | `components/ui/confirm-dialog.tsx` |
| **`apps/web`** | `components/faq/faq-question-item.tsx` | UI Component ("use client") | Draggable Question Row | `components/roadmap/kanban-card.tsx` |
| **`apps/web`** | `components/faq/faq-question-dialog.tsx` | UI Component ("use client") | Question Rich-Text Dialog | `components/roadmap/roadmap-item-modal.tsx` |
| **`apps/web`** | `app/[ws]/[product]/changelog/page.tsx` | Next.js RSC Page | Data Fetching & Stream | `app/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `app/[ws]/[product]/changelog/[slug]/page.tsx` | Next.js RSC Page | Standalone Article / OG | `app/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `app/[ws]/[product]/faq/page.tsx` | Next.js RSC Page | Data Fetching & Hierarchy | `app/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `app/dashboard/[ws]/[product]/changelog/page.tsx` | Next.js RSC Page | Studio Loader | `app/dashboard/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `app/dashboard/[ws]/[product]/changelog/new/page.tsx` | Next.js RSC Page | New Entry Studio | `app/dashboard/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `app/dashboard/[ws]/[product]/changelog/[id]/page.tsx` | Next.js RSC Page | Edit Entry Studio | `app/dashboard/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `app/dashboard/[ws]/[product]/faq/page.tsx` | Next.js RSC Page | FAQ Manager Loader | `app/dashboard/[ws]/[product]/roadmap/page.tsx` |
| **`apps/web`** | `test/changelog-timeline.test.tsx` | Frontend Test | Rendering & Expansion | `test/lib/linkify.test.ts` |
| **`apps/web`** | `test/faq-portal.test.tsx` | Frontend Test | Filter, Highlight, Hash | `test/lib/api-errors.test.ts` |

---

## 2. Database Models & Schema Patterns (`packages/db`)

### 2.1 Changelog Schema (`packages/db/src/schema/changelog.ts`)
**Closest Analog:** `packages/db/src/schema/roadmap.ts` & `packages/db/src/schema/tenancy.ts`

#### Key Architectural Elements:
1. Composite foreign keys verifying workspace and product isolation (`unique("...").on(t.id, t.productId)`).
2. ProseMirror document stored natively as `jsonb("content").notNull()`.
3. Separate publication status via timestamp: `publishedAt: timestamp("published_at", { withTimezone: true })`. When `null`, entry is an unpublished draft hidden from the public portal.
4. Unique constraint on `(productId, slug)` ensuring clean, deterministic permalinks per product.
5. Many-to-many tag relationship via `changelog_entry_tags` with cascading foreign keys on composite keys `(id, productId)`.

```ts
import { pgTable, uuid, text, timestamp, unique, index, foreignKey, jsonb, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
```

---

### 2.2 FAQ Schema (`packages/db/src/schema/faq.ts`)
**Closest Analog:** `packages/db/src/schema/roadmap.ts` & `packages/db/src/schema/tenancy.ts` (`statuses`)

#### Key Architectural Elements:
1. LexoRank string column (`rank: text("rank").notNull()`) on both categories and questions for O(1) single-row fractional reordering.
2. Composite foreign key from `faq_questions` to `faq_categories` (`(categoryId, productId) -> (id, productId)`), strictly enforcing that questions cannot belong to categories across different tenant products.
3. ProseMirror rich text answer stored as `jsonb("answer").notNull()`.
4. Case-insensitive unique category name per product via `uniqueIndex("faq_categories_product_name_ci")`.

```ts
import { pgTable, uuid, text, timestamp, unique, index, foreignKey, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
```

---

## 3. Shared Contracts, Validation & DTOs (`packages/types`)

### 3.1 ProseMirror AST Schema (`packages/types/src/rich-text.ts`)
**Role:** Contract & Security Barrier  
**Closest Analog:** `packages/types/src/tenancy.ts` & `packages/types/src/roadmap.ts`

```ts
import { z } from "zod";

export const ALLOWED_MARK_TYPES = [
  "bold",
  "italic",
  "strike",
  "code",
  "underline",
  "link",
] as const;

export const RichTextMarkSchema = z.object({
  type: z.enum(ALLOWED_MARK_TYPES),
  attrs: z
    .object({
      href: z.string().refine((url) => {
        try {
          const parsed = new URL(url, "https://dummy.base");
          return ["http:", "https:", "mailto:"].includes(parsed.protocol);
        } catch {
          return false;
        }
      }, { message: "Invalid link protocol" }).optional(),
      target: z.string().optional(),
      rel: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const ALLOWED_NODE_TYPES = [
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "text",
  "hardBreak",
] as const;

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: z.infer<typeof RichTextMarkSchema>[];
  text?: string;
};

export const RichTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.object({
    type: z.enum(ALLOWED_NODE_TYPES),
    attrs: z
      .object({
        level: z.number().int().min(1).max(3).optional(),
        src: z.string().refine((url) => {
          try {
            const parsed = new URL(url);
            return ["http:", "https:"].includes(parsed.protocol);
          } catch {
            return false;
          }
        }, { message: "Images must use http or https URLs" }).optional(),
        alt: z.string().max(200).optional(),
        title: z.string().max(200).optional(),
      })
      .passthrough()
      .optional(),
    content: z.array(RichTextNodeSchema).optional(),
    marks: z.array(RichTextMarkSchema).optional(),
    text: z.string().optional(),
  })
);

export const RichTextDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(RichTextNodeSchema).default([]),
});

export type RichTextDoc = z.infer<typeof RichTextDocSchema>;
```

---

### 3.2 Changelog DTOs (`packages/types/src/changelog.ts`)
**Role:** API Contracts  
**Closest Analog:** `packages/types/src/roadmap.ts`

```ts
import { z } from "zod";
import { RichTextDocSchema } from "./rich-text.js";

export const CHANGELOG_TITLE_MIN = 3;
export const CHANGELOG_TITLE_MAX = 150;
export const CHANGELOG_SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const ChangelogTitleSchema = z
  .string({ message: "title_required" })
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "title_required" })
      .min(CHANGELOG_TITLE_MIN, { message: "title_length" })
      .max(CHANGELOG_TITLE_MAX, { message: "title_length" })
  );

export const ChangelogSlugSchema = z
  .string({ message: "slug_required" })
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, { message: "slug_required" })
      .regex(CHANGELOG_SLUG_REGEX, { message: "slug_format" })
  );

export const ChangelogTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type ChangelogTag = z.infer<typeof ChangelogTagSchema>;

export const ChangelogTagInputSchema = z.object({
  name: z.string().trim().min(1, { message: "name_required" }).max(30, { message: "name_too_long" }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: "invalid_color" }),
});
export type ChangelogTagInput = z.infer<typeof ChangelogTagInputSchema>;

export const AdminChangelogEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  content: RichTextDocSchema,
  publishedAt: z.string().nullable(), // ISO string or null
  tags: z.array(ChangelogTagSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminChangelogEntry = z.infer<typeof AdminChangelogEntrySchema>;

export const AdminChangelogListResponseSchema = z.object({
  entries: z.array(AdminChangelogEntrySchema),
  tags: z.array(ChangelogTagSchema),
});
export type AdminChangelogListResponse = z.infer<typeof AdminChangelogListResponseSchema>;

export const PublicChangelogEntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  content: RichTextDocSchema,
  publishedAt: z.string(), // Always non-null on public portal
  tags: z.array(ChangelogTagSchema),
  createdAt: z.string(),
});
export type PublicChangelogEntry = z.infer<typeof PublicChangelogEntrySchema>;

export const PublicChangelogFeedResponseSchema = z.object({
  entries: z.array(PublicChangelogEntrySchema),
});
export type PublicChangelogFeedResponse = z.infer<typeof PublicChangelogFeedResponseSchema>;

export const CreateChangelogEntryInputSchema = z.object({
  title: ChangelogTitleSchema,
  slug: ChangelogSlugSchema.optional(),
  summary: z.string().max(500).optional(),
  content: RichTextDocSchema,
  tagIds: z.array(z.string().uuid()).default([]),
  publishedAt: z.string().nullable().optional(), // If provided upon creation
});
export type CreateChangelogEntryInput = z.infer<typeof CreateChangelogEntryInputSchema>;

export const UpdateChangelogEntryInputSchema = z.object({
  title: ChangelogTitleSchema.optional(),
  slug: ChangelogSlugSchema.optional(),
  summary: z.string().max(500).nullable().optional(),
  content: RichTextDocSchema.optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  publishedAt: z.string().nullable().optional(),
});
export type UpdateChangelogEntryInput = z.infer<typeof UpdateChangelogEntryInputSchema>;

export const PublishChangelogEntryInputSchema = z.object({
  publishedAt: z.string().optional(), // Optional custom / backdated release date (D-13)
});
export type PublishChangelogEntryInput = z.infer<typeof PublishChangelogEntryInputSchema>;
```

---

### 3.3 FAQ DTOs (`packages/types/src/faq.ts`)
**Role:** API Contracts  
**Closest Analog:** `packages/types/src/roadmap.ts` & `packages/types/src/feedback.ts`

```ts
import { z } from "zod";
import { RichTextDocSchema } from "./rich-text.js";

export const FAQ_CATEGORY_NAME_MIN = 2;
export const FAQ_CATEGORY_NAME_MAX = 50;
export const FAQ_QUESTION_MIN = 5;
export const FAQ_QUESTION_MAX = 200;

export const FaqCategoryInputSchema = z.object({
  name: z
    .string({ message: "category_name_required" })
    .trim()
    .min(FAQ_CATEGORY_NAME_MIN, { message: "category_name_required" })
    .max(FAQ_CATEGORY_NAME_MAX, { message: "category_name_too_long" }),
  rank: z.string().optional(),
});
export type FaqCategoryInput = z.infer<typeof FaqCategoryInputSchema>;

export const MoveFaqCategoryInputSchema = z.object({
  targetRank: z.string(),
});
export type MoveFaqCategoryInput = z.infer<typeof MoveFaqCategoryInputSchema>;

export const FaqQuestionInputSchema = z.object({
  categoryId: z.string().uuid({ message: "category_required" }),
  question: z
    .string({ message: "title_required" })
    .trim()
    .min(FAQ_QUESTION_MIN, { message: "title_length" })
    .max(FAQ_QUESTION_MAX, { message: "title_length" }),
  answer: RichTextDocSchema,
  rank: z.string().optional(),
});
export type FaqQuestionInput = z.infer<typeof FaqQuestionInputSchema>;

export const UpdateFaqQuestionInputSchema = z.object({
  categoryId: z.string().uuid().optional(),
  question: z
    .string()
    .trim()
    .min(FAQ_QUESTION_MIN, { message: "title_length" })
    .max(FAQ_QUESTION_MAX, { message: "title_length" })
    .optional(),
  answer: RichTextDocSchema.optional(),
});
export type UpdateFaqQuestionInput = z.infer<typeof UpdateFaqQuestionInputSchema>;

export const MoveFaqQuestionInputSchema = z.object({
  targetRank: z.string(),
  targetCategoryId: z.string().uuid().optional(), // Allows moving across categories
});
export type MoveFaqQuestionInput = z.infer<typeof MoveFaqQuestionInputSchema>;

export const AdminFaqQuestionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  question: z.string(),
  answer: RichTextDocSchema,
  rank: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminFaqQuestion = z.infer<typeof AdminFaqQuestionSchema>;

export const AdminFaqCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  rank: z.string(),
  questions: z.array(AdminFaqQuestionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminFaqCategory = z.infer<typeof AdminFaqCategorySchema>;

export const AdminFaqResponseSchema = z.object({
  categories: z.array(AdminFaqCategorySchema),
});
export type AdminFaqResponse = z.infer<typeof AdminFaqResponseSchema>;

export const PublicFaqQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  answer: RichTextDocSchema,
});
export type PublicFaqQuestion = z.infer<typeof PublicFaqQuestionSchema>;

export const PublicFaqCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  questions: z.array(PublicFaqQuestionSchema),
});
export type PublicFaqCategory = z.infer<typeof PublicFaqCategorySchema>;

export const PublicFaqResponseSchema = z.object({
  categories: z.array(PublicFaqCategorySchema),
});
export type PublicFaqResponse = z.infer<typeof PublicFaqResponseSchema>;
```

---

### 3.4 API Error Codes Mapping (`packages/types/src/index.ts`)
**Closest Analog:** `packages/types/src/index.ts` lines 12–74

Ensure these Phase 5 codes are registered in `API_ERROR_CODES`:
- `title_required`, `title_length`
- `slug_required`, `slug_format`, `slug_conflict`
- `content_required`, `invalid_image_url`
- `category_name_required`, `category_not_found`
- `reorder_failed`

---

## 4. Backend API Endpoints & Services (`apps/api`)

### 4.1 Admin Controller Pattern (`ChangelogController` & `FaqController`)
**Closest Analog:** `apps/api/src/roadmap/roadmap.controller.ts` & `apps/api/src/feedback/categories.controller.ts`

#### Key Architectural Elements:
1. `@UseGuards(TenantGuard)` on controller verifies workspace membership and permissions.
2. `@UseInterceptors(StandardSchemaSerializerInterceptor)` ensures response adheres strictly to the declared Zod schema.
3. Parameter parsing uses `UuidParamSchema.safeParse(rawId)` and throws `ApiException("not_found", 404, "...")` on invalid UUIDs.
4. Input validation uses `@Body({ schema: ... })`.
5. Product scoping via `@CurrentTenant() tenant: Tenant` (`tenant.productId!`).

```ts
// apps/api/src/changelog/changelog.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  AdminChangelogEntrySchema,
  AdminChangelogListResponseSchema,
  ChangelogTagSchema,
  CreateChangelogEntryInputSchema,
  UpdateChangelogEntryInputSchema,
  PublishChangelogEntryInputSchema,
  ChangelogTagInputSchema,
  type AdminChangelogEntry,
  type AdminChangelogListResponse,
  type ChangelogTag,
  type CreateChangelogEntryInput,
  type UpdateChangelogEntryInput,
  type PublishChangelogEntryInput,
  type ChangelogTagInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { ChangelogService } from "./changelog.service.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/changelog")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  @SerializeOptions({ schema: AdminChangelogListResponseSchema })
  async listEntries(@CurrentTenant() tenant: Tenant): Promise<AdminChangelogListResponse> {
    return this.changelogService.listAdminEntries(tenant.productId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async createEntry(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: CreateChangelogEntryInputSchema }) input: CreateChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    return this.changelogService.createEntry(tenant.productId!, input);
  }

  @Get(":id")
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async getEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Entry not found.");
    }
    return this.changelogService.getEntryById(tenant.productId!, parsed.data);
  }

  @Patch(":id")
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async updateEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: UpdateChangelogEntryInputSchema }) input: UpdateChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Entry not found.");
    }
    return this.changelogService.updateEntry(tenant.productId!, parsed.data, input);
  }

  @Post(":id/publish")
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async publishEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: PublishChangelogEntryInputSchema }) input: PublishChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Entry not found.");
    }
    return this.changelogService.publishEntry(tenant.productId!, parsed.data, input.publishedAt);
  }

  @Post(":id/unpublish")
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async unpublishEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Entry not found.");
    }
    return this.changelogService.unpublishEntry(tenant.productId!, parsed.data);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<void> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Entry not found.");
    }
    await this.changelogService.deleteEntry(tenant.productId!, parsed.data);
  }

  // --- Tag CRUD Endpoints ---
  @Get("tags")
  @SerializeOptions({ schema: z.array(ChangelogTagSchema) })
  async listTags(@CurrentTenant() tenant: Tenant): Promise<ChangelogTag[]> {
    return this.changelogService.listTags(tenant.productId!);
  }

  @Post("tags")
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: ChangelogTagSchema })
  async createTag(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: ChangelogTagInputSchema }) input: ChangelogTagInput
  ): Promise<ChangelogTag> {
    return this.changelogService.createTag(tenant.productId!, input);
  }

  @Delete("tags/:tagId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTag(
    @CurrentTenant() tenant: Tenant,
    @Param("tagId") rawId: string
  ): Promise<void> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Tag not found.");
    }
    await this.changelogService.deleteTag(tenant.productId!, parsed.data);
  }
}
```

---

### 4.2 Public Portal Controller Pattern (`PortalChangelogController` & `PortalFaqController`)
**Closest Analog:** `apps/api/src/roadmap/portal-roadmap.controller.ts`

#### Key Architectural Elements:
1. `@UseGuards(PortalGuard)` resolves workspace and product from route parameters, verifying the workspace is active.
2. `@Public()` allows unauthenticated public access.
3. Every `@Public()` method MUST declare `@SerializeOptions({ schema: ... })` to pass the `public-contract.test.ts` seam test.
4. Portal queries strictly filter `isNotNull(changelogEntries.publishedAt)`, guaranteeing drafts are never returned (`CHLG-04`).
5. Missing slugs or draft slugs immediately throw `ApiException("not_found", 404, "Not found.")`.

```ts
// apps/api/src/changelog/portal-changelog.controller.ts
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, isNotNull, desc } from "drizzle-orm";
import { DB, type Db, changelogEntries, changelogTags, changelogEntryTags } from "@userhq/db";
import {
  PublicChangelogFeedResponseSchema,
  PublicChangelogEntrySchema,
  type PublicChangelogFeedResponse,
  type PublicChangelogEntry,
} from "@userhq/types";
import { Public } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";

@Controller("portal/:ws/:product/changelog")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalChangelogController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Public()
  @SerializeOptions({ schema: PublicChangelogFeedResponseSchema })
  async getPublicChangelogFeed(@Req() req: any): Promise<PublicChangelogFeedResponse> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    // 1. Fetch published entries newest first (CHLG-07)
    const rows = await this.db
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        slug: changelogEntries.slug,
        summary: changelogEntries.summary,
        content: changelogEntries.content,
        publishedAt: changelogEntries.publishedAt,
        createdAt: changelogEntries.createdAt,
      })
      .from(changelogEntries)
      .where(
        and(
          eq(changelogEntries.productId, productId),
          isNotNull(changelogEntries.publishedAt)
        )
      )
      .orderBy(desc(changelogEntries.publishedAt));

    if (rows.length === 0) {
      return { entries: [] };
    }

    // 2. Fetch tags for all fetched entries
    const entryIds = rows.map((r) => r.id);
    const tagRows = await this.db
      .select({
        entryId: changelogEntryTags.entryId,
        id: changelogTags.id,
        name: changelogTags.name,
        color: changelogTags.color,
      })
      .from(changelogEntryTags)
      .innerJoin(changelogTags, eq(changelogEntryTags.tagId, changelogTags.id))
      .where(eq(changelogEntryTags.productId, productId));

    const tagsByEntry = new Map<string, { id: string; name: string; color: string }[]>();
    for (const tag of tagRows) {
      const list = tagsByEntry.get(tag.entryId) ?? [];
      list.push({ id: tag.id, name: tag.name, color: tag.color });
      tagsByEntry.set(tag.entryId, list);
    }

    return {
      entries: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        summary: r.summary ?? null,
        content: r.content as any,
        publishedAt: new Date(r.publishedAt!).toISOString(),
        tags: tagsByEntry.get(r.id) ?? [],
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    };
  }

  @Get(":slug")
  @Public()
  @SerializeOptions({ schema: PublicChangelogEntrySchema })
  async getPublicChangelogEntry(
    @Req() req: any,
    @Param("slug") slug: string
  ): Promise<PublicChangelogEntry> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    // Query published entry strictly scoped to product and non-null publishedAt (CHLG-08)
    const [row] = await this.db
      .select({
        id: changelogEntries.id,
        title: changelogEntries.title,
        slug: changelogEntries.slug,
        summary: changelogEntries.summary,
        content: changelogEntries.content,
        publishedAt: changelogEntries.publishedAt,
        createdAt: changelogEntries.createdAt,
      })
      .from(changelogEntries)
      .where(
        and(
          eq(changelogEntries.productId, productId),
          eq(changelogEntries.slug, slug.toLowerCase()),
          isNotNull(changelogEntries.publishedAt)
        )
      )
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }

    const tagRows = await this.db
      .select({
        id: changelogTags.id,
        name: changelogTags.name,
        color: changelogTags.color,
      })
      .from(changelogEntryTags)
      .innerJoin(changelogTags, eq(changelogEntryTags.tagId, changelogTags.id))
      .where(
        and(
          eq(changelogEntryTags.entryId, row.id),
          eq(changelogEntryTags.productId, productId)
        )
      );

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      summary: row.summary ?? null,
      content: row.content as any,
      publishedAt: new Date(row.publishedAt!).toISOString(),
      tags: tagRows,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  }
}
```

---

### 4.3 FAQ Service Reordering Pattern (`FaqService`)
**Closest Analog:** `apps/api/src/roadmap/roadmap.service.ts` (`moveItem`)

#### Key Architectural Elements:
1. Transactional row lock with `.for("update")`.
2. Reorder question within category or across categories by updating `rank` and optional `categoryId`.
3. Reorder category by updating `rank`.
4. Zero-downtime single-row updates without locking sibling rows.

```ts
// apps/api/src/faq/faq.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { and, eq, asc } from "drizzle-orm";
import { DB, type Db, faqCategories, faqQuestions } from "@userhq/db";
import {
  type MoveFaqCategoryInput,
  type MoveFaqQuestionInput,
  type AdminFaqCategory,
  type AdminFaqQuestion,
} from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class FaqService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async moveCategory(
    productId: string,
    categoryId: string,
    input: MoveFaqCategoryInput
  ): Promise<{ success: boolean; rank: string }> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: faqCategories.id })
        .from(faqCategories)
        .where(
          and(
            eq(faqCategories.id, categoryId),
            eq(faqCategories.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Category not found.");
      }

      await tx
        .update(faqCategories)
        .set({
          rank: input.targetRank,
          updatedAt: new Date(),
        })
        .where(eq(faqCategories.id, categoryId));

      return { success: true, rank: input.targetRank };
    });
  }

  async moveQuestion(
    productId: string,
    questionId: string,
    input: MoveFaqQuestionInput
  ): Promise<{ success: boolean; rank: string; categoryId: string }> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: faqQuestions.id, categoryId: faqQuestions.categoryId })
        .from(faqQuestions)
        .where(
          and(
            eq(faqQuestions.id, questionId),
            eq(faqQuestions.productId, productId)
          )
        )
        .for("update");

      if (!existing) {
        throw new ApiException("not_found", 404, "Question not found.");
      }

      const targetCategoryId = input.targetCategoryId ?? existing.categoryId;

      // If moving to another category, verify target category exists in this product
      if (input.targetCategoryId && input.targetCategoryId !== existing.categoryId) {
        const [targetCat] = await tx
          .select({ id: faqCategories.id })
          .from(faqCategories)
          .where(
            and(
              eq(faqCategories.id, input.targetCategoryId),
              eq(faqCategories.productId, productId)
            )
          )
          .limit(1);

        if (!targetCat) {
          throw new ApiException("validation_failed", 400, "Target category not found.");
        }
      }

      await tx
        .update(faqQuestions)
        .set({
          categoryId: targetCategoryId,
          rank: input.targetRank,
          updatedAt: new Date(),
        })
        .where(eq(faqQuestions.id, questionId));

      return {
        success: true,
        rank: input.targetRank,
        categoryId: targetCategoryId,
      };
    });
  }
}
```

---

## 5. Frontend Web: Public Portal & Server Components (`apps/web`)

### 5.1 Public Changelog Feed Page (`apps/web/app/[ws]/[product]/changelog/page.tsx`)
**Closest Analog:** `apps/web/app/[ws]/[product]/roadmap/page.tsx`

```tsx
import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicChangelogFeed } from "@/lib/api-server";
import { ChangelogFeed } from "@/components/changelog/changelog-feed";

interface PublicChangelogPageProps {
  params: Promise<{ ws: string; product: string }>;
}

export async function generateMetadata({
  params,
}: PublicChangelogPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getPortalProduct(ws, product);
  if (!result.ok) {
    return { title: "Changelog · UserHQ" };
  }
  return {
    title: `Changelog · ${result.data.product.name}`,
    description: `Follow new features, improvements, and bug fixes for ${result.data.product.name}.`,
  };
}

export default async function PublicChangelogPage({
  params,
}: PublicChangelogPageProps): Promise<React.JSX.Element> {
  const { ws, product } = await params;
  const [productRes, feedRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicChangelogFeed(ws, product),
  ]);

  if (!productRes.ok) {
    notFound();
  }

  const { product: p } = productRes.data;
  const entries = feedRes.ok ? feedRes.data.entries : [];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Changelog
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          New features, improvements, and bug fixes for {p.name}.
        </p>
      </div>

      <ChangelogFeed ws={ws} product={product} productName={p.name} entries={entries} />
    </div>
  );
}
```

---

### 5.2 Standalone Changelog Permalink Page with OpenGraph (`apps/web/app/[ws]/[product]/changelog/[slug]/page.tsx`)
**Closest Analog:** `apps/web/app/[ws]/[product]/roadmap/page.tsx`

```tsx
import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalProduct, getPublicChangelogEntry } from "@/lib/api-server";
import { ChangelogArticle } from "@/components/changelog/changelog-article";

interface ChangelogArticlePageProps {
  params: Promise<{ ws: string; product: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: ChangelogArticlePageProps): Promise<Metadata> {
  const { ws, product, slug } = await params;
  const [productRes, entryRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicChangelogEntry(ws, product, slug),
  ]);

  if (!productRes.ok || !entryRes.ok) {
    return { title: "Changelog · UserHQ" };
  }

  const entry = entryRes.data;
  const prod = productRes.data.product;

  return {
    title: `${entry.title} · ${prod.name} Changelog`,
    description: entry.summary ?? `Read release notes for ${entry.title} on ${prod.name}.`,
    openGraph: {
      title: entry.title,
      description: entry.summary ?? undefined,
      type: "article",
      publishedTime: entry.publishedAt,
    },
  };
}

export default async function ChangelogArticlePage({
  params,
}: ChangelogArticlePageProps): Promise<React.JSX.Element> {
  const { ws, product, slug } = await params;
  const [productRes, entryRes] = await Promise.all([
    getPortalProduct(ws, product),
    getPublicChangelogEntry(ws, product, slug),
  ]);

  if (!productRes.ok || !entryRes.ok) {
    notFound();
  }

  return (
    <ChangelogArticle
      ws={ws}
      product={product}
      productName={productRes.data.product.name}
      entry={entryRes.data}
    />
  );
}
```

---

### 5.3 Static ProseMirror AST Renderer (`apps/web/components/rich-text/rich-text-viewer.tsx`)
**Closest Analog:** `apps/web/components/plain-text.tsx`

#### Key Architectural Elements:
1. Completely DOM-free static rendering using `@tiptap/static-renderer/pm/react`.
2. Safe to execute inside React Server Components or Client components.
3. Automatically sets `target="_blank"` and `rel="noopener noreferrer nofollow"` on hyperlinks.
4. Guaranteed zero `dangerouslySetInnerHTML`.

```tsx
import * as React from "react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { RichTextDoc } from "@userhq/types";
import { cn } from "@/lib/utils";

export interface RichTextViewerProps {
  content: RichTextDoc | null | undefined;
  className?: string;
}

export function RichTextViewer({ content, className }: RichTextViewerProps): React.JSX.Element | null {
  if (!content || !content.content || content.content.length === 0) {
    return null;
  }

  const rendered = renderToReactElement({
    content,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            class: "text-primary underline hover:opacity-80 transition-opacity",
          },
        },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: "rounded-lg border border-border max-w-full h-auto my-4",
        },
      }),
    ],
  });

  return (
    <div className={cn("rich-text-content space-y-3 leading-relaxed text-foreground", className)}>
      {rendered}
    </div>
  );
}
```

---

### 5.4 Instant Search & Highlighting Text Pattern (`apps/web/components/faq/faq-highlight.tsx`)
**Closest Analog:** `apps/web/lib/linkify.ts`

```tsx
import * as React from "react";

export interface HighlightTextProps {
  text: string;
  query: string;
}

export function HighlightText({ text, query }: HighlightTextProps): React.JSX.Element {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/20 text-primary font-medium px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
```

---

## 6. Frontend Web: Admin Studio & Reordering (`apps/web`)

### 6.1 Tiptap Authoring Canvas (`apps/web/components/rich-text/rich-text-editor.tsx`)
**Closest Analog:** `apps/web/components/roadmap/roadmap-item-modal.tsx` (Form inputs)

#### Key Architectural Elements:
1. `immediatelyRender: false` passed to `useEditor` to prevent SSR hydration mismatch.
2. Sticky top formatting toolbar (`D-05`).
3. Markdown shortcut auto-conversion (`D-08`).
4. Remote image insertion modal (`D-06`).

```tsx
"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { RichTextDoc } from "@userhq/types";
import { EditorToolbar } from "./editor-toolbar";
import { cn } from "@/lib/utils";

export interface RichTextEditorProps {
  initialContent?: RichTextDoc | null;
  onChange?: (doc: RichTextDoc) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({
  initialContent,
  onChange,
  placeholder = "Write your release notes here...",
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false, // Critical Next.js / Vinext SSR guard
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] }, // H1 reserved for title
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: "rounded-lg border border-border max-w-full h-auto my-4",
        },
      }),
    ],
    content: initialContent ?? { type: "doc", content: [] },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as RichTextDoc);
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[300px] p-4 border-x border-b border-border rounded-b-lg focus:outline-none bg-background text-base leading-relaxed text-foreground",
          className
        ),
      },
    },
  });

  if (!editor) {
    return <div className="min-h-[300px] border border-border rounded-lg bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="flex flex-col border border-border rounded-lg bg-background shadow-xs">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

---

### 6.2 FAQ Reordering with LexoRank (`apps/web/components/faq/faq-manager.tsx`)
**Closest Analog:** `apps/web/components/roadmap/kanban-board.tsx` lines 45–140

#### Key Architectural Elements:
1. Wrapped in `@dnd-kit/react` `DragDropProvider`.
2. Rank calculated via `generateKeyBetween(prevRank, nextRank)`.
3. Optimistic local array update.
4. Mutation sent via `apiFetch(PATCH .../move)`.
5. Automatic rollback with `toast.error("Couldn't reorder item...")` on API failure.

```tsx
"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { toast } from "sonner";
import { generateKeyBetween, type AdminFaqCategory } from "@userhq/types";
import { apiFetch } from "@/lib/api-client";
import { FaqCategoryItem } from "./faq-category-item";

export interface FaqManagerProps {
  ws: string;
  product: string;
  initialCategories: AdminFaqCategory[];
}

export function FaqManager({ ws, product, initialCategories }: FaqManagerProps) {
  const [categories, setCategories] = React.useState<AdminFaqCategory[]>(initialCategories);

  const handleCategoryDragEnd = async (event: any) => {
    if (event.canceled) return;
    const { source, target } = event.operation;
    if (!source || !target) return;

    const sourceCatId = String(source.id);
    const draggedCat = categories.find((c) => c.id === sourceCatId);
    if (!draggedCat) return;

    const sortedCats = [...categories].sort((a, b) => a.rank.localeCompare(b.rank));
    const targetIndex = typeof target.index === "number" ? target.index : sortedCats.length;

    let newRank: string;
    if (sortedCats.length === 0) {
      newRank = generateKeyBetween(null, null);
    } else if (targetIndex <= 0) {
      newRank = generateKeyBetween(null, sortedCats[0].rank);
    } else if (targetIndex >= sortedCats.length) {
      newRank = generateKeyBetween(sortedCats[sortedCats.length - 1].rank, null);
    } else {
      const prevRank = sortedCats[targetIndex - 1].rank;
      const nextRank = sortedCats[targetIndex].rank;
      newRank = generateKeyBetween(prevRank, nextRank);
    }

    if (draggedCat.rank === newRank) return;

    // Optimistic update
    const prevList = [...categories];
    setCategories((prev) =>
      prev.map((c) => (c.id === sourceCatId ? { ...c, rank: newRank } : c))
    );

    try {
      await apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/faq/categories/${sourceCatId}/move`,
        {
          method: "PATCH",
          body: { targetRank: newRank },
        }
      );
    } catch {
      setCategories(prevList);
      toast.error("Couldn't reorder FAQ category. Check your connection and try again.");
    }
  };

  return (
    <DragDropProvider onDragEnd={handleCategoryDragEnd}>
      <div className="flex flex-col gap-4">
        {categories
          .sort((a, b) => a.rank.localeCompare(b.rank))
          .map((cat) => (
            <FaqCategoryItem key={cat.id} category={cat} ws={ws} product={product} />
          ))}
      </div>
    </DragDropProvider>
  );
}
```

---

## 7. Testing Patterns & Verification Suite

### 7.1 Public Contract Seam Test Pattern
**Target Test:** `apps/api/test/public-contract.test.ts`

Any newly added public controller (`PortalChangelogController`, `PortalFaqController`) is automatically picked up by this test. The handler MUST have:
1. `@Public()` decorator.
2. `@SerializeOptions({ schema: ... })` with an explicit Zod schema.

If a developer omits `@SerializeOptions`, `bun run --filter '@userhq/api' test` will fail with:
`Route /portal/:ws/:product/changelog is @Public() but missing serializer schema`.

### 7.2 Backend Integration Test Pattern (`apps/api/test/portal-changelog.test.ts`)
**Closest Analog:** `apps/api/test/portal-roadmap.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Public Portal Changelog API", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let publishedSlug = "published-update";
  let draftSlug = "draft-secret-update";

  beforeAll(async () => {
    testApp = await createTestApp();
    const adminUser = await signedInCookie(testApp.test, {
      name: "Changelog Admin",
      email: "chlg-admin@test.local",
      emailVerified: true,
    });

    wsSlug = "ws-chlg-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({ slug: wsSlug, name: "Changelog Test Workspace" })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "chlg-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({ workspaceId: ws.id, slug: prodSlug, name: "Changelog Product" })
      .returning();
    prodId = prod.id;

    // Insert 1 published entry
    await testApp.db.insert(schema.changelogEntries).values({
      productId: prodId,
      title: "Published Update",
      slug: publishedSlug,
      content: { type: "doc", content: [{ type: "paragraph", text: "Release notes" }] },
      publishedAt: new Date(),
    });

    // Insert 1 draft entry (publishedAt = null)
    await testApp.db.insert(schema.changelogEntries).values({
      productId: prodId,
      title: "Draft Secret Update",
      slug: draftSlug,
      content: { type: "doc", content: [{ type: "paragraph", text: "Secret notes" }] },
      publishedAt: null,
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("lists only published entries in public feed (CHLG-07)", async () => {
    const res = await request(testApp.server)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog`)
      .expect(200);

    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].slug).toBe(publishedSlug);
  });

  it("returns 404 for draft entries on permalink endpoint (CHLG-04)", async () => {
    await request(testApp.server)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog/${draftSlug}`)
      .expect(404);
  });
});
```

---

## 8. Cross-Cutting Patterns & Guardrails

### 8.1 Tenancy & Security Barrier Rules
1. **Never Join Internals in Public Routes**: Public portal endpoints (`PortalChangelogController`, `PortalFaqController`) must only select from customer-safe tables.
2. **Draft Isolation**: Any changelog query for public visitors must include `isNotNull(changelogEntries.publishedAt)`.
3. **Composite Foreign Keys**: All tables referencing a product or parent entity must use composite keys `(id, productId)` to prevent cross-tenant ID substitution.
4. **Rich Text Protocol Allowlist**: When parsing links or image sources in `RichTextDocSchema`, only allow `http:`, `https:`, and `mailto:` protocols. Never allow `javascript:`, `data:`, or `vbscript:`.
5. **No Raw HTML**: Storing raw HTML strings in the database or using `dangerouslySetInnerHTML` on the frontend is strictly forbidden. Use `@tiptap/static-renderer` for RSC and `@tiptap/react` for interactive canvases.

### 8.2 Frontend Routing & Navigation Sync
1. `apps/web/components/portal/portal-tabs.tsx`:
   - Add `{ label: "Changelog", href: `${baseHref}/changelog` }`
   - Add `{ label: "FAQ", href: `${baseHref}/faq` }`
   - Active tab detection matches paths starting with `${baseHref}/changelog` and `${baseHref}/faq`.
2. `apps/web/components/dashboard/sidebar.tsx`:
   - Under each active product sub-menu, insert `Changelog` (`/dashboard/${ws}/${product.slug}/changelog`, icon: `Megaphone`) and `FAQ` (`/dashboard/${ws}/${product.slug}/faq`, icon: `HelpCircle`) directly after `Roadmap`.

---

*Pattern map complete. Planner may consume this directly to generate implementation plans.*
