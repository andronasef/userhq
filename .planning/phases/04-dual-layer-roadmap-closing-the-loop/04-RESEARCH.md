# Phase 04: Dual-Layer Roadmap & Closing the Loop - Research & Architecture

## 1. Executive Summary & Primary Recommendation

### Purpose & Scope
Phase 04 delivers the **Dual-Layer Roadmap** and **Closing the Loop** engine for UserHQ. It bridges customer feedback with product delivery through:
1. **Internal Admin Kanban (`/dashboard/{ws}/{product}/roadmap`)**: Drag-and-drop roadmap planning across custom status columns, managing public-facing and internal-only metadata, assignee assignments, flexible target dates, and linking feedback posts to roadmap work items.
2. **Public Product Roadmap (`/{ws}/{product}/roadmap`)**: A clean, accessible view of planned, in-progress, and launched items with opt-in status columns, linked customer post counts, and item detail dialogs.
3. **Closing the Loop Notifications (`NotificationBell` & `/{ws}/{product}/activity`)**: An in-app notification center alerting users when posts they created, voted on, or commented on change status (including admin public notes), paired with a "My Activity" feed highlighting post updates and new comments since their last visit.
4. **Zero-Leakage Privacy Fortress (ROAD-12)**: Architectural guarantee and automated canary testing ensuring that internal titles, notes, descriptions, assignees, and internal deadlines never leak to public APIs or rendered HTML.

