---
phase: 06-product-feature-controls
plan: "01"
subsystem: product-settings
tags: [drizzle, zod, tenancy, playwright]
status: complete
requires: [phase-02-tenancy, phase-06-approved-plan]
provides: [persisted-product-features, partial-feature-patch, board-settings-tracer]
affects: [06-02, 06-03, 06-06, 06-08]
tech-stack:
  added: []
  patterns: [explicit-capability-dto, independent-column-updates]
key-files:
  created:
    - packages/db/migrations/0013_product_features.sql
    - packages/db/migrations/meta/0013_snapshot.json
    - apps/api/test/product-features.test.ts
    - apps/api/test/browser/product-features.spec.ts
  modified:
    - packages/db/src/schema/tenancy.ts
    - packages/types/src/tenancy.ts
    - apps/api/src/products/products.controller.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/web/app/dashboard/[ws]/[product]/settings/product-general-form.tsx
    - packages/db/test/migrate.test.ts
key-decisions:
  - Complete feature DTOs have no fail-open defaults; persisted columns default true.
  - Feature PATCH writes only provided columns so concurrent distinct-key updates compose.
  - Initial Board tracer remains in General until plan 06-08 supplies the complete dedicated section.
requirements-completed: []
duration: 10 min
completed: 2026-11-05
actuals:
  tokens: 36581
  tasks: 3
  commits: 4
plan_head_before: 8897b404dd4ec8fb1082affe62ccccb03ea23686
plan_head_after: 4de271b7713bc6e54767607b024ae38d6b1908c8
---

# Phase 6 Plan 1: Persisted product feature settings

Four enabled-by-default product capabilities round-trip through owner/admin settings, explicit admin/public metadata DTOs, and independently merged PATCH writes.

## Completed tasks and commits

1. RED persistence behavior: `c7b4f4f`. The real HTTP test failed because `features` was undefined, not because infrastructure was unavailable. Schema/contracts/API/UI implementation: `1c363c7`.
2. Upgrade/default, strict input, role/isolation and concurrent partial-update verification: `41eb234`.
3. Locally built Docker browser save/reload/REST persistence and restore journey: `4de271b`.

## Verification

- `bun run build:packages` passed.
- `bun run --filter @userhq/db db:check` passed.
- Regenerating after the committed generated snapshot reported **No schema changes, nothing to migrate**.
- `bun run --filter @userhq/api test -- test/product-features.test.ts test/products.test.ts test/portal.test.ts`: **33 tests passed**.
- `bun run --filter @userhq/db test -- test/migrate.test.ts`: **5 tests passed**, including an existing product migrated from the folder immediately before product_features. Name/tagline were preserved and all four flags became true.
- `bun run typecheck`: all four packages passed.
- Browser discovery found exactly one test; `bun run --filter @userhq/api test:browser -- test/browser/product-features.spec.ts`: **1 passed** against rebuilt local Docker images.
- `git diff --check` passed before task commits.

Parent restored the local Docker runtime, rebuilt API/web images, and installed the matching already-pinned Playwright Chromium binary. Initial browser attempts identified an ambiguous Save changes selector; the final test scopes Save to the Board form. Fixture teardown deletes seeded dependent rows before workspace deletion.

## Deviations from Plan

- **Rule 2, coupled DTO consumer:** updated PortalController's explicit column projection to populate the newly required PublicPortalProduct features field. This prevents a strict response-schema failure.
- **Rule 1, coupled tests:** updated the public portal allowlist expectation and typed branding fixture for the intentional features addition.
- **Research CF-2:** generated SQL initially repeated device_info additions already applied by migration 0012. Removed only those two duplicate statements; retained generated snapshot/journal, then confirmed regeneration is empty. No schema push was used.
- Parent owns STATE/ROADMAP and cross-plan requirement completion. CAP-01/02/08/09 are only partially delivered by this tracer and are therefore not marked complete here.

## Known Stubs

None. Public endpoints are intentionally not gated by this persistence plan; later plans implement availability enforcement before phase delivery. The complete four-control form is explicitly assigned to 06-08 rather than represented as shipped here.

## Self-Check: PASSED

Generated migration, snapshot, tests and implementation files exist. All four listed task commits are ancestors of the task tip. No deployment or external publication occurred.
