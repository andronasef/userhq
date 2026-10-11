# Phase 4: Dual-Layer Roadmap & Closing the Loop - Pattern Map

**Mapped:** 2026-10-11  
**Files analyzed:** ~62 new/modified (grouped by role)  
**Analogs found:** all groups except fractional rank generation, multi-container Kanban dnd-kit, grouped notification upsert, and automated canary string scan (see No Analog Found)

Updates `02-PATTERNS.md` and `03-PATTERNS.md` rather than re-deriving them. Phase 2 and 3 patterns remain the bedrock: PostgreSQL schemas in `packages/db`, Drizzle migrations, ESM `.js` imports, `ApiException`, Zod schemas in `packages/types`, `@Public()` + `@SerializeOptions` response allowlists, `TenantGuard` and `PortalGuard`, `apiRead` in `lib/api-server.ts`, and hand-written Radix-based UI components. Phase 4 introduces the internal planning engine (Kanban + LexoRank), a strict physical privacy boundary (ROAD-12), and the closing-the-loop notification and activity ecosystem. Every analog path is git-tracked (verified in repo).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/db/src/schema/roadmap.ts` (`roadmap_items`, `roadmap_item_internals`) | model | CRUD | `packages/db/src/schema/feedback.ts` (`posts`, lines 38–70) + `tenancy.ts` (`statuses`, lines 65–95) | exact |
| `packages/db/src/schema/notifications.ts` (`notifications`, `user_product_activity_visits`) | model | CRUD / upsert | `packages/db/src/schema/feedback.ts` (`postActivity`, lines 166–198; `postMutes`, lines 200–217) | exact |
| `packages/db/src/schema/tenancy.ts` (`statuses.isPublicRoadmap`) | model | \u2014 | itself line 75 (`isDefault: boolean("is_default")`) | exact |
| `packages/db/src/schema/feedback.ts` (`posts.roadmapItemId`, index) | model | \u2014 | itself line 51 (`mergedIntoId`) | exact |
| `packages/db/src/index.ts` (export roadmap and notifications schemas) | config | \u2014 | itself lines 7–21 | exact |
| `packages/db/migrations/0009_roadmap_notifications.sql` | migration | batch | `packages/db/migrations/0007_feedback.sql` | exact |
| `packages/types/src/rank.ts` (`generateKeyBetween`) | utility | transform | `packages/types/src/slugs.ts` (`slugify`) | exact |
| `packages/types/src/roadmap.ts` (Admin/Public item schemas, create/update inputs, combobox result) | schema | transform | `packages/types/src/feedback.ts` (PublicPostDetailSchema, CreatePostInputSchema) | exact |
| `packages/types/src/notifications.ts` (NotificationItemSchema, ActivityItemSchema, MarkReadSchema) | schema | transform | `packages/types/src/feedback.ts` (`ActivityEntrySchema`, lines 295–310) | exact |
| `packages/types/src/tenancy.ts` (`StatusSchema`, `CreateStatusInputSchema`, `UpdateStatusInputSchema`) | schema | \u2014 | itself lines 271–295 | exact |
| `packages/types/src/feedback.ts` (`PublicPostDetailSchema`, `AdminPostDetailSchema` + `roadmapItem` link) | schema | \u2014 | itself lines 236–252 | exact |
| `packages/types/src/index.ts` (re-exports + `API_ERROR_CODES` additions) | config | \u2014 | itself lines 1–60 | exact |
| `apps/api/src/roadmap/roadmap.service.ts` | service | CRUD (transactions) | `apps/api/src/feedback/moderation.service.ts` lines 50–165 | exact |
| `apps/api/src/roadmap/roadmap.controller.ts` | controller | CRUD | `apps/api/src/feedback/admin-posts.controller.ts` | exact |
| `apps/api/src/roadmap/portal-roadmap.controller.ts` | controller | request-response | `apps/api/src/feedback/portal-posts.controller.ts` lines 20–60 | exact |
| `apps/api/src/roadmap/roadmap.module.ts` | config | \u2014 | `apps/api/src/feedback/feedback.module.ts` | exact |
| `apps/api/src/notifications/notifications.service.ts` | service | CRUD / event-driven | `apps/api/src/feedback/posts.service.ts` + `comments.service.ts` | role-match |
| `apps/api/src/notifications/notifications.controller.ts` | controller | CRUD | `apps/api/src/account/account.controller.ts` + `auth/me.controller.ts` | role-match |
| `apps/api/src/notifications/portal-activity.controller.ts` | controller | request-response | `apps/api/src/feedback/portal-posts.controller.ts` | role-match |
| `apps/api/src/notifications/notifications.module.ts` | config | \u2014 | `apps/api/src/account/account.module.ts` | exact |
| `apps/api/src/products/statuses.controller.ts` (`deleteStatus` cascade to `roadmap_items`) | controller | CRUD | itself lines 348–365 | exact |
| `apps/api/src/feedback/moderation.service.ts` (`changeStatus` post_locked check; merge unlinking) | service | CRUD | itself lines 60–85, 300–350 | exact |
| `apps/api/src/app.module.ts` (register RoadmapModule, NotificationsModule) | config | \u2014 | itself lines 55–65 | exact |
| `apps/api/test/roadmap.test.ts` | test | CRUD / integration | `apps/api/test/statuses.test.ts` lines 1–100 | exact |
| `apps/api/test/portal-roadmap.test.ts` | test | request-response | `apps/api/test/portal.test.ts` + `board.test.ts` | exact |
| `apps/api/test/canary-roadmap-leak.test.ts` | test | security / assertion | `apps/api/test/public-contract.test.ts` + `portal-isolation.test.ts` | role-match |
| `apps/api/test/notifications.test.ts` | test | CRUD / fan-out | `apps/api/test/comments.test.ts` (fan-out) + `account.test.ts` | role-match |
| `apps/api/test/activity.test.ts` | test | request-response | `apps/api/test/board.test.ts` | role-match |
| `apps/api/test/cross-tenant.test.ts` (register `/workspaces/:ws/.../roadmap` routes) | test | \u2014 | itself lines 60–95 | exact |
| `apps/api/test/public-contract.test.ts` (add `/portal/:ws/:product/roadmap` and `/activity`) | test | \u2014 | itself lines 70–82 | exact |
| `packages/types/test/rank.test.ts` | test | unit | `packages/types/test/slugs.test.ts` (or `apps/web/lib/initials.test.ts`) | exact |
| `apps/web/proxy.ts` (add `/:ws/:product/activity` to auth matcher) | middleware | \u2014 | itself lines 70–85 | exact |
| `apps/web/lib/api-server.ts` (`getAdminRoadmap`, `getPublicRoadmap`, `getNotifications`, etc.) | utility | request-response | itself lines 120–135, 290–330 | exact |
| `apps/web/lib/api-errors.ts` (Phase 4 error copy and field mappings) | utility | transform | itself lines 5–55, 60–85 | exact |
| `apps/web/app/[ws]/[product]/layout.tsx` (TabNav Roadmap & Activity; NotificationBell) | layout | \u2014 | itself lines 110–135 | exact |
| `apps/web/app/dashboard/[ws]/layout.tsx` (NotificationBell in dashboard header) | layout | \u2014 | itself lines 80–95 | exact |
| `apps/web/components/header.tsx` (NotificationBell in app shell header) | layout | \u2014 | itself lines 15–30 | exact |
| `apps/web/components/user-menu.tsx` (inject "My activity" link inside product context) | component | \u2014 | itself lines 70–85 | exact |
| `apps/web/components/dashboard/sidebar.tsx` (inject "Roadmap" link with `Kanban` icon) | component | \u2014 | itself lines 135–165 | exact |
| `apps/web/components/dashboard/status-dialog.tsx` (`isPublicRoadmap` checkbox) | component | request-response | itself lines 160–210 | exact |
| `apps/web/components/dashboard/status-list.tsx` (`Public` badge on status row) | component | \u2014 | itself lines 60–95 | exact |
| `apps/web/components/post/post-actions-menu.tsx` ("Add to roadmap" / "View on roadmap") | component | \u2014 | itself lines 90–125 | exact |
| `apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx` (`LinkedRoadmapBanner`, lock status button) | component | \u2014 | itself lines 105–140 | exact |
| `apps/web/components/post/linked-roadmap-banner.tsx` | component | request-response | `apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx` lines 95–115 (Alert) | exact |
| `apps/web/app/dashboard/[ws]/[product]/roadmap/page.tsx` | page (RSC) | request-response | `apps/web/app/dashboard/[ws]/[product]/statuses/page.tsx` | exact |
| `apps/web/app/dashboard/[ws]/[product]/roadmap/roadmap-view.tsx` | client view | request-response | `apps/web/app/dashboard/[ws]/[product]/statuses/statuses-view.tsx` | exact |
| `apps/web/components/roadmap/kanban-board.tsx` | component | drag-and-drop | `apps/web/components/dashboard/status-list.tsx` lines 230–270 | role-match |
| `apps/web/components/roadmap/kanban-column.tsx` | component | drag-and-drop | `apps/web/components/dashboard/status-list.tsx` lines 50–110 | role-match |
| `apps/web/components/roadmap/kanban-card.tsx` | component | drag-and-drop | `apps/web/components/dashboard/status-list.tsx` lines 50–80 | role-match |
| `apps/web/components/roadmap/roadmap-item-modal.tsx` | component | request-response | `apps/web/components/dashboard/status-dialog.tsx` lines 1–230 | exact |
| `apps/web/components/roadmap/post-link-combobox.tsx` | component | request-response | `apps/web/components/post/merge-dialog.tsx` (search/select posts) | exact |
| `apps/web/components/roadmap/public-columns-popover.tsx` | component | request-response | `apps/web/components/dashboard/status-list.tsx` (dropdown/toggles) | role-match |
| `apps/web/app/[ws]/[product]/roadmap/page.tsx` | page (RSC) | request-response | `apps/web/app/[ws]/[product]/page.tsx` | exact |
| `apps/web/app/[ws]/[product]/roadmap/public-roadmap-view.tsx` | client view | request-response | `apps/web/components/board/post-list.tsx` | role-match |
| `apps/web/components/roadmap/public-roadmap-board.tsx` | component | request-response | `apps/web/components/tab-nav.tsx` | role-match |
| `apps/web/components/roadmap/public-roadmap-card.tsx` | component | \u2014 | `apps/web/components/board/post-row.tsx` | exact |
| `apps/web/components/roadmap/public-roadmap-modal.tsx` | component | \u2014 | `apps/web/components/post/voters-dialog.tsx` | exact |
| `apps/web/components/notifications/notification-bell.tsx` | component | request-response | `apps/web/components/user-menu.tsx` (popover/trigger pattern) | exact |
| `apps/web/components/notifications/notification-item.tsx` | component | \u2014 | `apps/web/components/post/activity-item.tsx` lines 1–40 | exact |
| `apps/web/app/[ws]/[product]/activity/page.tsx` | page (RSC) | request-response | `apps/web/app/[ws]/[product]/page.tsx` | exact |
| `apps/web/app/[ws]/[product]/activity/activity-view.tsx` | client view | request-response | `apps/web/components/board/post-list.tsx` | exact |
| `apps/web/components/activity/activity-feed.tsx` | component | \u2014 | `apps/web/components/board/post-list.tsx` + `post-row.tsx` | exact |

---

## Pattern Assignments

### 1. Database Schema & Models (`packages/db/src/schema/roadmap.ts`, `notifications.ts`)

**Analog:** `packages/db/src/schema/tenancy.ts` (lines 65–95, `statuses`) and `feedback.ts` (lines 38–70, `posts`).

#### Public-Safe Table & 1:1 Internal Table (`roadmap.ts`)
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
```

