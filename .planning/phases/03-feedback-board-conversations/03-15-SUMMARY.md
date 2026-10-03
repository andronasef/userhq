---
phase: 03-feedback-board-conversations
plan: 15
subsystem: account-deletion-workspace-soft-delete
tags: [account-deletion, ownership-transfer, workspace-soft-delete, privacy]
status: complete

requires: ["03-14"]
provides:
  - "POST /api/v1/account/delete: one transaction applying owner choices, scrub-in-place, session and account deletion"
  - "AccountService.deleteAccount with FOR UPDATE owner locks and per-statement one-owner handling"
  - "GET /api/v1/account returns ownedWorkspaces (slug, name, logoUrl, productCount, postCount, members excluding caller)"
  - "SessionGuard and the session-create hook treat deletedAt users as signed out"
  - "PortalGuard, TenantGuard, /me, and invite lookup/accept treat soft-deleted workspaces as unknown (404)"
  - "Danger zone UI with Your workspaces step and type-to-confirm"
affects: ["03-16"]

requirements-completed: [WORK-07, AUTH-04]

plan_head_before: eccc192f8ce8613fa6d1c45781b31843257040b8
plan_head_after: 48c707a9112928c709ce07bc8cccb3824aa57bd1

actuals:
  tokens: 60000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Scrub in place: user row keeps its id (restrict author FKs stay valid) with name '', image NULL, email 'deleted-{id}@deleted.invalid', deleted_at set"
    - "Transfer order: delete the caller's owner membership first, then promote the target, so the workspace_members_one_owner partial unique index holds per statement"
    - "Workspace soft delete via workspaces.deleted_at; the slug stays reserved by the existing unique constraint"

key-files:
  created:
    - apps/api/src/account/account.service.ts
    - apps/api/test/e2e/account.e2e.test.ts
    - apps/web/app/(app)/account/delete-account.tsx
  modified:
    - packages/types/src/account.ts
    - apps/api/src/account/account.controller.ts
    - apps/api/src/account/account.module.ts
    - apps/api/src/auth/auth.ts
    - apps/api/src/auth/guards.ts
    - apps/api/src/portal/portal.guard.ts
    - apps/api/src/tenancy/tenant.guard.ts
    - apps/api/src/auth/me.controller.ts
    - apps/api/src/invites/invites.service.ts
    - apps/api/test/account.test.ts
    - apps/web/lib/api-errors.ts
    - apps/web/app/(app)/account/page.tsx

key-decisions:
  - "transfer_target_invalid carries the workspace name in the server message ('That person is no longer a member of {name}. Choose someone else.') and the dialog shows that message, because the server knows which workspace failed and the web cannot tell"
  - "Better Auth deleteUser stays disabled (default); a test proves POST /api/auth/delete-user is rejected and leaves the user intact"
  - "POST /account/delete is throttled at 10 per minute per user"

duration: 11 min
completed: 2026-10-03

coverage:
  - id: D1
    description: "A user without owned workspaces deletes their account: identity scrubbed, sessions revoked, posts/comments read Deleted user, votes still count, second delete 401"
    requirement: WORK-07
    verification:
      - kind: automated
        ref: "apps/api/test/account.test.ts#tracer: deleting an account scrubs identity and keeps content and votes"
        status: pass
      - kind: automated
        ref: "apps/api/test/e2e/account.e2e.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Owners transfer or delete each owned workspace atomically; deleted workspaces 404 on portal, dashboard, /me, invites, slug stays taken, email batches cancelled"
    requirement: WORK-07
    verification:
      - kind: automated
        ref: "apps/api/test/account.test.ts#owner transfers one workspace and deletes the other; deleted workspace disappears"
        status: pass
      - kind: automated
        ref: "apps/api/test/account.test.ts#all-or-nothing: unresolved or invalid choices leave everything untouched"
        status: pass
      - kind: automated
        ref: "apps/api/test/account.test.ts#concurrent deletions by owners of different workspaces leave one owner or a deleted workspace"
        status: pass
    human_judgment: false
  - id: D3
    description: "Platform owner cannot delete the account (403 platform_owner_account) and Better Auth's own delete-user is unavailable"
    requirement: AUTH-04
    verification:
      - kind: automated
        ref: "apps/api/test/account.test.ts#refuses the platform owner account"
        status: pass
    human_judgment: false
  - id: D4
    description: "Danger zone dialog: workspaces step with radio groups, Continue gating, summary lines, Alerts for server rejections"
    requirement: WORK-07
    verification:
      - kind: automated
        ref: "bun run typecheck && bun run lint"
        status: pass
    human_judgment: true
    rationale: "The dialog was type-checked and built into the stack image, but no browser test drives the multi-step flow; a human or Playwright pass should confirm the visual and interaction details"
