# Plan 09-02 Summary: Authentication & Guard Seams for Workspace API Keys

## Accomplished
- **`ApiKeyService`**:
  - Implemented secure token generation (`uhq_live_` + cryptographically secure 32 bytes).
  - SHA-256 token hashing for safe persistence (never store plaintext tokens).
  - Created `createKey`, `listKeys`, `revokeKey`, and `validateToken` methods.
  - Automatically records `lastUsedAt` upon token authentication.
- **Guards & Scope Verification**:
  - `OriginGuard`: Bypasses browser origin checking for Bearer tokens with prefix `Bearer uhq_live_`.
  - `SessionGuard`: Authenticates Bearer API tokens, validating revocation and expiration, and binding `req.apiKey` and synthetic `req.user`.
  - `TenantGuard`: Enforces tenant boundary (`apiKey.workspaceId === workspace.id`), product restrictions (`productRestrictions`), and required scopes via `@RequireScopes(...)`.
  - Created `@RequireScopes(...scopes)` decorator and applied to workspace feedback read/write endpoints.
- **ApiKeys Module & Controller**:
  - Created `apps/api/src/api-keys/api-keys.controller.ts` providing:
    - `GET /api/v1/workspaces/:ws/api-keys` (list keys)
    - `POST /api/v1/workspaces/:ws/api-keys` (create key)
    - `DELETE /api/v1/workspaces/:ws/api-keys/:id` (revoke key)
- **Tests**:
  - `apps/api/test/cross-tenant.test.ts`: Verified 78/78 tests pass including 404 tenant isolation on all API key endpoints.
  - `apps/api/test/api-keys.test.ts`: 8/8 comprehensive tests passing:
    1. Key creation and one-time token delivery
    2. Listing keys (only keyPrefix and metadata exposed, no tokens/hashes)
    3. Bearer authentication without browser origin header
    4. Rejection of invalid/fake tokens (401 `api_key_invalid`)
    5. Product restriction enforcement (403 `product_restricted`)
    6. Key revocation blocking subsequent requests (401 `api_key_revoked`)
    7. Cross-workspace tenant isolation (404 Not Found)
    8. Granular scope enforcement (403 `insufficient_scope`)
  - `apps/api/test/workspace-feedback.test.ts`: Verified all 10 existing tests pass.
- **Type Checking**:
  - Monorepo typecheck passed cleanly with 0 errors across `@userhq/types`, `@userhq/db`, `@userhq/api`, and `@userhq/web`.