### Primary Architectural Recommendations
- **Dual-Table Privacy Architecture**: Separate public roadmap data from internal metadata into two physical tables: `roadmap_items` (public-safe fields only) and `roadmap_item_internals` (1:1 extension table storing internal notes, assignees, and deadlines). Public route handlers and queries strictly query `roadmap_items` and never join `roadmap_item_internals`.
- **Fractional Rank (LexoRank) for O(1) Reordering**: Use fractional string indexing (based on Rocicorp's battle-tested, CC0-licensed `generateKeyBetween` algorithm in `@userhq/types`) for card ranking within columns. Card movements update a single row (`status_id`, `rank`) in PostgreSQL without lock cascades or sibling re-indexing.
- **Transactional Post Status Sync & Lock**: Posts maintain a 1:many item-to-post relationship via `posts.roadmap_item_id`. When a roadmap item changes status, all linked posts update their status transactionally, log `post_activity`, and trigger notifications. Linked posts are locked from standalone status edits (`post_locked` error code 400). On roadmap item deletion, linked posts retain their status and unlock (`roadmap_item_id = null`).
- **Upserted Stakeholder Notifications**: Group repeated status updates per post into a single notification row via `UNIQUE(user_id, post_id)` upsert, resetting `read_at = NULL` and pointing to the latest `post_activity` snapshot.
- **Tracked User Activity Visits**: Track user visits per product in `user_product_activity_visits` (`user_id`, `product_id`, `last_visited_at`) to reliably highlight "Status changed" and "New comments" badges in "My Activity" feed since the user's last session.

---

## 2. Architectural Responsibility Map

| Domain / Layer | Package / Directory | Responsibilities |
| :--- | :--- | :--- |
| **Database Schema & Migrations** | `packages/db/src/schema/roadmap.ts`<br>`packages/db/src/schema/notifications.ts`<br>`packages/db/src/schema/tenancy.ts`<br>`packages/db/src/schema/feedback.ts` | • Define `roadmap_items` (public-safe) and `roadmap_item_internals` (1:1 internal).<br>• Add `is_public_roadmap` boolean to `statuses`.<br>• Add `roadmap_item_id` FK to `posts`.<br>• Define `notifications` table with `UNIQUE(user_id, post_id)` upsert constraint.<br>• Define `user_product_activity_visits` table for visit tracking.<br>• Generate migration `0009_roadmap_notifications.sql`. |
| **Shared Types & Contracts** | `packages/types/src/roadmap.ts`<br>`packages/types/src/notifications.ts`<br>`packages/types/src/rank.ts`<br>`packages/types/src/tenancy.ts` | • Zod schemas for Admin Roadmap Item (`AdminRoadmapItemSchema`, create/update inputs).<br>• Zod schemas for Public Roadmap Item (`PublicRoadmapItemSchema`, public list/detail responses).<br>• Notification & Activity schemas (`NotificationItemSchema`, `UserActivityItemSchema`).<br>• Inlined CC0 fractional string ordering generator (`generateKeyBetween`).<br>• Status schema updates (`isPublicRoadmap`). |
| **Backend API Modules** | `apps/api/src/roadmap/`<br>`apps/api/src/notifications/`<br>`apps/api/src/products/statuses.controller.ts`<br>`apps/api/src/feedback/moderation.service.ts` | • `RoadmapService` & `RoadmapController` (admin CRUD, post linking, combobox search).<br>• `PortalRoadmapController` (public endpoints, strict allowlist serialization, status column filtering).<br>• `NotificationsService` & `NotificationsController` (bell unread count, list, mark-read).<br>• `PortalActivityController` (user activity feed with update diffing).<br>• Update `statuses.controller.ts` deletion transaction to reassign roadmap items.<br>• Update `moderation.service.ts` to block standalone status changes on linked posts (`post_locked`). |
| **Frontend Dashboard** | `apps/web/app/dashboard/[ws]/[product]/roadmap/`<br>`apps/web/components/dashboard/roadmap/` | • Multi-column Kanban board using `@dnd-kit/react@0.5.0`.<br>• Status column toggles (`isPublicRoadmap` toggle in `/statuses`).<br>• Create / Edit Roadmap Item modal dialogs with dual-layer field controls.<br>• Post linking combobox with async search and unlinking actions.<br>• Drag overlay card preview and keyboard navigation. |
| **Frontend Public Portal** | `apps/web/app/[ws]/[product]/roadmap/`<br>`apps/web/app/[ws]/[product]/activity/`<br>`apps/web/components/portal/roadmap/` | • Tab navigation in `PortalLayout` (Feedback, Roadmap, Activity).<br>• Public Roadmap column layout with card counts, linked post badges, and item dialogs.<br>• Empty states for unconfigured public roadmaps.<br>• "My Activity" chronological feed with "Status changed" and "New comments" badges. |
| **Global Shell & Chrome** | `apps/web/components/notifications/`<br>`apps/web/components/dashboard/header.tsx`<br>`apps/web/components/portal/portal-frame.tsx`<br>`apps/web/components/user-menu.tsx` | • `NotificationBell` popover component mounted in both Dashboard and Portal headers.<br>• Unread badge counter with optimistic update on "Mark all as read".<br>• "My activity" link injected into `UserMenu` avatar dropdown. |

---

## 3. Standard Stack & Package Audit

### Core Stack Verification

| Dependency | Target Layer | Approved Version | State in Codebase | Purpose & Audit Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `@dnd-kit/react` | Frontend (`apps/web`) | `^0.5.0` (installed `0.5.0`) | Already in `apps/web/package.json` | **Verified**: Modern rewrite of dnd-kit. Provides `DragDropProvider`, `useSortable`, `useDroppable`, `DragOverlay`. |
| `@dnd-kit/react/sortable` | Frontend (`apps/web`) | `^0.5.0` (installed `0.5.0`) | Bundled with `@dnd-kit/react` | **Verified**: Exports `useSortable`, `isSortable`. Supports multi-column via `group` identifier. |
| `@dnd-kit/abstract`, `@dnd-kit/dom`, `@dnd-kit/collision` | Frontend (`apps/web`) | `0.5.0` | Transitive dependencies in root `node_modules` | **Verified**: Core engine for collision detection and pointer/keyboard sensors. |
| `lucide-react` | Frontend (`apps/web`) | `1.49.0` | Installed | **Verified**: Icons for `Kanban`, `Bell`, `Calendar`, `Paperclip`, `Lock`, `CheckCircle2`, `ExternalLink`. |
| `nuqs` | Frontend (`apps/web`) | `2.10.1` | Installed | **Verified**: URL state management for filter/tab query parameters without client state desync. |
| `@radix-ui/react-popover` | Frontend (`apps/web`) | Installed | Installed | **Verified**: Headless popover for the notification bell dropdown with focus management and outside click handling. |
| `@radix-ui/react-dialog` | Frontend (`apps/web`) | Installed | Installed | **Verified**: Modal dialogs for item creation, edit, and public roadmap item detail views. |
| `@userhq/types` | Cross-layer | Workspace package | Workspace package | **Verified**: Inlines CC0 fractional string indexing generator (`generateKeyBetween`). Zero new external packages. |

### Package Legitimacy & Safety Audit
- **Zero New Third-Party Dependencies Required**: By inlining the 100-line CC0-licensed Rocicorp fractional indexing string midpoint algorithm in `@userhq/types/src/rank.ts`, UserHQ adds **0 new npm dependencies** in Phase 4.
- All UI interactions strictly utilize packages already vetted and installed during Phases 1–3 (`@dnd-kit/react@0.5.0`, `@radix-ui/*`, `lucide-react@1.49.0`, `nuqs@2.10.1`).
- Complies 100% with the Registry Safety requirement in `04-UI-SPEC.md`.

---

## 4. Architecture Patterns & Data Modeling

### 4.1. System Architecture Diagram

```
                                      +---------------------------------------------+
                                      |                 Admin User                  |
                                      +---------------------------------------------+
                                                             |
                                                             v
                                        +-----------------------------------------+
                                        | Dashboard Roadmap (/dashboard/.../roadmap)|
                                        +-----------------------------------------+
                                                             |
                                      PATCH /api/v1/workspaces/:ws/products/:p/roadmap/:id
                                                             |
                                                             v
                                              +-----------------------------+
                                              |      RoadmapController      |
                                              |       (Admin Tenant)        |
                                              +-----------------------------+
                                                             |
                                                             v
                                           +-----------------------------------+
                                           |          RoadmapService           |
                                           +-----------------------------------+
                                             /               |               \
                                            /                |                \
                                           v                 v                 v
                                +-------------------+ +--------------+ +-------------------+
                                | roadmap_items     | | posts        | | notifications     |
                                | (public fields)   | | (status sync)| | (stakeholder UPSERT)
                                +-------------------+ +--------------+ +-------------------+
                                          |
                                          | 1:1 cascade
                                          v
                                +-------------------+
                                | roadmap_item_     |
                                | internals         |
                                | (secret fields)   |
                                +-------------------+

        ================================== STRICT PRIVACY BARRIER ==================================

                                              +-----------------------------+
                                              |   PortalRoadmapController   |
                                              |        (@Public()           |
                                              +-----------------------------+
                                                             |
                                           SELECT * FROM roadmap_items
                                           WHERE is_public = true
                                             AND status_id IN (statuses.is_public_roadmap = true)
                                           [STRICT ZERO JOIN to roadmap_item_internals]
                                                             |
                                                             v
                                        +-----------------------------------------+
                                        |  Public Roadmap (/{ws}/{product}/roadmap) |
                                        +-----------------------------------------+
                                                             ^
                                                             |
                                      +---------------------------------------------+
                                      |           Public Portal Visitor             |
                                      +---------------------------------------------+
```

### 4.2. Database Schema Design

#### 1. `packages/db/src/schema/roadmap.ts`
```typescript
import { pgTable, uuid, text, boolean, timestamp, unique, index, foreignKey } from "drizzle-orm/pg-core";
import { products, statuses, user } from "./tenancy.js";

// 1. Public-safe roadmap items table (Strictly contains no internal fields)
export const roadmapItems = pgTable(
  "roadmap_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    statusId: uuid("status_id").notNull(),
    publicTitle: text("public_title"), // Nullable until published or customized
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

// 2. Internal metadata table (1:1 extension, NEVER queried by public routes)
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
    deadlineText: text("deadline_text"), // e.g. "Q4 2026", "Nov 2026"
    deadlineDate: timestamp("deadline_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("roadmap_item_internals_item_product_unique").on(t.itemId, t.productId),
    index("roadmap_item_internals_product_assignee_idx").on(t.productId, t.assigneeId),
  ]
);
```

#### 2. `packages/db/src/schema/notifications.ts`
```typescript
import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { user, workspaces, products } from "./tenancy.js";
import { posts, postActivity } from "./feedback.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    postActivityId: uuid("post_activity_id")
      .notNull()
      .references(() => postActivity.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Ensures repeated changes to the same post group into ONE notification row per user
    unique("notifications_user_post_unique").on(t.userId, t.postId),
    index("notifications_user_read_created_idx").on(t.userId, t.readAt, t.createdAt),
  ]
);

export const userProductActivityVisits = pgTable(
  "user_product_activity_visits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    lastVisitedAt: timestamp("last_visited_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique("user_product_activity_visits_user_product_pk").on(t.userId, t.productId),
  ]
);
```

#### 3. Enhancements to Existing Schemas
- **`packages/db/src/schema/tenancy.ts` (`statuses` table)**:
  Add column: `isPublicRoadmap: boolean("is_public_roadmap").notNull().default(false)`.
- **`packages/db/src/schema/feedback.ts` (`posts` table)**:
  Add column: `roadmapItemId: uuid("roadmap_item_id").references(() => roadmapItems.id, { onDelete: "set null" })`.
  Add composite index: `index("posts_product_roadmap_item_idx").on(t.productId, t.roadmapItemId)`.

---

## 5. Critical Implementation Patterns

### 5.1. Zero-Leakage Privacy Fortress (ROAD-12)

#### Architectural Safeguards
1. **Physical Table Isolation**: Internal fields exist only in `roadmap_item_internals`. The public API controller (`PortalRoadmapController`) has zero imports from or references to `roadmapItemInternals`.
2. **Strict Whitelist Serialization**: `PortalRoadmapController` methods declare `@SerializeOptions({ schema: PublicRoadmapListResponseSchema })` ensuring response filtering through Zod schemas.
3. **Automated Canary Seam Test**: A dedicated Vitest test suite (`apps/api/test/canary-roadmap-leak.test.ts`) that executes before every deployment:
   - Inserts distinct UUID-salted tokens into `internalTitle`, `internalDescription`, `internalNotes`, `deadlineText`, and `assigneeId`.
   - Executes HTTP requests against all public endpoints (`/api/v1/portal/:ws/:product/roadmap`, `/posts`, `/posts/:number`, `/activity`).
   - Fetches rendered HTML for public pages (`/{ws}/{product}/roadmap`, `/{ws}/{product}/p/:slug`).
   - Scans the raw text responses for canary tokens with zero tolerance (`expect(response.text).not.toContain("CANARY_")`).

### 5.2. Multi-Column Kanban with `@dnd-kit/react@0.5.0` & LexoRank

In `@dnd-kit/react@0.5.0`, multi-container sorting is handled cleanly:
- Columns act as drop containers using `useDroppable({ id: status.id })`.
- Cards register via `useSortable({ id: item.id, index, group: item.statusId })`.
- During drag, `event.operation.source` exposes `initialGroup`, `group`, `initialIndex`, and `index`.
- When a card is dropped between neighbor $A$ and neighbor $B$:
  - Moving to top of column: `newRank = generateKeyBetween(null, firstCard.rank)`
  - Moving to bottom of column: `newRank = generateKeyBetween(lastCard.rank, null)`
  - Moving between cards: `newRank = generateKeyBetween(prevCard.rank, nextCard.rank)`
  - Empty column: `newRank = generateKeyBetween(null, null)` (returns `"a0"`)
- Frontend optimistically applies the move locally, then calls:
  `PATCH /api/v1/workspaces/:ws/products/:product/roadmap/:itemId` with `{ statusId: targetStatusId, rank: newRank }`.
- If the server returns an error, the local state reverts and a toast displays the error.

### 5.3. Post Linking, Status Locking & Merge Invariants

#### 1. Status Synchronization
When a roadmap item status changes (via drag-and-drop or item modal):
```typescript
await db.transaction(async (tx) => {
  // 1. Update the roadmap item
  await tx.update(roadmapItems).set({ statusId: newStatusId, updatedAt: new Date() }).where(eq(roadmapItems.id, itemId));

  // 2. Fetch all linked posts
  const linkedPosts = await tx.select().from(posts).where(eq(posts.roadmapItemId, itemId));

  for (const post of linkedPosts) {
    if (post.statusId !== newStatusId) {
      // 3. Update post status
      await tx.update(posts).set({ statusId: newStatusId, version: post.version + 1 }).where(eq(posts.id, post.id));

      // 4. Record post activity
      const [activity] = await tx.insert(postActivity).values({
        postId: post.id,
        actorId: adminUser.id,
        kind: "status_changed",
        toStatusId: targetStatus.id,
        statusName: targetStatus.name,
        statusColor: targetStatus.color,
        note: publicNote ?? null,
      }).returning();

      // 5. Fan out notifications to stakeholders (author, voters, commenters)
      await notificationsService.fanOutStatusChange(tx, {
        workspaceId,
        productId,
        post,
        activity,
        excludeUserId: adminUser.id,
      });
    }
  }
});
```

#### 2. Standalone Status Lock (MOD-03)
In `moderation.service.ts`:
```typescript
if (post.roadmapItemId !== null) {
  throw new ApiException("post_locked", 400, "This post's status is managed by a roadmap item.");
}
```

#### 3. Post Merge Resolution (ROAD-06 / MOD-05)
When duplicate posts are merged in `moderation.service.ts`:
- A post can link to at most one roadmap item.
- When `dupRow` is merged into `keepRow`:
  - `dupRow` is unlinked: `UPDATE posts SET roadmap_item_id = NULL WHERE id = dupRow.id`.
  - `keepRow` retains its existing `roadmapItemId` (if any).
  - If `keepRow.roadmapItemId === null` and `dupRow.roadmapItemId !== null`, `keepRow` does NOT automatically link (or optionally inherits if explicitly confirmed, but unlinking duplicate ensures zero accidental link collisions).

#### 4. Roadmap Item Deletion (D-12)
When an admin deletes a roadmap item:
- Linked posts retain their current status (`posts.status_id` remains unchanged).
- `posts.roadmap_item_id` is set to `NULL` (via DB `onDelete: "set null"` foreign key).
- The posts become unlocked and standalone immediately.

### 5.4. Stakeholder Notifications & Activity Badging

#### 1. Stakeholder Discovery Query
When a post status changes, the stakeholders are:
```sql
SELECT DISTINCT user_id FROM (
  SELECT author_id AS user_id FROM posts WHERE id = :postId
  UNION
  SELECT user_id FROM votes WHERE post_id = :postId
  UNION
  SELECT author_id AS user_id FROM comments WHERE post_id = :postId AND deleted_at IS NULL
) s
WHERE user_id IS NOT NULL AND user_id != :actorId;
```
For each discovered user:
```sql
INSERT INTO notifications (user_id, workspace_id, product_id, post_id, post_activity_id, read_at, created_at)
VALUES (:userId, :workspaceId, :productId, :postId, :activityId, NULL, NOW())
ON CONFLICT (user_id, post_id)
DO UPDATE SET
  post_activity_id = EXCLUDED.post_activity_id,
  read_at = NULL,
  created_at = NOW();
```
*Why UPSERT?* LOOP-04 mandates: "repeated changes to the same post are grouped into one notification". If Post #42 moves from Planned $\rightarrow$ In Progress, then In Progress $\rightarrow$ Completed, the user has ONE unread notification row showing the latest status.

#### 2. "My Activity" Diffing (LOOP-01, LOOP-02)
When querying `/{ws}/{product}/activity`:
1. Retrieve user's `lastVisitedAt` from `user_product_activity_visits`.
2. Retrieve all active posts the user authored, voted on, or commented on.
3. Compute badges:
   - `hasStatusChange = (postActivity.createdAt > lastVisitedAt)`
   - `hasNewComments = (latestComment.createdAt > lastVisitedAt AND latestComment.authorId != user.id)`
4. Update `user_product_activity_visits` with `lastVisitedAt = NOW()`.

---

## 6. Don't Hand-Roll Table

| Functionality | Standard Solution | Why We Don't Hand-Roll |
| :--- | :--- | :--- |
| **Fractional String Ranking** | Rocicorp `generateKeyBetween` algorithm inlined in `@userhq/types/src/rank.ts` | Naive floating point division suffers from 64-bit IEEE-754 precision exhaustion after ~50 moves. Rocicorp's base62 string midpoint generator can generate infinite keys between any two strings without re-indexing. |
| **Drag and Drop Coordination** | `@dnd-kit/react@0.5.0` (`useSortable`, `DragDropProvider`) | Custom HTML5 drag-and-drop has notorious mobile touch bugs, erratic ghost image positioning, and lack of accessible keyboard sorting. |
| **Notification Popover Dropdown** | `@radix-ui/react-popover` | Handles click outside, ESC dismiss, portaling over modal backdrops, collision detection with viewport edges, and focus restoration. |
| **Status Column Deletion Safety** | PostgreSQL atomic transaction with `onDelete: "restrict"` | Ensures no orphaned roadmap items or posts can exist if a status is removed; forces admin to pick a reassignment target. |
| **URL State Synchronization** | `nuqs` (installed `2.10.1`) | Prevents React hydration mismatch bugs and ensures filter/status toggles sync cleanly with browser history. |

---

## 7. Common Pitfalls & How to Avoid

### Pitfall 1: Leaking Internal Data in Search or Board Queries
- *Risk*: A developer adds a "roadmap item search" or joins roadmap items with posts, unintentionally passing `internalNotes` or `deadlineText` in the public API JSON.
- *Mitigation*: The database schema physically places internal fields in a separate table (`roadmap_item_internals`). Public endpoints strictly query `roadmap_items`. Automated canary tests (`canary-roadmap-leak.test.ts`) assert no canary strings appear anywhere in public responses.

### Pitfall 2: Re-indexing Cascade on Kanban Drag
- *Risk*: Shifting items using integer positions (`position = position + 1`) causes massive row lock contention, high database write amplification, and merge conflicts between concurrent admins.
- *Mitigation*: Fractional string ranking (`rank`) updates exactly one row (`UPDATE roadmap_items SET status_id = :status, rank = :rank WHERE id = :id`).

### Pitfall 3: Notification Spam on Post Updates
- *Risk*: Moving an item across several columns generates multiple annoying notification rows for voters.
- *Mitigation*: The `notifications` table has a `UNIQUE(user_id, post_id)` constraint and uses PostgreSQL `ON CONFLICT DO UPDATE` to group changes into a single updated notification with unread reset.

### Pitfall 4: Status Delete Cascade Failure
- *Risk*: Admin deletes a status that has roadmap items. The existing status delete handler only reassigns posts, causing a foreign key violation or orphaned items.
- *Mitigation*: Update `apps/api/src/products/statuses.controller.ts` line 364 to execute `UPDATE roadmap_items SET status_id = moveTo WHERE status_id = id AND product_id = tenant.productId` inside the existing transaction.

### Pitfall 5: Post Linking Across Tenants or Products
- *Risk*: An admin maliciously or accidentally attempts to link a post from Product A to a roadmap item from Product B.
- *Mitigation*: Composite foreign key or explicit check `posts.productId === roadmapItems.productId` in `RoadmapService`.

---

## 8. Code Examples & Existing Patterns

### 8.1. Inlined Fractional Indexing Generator (`packages/types/src/rank.ts`)

```typescript
// Based on Rocicorp's CC0-licensed fractional-indexing algorithm
const BASE_62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE_52_DIGITS = BASE_62_DIGITS.slice(10); // A-Z, a-z

export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined
): string {
  if (a == null && b == null) {
    return "a0";
  }
  if (a == null) {
    if (b === "a0") return "Zz";
    // Generate key before b
    // ...
  }
  // Standard Rocicorp midpoint calculation between a and b
  // Generates short, strictly ascending string keys: "a0", "a0V", "a1", etc.
}
```

### 8.2. Canary Privacy Leak Seam Test (`apps/api/test/canary-roadmap-leak.test.ts`)

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp } from "./support/test-app.js";