---

# Phase 3 Plan 15: Account Deletion and Workspace Soft Delete Summary

Account deletion by scrubbing the user row in place inside one transaction, with per-workspace transfer-or-delete choices for owners, and soft-deleted workspaces answering 404 across portals, dashboards, /me, and invites.

## Accomplishments

- **Tracer (commit 9bbc28e):** `POST /api/v1/account/delete` removes memberships and post mutes, cancels pending and retrying comment-email batches, scrubs the user row, and deletes session and account rows. Posts, comments, and votes are untouched, so they render as "Deleted user" and still count. The platform owner gets 403 `platform_owner_account`. A second delete is a 401 because the first revoked every session. Better Auth's delete-user endpoint is confirmed unavailable by test. e2e confirms the rendered post page contains "Deleted user" and neither the old name nor email.
- **Owner choices (commit 48c707a):** owned workspaces are locked `FOR UPDATE`; the input must match the owned set exactly (else `owned_workspaces_unresolved`); transfer targets must be current members other than the caller (else `transfer_target_invalid`). Every failure rolls back everything. Workspace soft-delete filters added to PortalGuard, TenantGuard, /me, and invite lookup/accept. The Danger zone UI gained the Your workspaces step and summary lines.
- **Pre-existing WIP reviewed and kept:** the dispatched partial work (auth.ts and guards.ts deletedAt handling, api-errors copy, account types, account.service.ts) was reviewed and built on. Its generic `transfer_target_invalid` message was unified to name the workspace.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing 03-14 tracer test asserted the old GET /account shape**
- **Found during:** Task 1
- **Issue:** `toEqual` and the key-list assertion in `account.test.ts` did not include `ownedWorkspaces`.
- **Fix:** Updated both assertions to the new shape (the test user owns one workspace with one product).
- **Files modified:** apps/api/test/account.test.ts
- **Commit:** 9bbc28e

**2. [Rule 2 - Missing critical] Throttle on the irreversible endpoint**
- **Issue:** The plan did not specify rate limiting for POST /account/delete.
- **Fix:** `UserThrottlerGuard` with 10 requests per minute per user (initially 5, raised because the all-or-nothing test legitimately issues seven rejected requests).
- **Files modified:** apps/api/src/account/account.controller.ts
- **Commit:** 9bbc28e, 48c707a

**Total deviations:** 2 auto-fixed. **Impact:** none on scope.

### Scope notes

- The controller's `ownedWorkspaces` population shipped in the Task 1 commit instead of the Task 2 commit, because the WIP controller changes were one coherent unit; the Task 2 commit contains the later throttle tweak and the workspace filters.
- Email recipient exclusion needed no change: `enqueueCommentEmail` already filters `deleted_at IS NULL` users, and the worker already cancels batches for deleted users and deleted workspaces (03-10).

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-03-52 through T-03-57 are mitigated and covered by the tests above).

## Verification

- `bun run test` for account, auth, ban, portal, workspaces, invites, team, cross-tenant, email: 130 tests pass (account.test.ts: 9)
- `bun run typecheck` and `bun run lint`: clean (including `cd apps/api && npx tsc --noEmit -p .`)
- `bun run stack:up` then e2e `account.e2e.test.ts` and `session-flow.e2e.test.ts`: 7 tests pass
- Acceptance criteria greps for both tasks: all pass

## Self-Check: PASSED

- Created files exist: account.service.ts, account.e2e.test.ts, delete-account.tsx
- Commits exist: 9bbc28e, 48c707a