#### Notifications & Activity Visits (`notifications.ts`)
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
    // Groups repeated status changes for a post into ONE notification row per user
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

#### Tenancy & Feedback Schema Additions
In `packages/db/src/schema/tenancy.ts` line 75:
```typescript
isPublicRoadmap: boolean("is_public_roadmap").notNull().default(false),
```
In `packages/db/src/schema/feedback.ts` line 51:
```typescript
roadmapItemId: uuid("roadmap_item_id").references(() => roadmapItems.id, { onDelete: "set null" }),
```
Register in `packages/db/src/index.ts`:
```typescript
import * as roadmapSchema from "./schema/roadmap.js";
import * as notificationsSchema from "./schema/notifications.js";

export const schema = {
  ...authSchema,
  ...uploadsSchema,
  ...tenancySchema,
  ...feedbackSchema,
  ...roadmapSchema,
  ...notificationsSchema,
};

export * from "./schema/roadmap.js";
export * from "./schema/notifications.js";
```

---

### 2. LexoRank Fractional Indexing (`packages/types/src/rank.ts`)

**Analog:** `packages/types/src/slugs.ts` (standalone pure utility function).

Inlines Rocicorp's battle-tested, CC0-licensed string midpoint algorithm:
```typescript
// packages/types/src/rank.ts
// Based on Rocicorp's CC0 fractional indexing string midpoint generator
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateKeyBetween(
  a: string | null | undefined,
  b: string | null | undefined
): string {
  if (!a && !b) return "a0";
  if (!a) {
    // Generate key before b
    return generateKeyBefore(b!);
  }
  if (!b) {
    // Generate key after a
    return generateKeyAfter(a);
  }
  // Generate key between a and b
  return midpoint(a, b);
}
```
Provides $O(1)$ single-row reordering when dropping items into any column position without sibling updates.

