---
phase: 06-product-feature-controls
plan: "04"
subsystem: public-module-availability
tags: [nestjs, http-tests, tenant-isolation, product-features]
status: complete
requires: [06-03]
provides: [independent-module-http-matrix, hidden-module-admin-crud-verification]
affects: [06-05, 06-07, 06-08, 06-09, 06-10]
tech-stack:
  added: []
  patterns: [real HTTP feature matrix, admin HTTP source preservation snapshots]
key-files:
  created: []
  modified:
    - apps/api/test/public-product-features.test.ts
    - apps/api/test/cross-tenant.test.ts
    - .planning/phases/06-product-feature-controls/deferred-items.md
key-decisions:
  - Existing shared PortalGuard and module classifications from 06-03 already implement all independent gates; expand behavioral regression coverage without duplicate enforcement.
  - Source preservation is observed through real admin HTTP responses before and after all sixteen flag combinations.
requirements-completed: [CAP-01, CAP-03, CAP-04, CAP-08, CAP-09]
duration: 5 min
completed: 2026-11-05
actuals:
  tokens: 3188
  tasks: 2
  commits: 2
plan_head_before: 99691e3afa596390f7a26c2309c97ddad8c29260
plan_head_after: 6be4d95659b1bb21d438559e012b2592dfb8949a
---

# Phase 6 Plan 04: Independent public module gates Summary

All sixteen Board/Roadmap/Changelog/FAQ combinations now have real HTTP coverage; disabled modules return 404 even to owners/admins, while private content management and preserved content remain usable.

## Accomplishments

- Roadmap list and ID detail, Changelog feed and slug permalink, FAQ tree and Board list each follow their own current flag for anonymous, customer, admin and owner callers.
- Another product and another workspace retain conflicting settings, demonstrating scope isolation.
- Public Roadmap responses contain neither internal field names nor seeded internal canaries.
- Roadmap and Changelog draft create/read/update/delete work while their public modules are disabled.
- FAQ category/question create/read/update/delete work with every public module disabled. Re-enabling FAQ exposes the prepared answer; customer, anonymous and foreign-workspace callers cannot perform admin mutations.
- Admin HTTP response snapshots of all four source modules remain identical across the sixteen settings combinations. Public Roadmap, Changelog and FAQ seed content survives re-enable.
- Product metadata and workspace directory stay reachable with all modules off.

## Task commits

| Task | Commit | Result |
|---|---|---|
| Prerequisite route coverage repair | 99691e3 | Registered the five admin Board mutations in the cross-tenant route matrix and resolved the deferred item. |
| 1 | 56be759 | Roadmap/Changelog list/detail independence, caller matrix, canaries and private draft CRUD. |
| 2 | 6be4d95 | Full sixteen-combination matrix, unchanged source snapshots and hidden FAQ CRUD. |

The ledger starts after the prerequisite repair; measured actuals therefore count the two task commits. The final documentation commit is excluded from `plan_head_after`.

## Verification

- Reproduced the existing cross-tenant route discovery failure: 1 failed, 63 passed; after registering the five endpoints, **69/69 passed**.
- Task 1 command: `bun run --filter @userhq/api test -- test/public-product-features.test.ts test/portal-roadmap.test.ts test/portal-changelog.test.ts test/canary-roadmap-leak.test.ts`: **4 files, 32 tests passed**, exit 0. Repeated unchanged for the tracer feedback gate: **32 passed**, exit 0.
- Task 2 command: `bun run --filter @userhq/api test -- test/public-product-features.test.ts test/admin-board-features.test.ts test/portal-faq.test.ts test/public-contract.test.ts`: **4 files, 37 tests passed**, exit 0.
- Combined regression: the previous eight unique test files including `cross-tenant.test.ts`: **8 files, 123 tests passed**, exit 0.
- `bun run --filter @userhq/api typecheck`: exit 0; `git diff --check`: exit 0.
- All HTTP tests use fixture-created, migrated disposable local PostgreSQL databases. No Docker rebuild, deployment, dependency installation or production access.

The contract suite intentionally logs a 500 from its unclassified probe controller; its expected-response assertion passes.

## Deviations from Plan

**1. Test-only verification expansion.** Plan 06-03's fail-closed classification requirement necessarily classified Roadmap, Changelog and FAQ at the same time as Board. Its shared guard already enforced all three switches. New HTTP behavior tests passed against this existing implementation; no artificial RED or redundant controller code was introduced. The parent approved this adjustment. An initial test assertion expected Roadmap deletion to return 204; the existing documented controller returns 200 with `{ success: true }`, so the test was corrected to its real contract before accepting results.

**2. Explicitly assigned prerequisite repair.** Fixed the five missing cross-tenant route-table entries discovered in 06-03 before starting the plan. This restores complete tenant-isolation test coverage for 06-02's new endpoints.

## Known Stubs

None. No new production surface or source stubs were added.

## Remaining risks

Nested projection suppression is still 06-05 scope. Portal page/navigation composition and full settings/admin notices remain 06-07 through 06-09. This plan establishes HTTP module boundaries and private CRUD behavior only; no phase-level completion claim is made.

Global STATE/ROADMAP updates are owned by the parent orchestrator to avoid concurrent edits.

## Follow-up: Full-suite fixture lifecycle

The parent's full API run later observed an unexpected HTTP 400 during the large configuration matrix. Adding response body/text to the assertion and rerunning the full suite reproduced a different transport symptom: the matrix stalled until its unchanged 30-second timeout, and the following FAQ request also stalled (488 passed, 2 failed). The 400 body was not reproduced, so no application error cause is claimed.

The matrix fixture now explicitly starts one local ephemeral listener with `app.listen(0, "127.0.0.1")`. Its existing `app.close()` teardown owns shutdown. Previously SuperTest started and closed the same server for each of hundreds of requests. This limits the change to the large matrix fixture and removes that unnecessary server lifecycle churn; all feature, role, preservation and CRUD assertions and timeouts remain intact. No production code, retry or global fixture was changed.

After the change, `bun run --filter @userhq/api test` passed **42 files, 490 tests**, exit 0 (49.26 seconds). API typecheck and `git diff --check` also passed. Other suites still emit existing concurrent SuperTest listener warnings; they all passed and are outside this local repair.

## Self-Check: PASSED

The modified test files and this summary exist. Commits 99691e3, 56be759 and 6be4d95 are ancestors of HEAD. All declared automated verification commands executed with nonzero test counts and final exit 0.
