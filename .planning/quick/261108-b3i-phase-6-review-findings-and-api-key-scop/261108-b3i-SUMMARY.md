---
phase: quick-261108-b3i
plan: 01
subsystem: api-keys, webhooks, dashboard
tags: [security, webhooks, api-key-scopes, story-20, AF-01, AF-02, AF-03]
requires: [06-product-feature-controls]
provides:
  - settings:read, settings:write, faq:read, faq:write API key scopes
  - webhook suppression in the Board/Changelog disable transaction
  - product share lock at webhook enqueue
  - required getPostPage projection
  - event-to-module exhaustiveness test
affects: [docs/automation-api.md, 06-SECURITY.md, 06-UI-SPEC.md]
key-files:
  created:
    - apps/api/test/automation-config-routes.test.ts
    - apps/api/test/webhook-event-modules.test.ts
  modified:
    - packages/types/src/api-keys.ts
    - apps/web/components/api-keys/create-api-key-dialog.tsx
    - apps/api/src/products/products.controller.ts
    - apps/api/src/products/statuses.controller.ts
    - apps/api/src/feedback/categories.controller.ts
    - apps/api/src/faq/faq.controller.ts
    - apps/api/src/webhooks/outbox.ts
    - apps/api/src/feedback/comments.service.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/web/app/dashboard/[ws]/[product]/board/board-view.tsx
    - docs/automation-api.md
status: complete
commits: 8
plan_head_before: be787aa32fcc6a91761ffadee55d94da8d335ad4
plan_head_after: 7a30e62d75be9ca9b76379d70e93f5f0f627fcba
actuals:
  tokens: 19500
  tasks: 4
  commits: 8
completed: 2026-11-08
---

# Quick 261108-b3i: Phase 6 review findings and API key scopes (story 20)

One-liner: queued webhooks are suppressed in the same transaction that switches Board or Changelog off (with a product share lock at enqueue), the post-page projection is required, the event-to-module map is pinned by test, and settings, statuses, categories and FAQ are scoped automation routes with restricted-key and cross-tenant coverage.

## Commits

| Step | Commit | Message |
|------|--------|---------|
| T1 RED | 9747e94 | test: RED settings scope on product routes |
| T1 GREEN | a271c6f | feat: settings scopes for product routes |
| T2 RED | c07a0c3 | test: RED webhook suppression on disable, enqueue lock, required projection, event-module table |
| T2 GREEN | 5edda00 | fix: suppress queued webhooks on module disable, lock enqueue, require post projection (AF-01..03) |
| T3 RED | 5f2e6fe | test: RED scoped statuses, categories and FAQ routes |
| T3 GREEN | 9a4efd9 | feat: API key scopes for statuses, categories and FAQ |
| T4 RED | 2213e64 | test: RED board empty state hides View portal when Board is off |
| T4 GREEN | 7a30e62 | fix: hide View portal when Board is off; close Phase 6 review bookkeeping |

## RED and GREEN evidence

- **T1 RED:** 8 failed, 9 passed. Key creation with `settings:*` answered 500 (see Observations; the plan expected 400), PATCH on products answered `api_key_route_forbidden`, and the `:ws` inventory test failed naming the three unpinned product routes. **GREEN:** the new suite plus automation-routes, products, product-features, api-keys, cross-tenant: 150/150 after fixing one test bug of mine (the restricted key needed `settings:read` for the list call).
- **T2 RED:** AF-01 board and changelog cases left deliveries `pending`; race case ended with a `pending` delivery after disable then re-enable; AF-02 call resolved with the admin view; AF-03 table passed on first run (characterization). **Mutation:** appended `faq.mutated` to `WEBHOOK_EVENTS`, rebuilt types, the exhaustiveness case failed with the "add the new event to EVENT_MODULES" message; restored with `git checkout`, rebuilt, `git diff packages/types/src/webhooks.ts` empty, 2/2 pass. **GREEN:** the 13 listed files, 127/127.
- **T3 RED:** 11 failed, the inventory test named 20 unscoped routes. **GREEN:** the 8 listed files, 162/162.
- **T4 RED:** the "View portal" link rendered with Board off (1 failed, 3 passed). **GREEN:** 4/4.

## ci:check result (stated honestly)

`bun run ci:check` exits 0 only when vitest parallelism is reduced: `VITEST_MAX_WORKERS=2 bun run ci:check` -> exit 0 (API 767/767, web 264/264, types 32, db 6, `db:check` clean, web build and build:next pass).

At default parallelism `bun run ci:check` exited 1 four times, each with different unrelated tests failing (webhook-worker "keeps the body", then api-key-attribution, dashboard-board, post-edit, votes; then votes, platform, product-feature-delivery; then automation-routes, webhook-secrets, auth, workspaces). Symptoms were `Parse Error: Expected HTTP/, RTSP/ or ICE/`, `401` where `200` expected, and `404` where `403` expected. The same files pass serially and in most plain `bun run test` runs.

