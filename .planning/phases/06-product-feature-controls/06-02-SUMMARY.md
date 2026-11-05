---
phase: 06-product-feature-controls
plan: "02"
subsystem: board-admin-routes
tags: [nestjs, tenant-guard, comments, posts, react]
status: complete
requires: [06-01]
provides: [admin-post-edit-delete, admin-comment-crud, dashboard-admin-endpoint-routing]
affects: [06-03, 06-08, 06-09]
tech-stack:
  added: []
  patterns: [boardApiBase-variant-helper, tenant-guard-admin-routes]
key-files:
  modified:
    - apps/api/src/feedback/admin-posts.controller.ts
    - apps/api/src/feedback/admin-comments.controller.ts
    - apps/api/test/admin-board-features.test.ts
    - apps/web/lib/tenant.ts
    - apps/web/components/post/comment-composer.tsx
    - apps/web/components/post/comment-item.tsx
    - apps/web/components/post/post-timeline.tsx
    - apps/web/components/post/post-actions-menu.tsx
    - apps/web/components/post/merge-dialog.tsx
    - apps/web/components/board/post-form-dialog.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx
key-decisions:
  - One helper (boardApiBase) maps variant to the base path; portal and admin routes share the posts/comments suffixes, so call sites only change their base.
  - Admin comment routes reuse CommentsService, shared Zod DTOs and the portal throttle (10/60s, UserThrottlerGuard); no new providers (CommentsService already registered in FeedbackModule).
  - Dashboard post-edit no longer redirects to the portal slug URL on slug change (dashboard URLs key on number, and the portal is unavailable with Board off).
requirements-completed: [CAP-04, CAP-08]
duration: resumed session
completed: 2026-11-05
actuals:
  tokens: 9000
  tasks: 3
  commits: 5
plan_head_before: 4ee265ce553035ab43ca472d72112731cdf1b4ae
plan_head_after: daa0892f81bc1a8f40bbdebeb203763100bd5900
---

# Phase 6 Plan 02: Admin Board Routes Summary

Dashboard post and comment management now runs through TenantGuard admin routes (PATCH/DELETE posts, POST posts/:number/comments, PATCH/DELETE comments/:id) and stays available with Board disabled; portal call sites keep their portal endpoints.

Note: `commits: 5` counts only 06-02 commits (4c60ffc, 3c3c872, 05779b4, a4c04da, daa0892). The range `plan_head_before..plan_head_after` also contains two interleaved 06-06 commits (4ea5ca3, f94db5a) from the concurrent executor.

## Commits

| Task | Commit | Notes |
|---|---|---|
| 1 RED/GREEN | 4c60ffc, 3c3c872 | Admin post edit/delete (committed in prior session) |
| 2 RED | 05779b4 | Admin comment lifecycle tests |
| 2 GREEN | a4c04da | Admin comment create/edit/delete controllers |
| 3 | daa0892 | Dashboard variant routing in web components |

## Task 2 review of the prior uncommitted diff

- DI: `CommentsService` is in `FeedbackModule` providers; both admin controllers are in the same module. No module change needed.
- Typing: `user: any` / `req: any` match `portal-comments.controller.ts` and the existing admin controllers (the repo convention), so left as is.
- Throttle: `UserThrottlerGuard` + `@Throttle({ default: { limit: 10, ttl: 60_000 } })`, identical to the portal create route.
- Cleanup only: moved stray imports into the import block and wrapped the long constructors. No behavior change.

## Task 3 changes

- `boardApiBase(variant, ws, product)` in `apps/web/lib/tenant.ts`.
- `variant` prop (default `"portal"`) added to `CommentComposer`, `CommentItem`, `PostTimeline`, `PostFormDialog`; `PostActionsMenu` delete and `PostFormDialog` edit use it.
- `MergeDialog` search uses the admin list in dashboard (`AdminPostPage` mapped via a `MergeCandidate` Pick of number/title/voteCount/status).
- `post-detail-view.tsx` passes `variant="dashboard"` to `PostTimeline`. `PostActionsMenu` there already passed it.
- Left on portal routes on purpose: post create (`POST posts`), vote, mute, post-list.

## Verification (real output)

- `bun run --filter @userhq/api test -- test/admin-board-features.test.ts test/posts.test.ts test/comments.test.ts` -> 3 files, 18 tests passed, exit 0.
- `bun run --filter @userhq/api typecheck` -> exit 0.
- `bun run --filter @userhq/web typecheck` -> exit 0.
- `bun run --filter @userhq/web test` -> 18 files, 129 tests passed, exit 0.
- Postgres: colima was stopped; started `colima` and `bun run dev:services` (postgres on 5432) to run the DB-backed tests.

## Deviations from Plan

**1. [Rule 3 - Blocking, environment]** Colima and the dev Postgres were down; started them per 06-RESEARCH. No code impact.

**2. [Rule 1 - Bug avoided]** Dashboard post edit would have `router.replace`d to the portal slug URL after a slug change, which 404s with Board off. Restricted that redirect to the portal variant.

No architectural changes.

## Issues Encountered

- Two test runs failed transiently because plan 06-06's concurrent edits to `apps/api/src/email/outbox.ts` were mid-edit (syntax error). Not touched; the re-run passed once 06-06 finished its edit.
- One run printed a pg `57P01` (terminating connection) unhandled error from a per-run test database while all 18 tests passed; an immediate re-run was clean (exit 0). Attributed to concurrent runs sharing the Postgres instance.

## Known Stubs

None.

## Remaining risks

- Dashboard repointing has no automated coverage here; plan 06-09's browser spec is the planned cover. Only typecheck and the API tests exercise it now.
- Admin merge search ignores the portal-only `limit=8` (BoardQuerySchema has no `limit`; the param is stripped), so the empty-query list uses the server page size.

## Threat Flags

None. No new endpoints beyond the plan; all derive tenant from TenantGuard.

## Self-Check: PASSED

- Commits 4c60ffc, 3c3c872, 05779b4, a4c04da, daa0892 exist on the branch.
- Modified files verified present.
