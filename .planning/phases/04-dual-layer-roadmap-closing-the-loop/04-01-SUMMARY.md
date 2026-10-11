---
phase: 04-dual-layer-roadmap-closing-the-loop
plan: 01
subsystem: database-and-contracts
tags: [schema, drizzle, migrations, fractional-indexing, lexorank, zod, contracts]

# Dependency graph
requires: []
provides:
  - "Database tables roadmap_items and roadmap_item_internals enforcing physical isolation (ROAD-12)"
  - "Database tables notifications and user_product_activity_visits for closing-the-loop notifications"
  - "Tenancy column statuses.is_public_roadmap and feedback column posts.roadmap_item_id"
  - "Drizzle migration 0009_roadmap_notifications.sql"
  - "Inlined CC0 Rocicorp fractional string generator generateKeyBetween in @userhq/types"
  - "Zod contracts and DTO schemas for admin/public roadmap items and notifications"
  - "Phase 4 error codes registered in API_ERROR_CODES"
affects: [04-02, 04-03, 04-04, 04-05]

actuals:
  tokens: 28000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Dual-table physical isolation between public items and private internals"
    - "CC0 fractional string midpoint algorithm for O(1) LexoRank reordering"
    - "Grouped notifications unique per (user_id, post_id)"

key-files:
  created:
    - packages/db/src/schema/roadmap.ts
    - packages/db/src/schema/notifications.ts
    - packages/db/migrations/0009_roadmap_notifications.sql
    - packages/db/migrations/meta/0009_snapshot.json
    - packages/types/src/rank.ts
    - packages/types/src/roadmap.ts
    - packages/types/src/notifications.ts
    - packages/types/test/rank.test.ts
  modified:
    - packages/db/src/schema/tenancy.ts
    - packages/db/src/schema/feedback.ts
    - packages/db/src/index.ts
    - packages/db/migrations/meta/_journal.json
    - packages/types/src/tenancy.ts
    - packages/types/src/feedback.ts
    - packages/types/src/index.ts
    - packages/types/package.json
    - bun.lock

key-decisions:
  - "Created separate roadmap_item_internals table with 1:1 cascade FK ensuring zero internal fields can leak through roadmap_items"
  - "Grouped notifications by unique (user_id, post_id) so repeated status updates consolidate into a single unread entry per user"
  - "Inlined Rocicorp CC0 fractional indexing midpoint algorithm in @userhq/types with zero third-party dependencies"
  - "Added isPublicRoadmap to statuses and roadmapItemId to posts with onDelete: set null"

patterns-established:
  - "generateKeyBetween(a, b) generates lexicographically ordered strings with a0 initial key"
  - "Roadmap titles validate 3-120 length constraints with dedicated error messages"

requirements-completed: [ROAD-01, ROAD-02, ROAD-12, NOTIF-01]

duration: 15min
completed: 2026-10-11
---

# Plan 04-01: Dual-Layer Database Schema & Shared Contracts Summary

Implemented the database foundation and shared contract layer for Phase 4 (Dual-Layer Roadmap & Closing the Loop).

### 1. Database Schema & Migration (`0009_roadmap_notifications.sql`)
- Created `packages/db/src/schema/roadmap.ts` with:
  - `roadmap_items`: public-safe projection containing `productId`, `statusId`, `publicTitle`, `publicDescription`, `isPublic`, `rank`, and composite status foreign key with `onDelete: restrict`.
  - `roadmap_item_internals`: 1:1 internal details table containing `internalTitle`, `internalDescription`, `internalNotes`, `assigneeId`, `deadlineText`, `deadlineDate` with `onDelete: cascade`.
- Created `packages/db/src/schema/notifications.ts` with:
  - `notifications`: grouped user notifications with unique constraint on `(user_id, post_id)`.
  - `user_product_activity_visits`: tracking timestamp of last visited activity per product.
- Updated `packages/db/src/schema/tenancy.ts` with `is_public_roadmap` on `statuses`.
- Updated `packages/db/src/schema/feedback.ts` with `roadmap_item_id` foreign key on `posts`.
- Generated Drizzle migration `packages/db/migrations/0009_roadmap_notifications.sql`.

### 2. Fractional Indexing & Validation Contracts
- Inlined Rocicorp's CC0 string midpoint algorithm in `packages/types/src/rank.ts`, exporting `generateKeyBetween` and `generateNKeysBetween`.
- Created Zod validation contracts in `packages/types/src/roadmap.ts` and `packages/types/src/notifications.ts`.
- Registered Phase 4 API error codes in `API_ERROR_CODES`.
- Added unit tests in `packages/types/test/rank.test.ts` covering bounds, midpoint generation, 100 consecutive mid-insertions, prepends/appends, and schema parsing (12 tests passing).

### Verification
- `bun run build:packages`: Types and DB packages compiled with clean ESM exports and type declarations.
- `bun run --filter '@userhq/types' test`: 12 passed.
- `bun run typecheck`: All packages passed with 0 errors.
- `bun run test`: All 346 API tests, 62 Web tests, and DB tests passed with 0 failures.
