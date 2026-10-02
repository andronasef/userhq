---
phase: 02-workspaces-products-platform-owner
plan: 03
subsystem: platform-owner-and-workspaces
tags: [platform-owner, workspaces, tenant-guard, validation, cross-tenant, slugs]
requires:
  - 02-01
  - 02-02
provides:
  - Platform owner identity verified email check (PLATFORM_OWNER_EMAIL + emailVerified === true)
  - workspace_members table and Drizzle migration 0003_members
  - Global StandardSchemaValidationPipe mapping Zod errors to UI-SPEC API_ERROR_CODES
  - TenantGuard enforcing tenant membership, suspension checks, and product verification
  - Workspaces API (POST /api/v1/workspaces, GET /api/v1/workspaces/:ws)
  - UI components (Input, Field with aria-describedby/aria-invalid, SlugInput, PageHeader)
  - /dashboard/new with invite-only guard and CreateWorkspaceForm
  - /dashboard/[ws] layout with data-shell="dashboard" and empty-state products page
  - Cross-tenant 404 test suite with automatic route discovery
affects:
  - packages/db
  - packages/types
  - apps/api
  - apps/web
  - compose.yaml
  - .github/workflows/ci.yml
  - .env.example
  - docs/deploy.md
tech-stack:
  added: []
  patterns:
    - Verified email platform owner identity (PLAT-01)
    - Single transaction workspace + owner member creation with onConflictDoNothing (WORK-01, WORK-02)
    - Strict cross-tenant isolation failing closed to 404
    - Auto-slug derivation with slugify and edit disconnect
key-files:
  created:
    - apps/api/src/auth/platform-owner.ts
    - apps/api/src/common/validation.ts
    - apps/api/src/tenancy/tenant.guard.ts
    - apps/api/src/tenancy/current-tenant.decorator.ts
    - apps/api/src/workspaces/workspaces.controller.ts
    - apps/api/src/workspaces/workspaces.module.ts
    - apps/api/test/workspaces.test.ts
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/support/seed.ts
    - apps/api/test/support/stack.ts
    - apps/api/test/e2e/workspace-create.e2e.test.ts
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/field.tsx
    - apps/web/components/slug-input.tsx
    - apps/web/components/page-header.tsx
    - apps/web/lib/api-client.ts
    - apps/web/app/dashboard/new/page.tsx
    - apps/web/app/dashboard/new/create-workspace-form.tsx
    - apps/web/app/dashboard/[ws]/layout.tsx
    - apps/web/app/dashboard/[ws]/page.tsx
    - packages/db/migrations/0003_members.sql
    - packages/db/migrations/meta/0003_snapshot.json
    - packages/types/src/slugs.ts
    - packages/types/src/user.ts
  modified:
    - apps/api/src/env.ts
    - apps/api/src/app.module.ts
    - apps/api/src/auth/me.controller.ts
    - apps/api/test/support/test-app.ts
    - apps/api/test/auth.test.ts
    - apps/web/lib/api-server.ts
    - packages/db/src/schema/tenancy.ts
    - packages/db/migrations/meta/_journal.json
    - packages/types/src/tenancy.ts
    - packages/types/src/index.ts
    - compose.yaml
    - .github/workflows/ci.yml
    - .env.example
    - docs/deploy.md
key-decisions:
  - "D-02-03-01: Platform owner role strictly requires verified email matching PLATFORM_OWNER_EMAIL. Platform owner role never bypasses TenantGuard."
  - "D-02-03-02: Workspace creation operates inside a single database transaction with onConflictDoNothing, preventing orphan rows or half-created workspaces."
  - "D-02-03-03: Registered global StandardSchemaValidationPipe mapping Zod issue messages into specific UI-SPEC API error codes."
  - "D-02-03-04: Cross-tenant test suite discovers all :ws routes dynamically and asserts 404 isolation across tenants."
requirements-completed: [PLAT-01, WORK-01, WORK-02]
duration: 22 min
completed: 2026-10-03T01:55:00Z
---

# Plan 02-03 Summary: Platform Owner & Workspace Creation

## What Was Delivered

1. **Platform Owner Configuration & Identity (PLAT-01):**
   - Added required `PLATFORM_OWNER_EMAIL` to `EnvSchema`, `compose.yaml`, `.github/workflows/ci.yml`, `.env.example`, and `docs/deploy.md`.
   - Created `apps/api/src/auth/platform-owner.ts` (`isPlatformOwner`), verifying `emailVerified === true` and case-insensitive email match.
   - Updated `MeController` to return `isPlatformOwner`, `canCreateWorkspace`, and workspace memberships. Anonymous callers receive `ANONYMOUS_ME`.

2. **Database Tenancy & Memberships (0003_members):**
   - Added `memberRole` enum (`owner`, `admin`) and `workspaceMembers` table to `packages/db/src/schema/tenancy.ts`.
   - Generated migration `0003_members.sql` and verified migration application count on Postgres.

3. **Global Validation Pipe & Slugs Package:**
   - Created `packages/types/src/slugs.ts` with `slugify`, `SLUG_RE`, reserved workspace/product lists, and Zod schemas.
   - Expanded `API_ERROR_CODES` with all UI-SPEC error codes (`validation_failed`, `slug_taken`, `slug_reserved`, `slug_invalid`, `name_required`, `name_too_long`, etc.).
   - Created `apps/api/src/common/validation.ts` (`StandardSchemaValidationPipe` with exception factory) and registered `APP_PIPE` in `AppModule`.

4. **TenantGuard & Workspace Endpoints (WORK-01, WORK-02):**
   - Implemented `TenantGuard` enforcing workspace membership lookup by slug, 404 for unknown/non-member, 403 for suspended workspace, and product resolution. Sets `req.tenant`.
   - Created `WorkspacesController` with `POST /api/v1/workspaces`: checks `canCreateWorkspace`, inserts workspace with `onConflictDoNothing`, inserts owner membership in a single transaction, returns 201 `{ slug }` or 409 `slug_taken`.
   - Created `WorkspaceController` with `GET /api/v1/workspaces/:ws` returning workspace metadata and member role behind `TenantGuard`.

5. **Web Pages & Components:**
   - Created UI primitives: `Input`, `Field` (handling error/helper replacement and aria attributes), `SlugInput` (with prefix span and font-mono input), and `PageHeader`.
   - Created client-safe `apiFetch` in `apps/web/lib/api-client.ts`.
   - Created `apps/web/app/dashboard/new/page.tsx` rendering invite-only message for regular users and `CreateWorkspaceForm` for platform owner.
   - Created `CreateWorkspaceForm` with React Hook Form, zodResolver, auto-slug derivation until touched, disabled state while creating, and redirect on success.
   - Created `apps/web/app/dashboard/[ws]/layout.tsx` (`data-shell="dashboard"`) and `page.tsx` displaying products empty state.

6. **Automated Test Coverage:**
   - `apps/api/test/workspaces.test.ts`: 34 tests covering tracer creation, non-owner 403, unverified owner check, uppercase email check, foreign tenant 404, reserved slugs, invalid formats, idempotency, concurrent creates race condition, and slugify diacritics/punctuation.
   - `apps/api/test/cross-tenant.test.ts`: automated route discovery asserting all non-public `:ws` routes fail with 404 for foreign tenants.
   - `apps/api/test/e2e/workspace-create.e2e.test.ts`: end-to-end tests against Docker stack validating creation, owner dashboard empty state, non-member 404, and invite-only guard.