---

### 3. Shared Zod Types & Validation Contracts (`packages/types/src/roadmap.ts`, `notifications.ts`)

**Analog:** `packages/types/src/feedback.ts` lines 18–120.

#### `packages/types/src/roadmap.ts`
```typescript
import { z } from "zod";
import { PostStatusSchema } from "./feedback.js";

export const ROADMAP_TITLE_MIN = 3;
export const ROADMAP_TITLE_MAX = 120;
export const ROADMAP_DESC_MAX = 5000;
export const ROADMAP_NOTES_MAX = 5000;

export const RoadmapInternalTitleSchema = z
  .string({ message: "item_title_required" })
  .transform((v) => v.trim())
  .pipe(
    z.string()
      .min(1, { message: "item_title_required" })
      .min(ROADMAP_TITLE_MIN, { message: "item_title_length" })
      .max(ROADMAP_TITLE_MAX, { message: "item_title_length" })
  );

export const RoadmapPublicTitleSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z.string()
      .min(1, { message: "public_title_required" })
      .min(ROADMAP_TITLE_MIN, { message: "public_title_length" })
      .max(ROADMAP_TITLE_MAX, { message: "public_title_length" })
  );

export const AdminRoadmapItemSchema = z.object({
  id: z.string().uuid(),
  statusId: z.string().uuid(),
  internalTitle: z.string(),
  internalDescription: z.string().nullable(),
  internalNotes: z.string().nullable(),
  publicTitle: z.string().nullable(),
  publicDescription: z.string().nullable(),
  isPublic: z.boolean(),
  rank: z.string(),
  assignee: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }).nullable(),
  deadlineText: z.string().nullable(),
  deadlineDate: z.string().nullable(),
  linkedPostCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdminRoadmapItem = z.infer<typeof AdminRoadmapItemSchema>;

export const PublicRoadmapItemSchema = z.object({
  id: z.string().uuid(),
  statusId: z.string().uuid(),
  title: z.string(), // publicTitle
  description: z.string().nullable(), // publicDescription
  postCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type PublicRoadmapItem = z.infer<typeof PublicRoadmapItemSchema>;
```

