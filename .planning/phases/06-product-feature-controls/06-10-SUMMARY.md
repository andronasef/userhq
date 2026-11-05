---
phase: 06-product-feature-controls
plan: "10"
subsystem: acceptance-and-review-fixes
status: complete
tags: [acceptance, browser, delivery-race, review-fixes]
requires: [06-09]
provides: [browser-acceptance-matrix, delivery-product-lock, validation-evidence]
affects: []
tech-stack:
  added: []
  patterns: [FOR SHARE product row lock to serialize delivery with disable, pickFeatures helper, RHF values with keepDirtyValues]
key-files:
  created:
    - .planning/phases/06-product-feature-controls/06-VALIDATION.md
    - .planning/phases/06-product-feature-controls/deferred-items.md
  modified:
    - apps/api/src/notifications/notifications.service.ts
    - apps/api/src/email/outbox.ts
    - apps/web/app/dashboard/[ws]/[product]/settings/product-features-form.tsx
    - apps/api/src/portal/product-features.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/api/src/portal/portal.guard.ts
    - apps/api/src/products/products.controller.ts
    - apps/api/test/browser/product-features.spec.ts
    - .planning/phases/06-product-feature-controls/06-MATT-SPEC.md
    - .planning/phases/06-product-feature-controls/06-MATT-STANDARDS.md
key-decisions:
  - Serialize delivery creation with Board disable via FOR SHARE on the products row inside the producer's transaction. The disable UPDATE already takes the conflicting row lock, so the disable path needed no change.
  - Remaining parallel API-suite flakiness is treated as environmental and recorded, not fixed here.
requirements-completed: []
duration: ~1 h
completed: 2026-11-05
actuals:
  tokens: 9000
  tasks: 2
  commits: 5
plan_head_before: 04d63ef433c79ad3dda20165e3abac0f50e012a2
plan_head_after: 1f3cdf627a4b1213f132e7417990d46302155816
---

# Phase 6 Plan 10: Final acceptance and review fixes Summary

Closes the Matt review findings (delivery-vs-disable race, stale feature form, duplicated feature mapping) and completes the Docker browser acceptance matrix for product feature controls. The remaining orchestrator-level GSD verification and Matt diff review are still pending, so no CAP box is marked complete.

## Commits

- `159920c` fix: CR-01. Fan-out and comment-email enqueue `FOR SHARE` the product row, so a concurrent Board disable waits and its cleanup sees the rows (D-14). The existing RED race test went from 2 failed to 2 passed.
- `f0cf0d9` fix: WR-01 (spec). The feature form follows refreshed server flags for pristine fields and keeps dirty choices.
- `48004ee` refactor: WR-01 (standards). `pickFeatures` plus `productFeatureColumns` replace four hand-copied mappings. The metadata whitelist derives from `PRODUCT_FEATURE_KEYS`.
- `2aa76de` test: browser acceptance matrix. Landing order and 307, all-off 200 noindex, disabled 404s, directory presence, hidden-dashboard management, refresh sync, nested roadmap and FAQ links, tab strip at 320/375/768. It also removes the resolved `deferred-items.md` entry.
- `1f3cdf6` docs: resolution notes appended to both Matt review files, and a new `deferred-items.md` for out-of-scope findings.

## Verification (actual)

See `06-VALIDATION.md`. In short: API serial run 492/492 on 3 of 3 runs; web 154/154; typecheck, lint (exit 0, 2 pre-existing warnings), builds and `db:check` pass; browser `product-features.spec.ts` 8/8; full browser suite 17 passed and 2 failed (stale, pre-existing).

## Deviations from Plan

**1. [Rule 1 - Bug] Work-in-progress browser test used wrong locators.** The uncommitted "server refresh" test looked up a "Name" label, but the field is "Product name", so it failed for the wrong reason. Fixed the locator before taking the RED reading.

**2. [Scope] Cross-tenant matrix and `deferred-items.md` entry.** The five admin Board routes were already registered in `CROSS_TENANT_ROUTES` by 06-04 (`99691e3`). I confirmed the route-set test passes (69/69) and that each route asserts 404 and `not_found` for a foreign tenant, then deleted the stale file as asked.

**3. [Scope] New `deferred-items.md`.** Recreated with three out-of-scope findings (see Known Issues).

`06-VALIDATION.md` was written because 06-10 Task 2 lists it as an output. The new browser tests exercise behavior that was already implemented, so they passed on first run; only the WR-01 test had a RED run.

## Known Issues (deferred, not Phase 6)

- `portal-branding.spec.ts` "OG and favicon metadata backstop" is stale: the title format `Sunny · Acme` predates the Phase 6 fixed point.
- `dashboard-header.spec.ts` is stale: commit `0078f0a` replaced the "UserHQ" text wordmark with an image.
- The parallel API suite is intermittently flaky on this host (1 to 4 random unrelated failures on roughly a third of runs). It is deterministic with `--no-file-parallelism`. The cause is likely ephemeral-port cross-talk with colima ssh forwards, but this is unconfirmed. `bun run ci:check` hit it once and stopped at the test stage.

## Threat Flags

None. No new endpoints, auth paths or schema. The `FOR SHARE` lock only narrows delivery creation.

## Self-Check: PASSED

Commits `159920c f0cf0d9 48004ee 2aa76de 1f3cdf6` are ancestors of HEAD. `06-VALIDATION.md`, `deferred-items.md` and both Matt files exist.
