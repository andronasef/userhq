# Phase 05: Changelog & FAQ - Research

**Researched:** 2026-10-12
**Target Phase:** Phase 05 — Changelog & FAQ
**Status:** Complete & Ready for Planning

---

## Executive Summary & Primary Recommendation

Phase 05 equips UserHQ with customer-facing release communication (Changelog) and self-serve help resources (FAQ), fulfilling requirements `CHLG-01` through `CHLG-08` and `FAQ-01` through `FAQ-07`. It serves two distinct audiences:
1. **Public Visitors & Customers**: Browsing chronological release updates with expandable inline snippets and permalinks (`/{ws}/{product}/changelog` & `/{ws}/{product}/changelog/[slug]`), and finding answers instantly through an accordion-style FAQ portal with real-time client-side keyword search (`/{ws}/{product}/faq`).
2. **Admins**: Authoring rich-text release notes with sticky formatting toolbars, markdown shortcuts, remote image insertion, tag assignment, custom release dates, slug auto-generation, debounced auto-save, and live preview (`/dashboard/{ws}/{product}/changelog`), alongside managing categorized Q&A with smooth drag-and-drop fractional reordering (`/dashboard/{ws}/{product}/faq`).

### Primary Architectural Recommendation
- **Rich Text Engine**: Store structured ProseMirror JSON (`jsonb`) in PostgreSQL and validate incoming documents strictly with Zod schemas in `@userhq/types`. Do **not** store or transport raw HTML. On the client, use `@tiptap/react` 3.31.4 with `immediatelyRender: false` in `"use client"` authoring canvases. On the read side, render safely in React Server Components using `@tiptap/static-renderer` (or a dedicated JSX AST mapper) without `dangerouslySetInnerHTML`.
- **Remote Images Only (D-06)**: Remote image URLs (`http://`, `https://`) with optional alt text are inserted directly into Tiptap image node attributes. Local image file upload and Sharp WebP conversion for changelog entries are explicitly deferred to v2.
- **Fractional Reordering**: Re-use UserHQ's established `@dnd-kit/react` 0.5.0 and `generateKeyBetween` LexoRank implementation (`packages/types/src/rank.ts`) for reordering FAQ categories and questions within categories. Reordering executes with zero-downtime, O(1) single-row database updates.
- **Client-Side FAQ Search & Highlighting**: Public FAQ datasets for a given product are compact (typically tens to hundreds of items). Fetching the category tree upfront enables instant 0ms search latency, real-time keyword highlighting with `<mark>`, hash synchronization (`#q-[id]`), and zero server load during visitor typing.

---

## Architectural Responsibility Map

| Domain / Layer | Primary Responsibility | Key Files & Modules |
|---|---|---|
| **Database (`@userhq/db`)** | Tables, indexes, composite foreign keys, and migrations for changelog entries, tags, entry-tags, FAQ categories, and FAQ questions | `packages/db/src/schema/changelog.ts`<br>`packages/db/src/schema/faq.ts`<br>`packages/db/migrations/0010_changelog_faq.sql` |
| **Shared Types (`@userhq/types`)** | Zod input/output DTOs, rich text ProseMirror schema, slug derivation helpers, error codes | `packages/types/src/changelog.ts`<br>`packages/types/src/faq.ts`<br>`packages/types/src/rich-text.ts`<br>`packages/types/src/index.ts` |
| **Backend API (`@userhq/api`)** | Admin CRUD, slug conflict resolution, tag seeding, move endpoints, public portal endpoints with tenant isolation and serialization guards | `apps/api/src/changelog/*`<br>`apps/api/src/faq/*`<br>`apps/api/src/portal/portal-changelog.controller.ts`<br>`apps/api/src/portal/portal-faq.controller.ts` |
| **Frontend Web (`@userhq/web`)** | Public portal timeline, article permalink with OpenGraph, FAQ portal with instant search, admin changelog studio with Tiptap, admin FAQ drag-and-drop editor | `apps/web/app/[ws]/[product]/changelog/*`<br>`apps/web/app/[ws]/[product]/faq/*`<br>`apps/web/app/dashboard/[ws]/[product]/changelog/*`<br>`apps/web/app/dashboard/[ws]/[product]/faq/*` |

