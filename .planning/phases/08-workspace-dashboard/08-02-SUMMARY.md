# Plan 08-02: Backend API Endpoints & Services Summary

**Completed:** 2026-11-06  
**Status:** Complete  
**Tests:** 10 passed (`bun --filter '@userhq/api' test test/workspace-feedback.test.ts`)

---

## 1. Accomplishments

1. **WorkspaceFeedbackService (`apps/api/src/feedback/workspace-feedback.service.ts`)**:
   - `listRequests`: queries all posts belonging to products within the workspace (`products.workspaceId = tenant.workspaceId`), joins `statuses`, `categories`, `user`, and `uploads` for product logo. Supports filtering by `product`, `statusId`, `statusType`, `categoryId`, and full-text `search` with cursor pagination and total count.
   - `listComments`: queries comments across workspace products, computes total `needsAttentionCount` (`isAdmin = false AND handledAt IS NULL`), tracks personal unread state via `commentReads`, supports `attention` filter (`needs_attention`, `handled`, `all`), and cursor pagination.
   - `markCommentHandled`: sets `handledAt = now()`, `handledById = user.id`.
   - `reopenComment`: clears `handledAt = null`, `handledById = null`.
   - `replyToComment`: in transaction, adds an admin reply comment and marks parent customer comment handled.
   - `markCommentRead`: upserts current user's read timestamp into `commentReads` on conflict update.

2. **WorkspaceFeedbackController (`apps/api/src/feedback/workspace-feedback.controller.ts`)**:
   - Controller mounted at `workspaces/:ws` with `@UseGuards(TenantGuard)` and `@UseInterceptors(StandardSchemaSerializerInterceptor)`.
   - `GET /api/v1/workspaces/:ws/requests`
   - `GET /api/v1/workspaces/:ws/comments`
   - `POST /api/v1/workspaces/:ws/comments/:id/handled`
   - `DELETE /api/v1/workspaces/:ws/comments/:id/handled`
   - `POST /api/v1/workspaces/:ws/comments/:id/reply`
   - `POST /api/v1/workspaces/:ws/comments/:id/read`

3. **FeedbackModule (`apps/api/src/feedback/feedback.module.ts`)**:
   - Registered `WorkspaceFeedbackController` in `controllers`.
   - Registered `WorkspaceFeedbackService` in `providers` and `exports`.

4. **Integration Test Suite (`apps/api/test/workspace-feedback.test.ts`)**:
   - 10 comprehensive tests covering:
     - Cross-product aggregation across multiple products.
     - Product, category, and full-text search filtering.
     - Tenant boundary isolation (non-member 404).
     - Needs attention count and filtering.
     - Admin marking handled and reopening attention.
     - Admin reply automatically marking parent comment handled.
     - Independent personal unread tracking without impacting team handled status.

---

## 2. Next Step

Proceed to **Plan 08-03: Frontend Workspace Dashboard Tabs & UI**.
- Transform `/dashboard/[ws]` page into unified dashboard tabs:
  - Tab 1: **Products** (the current product list, create product button, settings).
  - Tab 2: **Requests (All Boards)** (unified cross-product request list, filter by product, status type, category, search, sorting).
  - Tab 3: **Comments / Inbox** (cross-product comment feed with "Needs attention" badge, filter by attention status, quick reply modal/inline box, mark handled toggle, personal unread highlight).
