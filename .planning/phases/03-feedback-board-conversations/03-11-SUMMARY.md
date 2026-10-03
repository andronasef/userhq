---
phase: 03-feedback-board-conversations
plan: 11
subsystem: feedback-moderation
tags: [dashboard, board, moderation, voters, restore, deleted, cross-tenant]

# Dependency graph
requires: ["03-01", "03-04", "03-05", "03-09"]
provides:
  - "AdminPostsController and AdminCommentsController providing dashboard board list, detail, voters, deleted items, and post/comment restore"
  - "ModerationService managing admin board queries, voter listing with cursor pagination, soft-deleted post/comment queries, and restoration logic"
  - "Dashboard board UI (/dashboard/:ws/:product/board) with status/category/search filtering, sort, pagination, and deleted items tab"
  - "Post detail view (/dashboard/:ws/:product/board/:number) with timeline, admin comment composer, voters dialog, and deleted warning banner"
  - "VoterList and VotersDialog rendering voter avatar/name/votedAt without exposing voter email addresses"
  - "Complete cross-tenant 404 isolation for all six admin post and comment endpoints"
affects: [03-12]

actuals:
  tokens: 45000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Privacy by design: VoterSchema omits email entirely; API query explicitly selects name, image, deleted_at, and voted_at"
    - "Safe restoration: restoreComment validates that parent post is not deleted or merged (404 post_not_found if parent deleted); UI disables restore button with 'Restore the post first'"
    - "StandardSchemaSerializerInterceptor array handling: returns item schema instead of array schema to work cleanly with serializer interceptor"
    - "Cursor pagination on voter list: composite cursor (voted_at desc, user_id asc) for deterministic paging"

key-files:
  created:
    - apps/api/src/feedback/admin-comments.controller.ts
    - apps/api/test/dashboard-board.test.ts
    - apps/web/app/dashboard/[ws]/[product]/board/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/board-view.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/[number]/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx
    - apps/web/components/dashboard/board-table.tsx
    - apps/web/components/dashboard/board-filters.tsx
    - apps/web/components/dashboard/deleted-items.tsx
    - apps/web/components/post/voter-list.tsx
    - apps/web/components/post/voters-dialog.tsx
  modified:
    - packages/types/src/feedback.ts
    - apps/api/src/feedback/moderation.service.ts
    - apps/api/src/feedback/admin-posts.controller.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/web/app/dashboard/[ws]/[product]/page.tsx
    - apps/web/components/dashboard/sidebar.tsx
    - apps/web/components/post/post-actions-menu.tsx
    - apps/web/lib/api-server.ts
    - apps/api/test/cross-tenant.test.ts

key-decisions:
  - "Voter list privacy: voter email is never returned from the voters API or displayed in the UI, even for admins (MOD-04, AUTH-04)"
  - "Post and comment restoration: restored posts and comments retain their original votes, comments, and positions; restored comments require an active parent post (MOD-02)"
  - "Dashboard menu variant: PostActionsMenu variant='dashboard' removes status change dialog and adds 'View on portal' permalink link"
  - "Product index redirect: /dashboard/:ws/:product now redirects directly to /dashboard/:ws/:product/board"

requirements-completed: [MOD-01, MOD-02, MOD-04, POST-09]

coverage:
  - id: D1
    description: "Admin views board table with search/filters/sort and opens post detail with timeline and voter list"
    requirement: MOD-01, MOD-04, POST-09
    verification:
      - kind: automated
        ref: "apps/api/test/dashboard-board.test.ts (tracer test & detail tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admins list deleted posts and comments, and restore them with proper parent post guard rails and idempotent 404s"
    requirement: MOD-02
    verification:
      - kind: automated
        ref: "apps/api/test/dashboard-board.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Voter pagination at 50/51 boundary, zero voters edge case, stable tie-breaking, non-member 404, and cross-tenant isolation for all admin routes"
    requirement: MOD-04, POST-09
    verification:
      - kind: automated
        ref: "apps/api/test/dashboard-board.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/cross-tenant.test.ts"
        status: pass
    human_judgment: false
---

# Plan 03-11: Dashboard Board Table, Post Detail, Voters, and Restore Summary

Plan 03-11 delivered the internal dashboard feedback board management interface, voter inspection modal, deleted items recovery tab, and complete cross-tenant isolation for all administrative board operations.

## Accomplishments

1. **Dashboard Board Table & Post Detail (Task 1):**
   - Added `AdminBoardQuerySchema`, `AdminPostRowSchema`, `AdminPostPageSchema`, `VoterSchema`, `VoterPageSchema`, and `AdminPostDetailSchema` in `@userhq/types`.
   - Implemented `ModerationService` methods (`listAdminPosts`, `getAdminPost`, `listVoters`) supporting filtering by status (including open filter), category, search text, and sorting by newest or top-voted with cursor pagination.
   - Refactored `loadTimeline` in `PostsService` to support admin detail view without portal-specific author locks.
   - Implemented `AdminPostsController` routes under `/api/v1/workspaces/:ws/products/:product/posts` guarded by `TenantGuard`.
   - Created dashboard views at `/dashboard/:ws/:product/board` and `/dashboard/:ws/:product/board/:number` with BoardTable, BoardFilters, VoterList, and sidebar navigation.
   - Added tracer test verifying admin board row retrieval, detail timeline, and voter listing.

2. **Deleted Items Tab & Content Restoration (Task 2):**
   - Implemented `listDeletedPosts`, `restorePost`, `listDeletedComments`, and `restoreComment` in `ModerationService`.
   - Created `AdminCommentsController` handling `GET deleted` and `POST :id/restore`.
   - Added `DeletedItems` component rendering deleted posts and deleted comments tables with immediate restore buttons and optimistic updates.
   - Handled deleted parent post constraints: comments whose post is deleted show disabled restore with helper text `Restore the post first`, and API returns `404 post_not_found`.
   - Tested self-delete & restore by author, admin deletion, comment restoration, idempotency, and detail banner for deleted posts.

3. **Voters Dialog, Dashboard Menu Variant & Cross-Tenant Isolation (Task 3):**
   - Added `VotersDialog` with `max-h-96` scroll container and `VoterList` featuring cursor pagination and `No votes yet.` empty state.
   - Added `variant="dashboard"` to `PostActionsMenu` rendering `View on portal` link.
   - Verified 50/51 voter pagination boundary, zero voter counts, stable voter tie-breaking by `user_id asc`, and non-member 404 access restrictions.
   - Added all 6 administrative routes to `CROSS_TENANT_ROUTES` in `apps/api/test/cross-tenant.test.ts`, verifying 404 isolation across workspaces.
   - Validated end-to-end functionality across E2E tests (`dashboard.e2e.test.ts`, `comments.e2e.test.ts`).

## Verification

- Automated test suites passing:
  - `apps/api/test/dashboard-board.test.ts` (10 comprehensive tests)
  - `apps/api/test/cross-tenant.test.ts` (33 tests including all 6 admin routes)
  - `apps/api/test/public-contract.test.ts`
  - E2E tests: `test/e2e/dashboard.e2e.test.ts`, `test/e2e/comments.e2e.test.ts`
- Zero typecheck errors across all packages (`bun run typecheck`).
- Zero lint warnings (`oxlint -c .oxlintrc.json`).