---

## User Constraints

*(Verbatim from `05-CONTEXT.md`)*

### Changelog Feed & Article Layout
- **D-01:** Changelog feed is presented as a **Connected Timeline** — a vertical line connecting release entries with date markers and tag badges (classic changelog aesthetic, e.g. Linear/Raycast).
- **D-02:** Long changelog entries use **Expandable Inline ("Read more")** in the feed — displays a concise preview snippet that unfolds full content in place upon click, alongside a direct permalink share icon.
- **D-03:** Changelog permalink pages (`/{ws}/{product}/changelog/[slug]`) render as a **Centered Standalone Article** — clean single-column layout with "← All updates" back navigation, tags, and full OpenGraph social cards.
- **D-04:** Entry tags (New, Improved, Fixed) are displayed as **Static Colored Badges** (New = emerald, Improved = blue, Fixed = amber). Tag filtering is deferred to v2 per requirements (CHLG-V2-01).

### Editor & Image Insertion
- **D-05:** Formatting toolbar uses a **Sticky Top Toolbar** fixed above the editor canvas with icon buttons for headings (H1/H2), formatting (bold, italic), lists (bullet, ordered), quotes, code blocks, links, and images.
- **D-06:** Images are inserted via **Remote URLs Only** — local file upload and WebP conversion for changelog images is disabled for this version; images are inserted via remote `http://` / `https://` URLs with a URL input and optional alt text. — **Reversibility:** costly — schema stores remote image URL/alt text in rich text JSONB rather than internal upload file IDs.
- **D-07:** Draft saving and publishing uses a **Comprehensive Hybrid Workflow**:
  - Dedicated **Save Draft** and **Publish** buttons with an "Unsaved changes" dirty indicator.
  - Background **debounced auto-save** (every ~3s when dirty) with a "Draft saved at [time]" indicator.
  - A **Live Preview** modal/toggle showing the exact rendered output before publishing.