#### `packages/types/src/index.ts` Error Code Additions
Append to `API_ERROR_CODES`:
```typescript
  "item_title_required",
  "item_title_length",
  "public_title_required",
  "public_title_length",
  "notes_too_long",
  "post_already_linked",
  "item_not_found",
  "move_failed",
```

---

### 4. Admin Roadmap Service & Controller (`roadmap.service.ts`, `roadmap.controller.ts`)

**Analog:** `apps/api/src/feedback/moderation.service.ts` lines 50–165 (`changeStatus`), and `apps/api/src/products/statuses.controller.ts`.

#### `RoadmapService` Core Transaction Pattern
```typescript
@Injectable()
export class RoadmapService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async moveItem(
    tenant: { workspaceId: string; productId: string },
    adminUser: { id: string; name?: string | null; image?: string | null },
    itemId: string,
    input: { statusId: string; rank: string }
  ): Promise<AdminRoadmapItem> {
    return this.db.transaction(async (tx) => {
      // 1. Fetch & lock roadmap item
      const [existing] = await tx
        .select()
        .from(roadmapItems)
        .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.productId, tenant.productId)))
        .for("update");

      if (!existing) throw new ApiException("item_not_found", 404, "This roadmap item was removed.");

      const statusChanged = existing.statusId !== input.statusId;

      // 2. Update roadmap item rank & status
      await tx
        .update(roadmapItems)
        .set({ statusId: input.statusId, rank: input.rank, updatedAt: new Date() })
        .where(eq(roadmapItems.id, itemId));

      // 3. If status changed, cascade to all linked posts
      if (statusChanged) {
        const [targetStatus] = await tx
          .select()
          .from(statuses)
          .where(and(eq(statuses.id, input.statusId), eq(statuses.productId, tenant.productId)));

        const linkedPosts = await tx
          .select({ id: posts.id, number: posts.number, version: posts.version })
          .from(posts)
          .where(and(eq(posts.roadmapItemId, itemId), eq(posts.productId, tenant.productId)))
          .for("update");

        for (const p of linkedPosts) {
          await tx
            .update(posts)
            .set({ statusId: input.statusId, version: p.version + 1 })
            .where(eq(posts.id, p.id));

          const [activity] = await tx
            .insert(postActivity)
            .values({
              postId: p.id,
              actorId: adminUser.id,
              kind: "status_changed",
              toStatusId: targetStatus.id,
              statusName: targetStatus.name,
              statusColor: targetStatus.color,
              note: null,
            })
            .returning();

          // Fan out notifications to stakeholders
          await this.fanOutNotification(tx, {
            workspaceId: tenant.workspaceId,
            productId: tenant.productId,
            postId: p.id,
            postActivityId: activity.id,
            actorId: adminUser.id,
          });
        }
      }

      return this.getAdminItem(tx, tenant.productId, itemId);
    });
  }
}
```

