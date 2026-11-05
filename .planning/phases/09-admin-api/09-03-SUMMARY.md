# Plan 09-03 Summary: Core Automation Endpoints & Bulk Feedback Export

## Accomplished
- **Feedback Export Types (`@userhq/types`)**:
  - Created `packages/types/src/export.ts` with `FeedbackExportQuerySchema`, `FeedbackExportResponseSchema`, `FeedbackExportItemSchema`, and `FeedbackExportCommentSchema`.
  - Re-exported from `@userhq/types` index.
- **Bulk Feedback Export Module & Service (`ExportModule`, `ExportService`, `ExportController`)**:
  - Implemented `ExportService.exportFeedback`:
    - Deterministic cursor-based pagination using `(createdAt, id)` tuple with base64url cursor serialization.
    - Workspace-isolated queries filtering deleted posts and deleted products.
    - Optional filters: `productId` filter and `since` timestamp filter.
    - Nested comments fetching for page items with audit attribution (`createdByApiKeyId`), author info, and admin badge status.
  - Implemented `ExportController` with route:
    - `GET /api/v1/workspaces/:ws/export/feedback`
    - Protected by `TenantGuard` and `@RequireScopes("export:read")`.
  - Registered `ExportModule` in `AppModule`.
- **API Key Audit Attribution & Automation Integration**:
  - `posts.service.ts`: Updated `createPost` to accept `apiKeyId?: string | null` and persist `createdByApiKeyId`.
  - `comments.service.ts`: Updated `createComment` to accept `apiKeyId?: string | null` and persist `createdByApiKeyId`.
  - `workspace-feedback.service.ts`: Updated `replyToComment` to accept `apiKeyId?: string | null` and persist `createdByApiKeyId`.
  - `workspace-feedback.controller.ts`: Passed `req.apiKey?.id` to `replyToComment`.
  - `admin-posts.controller.ts`:
    - Added `POST /api/v1/workspaces/:ws/products/:product/posts` route with `@RequireScopes("requests:write")` and audit attribution to enable headless post creation by admin API keys.
    - Added `@RequireScopes` decorators for all post endpoints (list, get, comments, status change, merge, restore).
  - `admin-comments.controller.ts`: Added `@RequireScopes("comments:write")` and `@RequireScopes("comments:read")`.
  - `roadmap.controller.ts`: Added `@RequireScopes("roadmap:read")` and `@RequireScopes("roadmap:write")`.
  - `changelog.controller.ts`: Added `@RequireScopes("changelog:read")` and `@RequireScopes("changelog:write")`.
  - `api-keys.controller.ts`: Added `@RequireScopes("admin")` to key management endpoints.
- **Session & Guard Polish**:
  - Added `image: null` to synthetic API key user in `SessionGuard` to strictly satisfy `PublicAuthorSchema` validation.
  - Safe nullish defaults for `author.name` and `author.image` in comment creation.
- **Tests**:
  - `apps/api/test/export.test.ts`: 9/9 tests passing:
    1. Rejects unauthenticated requests to export feedback (401).
    2. Rejects API key without `export:read` scope (403 `insufficient_scope`).
    3. Creates posts and comments with API key and verifies `createdByApiKeyId` is stamped in the database.
    4. Exports all feedback across products using `exportApiKey` with nested comments and attribution.
    5. Supports admin scope API key to access export endpoint.
    6. Filters feedback export by `productId`.
    7. Filters feedback export by `since` timestamp.
    8. Supports deterministic cursor pagination with limit and cursor.
    9. Enforces cross-workspace isolation on export endpoint (404 anti-enumeration).
  - `apps/api/test/cross-tenant.test.ts`: 80/80 tests passing (updated with `GET /workspaces/:ws/export/feedback` and `POST /workspaces/:ws/products/:product/posts`).
  - `apps/api/test/api-keys.test.ts`: 8/8 tests passing.
  - `apps/api/test/workspace-feedback.test.ts`: 10/10 tests passing.
- **Type Checking**:
  - Monorepo typecheck passed cleanly with 0 errors across `@userhq/types`, `@userhq/db`, `@userhq/web`, and `@userhq/api`.
