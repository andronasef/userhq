---
phase: 04-dual-layer-roadmap-closing-the-loop
plan: 02
subsystem: api-roadmap
tags: [roadmap, kanban, api, security, privacy, canary-test, status-sync, zero-leakage]

# Dependency graph
requires: [04-01]
provides:
  - "RoadmapService providing Kanban CRUD, single-row LexoRank moves, post linking/unlinking, and status cascade"
  - "RoadmapController providing authenticated admin endpoints for product roadmap boards"
  - "PortalRoadmapController with strict zero-join isolation querying only roadmap_items and public statuses"
  - "Post status lock returning 400 post_locked when attempting manual status change on linked posts"
  - "Status deletion cascade reassigning roadmap items alongside posts to the replacement status"
  - "ROAD-12 automated canary privacy test suite asserting zero leakage across all public endpoints"
affects: [04-03, 04-04, 04-05]

actuals:
  tokens: 42000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Zero-join public controller querying only public projections"
    - "Row-level locked status propagation to linked feedback posts"
    - "Post status locking when controlled by roadmap item"
    - "High-entropy salted canary tokens in automated integration testing"

key-files:
  created:
    - apps/api/src/roadmap/roadmap.service.ts
    - apps/api/src/roadmap/roadmap.controller.ts
    - apps/api/src/roadmap/portal-roadmap.controller.ts
    - apps/api/src/roadmap/roadmap.module.ts
    - apps/api/test/roadmap.test.ts
    - apps/api/test/portal-roadmap.test.ts
    - apps/api/test/canary-roadmap-leak.test.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/feedback/moderation.service.ts
    - apps/api/src/products/statuses.controller.ts
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/portal-isolation.test.ts
    - apps/api/test/public-contract.test.ts
    - apps/api/test/support/seed.ts
    - packages/types/src/roadmap.ts
    - packages/types/src/feedback.ts

key-decisions:
  - "Strict zero-join architectural boundary in PortalRoadmapController preventing any access to roadmapItemInternals"
  - "Atomic status synchronization from roadmap items to linked posts creating post_activity log records"
  - "Lock post status modifications with 400 post_locked when post.roadmapItemId is not null"
  - "Cascade status deletion to roadmap_items reassigning to target moveTo status"
  - "Comprehensive canary privacy test asserting zero occurrence of 5 distinct internal tokens across 5 public endpoints"

patterns-established:
  - "LexoRank moveItem updates a single row without table re-indexing cascades"
  - "Posts automatically unlock (roadmapItemId = null) when linked roadmap item is deleted while keeping their current status"
---

# Plan 04-02: Backend Roadmap API & Status Synchronization Engine Summary

Implemented the core backend roadmap engine, status synchronization, post locking, and public privacy boundary.

## Accomplishments

1. **Admin Roadmap Engine (`RoadmapService` & `RoadmapController`)**:
   - `listAdminItems`: Aggregates items with internals, assignee metadata, and linked post counts, sorted by fractional rank.
   - `createItem`: Atomically inserts into `roadmap_items` and `roadmap_item_internals`. Prefills public title if `isPublic` is set. Links optional initial `postIds` and synchronizes their statuses.
   - `updateItem`: Validates workspace membership for assignees, requires public title when toggled to public, updates internal and public fields, and cascades status changes.
   - `moveItem`: Updates `rank` and `statusId` under row lock; automatically cascades status changes to all linked posts and appends `post_activity` entries.
   - `deleteItem`: Deletes the item, automatically setting `posts.roadmap_item_id = null` via database foreign key cascade while preserving post statuses.
   - `linkPost` / `unlinkPost`: Enforces 1:many constraint (a post can link to at most one item); synchronizes post status on link; unlocks on unlink.
   - `searchPosts`: Rapid combobox search for unlinked posts by number or title.

2. **Feedback Moderation Integration**:
   - Updated `ModerationService.changeStatus` to verify `posts.roadmapItemId === null`; throws `400 post_locked` if managed by a roadmap item.
   - Updated `ModerationService.mergePosts` to clear `roadmapItemId = null` on merged duplicate posts.

3. **Status Deletion Cascade**:
   - Updated `StatusesController.deleteStatus` to reassign all `roadmap_items` belonging to the deleted status to the specified `moveTo` status in the same atomic transaction.

4. **Public Roadmap Portal (`PortalRoadmapController`)**:
   - Strictly queries `roadmap_items` joined only with `statuses` where `statuses.is_public_roadmap = true` and `roadmap_items.is_public = true`. Zero-join isolation from `roadmap_item_internals`.
   - Returns public item detail with list of linked public posts (`number`, `slug`, `title`, `voteCount`).
   - Private items or items in non-public statuses return 404 `not_found`.

5. **Security & Canary Privacy Audit (ROAD-12)**:
   - `apps/api/test/canary-roadmap-leak.test.ts`: Plants high-entropy salted canary tokens into `internalTitle`, `internalDescription`, `internalNotes`, assignee name, and `deadlineText`. Asserts zero occurrence of any token across all public endpoints (`/roadmap`, `/roadmap/:id`, `/posts`, `/posts/:number`, `/portal/:ws/:product`).
   - `apps/api/test/portal-isolation.test.ts`: Proves cross-tenant roadmap isolation.
   - `apps/api/test/cross-tenant.test.ts`: Verified 44 cross-tenant route isolation tests including all new admin roadmap routes.
   - `apps/api/test/public-contract.test.ts`: Validated that all public roadmap endpoints enforce `@SerializeOptions` schemas.

## Verification

- `apps/api/test/roadmap.test.ts`: 8/8 passed.
- `apps/api/test/portal-roadmap.test.ts`: 3/3 passed.
- `apps/api/test/canary-roadmap-leak.test.ts`: 5/5 passed.
- `apps/api/test/cross-tenant.test.ts`: 44/44 passed.
- `apps/api/test/portal-isolation.test.ts`: 3/3 passed.
- `apps/api/test/public-contract.test.ts`: 1/1 passed.
- Full workspace test suite: 26 lint tests, 4 db tests, 362 api tests, 62 web tests — 100% pass.
- `bun run typecheck` & `bun run lint`: 0 errors, 0 warnings.
