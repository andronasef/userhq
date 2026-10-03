# Plan 02-07 Summary: Team Management & Teammate Invites

## Plan Outcome
All tasks in Plan 02-07 have been implemented and verified against the automated unit/integration test suites, cross-tenant test suites, full end-to-end container stack tests, and Playwright 320px mobile backstop tests.

### Key Changes
1. **Shared Types & Constants:**
   - Added `MemberRowSchema` and `type MemberRow` to `packages/types/src/tenancy.ts`.
   - Added `AcceptInviteResultSchema` and `type AcceptInviteResult` to `packages/types/src/tenancy.ts`.
   - Bundled and verified via `bun run build:packages`.

2. **Backend Services & Controllers:**
   - **InvitesService (`apps/api/src/invites/invites.service.ts`):**
     - Added `already_member` pre-check in `create()` for workspace invites (throws 409 `already_member` if a member with that email already belongs to the workspace).
     - Implemented `acceptWorkspaceInvite(token, currentUser)` within an atomic database transaction:
       - Validates token hash and workspace binding.
       - Enforces verified email match (403 `not_allowed` on mismatch or unverified).
       - Checks workspace suspension status (403 `workspace_suspended`).
       - Short-circuits idempotently if caller is already a member.
       - Claims invite via atomic single-row UPDATE with row locking and validity checks.
       - Supports idempotent re-acceptance by the same user.
       - Inserts caller into `workspace_members` with `role = 'admin'` using `onConflictDoNothing()`.
   - **InvitesController (`apps/api/src/invites/invites.controller.ts`):**
     - Added `@Post(":token/accept")` endpoint returning `AcceptInviteResult`.
   - **TeamInvitesController (`apps/api/src/workspaces/team-invites.controller.ts`):**
     - `GET /api/v1/workspaces/:ws/invites`: lists workspace invites with `InviteRowSchema`.
     - `POST /api/v1/workspaces/:ws/invites`: creates workspace invite for email.
     - `DELETE /api/v1/workspaces/:ws/invites/:id`: revokes pending workspace invite.
   - **MembersController (`apps/api/src/workspaces/members.controller.ts`):**
     - `GET /api/v1/workspaces/:ws/members`: lists members ordered with owner first then name.
     - `DELETE /api/v1/workspaces/:ws/members/:userId`: deletes admin teammate; enforces owner protection (cannot remove owner, 403 `not_allowed`) and self-protection (cannot remove self, 403 `not_allowed`). Constrained to `role = 'admin'`.
     - `POST /api/v1/workspaces/:ws/leave`: allows admin to leave workspace; forbids owner from leaving (403 `not_allowed`).
   - **WorkspacesModule (`apps/api/src/workspaces/workspaces.module.ts`):**
     - Registered `MembersController` and `TeamInvitesController`.

3. **Frontend Web & UI:**
   - **Data Fetching (`apps/web/lib/api-server.ts`):**
     - Added `getMembers(ws)` and `getTeamInvites(ws)` cached helpers.
   - **Sidebar Navigation (`apps/web/components/dashboard/sidebar.tsx`):**
     - Added "Team" link under Workspace navigation pointing to `/dashboard/{ws}/team` with `Users` icon.
   - **Members Table (`apps/web/components/team/members-table.tsx`):**
     - Client component with Avatar, Name, Email (truncated with title), Role badge ("Owner" / "Admin"), Joined date.
     - Viewer row indicated with "You" badge.
     - "Remove teammate" button for other admins opening `ConfirmDialog` ("Remove {name}?", "Keep teammate", "Remove teammate"). Moves focus to page `h1` on removal.
     - "Leave workspace" button for viewer (when not owner) opening `ConfirmDialog` ("Leave {workspace}?", "Stay in workspace", "Leave workspace"). Redirects to `/` on success.
     - Owner row has no removal or leave buttons.
   - **Team Page (`apps/web/app/dashboard/[ws]/team/page.tsx`):**
     - Assembles `PageHeader`, `MembersTable`, `InviteCreator`, and `InviteList`.
     - `generateMetadata` with "Team · {workspace}".
   - **Invite Acceptance (`apps/web/app/(app)/invite/[token]/accept-invite.tsx` & `page.tsx`):**
     - Added `AcceptInvite` component executing `POST /api/v1/invites/:token/accept` on mount.
     - Renders loader with `role="status"` and "Joining {workspace}…".
     - Handles errors with "Couldn't join {workspace}", "Retry joining", and "Go to home".
     - Integrated into invite landing page: redirects already-members to `/dashboard/{workspaceSlug}`, shows unavailable state on suspended workspace, and mounts `AcceptInvite` for pending workspace invites.
   - **DropdownMenu Fixes (`workspace-switcher.tsx` & `user-menu.tsx`):**
     - Removed improper `forceMount` prop that was causing Radix modal focus traps to mark background content `aria-hidden="true"`.

4. **Testing & Verification:**
   - **Integration Tests (`apps/api/test/team.test.ts`):**
     - 19 comprehensive tests covering:
       - Tracer: owner invites teammate, teammate signs in, looks up, accepts, joins as admin, verifies membership order and workspace role.
       - Member removal, owner removal protection (403), self removal protection (403), non-member 404, idempotency (204 then 404), concurrent removal races ([204, 404]).
       - Admin leave (204 then 404) and owner leave protection (403).
       - Duplicate checks: 409 `already_member`, 409 `invite_pending`, advisory lock concurrency.
       - Acceptance edge cases: same-user double accept idempotency, mismatch email (403), unverified email (403), suspended workspace (403).
       - Cross-tenant boundaries for members and invites.
   - **Cross-Tenant Test Suite (`apps/api/test/cross-tenant.test.ts`):**
     - Updated `CROSS_TENANT_ROUTES` with all `:ws` routes: members list, members delete, leave, invites list, invites create, invites revoke. All 8 routes verified isolated.
   - **E2E Suite (`apps/api/test/e2e/team.e2e.test.ts`):**
     - Full container flow: owner creates invite, teammate visits `/invite/:token` (verifies "Joining" SSR/client status), accepts, and owner sees both on the team page.
   - **Mobile Backstop Test (`apps/api/test/browser/dashboard-header.spec.ts`):**
     - "320px team invite CopyField is usable" test verifying `input[readonly]` is visible, "Copy link" button bounding box is within 0..320, document scroll width <= 320px, and screenshot saved.

## Verification Results
- `bun run typecheck`: Passed (0 errors across all packages and apps).
- `bun run lint`: Passed (0 errors, 0 warnings).
- Unit & integration tests (`test/team.test.ts test/cross-tenant.test.ts test/invites.test.ts`): Passed (36/36 tests passing).
- E2E tests (`test/e2e/team.e2e.test.ts`): Passed (1/1 tests passing).
- Browser Playwright tests (`test/browser/dashboard-header.spec.ts`): Passed (2/2 tests passing).
