# Plan 02-10 Summary: Public Directory, Portal Branding, Open Graph & Workspace Settings

## Plan Outcome
All tasks in Plan 02-10 (PROD-04, PROD-05, D-07 through D-11) have been implemented and verified against unit, integration, cross-tenant isolation, end-to-end container stack, and real browser Playwright backstops.

### Key Changes
1. **Shared Types & Schemas (`packages/types/src/tenancy.ts`):**
   - Added `PublicPortalDirectorySchema` (`workspace: { slug, name, logoUrl, websiteUrl }`, `directoryEnabled`, `products: [{ slug, name, tagline, accentColor, logoUrl }]`).
   - Extended `WorkspaceSchema` with `websiteUrl: z.string().nullable()` and `directoryEnabled: z.boolean()`.
   - Added `UpdateWorkspaceInputSchema` (`name`, `logoUploadId`, `websiteUrl`, `directoryEnabled`).

2. **Public Directory API (`apps/api/src/portal/portal.controller.ts`):**
   - Added `@Get(":ws")` with `PortalGuard` and `@SerializeOptions({ schema: PublicPortalDirectorySchema })`.
   - Returns live products ordered by name, then slug, falling back to workspace logo if product logo is absent.
   - Preserves strict anonymity (zero internal IDs, user IDs, or member information leaked).
   - Added route to `public-contract.test.ts` to assert serializer schema compliance.

3. **Workspace Settings API (`apps/api/src/workspaces/workspaces.controller.ts`):**
   - Added `@Patch()` on `WorkspaceController` (`/api/v1/workspaces/:ws`) with `TenantGuard` and `StandardSchemaSerializerInterceptor`.
   - Supports updating name, logo, website (HTTPS-only validation), and directory visibility toggle.
   - Validates logo upload ownership; preserves slug immutability.
   - Added route to `cross-tenant.test.ts` verifying 404 on cross-tenant access.

4. **Product Directory Page (`apps/web/app/[ws]/page.tsx`):**
   - Renders company product directory with `ProductCard` grid using accent top borders.
   - Automatically redirects (307) to the single product portal when exactly one product exists.
   - Redirects to workspace website or returns 404 when directory is disabled.
   - Handles suspended workspaces with the unbranded unavailable state page.

5. **Portal Frame & Product Theming (`apps/web/components/portal/`, `apps/web/app/[ws]/[product]/layout.tsx`):**
   - Extended `PortalFrame` to support branded header: 32px logo, name, tagline (hidden below 640px), "Back to {company}" link (rel="noopener", ArrowUpRight icon), and user session menu / sign in.
   - Root `--primary`, `--primary-foreground`, `--primary-text`, and `--entity-accent` tokens derived via `accentTokens(product.accentColor)`.
   - `generateMetadata`: dynamic title (`{product} · {workspace}` or just `{product}` if matching), description, Open Graph tags (`og:title`, `og:description`, `og:site_name`, `og:image`), and favicon link (`type="image/webp"`).

6. **Workspace Settings UI (`apps/web/app/dashboard/[ws]/settings/`):**
   - General settings form: Workspace name, read-only URL with Copy button, LogoField, and Website with helper text.
   - Product directory settings form: native checkbox for directory visibility toggle.
   - Updated dashboard sidebar with Settings link.

7. **Testing & Verification:**
   - **Unit & Integration (`apps/api/test/portal.test.ts`, `workspaces.test.ts`, `cross-tenant.test.ts`, `public-contract.test.ts`):** 71/71 tests passing covering tracer, rename, slug immutability, website validation, directory toggle, foreign logo reject, and cross-tenant 404s.
   - **E2E Container Stack (`apps/api/test/e2e/portal.e2e.test.ts`):** 9/9 tests passing covering directory card grid, single-product redirect, empty state, and disabled directory redirect.
   - **Playwright Browser Tests (`apps/api/test/browser/portal-branding.spec.ts`):** 2/2 tests passing:
     - Accent tokens backstop: `#FACC15` produces dark foreground `#000000` and dark link `rgb(23, 23, 23)`; `#2563EB` produces white foreground `#FFFFFF` and blue link `rgb(37, 99, 235)`.
     - OG and favicon metadata backstop: verified `og:title`, `og:description`, `og:site_name`, and WebP `og:image` & `link[rel=icon]` tags.

## Verification Results
- `bun run typecheck`: Passed (0 errors across `@userhq/web`, `@userhq/api`, `@userhq/db`, `@userhq/types`).
- `oxlint -c .oxlintrc.json`: Passed (0 warnings, 0 errors on 182 files).
- `apps/web` vitest: Passed (51/51 tests passing).
- `apps/api` vitest: Passed (71/71 tests passing).
- `apps/api` e2e test: Passed (9/9 tests passing).
- `apps/api` browser test: Passed (2/2 tests passing).