---

### 5. Status Cascade in Status Deletion (`apps/api/src/products/statuses.controller.ts`)

**Analog:** `statuses.controller.ts` line 358 (`deleteStatus` handler):
Replace the comment:
```typescript
// Replace: // Phase 4: UPDATE roadmap_items SET status_id = moveTo WHERE status_id = id AND product_id = tenant.productId
// With:
await tx
  .update(roadmapItems)
  .set({ statusId: moveTo, updatedAt: new Date() })
  .where(
    and(
      eq(roadmapItems.statusId, statusId),
      eq(roadmapItems.productId, tenant.productId!)
    )
  );
```

---

### 6. Standalone Status Lock in Moderation Service (`apps/api/src/feedback/moderation.service.ts`)

**Analog:** `moderation.service.ts` lines 60–85.
Add `roadmapItemId` check in `changeStatus`:
```typescript
const [post] = await tx
  .select({
    id: posts.id,
    statusId: posts.statusId,
    version: posts.version,
    roadmapItemId: posts.roadmapItemId, // <-- added
  })
  .from(posts)
  .where(...)
  .for("update");

if (post.roadmapItemId !== null) {
  throw new ApiException(
    "post_locked",
    400,
    "This post's status is managed by a roadmap item."
  );
}
```
And in post duplicate merge (`mergePosts`):
```typescript
// Unlink duplicate post so it never carries over a conflicting link
await tx
  .update(posts)
  .set({ roadmapItemId: null })
  .where(eq(posts.id, dupPost.id));
```

