# Plan 02-06 Summary: Invite Lookup, Platform Invite Consumption, and Logo Uploads

## Plan Outcome
All tasks in Plan 02-06 have been implemented and verified against the automated test suites, integration tests, public contract seam test, and full end-to-end container stack tests.

### Key Changes
1. **Shared Types & Constants:**
   - Updated `UploadResponseSchema` in `packages/types/src/index.ts` to include `id: z.uuid()`.
   - Updated `CreateWorkspaceInputSchema` in `packages/types/src/tenancy.ts` to accept `logoUploadId: z.uuid().nullable().optional()`.
   - Exported `InviteLookupSchema` and `type InviteLookup` in `packages/types/src/tenancy.ts` with masked email, state, and workspace fields.

2. **Backend Services & Controllers:**
   - **InvitesService (`apps/api/src/invites/invites.service.ts`):**
     - Implemented `maskEmail(email: string)` to format emails as first character + "•••" + "@" + domain without leaking full local parts.
     - Implemented `lookup(token: string, user: { id: string; email: string; emailVerified: boolean })`: validates 43-character base64url tokens, calculates state, verifies email matching (case-insensitive with `emailVerified === true`), masks email on mismatch, hides workspace info on mismatch, and fails with identical 404 `not_found` for malformed and nonexistent tokens.
     - Implemented `hasPendingPlatformInvite(user)` to dynamically determine if an invited user is eligible to create a workspace.
     - Implemented `claimPlatformInvite(tx, user, workspaceId)` running an atomic single-row claim using `FOR UPDATE SKIP LOCKED` inside the workspace creation transaction.
   - **InvitesController (`apps/api/src/invites/invites.controller.ts`):**
     - Added `GET /api/v1/invites/:token` endpoint protected by `SessionGuard` and serialized with `StandardSchemaSerializerInterceptor`.
   - **WorkspacesController (`apps/api/src/workspaces/workspaces.controller.ts`):**
     - Updated `create`: allows platform owners or verified users with a pending platform invite.
     - Validates `logoUploadId` (verifying `uploader_id = user.id`) before writing.
     - Atoms-in-one transaction: workspace insertion, owner membership insertion, and `claimPlatformInvite` (atomic rollback on conflict or race).
   - **MeController (`apps/api/src/auth/me.controller.ts`):**
     - Computed `canCreateWorkspace: isPlatformOwner || hasPendingPlatformInvite(user)`.
   - **UploadsController (`apps/api/src/uploads/uploads.controller.ts`):**
     - Returned `id: uploadId` in the response payload.

3. **Frontend Web & UI:**
   - **LogoField (`apps/web/components/logo-field.tsx`):**
     - 64px `EntityLogo` preview with fallback initials.
     - Hidden file input accepting `image/png,image/jpeg,image/webp,image/gif`.
     - Immediate file upload via `POST /api/v1/uploads` using TanStack `useMutation`.
     - Clear visual states: `Uploading…` spinner with disabled button and form submit disabling, `Remove logo` button when set, and error alerts mapped via `uploadErrorCopy`.
   - **Create Workspace Form (`apps/web/app/dashboard/new/create-workspace-form.tsx`):**
     - Integrated `LogoField` to send `logoUploadId`.
   - **Proxy (`apps/web/proxy.ts`):**
     - Added `/invite/:path*` to `matcher` to redirect unauthenticated visitors to `/login?next=...`.
   - **Invite Landing Page (`apps/web/app/(app)/invite/[token]/page.tsx`):**
     - Added `referrer: "no-referrer"` metadata.
     - Handled states:
       - Invalid/not found: "This invite link isn't valid" with "Go to home".
       - Email mismatch: "This invite is for another email address" showing masked email, `<SwitchAccountButton>`, and "Go to home".
       - Expired: "This invite has expired" with "Go to home".
       - Used: "This invite has already been used" with "Go to home".
       - Revoked: "This invite was canceled" with "Go to home".
       - Workspace suspended: "This workspace is unavailable" with "Go to home".
       - Valid platform invite: server redirect to `/dashboard/new`.
   - **SwitchAccountButton (`apps/web/app/(app)/invite/[token]/switch-account-button.tsx`):**
     - Signs out via `authClient.signOut()` and redirects to `/login?next=/invite/{token}`.

4. **Testing & Verification:**
   - Integration suite `apps/api/test/invites.test.ts` (9 tests covering tracer flow, unverified user, privacy protection, malformed token parity, lifecycle states, slug conflicts, concurrency races, and logo ownership).
   - E2E suite `apps/api/test/e2e/invite-flow.e2e.test.ts` verifying full signed-out redirect, matching user redirect to `/dashboard/new`, workspace creation, and already-used state display.
   - Updated `apiCall` in `apps/api/test/support/stack.ts` to support `redirect: "manual"` and added `grantPlatformInvite`.

## Verification Results
- `bun run typecheck`: Passed (0 errors across all 4 packages/apps).
- `bun run lint`: Passed (0 errors, 0 warnings across 144 files).
- `(cd apps/api && bun run test test/invites.test.ts test/workspaces.test.ts test/auth.test.ts test/uploads.test.ts test/public-contract.test.ts test/platform.test.ts test/cross-tenant.test.ts)`: Passed (107/107 tests passing).
- `(cd apps/web && bun run test)`: Passed (46/46 tests passing).
- `(cd apps/api && bun run test:e2e test/e2e/invite-flow.e2e.test.ts test/e2e/workspace-create.e2e.test.ts test/e2e/platform.e2e.test.ts)`: Passed (8/8 tests passing).
- DB migration parity: 5 migrations applied and verified in PostgreSQL.
