---
phase: 02-workspaces-products-platform-owner
plan: 02
subsystem: portal-tracer
tags: [portal, tenancy, drizzle, migration, routing, public-dto, shell-split]
requires:
  - 02-01
provides:
  - Tenancy schema (workspaces, products tables with slug format and hex accent check constraints)
  - Drizzle migration 0002_portal applied at boot
  - PublicPortalProductSchema and type in @userhq/types (stripping internal UUIDs)
  - Public GET /api/v1/portal/:ws/:product guarded by PortalGuard and serialized via StandardSchemaSerializerInterceptor
  - App shell split: apps/web/app/(app) layout with AppShell (data-shell="app") and portal frame with PortalFrame (data-shell="portal")
  - Seam helper apps/web/lib/tenant.ts with portalHref()
  - StatePage and EmptyState components
  - Neutral unavailable page for suspended workspaces (workspace_suspended 403)
affects:
  - packages/db
  - packages/types
  - apps/api
  - apps/web
tech-stack:
  added: []
  patterns:
    - Public DTO allowlist with explicit column selection and Zod schema serialization
    - Fallback resolution for logoUrl and websiteUrl from product to workspace
    - Route-group shell split isolating public portals from internal app header
    - Root dynamic [ws] segment coexisting with static app segments
key-files:
  created:
    - packages/db/src/schema/tenancy.ts
    - packages/db/migrations/0002_portal.sql
    - packages/db/migrations/meta/0002_snapshot.json
    - packages/types/src/tenancy.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/api/src/portal/portal.guard.ts
    - apps/api/src/portal/portal.module.ts
    - apps/api/test/portal.test.ts
    - apps/api/test/e2e/portal.e2e.test.ts
    - apps/web/components/app-shell.tsx
    - apps/web/components/empty-state.tsx
    - apps/web/components/state-page.tsx
    - apps/web/components/portal/portal-frame.tsx
    - apps/web/app/(app)/layout.tsx
    - apps/web/app/[ws]/[product]/layout.tsx
    - apps/web/app/[ws]/[product]/page.tsx
    - apps/web/lib/tenant.ts
    - apps/web/lib/tenant.test.ts
  modified:
    - packages/db/src/index.ts
    - packages/db/migrations/meta/_journal.json
    - packages/types/src/index.ts
    - apps/api/src/app.module.ts
    - apps/web/app/layout.tsx
    - apps/web/app/not-found.tsx
    - apps/web/components/header.tsx
    - apps/web/lib/api-server.ts
    - apps/web/app/(app)/page.tsx
    - apps/web/app/(app)/login/page.tsx
    - apps/web/app/(app)/login/login-buttons.tsx
    - apps/web/app/(app)/dev/upload/page.tsx
    - apps/web/app/(app)/dev/upload/upload-form.tsx
key-decisions:
  - "D-02-02-01: Public portal endpoint runs single explicit db.select with joins to workspaces and aliased uploads (product_logo, workspace_logo) with strict field-by-field mapping to PublicPortalProductSchema."
  - "D-02-02-02: Shell split moves all Phase 1 routes into (app) route group with AppShell, freeing the root layout for portal routes to mount their own PortalFrame without inheriting the app header."
  - "D-02-02-03: Suspended workspace renders neutral StatePage within AppShell without leaking workspace/product branding or names."
requirements-completed: [PROD-04]
duration: 18 min
completed: 2026-10-03T01:45:00Z
---

# Plan 02-02 Summary: Public Portal Tracer & Shell Split

## What Was Delivered

1. **Tenancy Database Schema & Migration (0002_portal):**
   - Created `packages/db/src/schema/tenancy.ts` with `workspaces` and `products` tables.
   - Enforced database-level format checks: `workspaces_slug_format`, `products_slug_format`, `products_accent_hex`.
   - Enforced unique constraint `products_workspace_slug_unique` covering soft-deleted rows so slugs cannot be recycled.
   - Generated `migrations/0002_portal.sql` and verified migration application count matches committed SQL files.

2. **Public Allowlisted Portal API:**
   - Created `packages/types/src/tenancy.ts` with `PublicPortalProductSchema` and `PublicPortalProduct`. Added `workspace_suspended` to `API_ERROR_CODES`.
   - Created `PortalGuard` in `apps/api/src/portal/portal.guard.ts` handling slug lookup, 404 for unknown/deleted products, and 403 for suspended workspaces.
   - Created `PortalController` in `apps/api/src/portal/portal.controller.ts` with `@Public()`, explicit `db.select({...})` with two aliased joins to `uploads`, and `@SerializeOptions({ schema: PublicPortalProductSchema })`.
   - Verified that no user IDs, workspace IDs, product IDs, or upload IDs leak in JSON responses.

3. **Route Group Shell Split & Components:**
   - Moved `app/page.tsx`, `app/login/`, and `app/dev/upload/` into `apps/web/app/(app)/` with updated relative imports.
   - Created `AppShell` wrapping `<Header />` with `data-shell="app"` and main content container.
   - Root `apps/web/app/layout.tsx` stripped of header to allow clean root-level dynamic routes.
   - Created `PortalFrame` with `data-shell="portal"`, header with product name link, and "Powered by UserHQ" footer.
   - Created `EmptyState` and `StatePage` reusable feedback components.
   - Created `apps/web/lib/tenant.ts` (`portalHref`) with unit tests.

4. **Public Portal RSC Routes (`/[ws]/[product]`):**
   - Added `apiRead` and `getPortalProduct` (with `cache()`) to `apps/web/lib/api-server.ts`.
   - `app/[ws]/[product]/layout.tsx` renders `PortalFrame` on success, `notFound()` on 404, and neutral `StatePage` on 403 `workspace_suspended`.
   - `app/[ws]/[product]/page.tsx` renders coming-soon `EmptyState` with hammer icon: `"{product} is getting set up"`.

5. **Test Coverage & Verification:**
   - `apps/api/test/portal.test.ts`: 6 unit tests passing (tracer 200, 404 unknown workspace/product, 404 deleted product, 403 suspended workspace, logo fallback, and zero UUID leak assertion).
   - `apps/api/test/e2e/portal.e2e.test.ts`: 5 end-to-end tests passing against running Docker stack (200 portal shell with shell attributes, 404 unknown, 404 deleted, 200 neutral unavailable for suspended, and static `/login` beating dynamic `/[ws]`).
   - Existing Phase 1 e2e suites (`session-flow.e2e.test.ts`, `upload-page.e2e.test.ts`) passing without regressions.
   - Package builds, typechecks, and oxlint all clean with 0 errors and 0 warnings.
