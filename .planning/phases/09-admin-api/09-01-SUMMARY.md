# Plan 09-01 Summary: DB Schema, Migration & Types for Workspace API Keys

## Accomplished
- **Database Schema**:
  - Created `packages/db/src/schema/api-keys.ts` with `workspaceApiKeys` table and relations.
  - Added `createdByApiKeyId` foreign key referencing `workspaceApiKeys.id` to both `posts` and `comments` in `packages/db/src/schema/feedback.ts`.
  - Re-exported `apiKeysSchema` from `packages/db/src/index.ts`.
- **Contracts & Validation Types**:
  - Created `packages/types/src/api-keys.ts` with explicit scopes: `admin`, `requests:read`, `requests:write`, `comments:read`, `comments:write`, `roadmap:read`, `roadmap:write`, `changelog:read`, `changelog:write`, `export:read`.
  - Defined Zod schemas and TypeScript types for `createApiKeySchema`, `apiKeyMetadataSchema`, and `createdApiKeyResponseSchema`.
  - Re-exported from `packages/types/src/index.ts` and added API key error codes to `API_ERROR_CODES`.
- **Database Migration**:
  - Generated and committed `packages/db/migrations/0015_workspace_api_keys.sql`.
  - Applied migration 0015 to PostgreSQL (`migrations: up to date (16 applied in total)`).
- **Type Checking**:
  - Monorepo typecheck passed cleanly with 0 errors across `@userhq/types`, `@userhq/db`, `@userhq/api`, and `@userhq/web`.