- **D-08:** Editor supports **Full Markdown Shortcuts** (auto-conversion of `#`, `-`, `>`, ```` ``` ````) alongside toolbar icon interactions for efficient authoring.

### FAQ Navigation & Search
- **D-09:** Public FAQ layout (`/{ws}/{product}/faq`) features a **Left Sidebar Category List + Stacked Sections** — sticky left navigation showing categories and question counts with smooth-scrolling and URL hash synchronization.
- **D-10:** Questions use **Multi-Open Accordions with Highlight Scroll** — visitors can expand multiple answers simultaneously. Visiting a question link (`#q-[id]`) auto-scrolls, expands the answer, and briefly flashes an accent highlight.
- **D-11:** FAQ search performs **Instant Client-Side Search with Keyword Highlighting** — real-time filtering across question titles and answer texts with matched terms highlighted in place.
- **D-12:** FAQ-07 "Didn't find it?" prompt **Navigates to Feedback Board with Prefilled Title** — links to `/{ws}/{product}?new=true` with the search query prefilled in the new post title input.

### Publishing Workflow & Attribution
- **D-13:** Release date allows **Custom / Backdated Release Dates** — defaults to current timestamp upon publish, but admins can select a specific date/time for historical release notes or precise deployment schedules.
- **D-14:** Public changelog entries show **Product Brand Only** — published under the product name and logo, keeping release updates focused on the company/product rather than individual admin users.
- **D-15:** Permalink slugs are **Auto-Generated from Title with Admin Edit** — slug is auto-derived from the title (e.g. `improved-export-performance`), editable before publishing, and deduplicated if conflicts arise.
- **D-16:** FAQ reordering in the dashboard uses **Drag-and-Drop with Grab Handles** for both categories and questions, powered by `@dnd-kit/react` with fractional ranking.

### Deferred Scope
- **CHLG-V2-01**: Visitor can filter the changelog feed by tag (deferred to v2 in REQUIREMENTS.md).
- **CHLG-V2-02**: Changelog has an RSS feed (deferred to v2 in REQUIREMENTS.md).
- **LOOP-V2-02**: Linking changelog entries to roadmap items / posts they shipped (deferred to v2 in REQUIREMENTS.md).
- **CHLG-V2-IMAGE-UPLOAD**: Server-side WebP image uploads directly from the changelog editor (deferred for v1 per D-06; remote URLs used).

---

## Phase Requirements Table

| Requirement ID | Description | Status / Resolution | Architectural Mechanism |
|---|---|---|---|
| **CHLG-01** | Admin formatted rich text (headings, lists, bold, italics, links) | Required | Tiptap StarterKit v3 + sticky toolbar (`D-05`, `D-08`) stored as JSONB |
| **CHLG-02** | Admin insert images (remote URLs only per `D-06`) | Modified by `D-06` | Tiptap Image extension accepting remote URL and alt text |
| **CHLG-03** | Tagging entries; seed New, Improved, Fixed; admin CRUD | Required | `changelog_tags` table, seeded on product creation, tag management in studio |
| **CHLG-04** | Save entry as draft hidden from public | Required | `publishedAt: null`, portal filters `publishedAt IS NOT NULL` |
| **CHLG-05** | Publish entry, edit after publishing, unpublish to draft | Required | Dedicated Publish/Unpublish buttons (`D-07`), updates `publishedAt` |
| **CHLG-06** | Admin delete entry | Required | `DELETE .../changelog/:id` with confirmation modal |
| **CHLG-07** | Anyone read published entries, newest first | Required | Timeline feed `/{ws}/{product}/changelog`, ordered by `publishedAt DESC` (`D-01`, `D-02`) |
| **CHLG-08** | Permalink per entry with OpenGraph title and image preview | Required | Route `/{ws}/{product}/changelog/[slug]` (`D-03`), `generateMetadata` OpenGraph card |
| **FAQ-01** | Admin create, rename, delete FAQ categories | Required | `faq_categories` table, admin category dialogs & cascade handling |
| **FAQ-02** | Admin create, edit, delete questions in category, rich-text answers | Required | `faq_questions` table with JSONB answer, Tiptap editor |
| **FAQ-03** | Admin reorder categories, and questions within category | Required | `@dnd-kit/react` + `generateKeyBetween` LexoRank (`D-16`) |
| **FAQ-04** | Visitor browse FAQ by category | Required | Stacked category sections + sticky category navigation sidebar (`D-09`) |
| **FAQ-05** | Visitor search questions and answers by text | Required | Client-side real-time filtering across titles and answers (`D-11`) |
| **FAQ-06** | Deep link per question expanding accordion | Required | Hash `#q-[id]`, auto-expands, scrolls into view, pulse highlight (`D-10`) |
| **FAQ-07** | "Didn't find it?" button opening new-post feedback form | Required | Link to `/{ws}/{product}?new=true&title=${encodeURIComponent(q)}` (`D-12`) |

---

## Standard Stack

### Core Stack
- **Node.js**: Node 24+ [VERIFIED: `package.json`]
- **Runtime / Package Manager**: Bun 1.4.2 [VERIFIED: `package.json`]
- **Backend Framework**: NestJS 12.1.2 [VERIFIED: `apps/api/package.json`]
- **Database & ORM**: PostgreSQL 16+ via `pg` 8.23.1 and `drizzle-orm` 0.45.3 [VERIFIED: `packages/db/package.json`]
- **Frontend Framework**: Next.js 16.3.8 / Vinext 1.0.0 [VERIFIED: `apps/web/package.json`]
- **React**: React 19.3.0 (`catalog:`) [VERIFIED: `package.json`]
- **Validation**: Zod 4.6.5 (`catalog:`) [VERIFIED: `package.json`]
- **Drag & Drop**: `@dnd-kit/react` 0.5.0 [VERIFIED: `apps/web/package.json`]
- **Fractional Indexing**: `generateKeyBetween` [VERIFIED: `packages/types/src/rank.ts`]
- **Icons**: `lucide-react` 1.49.0 [VERIFIED: `apps/web/package.json`]

### Supporting Stack (Verified Versions for Installation)
- **`@tiptap/react`**: `3.31.4` [VERIFIED: npm registry]
- **`@tiptap/pm`**: `3.31.4` [VERIFIED: npm registry]
- **`@tiptap/starter-kit`**: `3.31.4` [VERIFIED: npm registry]
  *(Bundles: Heading, Bold, Italic, Strike, Code, CodeBlock, Blockquote, BulletList, OrderedList, ListItem, Link, Underline, HorizontalRule)*
- **`@tiptap/extension-image`**: `3.31.4` [VERIFIED: npm registry]
- **`@tiptap/static-renderer`**: `3.31.4` [VERIFIED: npm registry]
  *(Synchronous, DOM-free React AST static rendering for Server Components)*

---

## Package Legitimacy Audit

| Package | Version | Purpose | Peer Compatibility | Audit Verdict |
|---|---|---|---|---|
| `@tiptap/react` | `3.31.4` | Tiptap rich-text editor for `"use client"` authoring | `react: ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` [VERIFIED: npm registry] | **Approved**: Native React 19 support. Use `immediatelyRender: false`. |
| `@tiptap/starter-kit` | `3.31.4` | Standard prose extensions and markdown shortcut input rules | Compatible with `@tiptap/core` 3.31.4 | **Approved**: Bundles Link and Underline in v3. |
| `@tiptap/extension-image` | `3.31.4` | Remote image node insertion (`D-06`) | Compatible with `@tiptap/core` 3.31.4 | **Approved**: Allows setting `src` and `alt`. |
| `@tiptap/static-renderer` | `3.31.4` | Server-side React element rendering from ProseMirror JSON | `react: ^17.0.0 \|\| ^18.0.0 \|\| ^19.0.0` [VERIFIED: npm registry] | **Approved**: Completely DOM-free; executes in Node/RSC without JSDOM. |
| `@dnd-kit/react` | `0.5.0` | Category and question drag-and-drop reordering | React 19 compatible, already installed in web app | **Approved**: Established in Phase 04 kanban. |

---

## Architecture Patterns

### 1. System Architecture & Entity Flow

```
+---------------------------------------------------------------------------------------+
|                                    USER BROWSER                                       |
|                                                                                       |
|  [Public Visitor: /{ws}/{product}/changelog]  [Public Visitor: /{ws}/{product}/faq]  |
|       | Connected Timeline (D-01)                  | Left Sidebar + Stacked (D-09)    |
|       | Expandable "Read More" (D-02)              | Multi-Open Accordions (D-10)     |
|       | Centered Permalink (D-03)                  | Instant Search + Highlight (D-11)|
|       | Static Tag Badges (D-04)                   | "Didn't find it?" -> Board (D-12)|
|                                                                                       |
|  [Admin Studio: /dashboard/{ws}/{product}/changelog] [/dashboard/{ws}/{prod}/faq]     |
|       | Tiptap Sticky Toolbar (D-05)               | Drag & Drop Reordering (D-16)    |
|       | Remote Image URLs (D-06)                   | Rich-Text Answers (FAQ-02)       |
|       | Debounced Auto-Save 3s (D-07)              | Fractional Ranks (generateKey)   |
|       | Markdown Shortcuts (D-08)                                                     |
|       | Custom Release Date (D-13)                                                    |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v (HTTP /api/v1)
+---------------------------------------------------------------------------------------+
|                                  NESTJS API GATEWAY                                   |
|                                                                                       |
|  Admin Controllers (TenantGuard + Tenant Scoping)                                     |
|  - ChangelogController: CRUD, saveDraft, publish, unpublish, tag CRUD, dedupeSlug     |
|  - FaqController: Category CRUD, moveCategory, Question CRUD, moveQuestion            |
|                                                                                       |
|  Portal Controllers (PortalGuard + @Public() + @SerializeOptions)                     |
|  - PortalChangelogController: listPublishedFeed, getPublishedBySlug                   |
|  - PortalFaqController: listPublicFaqTree                                             |
|                                                                                       |
|  Validation & Sanitization Layer                                                      |
|  - RichTextDocSchema: Strict ProseMirror JSON schema (nodes, marks, http/https URLs)  |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v (SQL via Drizzle ORM)
+---------------------------------------------------------------------------------------+
|                                  POSTGRESQL DATABASE                                  |
|                                                                                       |
|  - changelog_entries (id, product_id, title, slug, summary, content [jsonb],          |
|                       published_at, created_at, updated_at)                           |
|  - changelog_tags (id, product_id, name, color, created_at)                           |
|  - changelog_entry_tags (entry_id, tag_id, product_id [PK: entry_id, tag_id])         |
|  - faq_categories (id, product_id, name, rank [LexoRank], created_at, updated_at)     |
|  - faq_questions (id, product_id, category_id, question, answer [jsonb],             |
|                   rank [LexoRank], created_at, updated_at)                            |
+---------------------------------------------------------------------------------------+
```

### 2. Database Schema Design (`packages/db`)

```ts
// packages/db/src/schema/changelog.ts
import { pgTable, uuid, text, timestamp, unique, index, foreignKey } from "drizzle-orm/pg-core";
import { products } from "./tenancy.js";

export const changelogEntries = pgTable(
  "changelog_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary"), // Optional excerpt for timeline preview & OpenGraph
    content: jsonb("content").notNull(), // ProseMirror JSON
    publishedAt: timestamp("published_at", { withTimezone: true }), // null = draft
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("changelog_entries_id_product_unique").on(t.id, t.productId),
    unique("changelog_entries_product_slug_unique").on(t.productId, t.slug),
    index("changelog_entries_product_published_idx").on(t.productId, t.publishedAt),
  ]
);

export const changelogTags = pgTable(
  "changelog_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(), // Hex color: '#10B981', '#3B82F6', '#F59E0B'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("changelog_tags_id_product_unique").on(t.id, t.productId),
    uniqueIndex("changelog_tags_product_name_ci").on(t.productId, sql`lower(${t.name})`),
  ]
);

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

```ts
// packages/db/src/schema/faq.ts
import { pgTable, uuid, text, timestamp, unique, index, foreignKey, jsonb } from "drizzle-orm/pg-core";
import { products } from "./tenancy.js";

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

export const faqQuestions = pgTable(
  "faq_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull(),
    question: text("question").notNull(),
    answer: jsonb("answer").notNull(), // ProseMirror JSON
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

### 3. Safe Tiptap JSON Validation Pattern (`@userhq/types`)

```ts
// packages/types/src/rich-text.ts
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

### 4. Safe Static Rich-Text Rendering Pattern (`apps/web`)

```tsx
// apps/web/components/rich-text/rich-text-viewer.tsx
import * as React from "react";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { RichTextDoc } from "@userhq/types";
import { cn } from "../../lib/utils";

export interface RichTextViewerProps {
  content: RichTextDoc | null | undefined;
  className?: string;
}

export function RichTextViewer({ content, className }: RichTextViewerProps): React.JSX.Element | null {
  if (!content || !content.content || content.content.length === 0) {
    return null;
  }

  // Statically renders ProseMirror JSON AST to native React JSX components in RSC or Client
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

### 5. Fractional Drag-and-Drop Pattern (`@dnd-kit/react`)

```tsx
// Reordering pattern matching kanban-board.tsx
import { generateKeyBetween } from "@userhq/types";

// In handleCategoryDragEnd / handleQuestionDragEnd:
const sortedItems = [...items].sort((a, b) => a.rank.localeCompare(b.rank));
const targetIndex = event.target.index;

let newRank: string;
if (sortedItems.length === 0) {
  newRank = generateKeyBetween(null, null);
} else if (targetIndex <= 0) {
  newRank = generateKeyBetween(null, sortedItems[0].rank);
} else if (targetIndex >= sortedItems.length) {
  newRank = generateKeyBetween(sortedItems[sortedItems.length - 1].rank, null);
} else {
  const prevRank = sortedItems[targetIndex - 1].rank;
  const nextRank = sortedItems[targetIndex].rank;
  newRank = generateKeyBetween(prevRank, nextRank);
}

// Persist via PATCH /api/v1/workspaces/:ws/products/:product/faq/questions/:id/move { targetRank: newRank }
```

### 6. Public FAQ Real-Time Search & Highlight Pattern (`apps/web`)

```tsx
// apps/web/components/faq/faq-highlight.tsx
import * as React from "react";

export function HighlightText({ text, query }: { text: string; query: string }): React.JSX.Element {
  if (!query.trim()) return <>{text}</>;

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

## Don't Hand-Roll

| Feature / Domain | Do NOT Hand-Roll | Use Standard Established Pattern |
|---|---|---|
| **LexoRank / Fractional Keys** | Custom decimal division or string slicing | `generateKeyBetween` from `packages/types/src/rank.ts` [VERIFIED: Tested & working] |
| **HTML Sanitization** | Regex stripping or HTML sanitizers on raw strings | Store ProseMirror JSONB validated via Zod + render via `@tiptap/static-renderer` |
| **Slug Generation** | Manual string replacements and regex trimming | `slugify` from `packages/types/src/slugs.ts` with collision counter loop |
| **Drag and Drop Engine** | HTML5 drag-and-drop API with event listeners | `@dnd-kit/react` 0.5.0 + `useSortable` (accessibility, touch, keyboard support) |
| **Date Time Picker** | Heavy 3rd-party date-picker bundle (e.g. `react-day-picker`) | Standard HTML5 `<input type="datetime-local" />` styled with Tailwind tokens |
| **Multi-Open Accordion** | Heavy state libraries or custom animated height calculators | Lightweight React `Set<string>` open state with Radix or CSS grid-rows transition |

---

## Common Pitfalls & How to Avoid

### Pitfall 1: Tiptap SSR Hydration Mismatch
- **Problem**: Next.js / Vinext server-side renders `<TiptapEditor />` and ProseMirror modifies the DOM immediately on load, causing React hydration error #418 or #425.
- **Solution**:
  1. Pass `immediatelyRender: false` in `useEditor({ ... })`.
  2. Load the editor inside a `"use client"` component.

### Pitfall 2: XSS in Rich-Text Answer / Release Note Rendering
- **Problem**: Storing HTML strings or rendering with `dangerouslySetInnerHTML` allows malicious actors to inject `<script>` tags, `onerror` payloads, or `javascript:` URLs.
- **Solution**:
  1. Persist only structured JSON in PostgreSQL (`jsonb`).
  2. Validate incoming JSON payload with `RichTextDocSchema` in `@userhq/api`.
  3. Validate that URLs only use `http:`, `https:`, or `mailto:` protocols.
  4. Render with `@tiptap/static-renderer/pm/react` into React elements (`<p>`, `<h1>`, `<a>` with `rel="noopener noreferrer nofollow"`), guaranteeing zero raw HTML string injection.

### Pitfall 3: FAQ Drag-and-Drop Race Conditions & Rank Collisions
- **Problem**: Concurrent drag-and-drop operations creating identical ranks or shifting entire arrays of integers.
- **Solution**: Use LexoRank fractional indexing (`generateKeyBetween`). Every move is an isolated `PATCH` updating only one row's `rank` column without locking or updating neighboring rows.

### Pitfall 4: Slug Collisions on Publish or Auto-Derivation
- **Problem**: Two changelog entries with the title "March Updates" colliding on `slug = "march-updates"`, triggering a database unique constraint violation (500 error).
- **Solution**: Implement `generateUniqueChangelogSlug(db, productId, baseSlug, currentEntryId)`. On save/publish, the service detects conflicts and automatically appends `-2`, `-3` etc.

### Pitfall 5: Draft Leaks in Public Portal Feeds
- **Problem**: Admin drafts appearing in the public feed or via permalinks.
- **Solution**: Public portal queries explicitly filter `where(and(eq(changelogEntries.productId, productId), isNotNull(changelogEntries.publishedAt)))`. Add automated unit tests verifying draft entries return 404 on the public portal route.

### Pitfall 6: Public Contract Route Serialization
- **Problem**: Public endpoints leaking internal fields or breaking `apps/api/test/public-contract.test.ts`.
- **Solution**: Every `@Public()` handler must declare `@SerializeOptions({ schema: PublicSchema })` as verified by the public contract seam test.

---

## Validation Architecture

### Verification Commands
```bash
# 1. Typecheck all packages and apps
bun run typecheck

# 2. Run database migration check
bun run --filter '@userhq/db' db:check

# 3. Run backend tests (including public-contract, changelog, and faq)
bun run --filter '@userhq/api' test

# 4. Run frontend tests
bun run --filter '@userhq/web' test

# 5. Full CI verification pipeline
bun run ci:check
```

### Automated Test Matrix
1. **Public Contract Seam Test (`apps/api/test/public-contract.test.ts`)**:
   - Assert all new `@Public()` routes (`/portal/:ws/:product/changelog`, `/portal/:ws/:product/changelog/:slug`, `/portal/:ws/:product/faq`) declare `@SerializeOptions({ schema })`.
2. **Changelog Service & Controller Test (`apps/api/test/changelog.test.ts`)**:
   - Create draft entry with Tiptap JSON content.
   - Debounced auto-save updates entry.
   - Publish entry with custom release date (`D-13`).
   - Unpublish entry back to draft (`CHLG-05`).
   - Delete entry (`CHLG-06`).
   - Slug collision deduplication (`D-15`).
   - Seeded tags (New, Improved, Fixed) created on product setup; add/rename/delete tags (`CHLG-03`).
3. **Portal Changelog API Test (`apps/api/test/portal-changelog.test.ts`)**:
   - Feed lists only published entries, newest first (`CHLG-07`).
   - Draft entries return 404 on permalink endpoint (`CHLG-04`).
   - Tenant isolation: Workspace B cannot fetch Workspace A's entries (`CHLG-08`).
4. **FAQ Service & Controller Test (`apps/api/test/faq.test.ts`)**:
   - Category CRUD (`FAQ-01`).
   - Question CRUD with rich-text answer JSON (`FAQ-02`).
   - Reorder categories via `targetRank` (`FAQ-03`, `D-16`).
   - Reorder questions within category and move question across categories (`FAQ-03`, `D-16`).
   - Tenant isolation: Workspace B cannot reorder or delete Workspace A's FAQ categories or questions.
5. **Portal FAQ API Test (`apps/api/test/portal-faq.test.ts`)**:
   - Returns category hierarchy sorted by category rank and question rank (`FAQ-04`).
6. **Frontend Web Tests (`apps/web/test/*`)**:
   - `changelog-timeline.test.tsx`: Timeline rendering, inline "Read more" toggle, permalink share copy.
   - `faq-portal.test.tsx`: Left category sidebar smooth scroll, multi-open accordion, client-side keyword search, keyword highlighting, "Didn't find it?" feedback button navigation with prefilled title.

---

## Security Domain

### ASVS / Security Requirements
- **ASVS V5 (Input Validation & Output Encoding)**:
  - Rich text content is never parsed as raw HTML.
  - Zod validates the AST node and mark allowlists.
  - Links are restricted to `http:`, `https:`, and `mailto:` protocols.
  - Images are restricted to valid `http:` and `https:` URLs (D-06).
  - External links are rendered with `rel="noopener noreferrer nofollow"`.
- **Multi-Tenant Scoping**:
  - All changelog entries, tags, entry-tags, FAQ categories, and FAQ questions are strictly scoped by `productId` and `workspaceId`.
  - Composite foreign keys in PostgreSQL enforce referential integrity across tenants (`foreignKey({ columns: [t.categoryId, t.productId], foreignColumns: [faqCategories.id, faqCategories.productId] })`).
  - `TenantGuard` verifies admin authorization against the workspace session before any mutation or dashboard view.
  - `PortalGuard` validates public workspace and product existence and suspends access if the workspace is suspended.

---

## Sources & Metadata

### Verified Sources
- Codebase inspection: `packages/db/src/schema/tenancy.ts`, `packages/db/src/schema/roadmap.ts`, `packages/db/src/schema/feedback.ts` [VERIFIED: Codebase]
- Codebase inspection: `packages/types/src/rank.ts`, `packages/types/src/slugs.ts`, `packages/types/src/index.ts` [VERIFIED: Codebase]
- Codebase inspection: `apps/api/src/products/products.controller.ts`, `apps/api/test/public-contract.test.ts` [VERIFIED: Codebase]
- Codebase inspection: `apps/web/components/roadmap/kanban-board.tsx`, `apps/web/components/roadmap/kanban-card.tsx` [VERIFIED: Codebase]
- Npm registry: `@tiptap/react@3.31.4`, `@tiptap/starter-kit@3.31.4`, `@tiptap/static-renderer@3.31.4`, `@tiptap/extension-image@3.31.4` [VERIFIED: npm registry]
- Project documentation: `.planning/phases/05-changelog-faq/05-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/research/STACK.md` [VERIFIED: Project docs]

---
*Phase 05 Research completed for planner consumption.*
