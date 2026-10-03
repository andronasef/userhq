# Plan 02-09 Summary: Status Management, Reordering, Safeguards & Accessibility

## Plan Outcome
All tasks in Plan 02-09 (STAT-02, STAT-03, STAT-04, STAT-05) have been implemented and verified against unit, integration, cross-tenant isolation, end-to-end container stack, and real browser Playwright tests.

### Key Changes
1. **Shared Types & Schemas (`packages/types/src/tenancy.ts`):**
   - Added `StatusNameSchema` (1-30 chars, trimmed, custom message `name_required` and `name_too_long`).
   - Added `StatusTypeSchema` (enum: `review`, `planned`, `active`, `completed`, `closed`).
   - Added `StatusSchema` (`id`, `name`, `color`, `type`, `position`, `isDefault`).
   - Added input schemas: `CreateStatusInputSchema`, `UpdateStatusInputSchema` (`.partial()`), `ReorderStatusesInputSchema` (`ids` UUID array).

2. **Database Error Utility (`apps/api/src/common/db-errors.ts`):**
   - Created `isUniqueViolation(e: unknown, constraint?: string): boolean` inspecting PostgreSQL error `23505` and nested Drizzle cause constraints.

3. **Backend API (`apps/api/src/products/statuses.controller.ts`):**
   - `GET /api/v1/workspaces/:ws/products/:product/statuses`: Returns product statuses ordered by position asc, id asc.
   - `POST /api/v1/workspaces/:ws/products/:product/statuses`: Inside transaction computes position as max + 1; handles unique name collisions (`409 status_name_taken`).
   - `PATCH /api/v1/workspaces/:ws/products/:product/statuses/:statusId`: Updates name, type, or color; handles unique collisions.
   - `PUT /api/v1/workspaces/:ws/products/:product/statuses/:statusId/default`: Atomically updates default status via two-statement transaction (unset old default, set new default); preserves invariant of exactly one default status.
   - `PUT /api/v1/workspaces/:ws/products/:product/statuses/order`: Row-locking transaction verifies exact permutation of product's status IDs; sets 0..n positions.
   - `DELETE /api/v1/workspaces/:ws/products/:product/statuses/:statusId?moveTo=:targetId`: Locks both rows; rejects deleting default status (`400 delete_default_status`); carries marked comments for Phase 3 posts and Phase 4 roadmap items reassignment.
   - Registered `StatusesController` in `ProductsModule`.

4. **Frontend Web & UI:**
   - **Dialog Primitives (`apps/web/components/ui/dialog.tsx`):** Radix Dialog wrapper with close button aria-label "Close dialog".
   - **Native Select (`apps/web/components/ui/native-select.tsx`):** ForwardRef select component with `ChevronDown` adornment.
   - **Status Dialog (`apps/web/components/dashboard/status-dialog.tsx`):** RHF + Zod resolver modal for add/edit status; includes Name, Type select, ColorField, "Discard changes" button, and field-level error mapping.
   - **Sortable Status List (`apps/web/components/dashboard/status-list.tsx`):**
     - Single-list sortable powered by `@dnd-kit/react` and `@dnd-kit/react/sortable` (zero `@dnd-kit/helpers` dependencies).
     - GripVertical handle (`cursor-grab`, aria-label "Reorder {name}").
     - 10-preset / hex color dot, name truncated with title tooltip, type badge, and neutral "Default" badge.
     - Row actions menu with "Edit status", "Make default", and "Delete status".
     - Visible safeguard messages when delete is disabled ("The default status can't be deleted", "A product needs at least one status").
     - Reassignment ConfirmDialog with "Move its posts to" dropdown preselecting the default status.
     - Optimistic reordering with serialized promise save queue; rollback on failure with toast "Couldn't save the new order. Try again.".
     - Live-region announcements (`aria-live="assertive"`) with all four UI-SPEC strings.
   - **Statuses Page (`apps/web/app/dashboard/[ws]/[product]/statuses/`):** Statuses view page with "Add status" action button.
   - **Navigation Updates (`apps/web/components/dashboard/sidebar.tsx`, `[product]/page.tsx`, `[ws]/page.tsx`):**
     - Added "Statuses" link with `CircleDot` icon in product navigation above Settings.
     - Direct product clicks redirect to `/statuses`.

5. **Testing & Verification:**
   - **API Integration Tests (`apps/api/test/statuses.test.ts`):** 9 comprehensive test suites covering tracer, field validations, unique name collisions, default switching, safeguards against deleting default/lone status, concurrent delete races, invariant test verifying exactly one default status, and reordering permutation validation.
   - **Cross-Tenant Test Suite (`apps/api/test/cross-tenant.test.ts`):** All 6 status routes tested with cross-workspace isolation and foreign status ID injection (21 tests passing).
   - **E2E Tests (`apps/api/test/e2e/statuses.e2e.test.ts`):** Container stack test verifying product statuses page renders seeded statuses and "Default" badge.
   - **Playwright Browser Tests (`apps/api/test/browser/status-reorder.spec.ts`):**
     - Pointer test: drags "Declined" above "Under Review", waits for PUT `/order`, verifies DOM order, reloads page, and verifies persisted order.
     - Keyboard test: focuses "Reorder Planned", presses Space, ArrowDown twice, Space, waits for PUT `/order`, verifies live-region text contains "dropped at position", reloads page, and verifies persisted order.

## Verification Results
- `bun run typecheck`: Passed (0 errors across `@userhq/web`, `@userhq/api`, `@userhq/db`, `@userhq/types`).
- `oxlint -c .oxlintrc.json`: Passed (0 warnings, 0 errors on 177 files).
- `apps/web` vitest: Passed (51/51 tests passing).
- `apps/api` vitest: Passed (30/30 tests passing across statuses and cross-tenant suites).
- `apps/api` e2e test: Passed (1/1 tests passing).
- `apps/api` browser test: Passed (2/2 tests passing: pointer and keyboard reorder + reload backstop).
