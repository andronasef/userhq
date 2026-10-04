# Quick Task Summary: Product URL Editing & Workspace Deletion

**Date:** 2026-10-04  
**Status:** Completed  
**Branch:** main  

## User Request
> "the user could change the product url if it doesnot break any other url and could delete workspace (but deletes the whole workspace with all products)"

---

## 1. Product URL (Slug) Modification
- **Type Definitions (`packages/types/src/tenancy.ts`)**:
  - Added `slug: productSlugSchema.optional()` to `UpdateProductInputSchema`.
  - Rebuilt package dists (`bun run build:packages`).
- **Backend API (`apps/api/src/products/products.controller.ts`)**:
  - In `updateProduct`:
    - Validates `input.slug` with `productSlugSchema` (rejects invalid slug patterns with 400 `slug_invalid` and reserved names with 400 `slug_reserved`).
    - Checks for collisions within the workspace: if another product in the workspace already uses this slug, rejects with 409 `slug_taken`.
    - If valid and unique (or unchanged), updates `products.slug`.
- **Frontend Dashboard (`apps/web/app/dashboard/[ws]/[product]/settings/product-general-form.tsx`)**:
  - Replaced read-only URL input with editable `SlugInput` bound to `register("slug")`.
  - Added helper text explaining that changing the URL updates the portal address.
  - Linked error mapping for `slug` (`slug_taken`, `slug_invalid`, `slug_reserved`).
  - On submit success, if `updated.slug !== product.slug`, redirects seamlessly to `/dashboard/[ws]/[newSlug]/settings`.

---

## 2. Workspace Deletion (Cascading to all Products)
- **Backend API (`apps/api/src/workspaces/workspaces.controller.ts`)**:
  - Added `DELETE /workspaces/:ws` endpoint with `@HttpCode(HttpStatus.NO_CONTENT)`.
  - Enforces `tenant.role === "owner"`; non-owner admins receive 403 `forbidden`.
  - Runs in a database transaction:
    - Soft-deletes the workspace: `UPDATE workspaces SET deleted_at = now() WHERE id = tenant.workspaceId`.
    - Soft-deletes all active products in that workspace: `UPDATE products SET deleted_at = now() WHERE workspace_id = tenant.workspaceId AND deleted_at IS NULL`.
- **Cross-Tenant Guard Verification (`apps/api/test/cross-tenant.test.ts`)**:
  - Registered `DELETE /workspaces/:ws` in `CROSS_TENANT_ROUTES` ensuring isolation verification passes.
- **Frontend Dashboard (`apps/web/app/dashboard/[ws]/settings/workspace-settings-forms.tsx`)**:
  - Added `WorkspaceDangerZone` component (visible only when `workspace.role === "owner"`).
  - Includes a destructive "Delete workspace" button with a `ConfirmDialog`.
  - Requires the user to type the workspace name to confirm deletion.
  - On confirm, sends `DELETE /api/v1/workspaces/[ws]`, flashes a toast (`"[Workspace name] deleted"`), and redirects to `/dashboard`.

---

## 3. Verification & Test Results
- **API Unit & Integration Tests**:
  - `apps/api/test/products.test.ts`: Added tests for successful slug updating, 404 on old slug, 200 on new slug, portal availability, conflict rejection (409 `slug_taken`), reserved slug rejection (400 `slug_reserved`), and invalid format rejection (400 `slug_invalid`).
  - `apps/api/test/workspaces.test.ts`: Added tests for 403 when non-owner attempts deletion, 204 when owner deletes, 404 on subsequent workspace access, DB soft-deletion of workspace and all its products, and portal 404s.
  - All 27 test files and 346 tests passed:
    ```
    Test Files  27 passed (27)
    Tests       346 passed (346)
    ```
- **Typecheck & Lint**:
  - `bun run typecheck`: Passed across `@userhq/types`, `@userhq/db`, `@userhq/api`, `@userhq/web` (0 errors).
  - `bun run lint`: Passed across 280 files (0 errors, 0 warnings).
