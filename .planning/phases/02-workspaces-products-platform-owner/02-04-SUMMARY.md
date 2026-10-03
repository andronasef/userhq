# Plan 02-04 Summary: Dashboard Frame, Navigation, Landing/Picker, Error Mapping & 320px Backstop

## Plan Outcome
All tasks in Plan 02-04 were successfully implemented and verified against the automated test suites, e2e test suites, and Playwright 320px browser backstop.

### Key Changes
1. **Design Tokens & Entity Identity:**
   - Added `--destructive-foreground`, `--primary-text`, and `--entity-accent` tokens to `apps/web/app/globals.css`.
   - Created `EntityLogo` component (`apps/web/components/entity-logo.tsx`) rendering an `<img>` with an automatic fallback to an initials badge on `--entity-accent` background at all standard sizes (20, 24, 32, 40, 64px).

2. **Dashboard Frame & Navigation:**
   - Implemented `Drawer` (`apps/web/components/ui/drawer.tsx`) wrapping Radix Dialog with CSS sheet animations (`translate-x-full` transitions).
   - Created `MobileNav` (`apps/web/components/dashboard/mobile-nav.tsx`) exposing the hamburger button (`aria-label="Open navigation"`) on screens `<1024px` and closing the drawer on navigation clicks.
   - Built `DashboardSidebar` (`apps/web/components/dashboard/sidebar.tsx`) structured per D-04 into "Workspace" and "Products" sections, displaying "No products yet" empty states and independent vertical scrolling.
   - Built `WorkspaceSwitcher` (`apps/web/components/dashboard/workspace-switcher.tsx`) supporting zero/one/many workspaces, truncation on small viewports, active checkmark, and a create workspace link if permitted.
   - Wired the frame together in `apps/web/app/dashboard/[ws]/layout.tsx`.

3. **Landing Routing, Workspace Picker & Error Mapping:**
   - Created `apps/web/lib/api-errors.ts` translating server and Zod error codes (`slug_taken`, `slug_reserved`, `slug_invalid`, `name_required`, `name_too_long`, etc.) to UI-SPEC copy with unit test coverage (`apps/web/lib/api-errors.test.ts`).
   - Built `AppToaster` and session `flash()` toast mechanism in `apps/web/components/ui/toaster.tsx` (mounted in `AppShell` and `dashboard/[ws]/layout.tsx`).
   - Integrated error mapping into `CreateWorkspaceForm` and field error states.
   - Updated root landing `apps/web/app/(app)/page.tsx` with D-02 zero-one-many routing (0 workspaces shows setup/invite-only card, 1 redirects to `/dashboard/{ws}`, 2+ redirects to `/dashboard`).
   - Created workspace picker page `apps/web/app/dashboard/page.tsx` listing workspaces sorted by name with logos, role badges, and create actions.
   - Updated `UserMenu` to conditionally reveal the "Dashboard" menu item only when the user belongs to at least one workspace.
   - Updated `proxy.ts` to protect `/dashboard` and `/dashboard/:path*`.

4. **320px Viewport Backstop:**
   - Configured Playwright in `apps/api/playwright.config.ts` running against the local stack.
   - Added `test:browser` script in `apps/api/package.json`.
   - Built pure auth helpers in `apps/api/test/support/auth-helpers.ts` avoiding NestJS parameter decorator transpilation issues in Playwright.
   - Added browser test `apps/api/test/browser/dashboard-header.spec.ts` asserting:
     - `document.documentElement.scrollWidth <= 320`
     - Menu button, wordmark, workspace switcher, and user avatar all fit on a single line within the header bounding box.
     - Switcher menu and mobile drawer do not introduce horizontal scroll when opened.
     - Captured screenshot `apps/api/test-results/dashboard-header-320.png`.

## Verification Results
- `bun run typecheck`: Passed (0 errors across `@userhq/web`, `@userhq/api`, `@userhq/db`, `@userhq/types`).
- `bun run lint`: Passed (0 errors, 0 warnings across 120 files).
- `(cd apps/web && bun run test)`: Passed (46/46 unit tests passing).
- `(cd apps/api && bun run test:e2e test/e2e/dashboard.e2e.test.ts test/e2e/session-flow.e2e.test.ts test/e2e/upload-page.e2e.test.ts test/e2e/workspace-create.e2e.test.ts)`: Passed (23/23 tests passing).
- `(cd apps/api && bun run test:browser test/browser/dashboard-header.spec.ts)`: Passed (1/1 browser test passing).