---

### 7. Stakeholder Notification Fan-Out & Grouped UPSERT (`notifications.service.ts`)

**Analog:** `apps/api/src/feedback/comments.service.ts` (finding stakeholders) and `postActivity` insertion.

```typescript
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async fanOutStatusChange(
    tx: DbOrTx,
    opts: {
      workspaceId: string;
      productId: string;
      postId: string;
      postActivityId: string;
      actorId: string;
    }
  ): Promise<void> {
    // 1. Discover all distinct stakeholders (author, voters, commenters)
    const stakeholders = await tx.execute<{ user_id: string }>(sql`
      SELECT DISTINCT user_id FROM (
        SELECT author_id AS user_id FROM posts WHERE id = ${opts.postId}
        UNION
        SELECT user_id FROM votes WHERE post_id = ${opts.postId}
        UNION
        SELECT author_id AS user_id FROM comments WHERE post_id = ${opts.postId} AND deleted_at IS NULL
      ) s
      WHERE user_id IS NOT NULL AND user_id != ${opts.actorId}
    `);

    // 2. Upsert notifications row for each stakeholder (LOOP-04: groups repeated changes)
    for (const row of stakeholders.rows) {
      await tx
        .insert(notifications)
        .values({
          userId: row.user_id,
          workspaceId: opts.workspaceId,
          productId: opts.productId,
          postId: opts.postId,
          postActivityId: opts.postActivityId,
          readAt: null,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [notifications.userId, notifications.postId],
          set: {
            postActivityId: opts.postActivityId,
            readAt: null,
            createdAt: new Date(),
          },
        });
    }
  }
}
```

---

### 8. Public Roadmap Controller & Zero-Leakage Privacy Boundary (`portal-roadmap.controller.ts`)

**Analog:** `apps/api/src/portal/portal.controller.ts` lines 1–60.

```typescript
@Controller("portal/:ws/:product/roadmap")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalRoadmapController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Public()
  @SerializeOptions({ schema: PublicRoadmapListResponseSchema })
  async getPublicRoadmap(@Req() req: any): Promise<PublicRoadmapListResponse> {
    const { productId } = req.portal ?? {};
    if (!productId) throw new ApiException("not_found", 404, "Not found.");

    // Strict query: ONLY selects from roadmapItems and statuses where is_public_roadmap = true
    // STRICT ZERO-JOIN to roadmapItemInternals
    const items = await this.db
      .select({
        id: roadmapItems.id,
        statusId: roadmapItems.statusId,
        title: roadmapItems.publicTitle,
        description: roadmapItems.publicDescription,
        rank: roadmapItems.rank,
        createdAt: roadmapItems.createdAt,
      })
      .from(roadmapItems)
      .innerJoin(
        statuses,
        and(eq(roadmapItems.statusId, statuses.id), eq(statuses.isPublicRoadmap, true))
      )
      .where(
        and(
          eq(roadmapItems.productId, productId),
          eq(roadmapItems.isPublic, true)
        )
      )
      .orderBy(asc(roadmapItems.rank));

    return {
      items: items.map((r) => ({
        ...r,
        title: r.title ?? "Untitled item",
        postCount: 0, // aggregate linked post count
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
```

---

### 9. Automated Canary Privacy Seam Test (`apps/api/test/canary-roadmap-leak.test.ts`)

