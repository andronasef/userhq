# Plan 02-11 Summary: Platform Owner Console, Workspaces & Users Oversight, Suspension & Bans

## Plan Outcome
All tasks in Plan 02-11 (PLAT-04, PLAT-05, PLAT-06, PLAT-07, D-19, D-20) have been implemented and verified against unit, integration, cross-tenant isolation, end-to-end container stack, and full CI verification pipelines.

### Key Changes
1. **Shared Types & Schemas (`packages/types/src/tenancy.ts`):**
   - Added `PlatformListQuerySchema` (`q?: string`, `page: number` with min 1, default 1).
   - Added `PlatformWorkspaceRowSchema` (`id`, `slug`, `name`, `logoUrl`, `productCount`, `memberCount`, `postCount`, `voteCount`, `suspended`, `createdAt`).
   - Added `PlatformWorkspaceDetailSchema` with product list (`live: boolean`) and member list (`role: "owner" | "admin"`).
   - Added `PlatformUserRowSchema` (`id`, `name`, `email`, `image`, `workspaceCount`, `postCount`, `voteCount`, `banned`, `isPlatformOwner`, `createdAt`).
   - Added pagination schemas `pageOf(PlatformWorkspaceRowSchema)` and `pageOf(PlatformUserRowSchema)`.
   - Bundled and verified via `bun run build:packages`.

2. **Database Migration (`packages/db`):**
   - Added `bannedAt: timestamp("banned_at", { withTimezone: true })` to `user` table in `packages/db/src/schema/auth.ts`.
   - Generated migration `packages/db/migrations/0006_ban.sql` and journal metadata.
   - Verified migration applied and checked (`db:check` clean, 7 migrations in sync with Docker Postgres).

3. **Authentication Hook & Guards (`apps/api/src/auth/`):**
   - In `apps/api/src/auth/auth.ts`:
     - Added `user.additionalFields.bannedAt` with `input: false` to prevent client modification.
     - Added `databaseHooks.session.create.before` checking `bannedAt` on user creation/login. Rejects banned accounts with `APIError.from("FORBIDDEN", { code: "account_banned", message: "This account can't sign in." })`.
   - In `apps/api/src/auth/guards.ts`:
     - Updated `SessionGuard` to verify `!session.user.bannedAt`, treating banned user sessions as signed out (`null`).
     - This guarantees banned users receive 404 from platform owner endpoints (`PLAT-07`) even if their email matches `PLATFORM_OWNER_EMAIL`.

4. **Platform Owner API Endpoints (`apps/api/src/platform/platform.controller.ts`):**
   - `GET /api/v1/platform/workspaces`: lists workspaces with search query `q` (LIKE escaped, trimmed, capped at 100 chars), 50-row pagination (`limit 51` for `hasNext`), ordered by `created_at desc, id desc`. Member and product counts via subqueries; post and vote counts returned as 0 (for Phase 3).
   - `GET /api/v1/platform/workspaces/:id`: workspace detail with products and members.
   - `POST /api/v1/platform/workspaces/:id/suspend`: sets `suspended_at = now()`, idempotent 204.
   - `DELETE /api/v1/platform/workspaces/:id/suspend`: sets `suspended_at = null`, idempotent 204.
   - `GET /api/v1/platform/users`: lists users with search query `q`, 50-row pagination, membership counts, ordered newest first, with calculated `isPlatformOwner`.
   - `POST /api/v1/platform/users/:id/ban`: forbids banning platform owner (403 `not_allowed`). In a single transaction, updates `banned_at = now()` and deletes all active sessions from the `session` table.
   - `DELETE /api/v1/platform/users/:id/ban`: sets `banned_at = null`, idempotent 204.

5. **Web Console UI & Client Components (`apps/web`):**
   - `apps/web/lib/api-server.ts`: added `getPlatformWorkspaces`, `getPlatformWorkspace`, `getPlatformUsers`.
   - `apps/web/lib/login-errors.ts`: added `account_banned` copy ("This account can't sign in").
   - `apps/web/app/(app)/login/page.tsx`: rendered error alert in server component HTML so SSR immediately provides the banned copy.
   - `apps/web/components/platform/platform-header.tsx`: added "Workspaces" and "Users" tabs alongside "Invites".
   - `apps/web/components/platform/pager.tsx`: pagination control preserving query parameters.
   - `apps/web/components/platform/workspaces-table.tsx`: table with 24px EntityLogo, mono URL, badges, and suspend/lift confirmation dialogs.
   - `apps/web/components/platform/users-table.tsx`: table with 32px Avatar, "You" badge for platform owner, and ban/lift dialogs.
   - `apps/web/components/platform/workspace-detail-header.tsx`: workspace detail header with status badge and suspend/lift actions.
   - `apps/web/app/(app)/platform/workspaces/page.tsx`: workspaces browse page with search and pagination.
   - `apps/web/app/(app)/platform/workspaces/[id]/page.tsx`: workspace detail page with Products and Members tables.
   - `apps/web/app/(app)/platform/users/page.tsx`: users browse page with search and pagination.
   - `apps/web/app/dashboard/[ws]/layout.tsx` & subpages (`page.tsx`, `settings`, `team`, `new`, `[product]/settings`, `[product]/statuses`): clean handling of 403 `workspace_suspended` rendering the unbranded unavailable state page in AppShell without the dashboard sidebar.

6. **Non-Destructive Guarantee Verification:**
   - Proved suspend/lift is non-destructive: after suspending a workspace and lifting suspension, all workspace members, products, statuses, invites, and settings remain identical.
   - Proved ban/lift is non-destructive: after banning a user and lifting the ban, all user memberships, created entities, and profile data remain identical.

## Verification Results
- `bun run typecheck`: Passed (0 errors across `@userhq/web`, `@userhq/api`, `@userhq/db`, `@userhq/types`).
- `oxlint -c .oxlintrc.json`: Passed (0 warnings, 0 errors on 190 files).
- `apps/api/test/platform.test.ts`: Passed (19/19 tests passing).
- `apps/api/test/ban.test.ts`: Passed (7/7 tests passing).
- `apps/web/lib/login-errors.test.ts`: Passed (6/6 tests passing).
- All 13 API unit/integration suites: Passed (200/200 tests passing).
- All 7 Web unit suites: Passed (52/52 tests passing).
- All 11 E2E container test suites: Passed (43/43 tests passing including `platform.e2e.test.ts`, `session-flow.e2e.test.ts`, `dashboard.e2e.test.ts`).
- `bun run ci:check`: Passed completely (`oxlint`, `typecheck`, `build:packages`, `api build`, all tests, `web build`, `next build`, `db:check`).
