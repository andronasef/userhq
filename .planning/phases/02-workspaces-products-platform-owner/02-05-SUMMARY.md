# Plan 02-05 Summary: Platform Owner Console, Invites Table/Service, 404 Guard Matrix, Seam Test, and /platform UI

## Plan Outcome
All tasks in Plan 02-05 have been implemented and verified against the automated test suites, integration tests, public contract seam test, and full end-to-end container stack tests.

### Key Changes
1. **Schema & Database Migrations:**
   - Added `inviteKind` enum (`platform`, `workspace`) and `invites` table to `packages/db/src/schema/tenancy.ts`.
   - Added database checks `invites_workspace_kind` (workspace_id null iff kind=platform) and `invites_email_lower` (email is lower-cased).
   - Added index `invites_lookup_idx` on `(kind, token_hash)`.
   - Generated Drizzle migration `packages/db/migrations/0004_invites.sql` and verified migration parity against the PostgreSQL container.

2. **Shared Types & Constants:**
   - Exported `INVITE_TTL_DAYS = 7`, `InviteStateSchema`, `CreateInviteInputSchema`, `InviteCreatedSchema`, `InviteRowSchema`, and `HealthResponseSchema` in `packages/types/src/tenancy.ts`.
   - Built and bundled `@userhq/types` across the monorepo.

3. **Backend Service & Guards:**
   - Created `InvitesService` (`apps/api/src/invites/invites.service.ts`):
     - Secure token generation using `crypto.randomBytes(32).toString("base64url")` (43 characters).
     - SHA-256 hash storage (`crypto.createHash("sha256").update(token).digest("hex")`).
     - State computation: `revokedAt ? revoked : usedAt ? used : expiresAt <= now ? expired : pending`.
     - Creation concurrency protection via `pg_advisory_xact_lock(hashtext(...))` per `(kind, workspace_id, email)`.
     - 409 Conflict with error code `invite_pending` if an active pending invite already exists.
     - Listing with ordering: active invites first (state ASC, expires_at ASC), then terminal invites (created_at DESC).
     - Revocation via `UPDATE invites SET revoked_at = NOW() WHERE id = :id AND revoked_at IS NULL AND used_at IS NULL`.
   - Created `PlatformOwnerGuard` (`apps/api/src/platform/platform-owner.guard.ts`) enforcing strict 404 Not Found on unauthenticated callers, unverified emails, or non-platform-owners, leaking no presence or authentication details.
   - Created `PlatformController` (`apps/api/src/platform/platform.controller.ts`) with `@Public()`, `@UseGuards(PlatformOwnerGuard)`, and `@SerializeOptions`.
   - Added `HealthResponseSchema` serialization on `HealthController` (`apps/api/src/health/health.controller.ts`).
   - Wired `InvitesModule` and `PlatformModule` into `AppModule`.

4. **Public Contract Seam Test:**
   - Created `apps/api/test/public-contract.test.ts` scanning all NestJS controllers across `apps/api`.
   - Asserts that every route handler marked with `@Public()` explicitly defines `@SerializeOptions({ schema: ... })` to prevent accidental unvalidated data leaks.

5. **Frontend Web Console (`/platform`):**
   - Implemented `formatDate` (`apps/web/lib/format.ts`) with `Intl.DateTimeFormat("en", { dateStyle: "medium" })`.
   - Implemented UI primitives: `Badge` (`apps/web/components/ui/badge.tsx`), `Table` (`apps/web/components/ui/table.tsx`), `TabNav` (`apps/web/components/tab-nav.tsx`), `ConfirmDialog` (`apps/web/components/ui/confirm-dialog.tsx`), and `CopyField` (`apps/web/components/copy-field.tsx`).
   - Created `PlatformHeader` (`apps/web/components/platform/platform-header.tsx`), `InviteCreator` (`apps/web/components/invites/invite-creator.tsx`), and `InviteList` (`apps/web/components/invites/invite-list.tsx`).
   - Built `/platform` page (`apps/web/app/(app)/platform/page.tsx`) enforcing server-side `notFound()` when `!me.isPlatformOwner`.
   - Added `getPlatformInvites` server fetcher in `apps/web/lib/api-server.ts`.
   - Updated `UserMenu` (`apps/web/components/user-menu.tsx`) to show "Platform console" navigation item for platform owners.

6. **Automated & E2E Testing:**
   - Created `apps/api/test/platform.test.ts` (13 integration tests covering 404 matrix, 403 on invalid origin, duplicate conflict, concurrency advisory lock, revoke and re-invite lifecycle, state transitions, and ordering).
   - Created `apps/api/test/e2e/platform.e2e.test.ts` verifying invite creation, HTML rendering of invite row, and 404 behavior for anonymous and non-owner callers through the live Caddy/Docker stack.

## Verification Results
- `bun run typecheck`: Passed (0 errors across all 4 packages/apps).
- `bun run lint`: Passed (0 errors, 0 warnings across 138 files).
- `(cd apps/api && bun run test test/platform.test.ts test/public-contract.test.ts test/cross-tenant.test.ts)`: Passed (16/16 tests passing).
- `(cd apps/web && bun run test)`: Passed (46/46 tests passing).
- `(cd apps/api && bun run test:e2e test/e2e/platform.e2e.test.ts)`: Passed (3/3 tests passing).
- DB migration parity: 5 migrations applied and verified in PostgreSQL.