**Analog:** `apps/api/test/public-contract.test.ts` lines 1–65.

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("ROAD-12: Zero-Leakage Privacy Canary Test", () => {
  const CANARY_VALUES = {
    title: "CANARY_SECRET_TITLE_991827",
    description: "CANARY_SECRET_DESC_554433",
    notes: "CANARY_SECRET_NOTES_221100",
    deadline: "CANARY_SECRET_DEADLINE_778899",
  };

  it("verifies public endpoints contain zero internal canary strings", async () => {
    // 1. Plant canary values in roadmap_item_internals
    // 2. Query all public routes:
    //    - GET /api/v1/portal/:ws/:product/roadmap
    //    - GET /api/v1/portal/:ws/:product/posts
    //    - GET /api/v1/portal/:ws/:product/posts/:number
    //    - GET /api/v1/portal/:ws/:product/activity
    // 3. Assert zero leakage across response bodies
    for (const canary of Object.values(CANARY_VALUES)) {
      expect(resRoadmap.text).not.toContain(canary);
      expect(resPosts.text).not.toContain(canary);
      expect(resPostDetail.text).not.toContain(canary);
    }
  });
});
```

---

### 10. Multi-Column Kanban with `@dnd-kit/react@0.5.0` (`kanban-board.tsx`)

**Analog:** `apps/web/components/dashboard/status-list.tsx` lines 18–45, 230–280 (`DragDropProvider`, `useSortable`).

```tsx
"use client";

import * as React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";
import { generateKeyBetween } from "@userhq/types";
import { KanbanColumn } from "./kanban-column";

export function KanbanBoard({ ws, product, statuses, initialItems }) {
  const [items, setItems] = React.useState(initialItems);
  const [announcement, setAnnouncement] = React.useState("");

  const handleDragEnd = async (event) => {
    const { operation } = event;
    if (!operation.target) return;

    const sourceId = operation.source.id;
    const targetStatusId = operation.target.group ?? operation.target.id;
    
    // Calculate new LexoRank between neighbors at target position
    const columnItems = items.filter((i) => i.statusId === targetStatusId && i.id !== sourceId);
    const targetIndex = operation.target.index;
    const prevRank = targetIndex > 0 ? columnItems[targetIndex - 1]?.rank : null;
    const nextRank = targetIndex < columnItems.length ? columnItems[targetIndex]?.rank : null;
    const newRank = generateKeyBetween(prevRank, nextRank);

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === sourceId ? { ...item, statusId: targetStatusId, rank: newRank } : item
      )
    );

    // Call API
    try {
      await apiFetch(
        `/api/v1/workspaces/${ws}/products/${product}/roadmap/${sourceId}`,
        {
          method: "PATCH",
          body: { statusId: targetStatusId, rank: newRank },
        }
      );
    } catch {
      // Revert on failure
      setItems(initialItems);
      toast.error("Couldn't move item. Check your connection and try again.");
    }
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[calc(100vh-16rem)]">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            items={items.filter((i) => i.statusId === status.id)}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}
```

---

### 11. In-App Notification Bell & Popover (`notification-bell.tsx`)

**Analog:** `apps/web/components/user-menu.tsx` lines 30–75 (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`).

```tsx
"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-client";

export function NotificationBell({ ws, product }: { ws?: string; product?: string }) {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState([]);

  // Fetch count on mount & refresh
  const handleMarkAllRead = async () => {
    await apiFetch("/api/v1/notifications/mark-read", { method: "POST" });
    setUnreadCount(0);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full relative flex items-center justify-center text-foreground hover:bg-muted"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "No unread notifications"}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 rounded-lg shadow-md">
        {/* Header + Mark all read + Notification item list */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### 12. Post Detail Roadmap Linking Banner (`LinkedRoadmapBanner.tsx`)

**Analog:** `apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx` lines 95–115 (`Alert` component).

```tsx
"use client";

