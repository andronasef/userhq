---
phase: 03-feedback-board-conversations
plan: 09
subsystem: api-web
tags: [moderation, status-change, post-activity, lock-rule, optimistic-concurrency, soft-delete]

# Dependency graph
requires: ["03-01", "03-02", "03-04", "03-06", "03-08"]
provides:
  - "ModerationService with changeStatus executing in a FOR UPDATE transaction, version conflict detection (409 edit_conflict), same-status no-op handling, and post_activity entry insertion with snapshotted status name/color"
  - "AdminPostsController with PUT /workspaces/:ws/products/:product/posts/:number/status guarded by TenantGuard"
  - "PostsService updatePost and deletePost with D-13/D-14 engagement lock check (post_locked 403 for non-admin authors once votes or comments exist from other users)"
  - "PortalPostsController with PATCH /portal/:ws/:product/posts/:number and DELETE /portal/:ws/:product/posts/:number"
  - "PostActionsMenu component rendering Admin menu (with Edit post, Change status, Delete post) for admins, and Post actions menu for authors (with locked reason when canEdit is false)"
  - "StatusChangeDialog and ActivityItem components rendering public timeline entries for status updates"
  - "PostFormDialog supporting edit mode with optimistic concurrency conflict reload"
  - "Automatic status deletion post reassignment in StatusesController deleteStatus"
affects: [03-10, 03-11, 03-12]

actuals:
  tokens: 45000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Lock-then-mutate transactions with FOR UPDATE row locking across status changes, post edits, and soft deletes"
    - "D-13/D-14 engagement locking rule re-checked inside mutation transactions after row acquisition"
    - "Snapshot immutability: post_activity rows record actor identity, status name, and color at the moment of status change"
    - "Pattern 6 optimistic concurrency with integer post versioning and edit_conflict (409) resolution"
    - "Status deletion post reassignment updating posts in the same transaction before deleting the status row"

key-files:
  created:
    - apps/api/src/feedback/moderation.service.ts
    - apps/api/src/feedback/admin-posts.controller.ts
    - apps/web/components/post/activity-item.tsx
    - apps/web/components/post/status-change-dialog.tsx
    - apps/web/components/post/post-actions-menu.tsx
    - apps/api/test/moderation.test.ts
    - apps/api/test/post-edit.test.ts
  modified:
    - packages/types/src/feedback.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/portal-posts.controller.ts
    - apps/api/src/products/statuses.controller.ts
    - apps/web/components/board/post-form-dialog.tsx
    - apps/web/components/post/post-timeline.tsx
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx
    - apps/api/test/statuses.test.ts
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/e2e/comments.e2e.test.ts

key-decisions:
  - "Admins can edit and delete any post at any time; authors can only edit or delete their own post while no other user has voted or commented (D-13, D-14)"
  - "Status updates record an activity log item with snapshotted status name and color in post_activity, visible in the public timeline, but do not send emails or notifications (D-05, MOD-03)"
  - "Optimistic concurrency version preconditions are verified atomically; stale saves yield 409 edit_conflict with an in-place Reload button (D-27)"
  - "Deleting a status requires a moveTo parameter that immediately reassigns all existing posts to the replacement status within the deletion transaction"

requirements-completed: [POST-05, MOD-01, MOD-02, MOD-03]

coverage:
  - id: D1
    description: "An admin changes a post's status with a public note from the portal Admin menu, updating badge and timeline in place"
    requirement: MOD-03
    verification:
      - kind: automated
        ref: "apps/api/test/moderation.test.ts (tracer test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Authors edit and delete their own post until someone else engages; admins edit and delete any post; stale saves reject with 409 edit_conflict"
    requirement: POST-05, MOD-01, MOD-02
    verification:
      - kind: automated
        ref: "apps/api/test/post-edit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deleting a status moves its posts to the replacement status, status routes are isolated per workspace, and activity entries render in HTML"
    requirement: MOD-03
    verification:
      - kind: automated
        ref: "apps/api/test/statuses.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/cross-tenant.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/e2e/comments.e2e.test.ts"
        status: pass
    human_judgment: false
---

# Plan 03-09: Status Change, Post Edit/Delete Lock Rule, and Activity Log Summary

Plan 03-09 delivered post status changes with public notes, public activity entries on the post timeline, post edit and delete operations under the author lock rule (D-13/D-14), and automatic status deletion post reassignment.

## Accomplishments

1. **Admin Status Change & Activity Log (Task 1):**
   - Created `ModerationService.changeStatus` executing within a `FOR UPDATE` transaction, validating integer version preconditions (`edit_conflict` 409), handling same-status no-ops cleanly, and writing to `post_activity` with snapshotted status name and color.
   - Exposed `PUT /workspaces/:ws/products/:product/posts/:number/status` via `AdminPostsController` under `TenantGuard`.
   - Updated `PostsService.getPostPage` to merge `post_activity` entries with comments and stubs in the timeline sorted by `createdAt` ascending, then `id` ascending.
   - Created UI components `PostActionsMenu`, `StatusChangeDialog`, and `ActivityItem` with live timeline rendering.

2. **Author/Admin Post Edit & Delete with Lock Rule (Task 2):**
   - Implemented `PostsService.updatePost` and `deletePost` with lock-first transactions, re-evaluating `engagedSql` after acquiring the row lock. Non-admin authors are locked out (`post_locked` 403) once any other user has voted or added a non-deleted comment.
   - Implemented `PATCH` and `DELETE` endpoints in `PortalPostsController`.
   - Updated `PostFormDialog` to support edit mode with dirty checking (`Save post`, `Discard changes`), optimistic concurrency conflict handling with an inline `Reload` CTA.
   - Wired `PostActionsMenu` with `Edit post` and destructive `ConfirmDialog` for post deletion, showing the locked explanation when editing/deleting is disabled for authors.

3. **Status Reassignment & Isolation (Task 3):**
   - Replaced placeholder in `StatusesController.deleteStatus` to reassign posts to the `moveTo` status prior to deleting the status row.
   - Verified that renaming a status updates active boards while preserving historical snapshotted names and colors in existing `post_activity` timeline entries.
   - Added cross-tenant isolation test for the new status change route.
   - Verified end-to-end rendering of status activity entries with public notes in the post page HTML on the live stack.

## Verification

- Automated test suites passing:
  - `apps/api/test/moderation.test.ts` (tracer and edge cases)
  - `apps/api/test/post-edit.test.ts` (11 unit/integration tests)
  - `apps/api/test/statuses.test.ts` (including post reassignment and activity snapshot preservation)
  - `apps/api/test/cross-tenant.test.ts` (27 tenant isolation tests including the new PUT status route)
  - `apps/api/test/e2e/comments.e2e.test.ts` (live stack HTML verification of status activity)
  - `apps/api/test/e2e/statuses.e2e.test.ts`
- Zero typecheck errors across all workspaces (`bun run typecheck`).
- Zero lint warnings across all workspaces (`oxlint -c .oxlintrc.json`).
