---
phase: 06-product-feature-controls
plan: "03"
subsystem: portal-capability-enforcement
tags: [nestjs, guard, metadata, tenant-isolation, contract-test]
status: complete
requires: [06-01, 06-02]
provides: [portal-feature-metadata, portal-guard-capability-gate, fail-closed-classification-contract]
affects: [06-04, 06-05, 06-08, 06-09]
tech-stack:
  added: []
  patterns: [SetMetadata+Reflector in existing guard, pure capability predicate, fail-closed config error]
key-files:
  created:
    - apps/api/src/portal/product-features.ts
    - apps/api/test/public-product-features.test.ts
  modified:
    - apps/api/src/portal/portal.guard.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/api/src/feedback/portal-posts.controller.ts
    - apps/api/src/feedback/portal-comments.controller.ts
    - apps/api/src/feedback/portal-votes.controller.ts
    - apps/api/src/feedback/portal-mutes.controller.ts
    - apps/api/src/notifications/portal-activity.controller.ts
    - apps/api/src/roadmap/portal-roadmap.controller.ts
    - apps/api/src/changelog/portal-changelog.controller.ts
    - apps/api/src/faq/portal-faq.controller.ts
    - apps/api/test/public-contract.test.ts
key-decisions:
  - PortalGuard reads @PortalFeature (handler overrides class) and resolves the four flags in its existing product select, so enforcement adds zero queries; flags are exposed as req.portal.features for later projection work (N1-N4 in 06-04/05).
  - Unclassified product routes throw a plain Error (500) before any tenant lookup; workspace-only routes (no :product) skip classification.
  - No admin bypass on portal URLs; scoped admin management stays on TenantGuard routes from 06-02.
requirements-completed: []
duration: ~25 min
completed: 2026-11-05
actuals:
  tokens: 7900
  tasks: 3
  commits: 3
plan_head_before: fd4970770254762aba921b998f6c8e612e343645
plan_head_after: 182798876debcc2ef4611f7c1b7ee35596fb027f
---

# Phase 6 Plan 03: Public Board enforcement and fail-closed classification

A disabled Board now returns the uniform `not_found` 404 on every portal Board read, write and activity route for every caller (anonymous, customer, admin, owner), and every `portal/:ws/:product` handler carries an explicit `@PortalFeature` classification that the contract suite and `PortalGuard` both enforce.

## Commits

| Task | Commit | Notes |
|---|---|---|
| 1 | 9c2e902 | `product-features.ts`, `PortalGuard` capability gate, all portal controllers classified, read-path tests |
| 2 | 21bc9e8 | Writes/activity matrix by role, row-count snapshots, re-enable and admin-route checks |
| 3 | 1827988 | Contract scan, per-controller classification cases, guard fixture, unclassified probe controller |

## What was built

- `PortalFeature(setting)` metadata, `featureEnabled(features, setting)` pure predicate and `productFeatureColumns` select map (usable without HTTP).
- Guard order preserved: ws 404, suspended 403, product 404, then the capability 404. `exempt` (PortalController, branding metadata) and the workspace directory branch are never gated.
- Classification: posts/comments/votes/mutes/activity = board; roadmap/changelog/faq = their module; PortalController = exempt.
- Anonymous Board writes still return 401 (global session guard runs before PortalGuard), identical to the enabled state, so no product-state oracle.

## Verification (real output)

- RED (before implementation): `public-product-features.test.ts` 2 failed / 8 passed. Disabled Board returned 200 on `GET posts` and 201 on `POST posts`. An earlier RED was a fixture bug (seeded `nextPostNumber`), fixed before accepting RED.
- `bun run build:packages && bun run --filter @userhq/api test -- test/public-product-features.test.ts test/portal-isolation.test.ts` -> 2 files, 9 tests passed, exit 0.
- `bun run --filter @userhq/api test -- test/public-product-features.test.ts test/activity.test.ts test/comments.test.ts` -> 3 files, 20 tests passed, exit 0; `bun run --filter @userhq/api typecheck` exit 0.
- `bun run --filter @userhq/api test -- test/public-contract.test.ts test/public-product-features.test.ts test/canary-roadmap-leak.test.ts` -> 3 files, 33 tests passed, exit 0.
- `bun run lint`: only the pre-existing `apps/web/components/color-field.tsx` unused-variable warning.
- Full API suite (`bun run --filter @userhq/api test`): 40 files passed, 1 failed (475 passed, 1 failed). The failure is `cross-tenant.test.ts` "discovered :ws routes equal CROSS_TENANT_ROUTES keys", caused by the five 06-02 admin Board routes missing from its route table; unrelated to this plan, logged in `deferred-items.md`. A first full run (while other agents shared Postgres) had 6 vote-test 30s timeouts; those files pass in isolation and in the second full run.

## Deviations from Plan

**1. [Rule 3 - Blocking, coupled change] Classified all portal controllers in Task 1, not only posts and portal.** Fail-closed means any unclassified product route returns 500, so committing posts/portal alone would have broken comments/votes/mutes/activity (and roadmap/changelog/faq) between commits. Decorators for those were applied in Task 1; Task 2's commit therefore contains the write/activity tests only. Task 2's RED was observed on the pre-implementation tree (POST posts returned 201 while disabled).

**2. [Rule 1 - Test scope] Serializer check exempts 204 handlers.** `deletePost` and `deleteComment` return no body, so the "serializer present" assertion applies to handlers with a response body.

**3. Probe controller in the contract suite** uses `createTestApp({ extraControllers })` rather than a new support file, keeping the change inside the two listed test files.

## Known Stubs

None.

## Threat Flags

None. T-06-03-01/02: capability derived from the guard's own scoped product row; cross-tenant and sibling-product isolation tested; no admin bypass. T-06-03-03: gate reads stored flags only; content untouched (re-enable test shows data intact).

## Remaining risks

- Roadmap/changelog/faq are classified but their independent read matrix and the nested projection leaks (N1-N4) are 06-04/05 scope; `req.portal.features` is available for them.
- Dashboard components still call portal routes for post creation (`post-form-dialog.tsx` create), post list (`post-list.tsx`) and vote (`vote-button.tsx`). With Board off, an admin using those from the dashboard gets 404. 06-02 left these on portal routes deliberately; verify the dashboard never renders them for a disabled Board (06-08/09).
- `cross-tenant.test.ts` route table is stale for 06-02 routes (see deferred-items.md).
- Unclassified-route failure is a runtime 500 plus a CI-time contract failure; there is no startup-time check.

## Self-Check: PASSED

- `apps/api/src/portal/product-features.ts` and `apps/api/test/public-product-features.test.ts` exist.
- Commits 9c2e902, 21bc9e8, 1827988 are ancestors of HEAD.
