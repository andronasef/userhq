# Plan 02-08 Summary: Product Creation, Seeded Statuses, Branding & Soft Deletion

## Plan Outcome
All tasks in Plan 02-08 (PROD-01, PROD-02, PROD-03, STAT-01) have been implemented and verified against the unit, integration, cross-tenant isolation, end-to-end container stack, and database migration parity checks.

### Key Changes
1. **Database Schema & Migrations:**
   - Added `statusType` pgEnum (`review`, `planned`, `active`, `completed`, `closed`).
   - Added `statuses` table with:
     - `productId` UUID referencing `products.id` on delete cascade.
     - Partial unique index `statuses_one_default` enforcing exactly one default status per product where `is_default = true`.
     - Unique index `statuses_product_name_ci` enforcing case-insensitive unique status names per product.
     - Composite unique constraint `statuses_id_product_unique` on `(id, productId)` for Phase 3 composite FK referencing.
     - Position index `statuses_product_position_idx`.
     - Check constraint `statuses_color_hex` ensuring valid uppercase 6-digit hex.
   - Generated and applied migration `0005_statuses.sql`.
   - Verified schema parity with `drizzle-kit check` and database migration counts.

2. **Shared Types & Constants:**
   - Created `packages/types/src/palette.ts`:
     - `HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/`
     - `DEFAULT_ACCENT = "#2563EB"`
     - `PALETTE`: 10 curated preset swatches (Gray, Red, Orange, Amber, Green, Teal, Blue, Indigo, Purple, Pink).
     - `STATUS_TYPES`: `["review", "planned", "active", "completed", "closed"]`.
     - `SEEDED_STATUSES`: 5 starter statuses with their names, types, hex colors, and default marker (`Under Review` default).
   - Re-exported from `packages/types/src/index.ts`.
   - Added Zod schemas to `packages/types/src/tenancy.ts`:
     - `HexColorSchema`, `WebsiteUrlSchema`, `TaglineSchema`
     - `CreateProductInputSchema`, `ProductCreatedSchema`
     - `ProductSummarySchema`, `ProductDetailSchema`, `UpdateProductInputSchema` (with slug intentionally omitted to ensure immutability).

3. **Backend API (`apps/api/src/products/`):**
   - Implemented `ProductsController` with `TenantGuard` and `StandardSchemaSerializerInterceptor`:
     - `POST /api/v1/workspaces/:ws/products`: Validates logo upload ownership; inserts product and seeds all 5 statuses atomically inside a single `db.transaction`; handles conflicts with 409 `slug_taken`.
     - `GET /api/v1/workspaces/:ws/products`: Lists non-deleted products ordered alphabetically by `name`, then `slug`.
     - `GET /api/v1/workspaces/:ws/products/:product`: Returns product details including logo URL, tagline, website, accent.
     - `PATCH /api/v1/workspaces/:ws/products/:product`: Updates product details with logo ownership check on change; ignores slug to ensure immutable URLs.
     - `DELETE /api/v1/workspaces/:ws/products/:product`: Performs soft deletion by updating `deleted_at = now() WHERE deleted_at IS NULL`; preserves database row and statuses; returns 204 or 404.
   - Registered `ProductsModule` in `app.module.ts`.

4. **Frontend Web & UI:**
   - **Accent & Color (`apps/web/lib/accent.ts`, `components/color-field.tsx`):**
     - Implemented `accentTokens(hex)` and `contrastRatio(hex1, hex2)` using WCAG 2.x relative luminance.
     - Implemented accessible `ColorField` with `role="radiogroup"` wrapping swatches and custom hex input.
   - **EntityLogo Update (`apps/web/components/entity-logo.tsx`):**
     - Added `style` prop support for `--entity-accent` styling.
   - **Sidebar Navigation (`apps/web/components/dashboard/sidebar.tsx`, `layout.tsx`):**
     - Updated layout to fetch and pass `getProducts(ws)`.
     - Added "+" button linking to `/dashboard/{ws}/new`.
     - Rendered product items with 20px `EntityLogo` and expandable nested links (`Settings` and `View portal` linking to public portal in a new tab).
   - **Products Overview (`apps/web/app/dashboard/[ws]/page.tsx`):**
     - Displays products list with 40px logo, link to settings, monospace `/{ws}/{product}`, and "View portal" button.
     - Empty state with "Create product" button.
   - **New Product Page (`apps/web/app/dashboard/[ws]/new/`):**
     - `CreateProductForm` with auto-slug derivation, `SlugInput`, `LogoField`, and loading states.
   - **Product Settings Page (`apps/web/app/dashboard/[ws]/[product]/settings/`):**
     - `ProductGeneralForm`: Name, read-only URL with Copy URL button, Logo, Tagline with character count, Website URL.
     - `ProductBrandingForm`: ColorField with live `AccentPreview` panel and note for light colors.
     - `ProductDangerZone`: Soft delete requiring exact case-sensitive trimmed product name confirmation via `ConfirmDialog`.

5. **Testing & Verification:**
   - **Web Tests (`apps/web/lib/accent.test.ts`):** 5 unit tests validating contrast ratios, fallback behavior, and uppercase formatting across all palette swatches.
   - **API Integration Tests (`apps/api/test/products.test.ts`):** 13 comprehensive tests covering tracer flow, accent color validation, soft delete, repeat delete, concurrent delete races, slug reservation, cross-workspace identical slugs, concurrent create races, double submit, and alphabetical ordering.
   - **Cross-Tenant Test Suite (`apps/api/test/cross-tenant.test.ts`):** Added all 5 product routes to `CROSS_TENANT_ROUTES` + foreign product slug test on workspace A; 14 tests passing.
   - **E2E Tests (`apps/api/test/e2e/products.e2e.test.ts`):** Full stack test with containerized services: creates product, verifies overview page contains product name and "View portal", and verifies public portal `/{ws}/{p}` is live.
   - **Migration Check:** Verified 6 committed migrations match 6 applied migrations in database `drizzle.__drizzle_migrations`.

## Verification Results
- `bun run typecheck`: Passed (0 errors across `@userhq/web`, `@userhq/api`, `@userhq/db`, `@userhq/types`).
- `oxlint -c .oxlintrc.json`: Passed (0 warnings, 0 errors on 166 files).
- `apps/web` vitest: Passed (51/51 tests passing).
- `apps/api` vitest: Passed (33/33 tests passing).
- `apps/api` e2e test: Passed (1/1 tests passing).
- Database migration check: Passed (`drizzle-kit check`, migration count parity verified).
