---
phase: 03-feedback-board-conversations
plan: 12
subsystem: feedback-moderation
tags: [merge, bulk-merge, dedupe, redirects, concurrency, cross-tenant]

# Dependency graph
requires: ["03-04", "03-08", "03-11"]
provides:
  - "ModerationService.mergePosts performing atomic single and bulk post merges in one transaction"
  - "AdminPostsController routes for POST :number/merge and POST merge returning the surviving post"
  - "MergeDialog providing two-step search and confirm merge dialog from the portal and dashboard"
  - "BulkMergeDialog providing multi-post survivor selection and bulk merge execution from the dashboard table"
  - "Selection bar and checkbox column in BoardTable with indeterminate state and clear on filter change"
  - "Preservation of comments, parent-child thread hierarchy, and timestamps during post merges"
  - "Vote deduplication ensuring voters who voted on multiple posts are counted once"
  - "Flattening of prior merged post chains pointing directly to the new target post"
  - "Cross-tenant 404 isolation for single and bulk merge routes"
affects: [03-13]

actuals:
  tokens: 46000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Deadlock prevention: all involved posts locked in ASC id order with FOR UPDATE in a single transaction"
    - "Single UPDATE comments migration: moves all comments in one statement, satisfying composite deferred FKs"
    - "Vote deduplication: ON CONFLICT DO NOTHING copy into target votes table followed by COUNT(*) recount"
    - "Flattening redirect chains: posts previously merged into the duplicate are repointed directly to the target post"
    - "Selection bar UX: interactive selection region with disabled state when < 2 items selected, cleared on search change"

key-files:
  created:
    - apps/web/components/post/merge-dialog.tsx
    - apps/web/components/dashboard/bulk-merge-dialog.tsx
    - apps/api/test/merge.test.ts
  modified:
    - packages/types/src/feedback.ts
    - apps/api/src/feedback/moderation.service.ts
    - apps/api/src/feedback/admin-posts.controller.ts
    - apps/web/components/post/post-actions-menu.tsx
    - apps/web/components/dashboard/board-table.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/[number]/page.tsx
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/e2e/board.e2e.test.ts

key-decisions:
  - "Merge is irreversible: votes are deduplicated, comments interleaved chronologically; no undo is supported (MOD-05)"
  - "No merged trace on target: merged duplicates point to target with merged_into_id; target post shows no 'merged from' banner (D-04)"
  - "Concurrency safety: locking posts in ASC id order guarantees no deadlock between concurrent opposite merges (X->Y vs Y->X)"
  - "Flattening redirect chains: posts previously merged into duplicate post now point directly to the survivor, preventing redirect chains"

requirements-completed: [MOD-05]

coverage:
  - id: D1
    description: "Admin merges duplicate post into target; votes combine without double counting, comments interleave chronologically, duplicate permalink redirects"
    requirement: MOD-05
    verification:
      - kind: automated
        ref: "apps/api/test/merge.test.ts (tracer test)"
        status: pass
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bulk merge from dashboard table with selection bar, radio survivor picker, thread preservation, and race protection"
    requirement: MOD-05
    verification:
      - kind: automated
        ref: "apps/api/test/merge.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/cross-tenant.test.ts"
        status: pass
    human_judgment: false
---

# Plan 03-12: Post Merge, Bulk Merge, Deduplication, and Redirects Summary

Plan 03-12 delivered single and bulk post merging capabilities for administrators, vote deduplication, chronological comment interleaving, threaded conversation preservation, redirect chain flattening, and cross-tenant isolation.

## Accomplishments

1. **Single Post Merge & Portal UX (Task 1):**
   - Added `MergeInputSchema`, `BulkMergeInputSchema`, and `MergeResultSchema` in `@userhq/types`.
   - Implemented `mergePosts` in `ModerationService` executing atomic post merges in one transaction:
     - Locks all involved rows in `id ASC` order to prevent deadlocks.
     - Copies votes with `ON CONFLICT DO NOTHING`, removes duplicate votes, and recounts target's `vote_count`.
     - Moves all comments with a single `UPDATE` to preserve comment-parent foreign keys.
     - Copies post mutes with `ON CONFLICT DO NOTHING`.
     - Flattens redirect chains by updating `merged_into_id` of prior merged posts to the new target.
     - Sets duplicate post `merged_into_id = target.id` and `vote_count = 0`.
   - Added `POST :number/merge` and `POST merge` endpoints to `AdminPostsController`.
   - Created `MergeDialog` featuring debounced board search (with 300ms pause), live region announcements, before/after vote visualization with `ArrowDown`, and destructive confirmation.
   - Added `Merge into…` action to `PostActionsMenu` for admins.
   - Delivered tracer test in `apps/api/test/merge.test.ts` verifying combined votes, comment timeline preservation, and duplicate redirection.
   - Added E2E test in `apps/api/test/e2e/board.e2e.test.ts` verifying permalink redirection.

2. **Dashboard Bulk Merge & Selection Bar (Task 2):**
   - Added native checkbox selection column and indeterminate header checkbox to `BoardTable`.
   - Added floating selection bar displaying count, disabled `Merge posts…` button with tooltip when `< 2` posts selected, and `Clear selection` button.
   - Created `BulkMergeDialog` with native radio group preselecting the post with the highest vote count, metadata display (`{votes} votes · {comments} comments`), and destructive merge execution.
   - Verified that dashboard detail route redirects to survivor on merged post requests.
   - Tested concurrency safety with concurrent opposite merges (`X->Y` and `Y->X`), validating that exactly one succeeds and no database deadlock occurs.
   - Added `POST /workspaces/:ws/products/:product/posts/:number/merge` and `POST /workspaces/:ws/products/:product/posts/merge` to `CROSS_TENANT_ROUTES` in `apps/api/test/cross-tenant.test.ts`.

## Verification

- Automated test suites passing:
  - `apps/api/test/merge.test.ts` (8 comprehensive tests covering tracer, bulk merge, chain flattening, threaded comments, empty duplicates, validations, and concurrent opposite merges)
  - `apps/api/test/cross-tenant.test.ts` (35 tests including all merge routes)
  - `apps/api/test/votes.test.ts` (8 tests)
  - `apps/api/test/e2e/board.e2e.test.ts` (10 E2E tests including merged redirect)
- Zero typecheck errors across all workspaces (`bun run typecheck`).
- Zero lint warnings (`oxlint -c .oxlintrc.json`).