This is a pre-existing flake, not caused by this plan: a clean worktree at be787aa (no changes of mine) failed its API suite in 3 of 5 full runs (`sends the pinned headers...` twice, `rate limit: a user's 11th upload` and a created_at ordering test once), and passed twice. At HEAD the plain API suite passed 5 of 8 runs. Cause not identified (cross-talk between parallel test forks on this machine is the likely area). Not fixed: out of scope. Recommend a follow-up to find it.

## Scope mapping decision (story 20)

- Statuses and categories use the **settings pair** (`settings:read` / `settings:write`), not `requests:*`: deleting a status reassigns roadmap items and `isPublicRoadmap` controls public roadmap exposure, which a requests key must not change. An integration that moves posts and reads status ids holds `requests:write` + `settings:read`.
- Product list, get and PATCH (four feature switches, name, slug, tagline, website, accent colors, logo removal) use the settings pair. FAQ routes use a **faq pair**.
- `createProduct` and `deleteProduct` stay undecorated (`api_key_route_forbidden` for every key); they are pinned per handler in `automation-routes.test.ts`. Keys can clear a logo but never set one (no key can upload; ownership is checked against the integration actor).
- Every new handler declares exactly one scope. Code, `API_KEY_SCOPES`, web `SCOPE_LABELS` and docs rows (4 scope rows, 23 endpoint rows) are kept in sync by the existing inventory and docs tests; no `story-20` pin remains.
- Tenant isolation and restricted keys come from `TenantGuard` with no handler changes; tests assert unchanged database rows for P2 and workspace B, including B's status, category and FAQ ids sent under A's slug.

## Privilege note

`admin` means every scope, so **existing `admin` keys now reach product settings, statuses, categories and FAQ** (previously `api_key_route_forbidden`). Docs section 2 says so. Accepted per threat T-B3I-03: keys are created and revoked only by owners and admins.

## Audit attribution

No attribution added: statuses, categories, FAQ and product tables have no actor or key column, and status delete writes no `post_activity`. The status-delete test asserts the `post_activity` count is unchanged so a future audited write fails it.

## Findings already done / intentionally unchanged

- **Already done:** Categories dashboard notice (`categories/page.tsx` redirects to the Board page, which renders the Board notice above the view switch; UI-REVIEW fix 2 was a false positive). Statuses carries no notice by UI-SPEC (shared by Board and Roadmap).
- **Intentionally not changed:** runtime fail-closed for unknown webhook event types (the exhaustiveness test makes a missing classification a failing test; revisit if an event carries product data but belongs to no module), the activity-feed and portal-side links, AF-04 / AR-06-01.

## Deviations from Plan

**1. [Rule 1 - test bug] Restricted-key test used a write-only key for the product list.** The list needs `settings:read` and SessionGuard reports `insufficient_scope` before TenantGuard reports `product_restricted`. Fixed the test key to hold both scopes. Test commit a271c6f.

**2. [Doc scope] 06-UI-SPEC.md: only the Approval line changed.** Commit e3821a3 changed only the front matter (`status: approved`, `reviewed_at`); nothing in it supports an all-pass sign-off, so the seven checker boxes stay unticked and the line now reads "approved 2026-11-05 (commit e3821a3)".

**3. [Plan expectation] Unknown scope at key creation returns 500, not 400.** The plan's RED expected 400; in the repo `ApiKeysController.createKey` throws an uncaught ZodError (500 `internal_error`). RED still failed for the right reason. Not changed (out of scope), see Observations.

No auth gates. No package installs. No migration (`git diff --stat be787aa..HEAD -- packages/db` is empty). STATE.md and ROADMAP.md untouched.

## Observations (not fixed)

- `POST /workspaces/:ws/api-keys` with an unknown scope returns 500 `internal_error` (ZodError thrown in `ApiKeysController.createKey`) instead of a 400 `validation_failed`.
- The webhook-worker tests `sends the pinned headers...` and `keeps the body and changes the signature timestamp...` are among the flakes above (they also fail at be787aa).

## Verification of AF-01 callers

All 14 `enqueueWebhookEvent` callers run inside `db.transaction` callbacks (`announceIfWentLive` and the roadmap helper are called from transactions). The only bare-handle caller (portal comment delete in `comments.service.ts`) now runs the soft delete and the enqueue in one transaction; `grep -c 'enqueueWebhookEvent(this'` prints 0 and `grep -c '= { kind: "admin" }'` in `posts.service.ts` prints 0.

## Known Stubs

None.

## Threat Flags

None. The new share lock only narrows concurrency; no new endpoints beyond the scoped routes in the threat register.

## Self-Check: PASSED

Created files exist, all 8 commits are ancestors of HEAD, `packages/db` untouched.