describe("ROAD-12: Zero-Leakage Privacy Seam Test", () => {
  const CANARIES = {
    title: "CANARY_SECRET_TITLE_991827",
    description: "CANARY_SECRET_DESC_554433",
    notes: "CANARY_SECRET_NOTES_221100",
    deadline: "CANARY_SECRET_DEADLINE_778899",
  };

  it("ensures public endpoints and rendered outputs contain zero internal canary strings", async () => {
    // 1. Seed roadmap item with canary strings in roadmap_item_internals
    // 2. Query public endpoints:
    const resRoadmap = await request(testApp.server).get(`/api/v1/portal/${ws}/${product}/roadmap`);
    const resPosts = await request(testApp.server).get(`/api/v1/portal/${ws}/${product}/posts`);
    
    // 3. Assert zero leakage across all response text
    for (const token of Object.values(CANARIES)) {
      expect(resRoadmap.text).not.toContain(token);
      expect(resPosts.text).not.toContain(token);
    }
  });
});
```

---

## 9. State of the Art & Assumptions Log

### Assumptions
- **LexoRank String Length**: Practical usage on Kanban boards involves tens or hundreds of moves per column. String lengths grow very slowly ($\approx 1$ character per 10-20 bisected insertions). Automatic re-balancing is unnecessary for Phase 4 scale.
- **Notification Retention**: Status notifications remain in the database until user deletion or post deletion (`onDelete: "cascade"`).
- **Public Visibility Rule**: A roadmap item is only visible publicly if:
  1. `roadmap_items.is_public === true`, AND
  2. `statuses.is_public_roadmap === true`.
  If an item is marked public but its status is not marked public, it remains hidden from the public portal.

---

## 10. Validation Architecture & Test Strategy

### Test Pyramid for Phase 4
1. **Unit Tests (`packages/types`)**:
   - `test/rank.test.ts`: Verify `generateKeyBetween` produces strictly ascending strings across empty, head, tail, and middle bisect scenarios.
   - `test/schemas.test.ts`: Verify `AdminRoadmapItemSchema`, `PublicRoadmapItemSchema`, and `NotificationItemSchema` parsing.
2. **Integration API Tests (`apps/api/test`)**:
   - `roadmap.test.ts`: Test admin roadmap CRUD, drag-and-drop reorder, and post linking/unlinking.
   - `canary-roadmap-leak.test.ts`: Assert ROAD-12 privacy protection.
   - `notifications.test.ts`: Verify status change fan-out, unread counts, repeated change grouping, and mark-read operations.
   - `activity.test.ts`: Verify "My Activity" feed and "Status changed" / "New comments" badge diffing.
   - `status-cascade.test.ts`: Verify status deletion reassigns both posts and roadmap items.
3. **End-to-End Tests (`apps/api/test/e2e` & Playwright)**:
   - Full flow: Admin creates roadmap item $\rightarrow$ links post $\rightarrow$ moves card to new status column $\rightarrow$ post status updates $\rightarrow$ author/voter sees unread notification bell count $\rightarrow$ opens notification popover $\rightarrow$ navigates to post.

---

## 11. Environment Availability & Readiness Checklist

- Node.js: `v26.10.0`
- Bun: `1.4.2`
- Vitest: `5.0.3`
- PostgreSQL: Active and verified via local container/database connection.
- All existing unit, lint, and integration test suites passing.
- Drizzle schema generation (`bun run --filter '@userhq/db' db:check`) ready for migration `0009_roadmap_notifications.sql`.
