---
phase: 03-feedback-board-conversations
plan: 08
subsystem: api-web
tags: [comments, threads, optimistic-concurrency, stubs, throttler, isolation]

# Dependency graph
requires: ["03-01", "03-02", "03-04", "03-06"]
provides:
  - "CommentsService with lock-first transaction, 1-level reply normalization (D-16), optimistic concurrency edit/delete (version bump, 409 edit_conflict), and shapeTimeline with deleted-comment stubs"
  - "PortalCommentsController with POST /posts/:number/comments (throttled 10/min), PATCH /comments/:id, and DELETE /comments/:id"
  - "Post-create write throttling at 5/min on PortalPostsController (POST /posts)"
  - "PostTimeline, CommentComposer, CommentItem, CommentActionsMenu, and SignInPrompt components"
  - "Server-snapshot authorIsAdmin from workspace membership at comment write time (T-03-21 mitigation)"
  - "Deleted comment stubs emitting kind: 'stub' with zero author and body data when visible replies exist (T-03-23 mitigation)"
  - "Product tenant isolation on comment PATCH and DELETE (T-03-24 mitigation)"
affects: [03-09, 03-10, 03-11, 03-12]

actuals:
  tokens: 42000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Lock-first transaction (.for('update')) on parent post when inserting comments"
    - "Single-level reply tree: child replies to a reply normalize their parentId to the top-level parent comment"
    - "Optimistic concurrency via atomic version checking: WHERE id = $id AND version = $version, returning 409 edit_conflict on mismatch"
    - "Soft delete via deleted_at timestamp with stub tombstone emission when visible replies remain"
    - "Per-user rate throttling with UserThrottlerGuard (5 posts/min, 10 comments/min)"
    - "Signed-out deep linking with return hash: /login?next=/{ws}/{product}/p/{ref}#comment or #comment-{id}"

key-files:
  created:
    - apps/api/src/feedback/comments.service.ts
    - apps/api/src/feedback/portal-comments.controller.ts
    - apps/api/test/comments.test.ts
    - apps/api/test/e2e/comments.e2e.test.ts
    - apps/web/components/post/comment-composer.tsx
    - apps/web/components/post/comment-item.tsx
    - apps/web/components/post/comment-actions-menu.tsx
    - apps/web/components/post/post-timeline.tsx
    - apps/web/components/post/sign-in-prompt.tsx
  modified:
    - packages/types/src/feedback.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/portal-posts.controller.ts
    - apps/api/test/portal-isolation.test.ts
    - apps/api/test/support/seed.ts
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx

key-decisions:
  - "Comments are strictly one level deep: any reply targeting an existing reply is flattened to the root parent comment (D-16)"
  - "Deleted comments are never physically deleted: soft-deleted comments with active replies render '[Comment deleted]' stubs without leaking author name or text (D-18)"
  - "Optimistic concurrency version checks on comment edits reject stale edits with 409 edit_conflict and provide an in-place reload action (D-27)"
  - "Admin badge is determined solely on the server via workspace membership at write time; client input schemas reject or strip any client-supplied isAdmin fields (D-15, T-03-21)"
  - "Write rate limits are enforced per-user using UserThrottlerGuard: 5 posts/min and 10 comments/min (T-03-26)"

requirements-completed: [CMNT-01, CMNT-02, CMNT-03, CMNT-04, AUTH-04, PROD-06, MOD-01, MOD-02]

coverage:
  - id: D1
    description: "Signed-in user can submit a top-level comment and view it in the post timeline"
    requirement: CMNT-01
    verification:
      - kind: automated
        ref: "apps/api/test/comments.test.ts (tracer test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Comment by workspace member carries author.isAdmin true; non-member carries false; forged input stripped"
    requirement: CMNT-02
    verification:
      - kind: automated
        ref: "apps/api/test/comments.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Author can edit own comment with version bump; stale edit yields 409 edit_conflict"
    requirement: CMNT-03
    verification:
      - kind: automated
        ref: "apps/api/test/comments.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Author or workspace admin can delete comment; deleted comment with replies renders stub, without replies disappears"
    requirement: CMNT-04, MOD-01, MOD-02
    verification:
      - kind: automated
        ref: "apps/api/test/comments.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/e2e/comments.e2e.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Signed-out visitor sees sign-in prompt redirecting to /login?next=...#comment"
    requirement: AUTH-04
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/comments.e2e.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Comment PATCH and DELETE isolated per product (cross-tenant ID yields 404 comment_not_found)"
    requirement: PROD-06
    verification:
      - kind: automated
        ref: "apps/api/test/portal-isolation.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Post creation throttled at 5/min and comment creation at 10/min (429 rate_limited)"
    requirement: CMNT-01, POST-01
    verification:
      - kind: automated
        ref: "apps/api/test/comments.test.ts"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 08: The Conversation (Comments, Threads, Stubs, Concurrency) Summary

Plan 03-08 delivers the complete commenting and discussion system for feedback posts on public product portals.

## What Was Delivered

1. **Comments Service & API Contracts**:
   - `createComment`: Locks the target post using `.for("update")`, snapshots workspace membership for `authorIsAdmin`, normalizes nested replies to 1 level (reply-to-reply becomes reply-to-parent), and increments `post.comment_count`.
   - `updateComment`: Optimistic concurrency check (`WHERE id = $id AND version = $version`). On mismatch, returns 409 `edit_conflict`. On success, bumps `version` and sets `edited_at`.
   - `deleteComment`: Soft deletes via `deleted_at = now()` and records `deleted_by_id`. Only author or workspace admin can delete (403 `not_allowed` otherwise).
   - `shapeTimeline`: Merges top-level comments and replies. Deleted top-level comments with visible replies emit `{ kind: "stub", id, replies }` with zero author or body text. Deleted comments with no active replies vanish from public output.

2. **Web UI Components**:
   - `PostTimeline`: Renders top-level comments and 1-level replies. Supports replying with preserved draft state per thread. Displays deleted stubs (`[Comment deleted]`).
   - `CommentItem`: Displays author metadata, relative timestamps, admin badges, and edited markers. Supports in-place editing with Esc/Save and conflict reloading.
   - `CommentComposer`: Auto-expanding textarea with character counters, keyboard shortcuts (Cmd+Enter), and error banners.
   - `CommentActionsMenu`: Dropdown menu for edit and delete actions, guarded by `canEdit` / `canDelete`. Includes author-vs-admin confirmation dialogs for delete.
   - `SignInPrompt`: Renders for signed-out visitors with link to `/login?next=...#comment`.

3. **Rate Limiting & Security Defenses**:
   - Added `UserThrottlerGuard` to `POST /portal/:ws/:product/posts` (limit: 5/min) and `POST /portal/:ws/:product/posts/:number/comments` (limit: 10/min).
   - Cross-tenant comment access strictly returns 404 `comment_not_found` by scoping all queries to the portal's `productId`.
   - Input schemas strip any client-supplied `isAdmin` or `authorIsAdmin` fields, making badge forgery impossible.

4. **Automated Verification**:
   - Unit & integration tests in `comments.test.ts`, `portal-isolation.test.ts`, and `posts.test.ts`.
   - End-to-end tests against the live Docker stack in `comments.e2e.test.ts` verifying signed-out prompts and stub data secrecy in rendered HTML.