import * as React from "react";
import { Kanban, Unlink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function LinkedRoadmapBanner({
  itemTitle,
  onUnlink,
  unlinking = false,
}: {
  itemTitle: string;
  onUnlink: () => void;
  unlinking?: boolean;
}) {
  return (
    <Alert variant="neutral" className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-muted/40 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        <Kanban className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="text-sm truncate">
          Linked to roadmap item: <strong className="font-semibold">{itemTitle}</strong>
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onUnlink}
        disabled={unlinking}
        aria-label="Unlink from roadmap item"
        className="gap-1.5 shrink-0"
      >
        <Unlink className="size-3.5" aria-hidden="true" />
        <span>{unlinking ? "Unlinking…" : "Unlink"}</span>
      </Button>
    </Alert>
  );
}
```

---

## Shared Patterns

### Errors
**Source:** `apps/api/src/common/api-error.filter.ts` (`ApiException(code, status, message)`).  
**Apply to:** All roadmap and notification endpoints. Codes are registered in `API_ERROR_CODES` in `packages/types/src/index.ts` first, with localized copy in `apps/web/lib/api-errors.ts`.

### Strict Zero-Leakage Privacy Boundary (ROAD-12)
**Source:** Physical table isolation (`roadmap_items` vs `roadmap_item_internals`).  
**Rules:**
1. Public controllers (`PortalRoadmapController`, `PortalPostsController`) NEVER import `roadmapItemInternals`.
2. Public endpoints use explicit column `.select(...)` maps against `roadmap_items` only.
3. Every `@Public()` handler applies `@SerializeOptions({ schema })`.
4. Automated canary test (`apps/api/test/canary-roadmap-leak.test.ts`) verifies no canary strings planted in internal fields ever leak into public JSON or HTML responses.

### Fractional LexoRank String Indexing
**Source:** `packages/types/src/rank.ts` (`generateKeyBetween`).  
**Rules:**
1. Reordering updates only the dragged item (`UPDATE roadmap_items SET status_id = :status, rank = :rank WHERE id = :id`).
2. Sibling cards require no position re-indexing, preventing database write amplification and lock contention.

### Atomic Transactions with Row Locks
**Source:** `apps/api/src/products/statuses.controller.ts` lines 315–359.  
**Rules:**
1. Use `this.db.transaction(async (tx) => { ... })`.
2. Lock rows with `.for("update")` before modifying state.
3. Roadmap item status changes update linked posts, record `post_activity`, and fan out notifications inside the same atomic transaction.

### Web Data Flow
**Source:** `apps/web/lib/api-server.ts` (`cache()` + `apiRead`) for RSC, and `lib/api-client.ts` (`apiFetch`) inside `useMutation` for client interactions. After mutations, call `router.refresh()`. Never use Server Actions.

---

## No Analog Found

| File / Component | Role | Data Flow | Standard Solution / Implementation Origin |
|---|---|---|---|
| `packages/types/src/rank.ts` (`generateKeyBetween`) | utility | transform | CC0-licensed Rocicorp fractional string midpoint algorithm. Inlined in `@userhq/types` with zero new dependencies. |
| `@dnd-kit/react@0.5.0` Multi-Container Kanban | component | drag-and-drop | Uses `DragDropProvider`, `useSortable({ group })`, and `useDroppable` across multi-status columns with optimistic local reorder. |
| Notification Grouped UPSERT | service | event-driven | PostgreSQL `ON CONFLICT (user_id, post_id) DO UPDATE SET post_activity_id = EXCLUDED.post_activity_id, read_at = NULL, created_at = NOW()`. Groups repeated post changes into one unread notification row per user. |
| Automated Canary Leak Scanner | test | security | `apps/api/test/canary-roadmap-leak.test.ts` seeds random UUID-salted canary strings into internal fields, executes requests against all public routes and HTML pages, and asserts `not.toContain(canary)` with zero tolerance. |
| Activity Visit Timestamp Diffing | service | request-response | Compares `post_activity.created_at` and `comments.created_at` against `user_product_activity_visits.last_visited_at` to accurately render `Status changed` and `New comments` badges. |

---

## Metadata

**Analog search scope:** `apps/api/{src,test}`, `apps/web/{app,components,lib}`, `packages/{db,types}/src`  
**Files scanned:** ~210 tracked source files; ~18 analog files inspected in depth  
**Pattern extraction date:** 2026-10-11
