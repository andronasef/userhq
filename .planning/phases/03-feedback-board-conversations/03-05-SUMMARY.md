---
phase: 03-feedback-board-conversations
plan: 05
subsystem: api-web
tags: [categories, feedback, tenancy, migrations, dashboard]

# Dependency graph
requires: ["03-01", "03-04"]
provides:
  - "Category management API (GET, POST, PATCH, DELETE) at /workspaces/:ws/products/:product/categories"
  - "Dashboard Category editor page at /dashboard/:ws/:product/categories with CategoryList and CategoryDialog"
  - "Category selection in New Post dialog and category badges on board/permalinks"
  - "Automated seeding of Feature Request and Bug categories on product creation"
  - "Custom idempotent migration 0008_backfill_categories backfilling existing products"
  - "Enforcement of category requirement on post creation and post category nullification on category delete"
affects: [03-06, 03-07, 03-08, 03-09, 03-12]

actuals:
  tokens: 38000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Deterministically offset created_at (+1ms) for seeded categories in single transaction"
    - "WHERE NOT EXISTS idempotent SQL backfill for multi-statement migration"
    - "Tenant-scoped category row lock with for('update') and atomic post category nullification on delete"
    - "Case-insensitive unique constraint categories_product_name_ci allowing self-casing renames"

key-files:
  created:
    - apps/api/src/feedback/categories.controller.ts
    - apps/api/test/categories.test.ts
    - apps/web/app/dashboard/[ws]/[product]/categories/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/categories/categories-view.tsx
    - apps/web/components/dashboard/category-dialog.tsx
    - apps/web/components/dashboard/category-list.tsx
    - packages/db/migrations/0008_backfill_categories.sql
  modified:
    - packages/types/src/feedback.ts
    - packages/types/src/tenancy.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/api/src/products/products.controller.ts
    - apps/api/test/portal.test.ts
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/support/seed.ts
    - apps/web/lib/api-server.ts
    - apps/web/components/dashboard/sidebar.tsx
    - apps/web/components/board/post-form-dialog.tsx
    - apps/web/app/[ws]/[product]/page.tsx

key-decisions:
  - "Seed 'Feature Request' at now() and 'Bug' at now() + 1ms to guarantee deterministic ordering without an extra position column"
  - "Category delete nullifies posts.category_id in the same transaction instead of requiring a reassignment replacement"
  - "Post creation validates category existence and tenant ownership (assertCategory), returning 400 category_required or category_invalid"
  - "Category CRUD uses :id route param matching cross-tenant reflection scanner and REST standards"

requirements-completed: [POST-01, POST-02]

coverage:
  - id: D1
    description: "Admin can create, rename, list with postCount, and delete categories in dashboard"
    requirement: POST-02
    verification:
      - kind: automated
        ref: "apps/api/test/categories.test.ts (tracer and CRUD tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "New products are automatically seeded with Feature Request and Bug in created_at order"
    requirement: POST-02
    verification:
      - kind: automated
        ref: "apps/api/test/categories.test.ts (seeding test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Migration 0008 backfills Feature Request and Bug into category-less products idempotently"
    requirement: POST-02
    verification:
      - kind: automated
        ref: "apps/api/test/categories.test.ts (0008 SQL execution idempotency test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Category rename returns 409 category_name_taken on conflict, 200 on casing itself"
    requirement: POST-02
    verification:
      - kind: automated
        ref: "apps/api/test/categories.test.ts (rename collision test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Deleting a category nullifies category_id on posts, returns 204, then 404 on repeat"
    requirement: POST-02
    verification:
      - kind: automated
        ref: "apps/api/test/categories.test.ts (delete and orphan posts test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Customer post creation requires categoryId when categories exist and rejects foreign category IDs"
    requirement: POST-01
    verification:
      - kind: automated
        ref: "apps/api/test/categories.test.ts (validation test)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Cross-tenant isolation returns 404 for foreign workspace/product category routes"
    requirement: POST-02
    verification:
      - kind: automated
        ref: "apps/api/test/cross-tenant.test.ts"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-03
status: complete
---

# Phase 03: Plan 05 Summary

**Categories: dashboard editor, category on posts, seeded Feature Request/Bug + backfill (0008)**

## Accomplishments

- Implemented full Category CRUD endpoints (`apps/api/src/feedback/categories.controller.ts`) protected by `TenantGuard`, with subquery-based `postCount`, row-locking atomic post nullification on delete, and case-insensitive unique constraint collision handling.
- Built dashboard Category management interface (`apps/web/app/dashboard/[ws]/[product]/categories/`) with `CategoryList`, `CategoryDialog` (add/rename modal with validation and error mapping), accessible `ConfirmDialog` for delete, and sidebar integration under Manage.
- Wired category selection into customer feedback portal: `getPortalProduct` returns active categories, `PostFormDialog` provides an accessible `NativeSelect` dropdown, and `assertCategory` enforces category requirements on post filing.
- Added automatic seeding of `"Feature Request"` and `"Bug"` in `products.controller.ts` `createProduct` transaction, using a deterministic 1 millisecond offset on `createdAt`.
- Generated custom database migration `0008_backfill_categories.sql` using `NOT EXISTS` guards to backfill existing category-less products idempotently.
- Verified live schema gate against Docker Postgres container: all 9 migrations applied and synced with `drizzle-kit check`.
- Added comprehensive test suites in `apps/api/test/categories.test.ts` and registered all category endpoints in `apps/api/test/cross-tenant.test.ts`.

## Task Commits

1. **Task 1: Category editor, post category assignment, and tracer** - `7de4046` (`feat(03-05): category editor, post category assignment, and tracer`)
2. **Task 2: Seed categories, backfill migration 0008, and cross-tenant tests** - `a153756` (`feat(03-05): seed categories, backfill migration 0008, and cross-tenant tests`)

## Verification

- `bun run build:packages`: Types and DB packages compiled cleanly.
- `apps/api` test suite:
  - `categories.test.ts` (6 tests passing)
  - `cross-tenant.test.ts` (26 tests passing)
  - `products.test.ts` (13 tests passing)
  - `portal.test.ts` (10 tests passing)
  - `posts.test.ts` (8 tests passing)
- `bun run typecheck`: 0 errors across `@userhq/web`, `@userhq/api`, `@userhq/db`, `@userhq/types`.
- `bun run lint`: 0 errors, 0 warnings across 215 files.
- `bun run stack:up`: Rebuilt and deployed containers cleanly.
- `bun run --filter '@userhq/db' db:check`: Confirmed schema synchronization.
- Live database check: 9 applied migrations on Docker Postgres matching 9 migration files on disk.

---
*Phase: 03-feedback-board-conversations*
*Completed: 2026-10-03*
