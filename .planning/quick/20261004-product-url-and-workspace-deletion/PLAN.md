---
task: product-url-and-workspace-deletion
description: "Allow changing product URL (slug) without breaking other URLs, and allow workspace owners to delete workspace with all its products"
type: quick
status: in-progress
created: 2026-10-04
---

# Quick Plan: Product URL Change & Workspace Deletion

Allow changing a product's URL (slug) with uniqueness/format validation, and allow workspace owners to delete their entire workspace along with all of its products.

## Tasks

### Task 1: Product URL (Slug) Modification
- Update `UpdateProductInputSchema` in `packages/types/src/tenancy.ts` to include optional `slug: productSlugSchema`.
- In `apps/api/src/products/products.controller.ts`:
  - When `input.slug` is provided and differs from the current slug:
    - Check for conflicting product slug within the same workspace (`workspaceId` match, `id` different).
    - If conflict, reject with 409 `slug_taken`.
    - Format and reserved slug checks are handled by `productSlugSchema` (rejects 400).
    - Update `products.slug`.
- In `apps/web/app/dashboard/[ws]/[product]/settings/product-general-form.tsx`:
  - Make `SlugInput` an editable field registered to `slug`.
  - Add helper text and map `errors.slug`.
  - On submit success, if `updated.slug !== product.slug`, redirect to the new settings URL `/dashboard/${ws}/${updated.slug}/settings`.
- Add integration tests in `apps/api/test/products.test.ts`.

### Task 2: Workspace Deletion
- In `apps/api/src/workspaces/workspaces.controller.ts`:
  - Add `DELETE /workspaces/:ws`.
  - Validate caller is workspace `"owner"` (403 forbidden otherwise).
  - In a transaction, mark `workspaces.deleted_at = now()` and mark all its active products `products.deleted_at = now()`.
- In `apps/api/test/cross-tenant.test.ts`:
  - Register `"DELETE /workspaces/:ws"` in `CROSS_TENANT_ROUTES`.
- In `apps/web/app/dashboard/[ws]/settings/workspace-settings-forms.tsx`:
  - Add `WorkspaceDangerZone` when `workspace.role === "owner"`.
  - Render confirmation dialog requiring typing the workspace name.
  - Call `DELETE /api/v1/workspaces/${ws}` and redirect to `/dashboard`.
- Add integration tests in `apps/api/test/workspaces.test.ts`.
