---
phase: 04-dual-layer-roadmap-closing-the-loop
plan: 03
subsystem: api-notifications
tags: [notifications, activity-feed, stakeholder-fanout, visit-diffing, canary-test, closing-the-loop]

# Dependency graph
requires: [04-01, 04-02]
provides:
  - "NotificationsService providing stakeholder discovery, grouped UPSERT, unread counts, and mark-read operations"
  - "NotificationsController providing in-app bell endpoints (/notifications/unread-count, /notifications, /notifications/mark-read, /notifications/:postId/read)"
  - "PortalActivityController providing product My Activity feed with session visit diffing (/portal/:ws/:product/activity)"
  - "Automatic status change fan-out wired into RoadmapService (create, update, move, link) and ModerationService (changeStatus)"
  - "Canary leak seam test expanded to verify zero internal roadmap field leakage into /portal/:ws/:product/activity"
affects: [04-04, 04-05]

actuals:
  tokens: 45000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Stakeholder discovery via DISTINCT UNION of post author, voters, and commenters"
    - "Postgres clock synchronization (sql`now()`) for distributed session visit diffing"
    - "Grouped notifications on unique(user_id, post_id) collapsing repeated status changes"

key-files:
  created:
    - apps/api/src/notifications/notifications.service.ts
    - apps/api/src/notifications/notifications.controller.ts
    - apps/api/src/notifications/portal-activity.controller.ts
    - apps/api/src/notifications/notifications.module.ts
    - apps/api/test/notifications.test.ts
    - apps/api/test/activity.test.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/api/src/feedback/moderation.service.ts
    - apps/api/src/roadmap/roadmap.module.ts
    - apps/api/src/roadmap/roadmap.service.ts
    - apps/api/test/canary-roadmap-leak.test.ts
    - packages/types/src/notifications.ts

key-decisions:
  - "Fanned out notifications to author, voters, and commenters while strictly excluding the actor"
  - "Used ON CONFLICT (user_id, post_id) DO UPDATE SET post_activity_id = EXCLUDED.post_activity_id, read_at = NULL to keep one grouped notification row per user per post (LOOP-04)"
  - "Used Postgres sql`now()` for user_product_activity_visits.last_visited_at to prevent host-container clock skew from falsely triggering activity badges"
  - "Expanded canary leak tests to verify zero leakage of internal roadmap data into the activity feed"

patterns-established:
  - "Visit diffing: hasStatusChange and hasNewComments compare against database-managed last_visited_at timestamp"
  - "Notification bell reads unread counts efficiently using indexed read_at IS NULL filter"
---

# Plan 04-03: Notification Engine & Fan-Out Service Summary

Implemented the notification fan-out engine, grouped deduplication, in-app notification endpoints, and the My Activity product feed with session visit diffing.

## Accomplishments

1. **Stakeholder Notification Fan-Out (`NotificationsService`)**:
   - `fanOutStatusChange`: Queries distinct user IDs from post authors, voters, and non-deleted commenters, excluding the actor performing the change.
   - Grouped Upsert: Uses `ON CONFLICT (user_id, post_id) DO UPDATE` to ensure repeated status changes on a post never duplicate notification rows; updates `post_activity_id`, resets `read_at = NULL`, and sets `created_at = NOW()`.
   - Wired seamlessly into `ModerationService.changeStatus`, `RoadmapService.createItem`, `RoadmapService.updateItem`, `RoadmapService.moveItem`, and `RoadmapService.linkPost`.
   - Notification Mutations: `getUnreadCount`, `listNotifications`, `markRead` (all or specific IDs), and `markPostRead`.

2. **In-App Notification Center (`NotificationsController`)**:
   - `GET /api/v1/notifications/unread-count`: Returns unread count for current user.
   - `GET /api/v1/notifications`: Returns user's notifications sorted newest first with post and activity snapshots (including public notes).
   - `POST /api/v1/notifications/mark-read`: Bulk marks notifications read.
   - `POST /api/v1/notifications/:postId/read`: Marks a single post's notification read.

3. **Portal My Activity & Session Visit Diffing (`PortalActivityController`)**:
   - `GET /api/v1/portal/:ws/:product/activity`: Lists all active posts where the user is an author, voter, or commenter.
   - Accurately tags engagement `type` (`created`, `voted`, `commented`).
   - Evaluates `hasNewStatus` / `hasStatusChange` and `hasNewComments` by comparing `postActivity.createdAt` and `comments.createdAt` against the user's `lastVisitedAt`.
   - Uses Postgres `sql`now()`` to prevent clock skew between Docker containers and host environments.
   - Automatically updates `user_product_activity_visits.last_visited_at`.

4. **Security & Canary Privacy Audit (ROAD-12)**:
   - Added `GET /api/v1/portal/:ws/:product/activity` to `apps/api/test/canary-roadmap-leak.test.ts`.
   - Confirmed zero canary tokens or internal roadmap fields leak into the activity feed.

## Verification

- `apps/api/test/notifications.test.ts`: 4/4 passed.
- `apps/api/test/activity.test.ts`: 3/3 passed.
- `apps/api/test/canary-roadmap-leak.test.ts`: 6/6 passed.
- Full Phase 4 test suite (`roadmap.test.ts`, `portal-roadmap.test.ts`, `notifications.test.ts`, `activity.test.ts`, `canary-roadmap-leak.test.ts`, `cross-tenant.test.ts`): 68/68 passed.
- `bun run typecheck` & `bun run lint`: 0 errors, 0 warnings.
