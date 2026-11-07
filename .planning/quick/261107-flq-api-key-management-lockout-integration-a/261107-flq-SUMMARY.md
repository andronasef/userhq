---
phase: quick-261107-flq
plan: 01
subsystem: api-keys
tags: [api-keys, attribution, rate-limit, docs, drizzle]
requires:
  - 261106-f9k (deny-by-default key auth)
provides:
  - post_activity.api_key_id (migration 0020)
  - "`source` on feedback DTOs (public and admin shapes)"
  - ApiKeyRateLimitGuard and API_KEY_RATE_LIMIT
  - docs/automation-api.md with route/scope/limit sync tests
affects: [apps/api, packages/db, packages/types, docs]
key-files:
  created:
    - packages/db/migrations/0020_post_activity_api_key.sql
    - apps/api/src/api-keys/api-key-rate-limit.guard.ts
    - apps/api/test/api-key-attribution.test.ts
    - apps/api/test/automation-routes.test.ts
    - apps/api/test/support/routes.ts
    - docs/automation-api.md
  modified:
    - packages/db/src/schema/feedback.ts
    - packages/types/src/api-keys.ts
    - packages/types/src/feedback.ts
    - apps/api/src/auth/principal.ts
    - apps/api/src/auth/guards.ts
    - apps/api/src/app.module.ts
    - apps/api/src/feedback/moderation.service.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/comments.service.ts
    - apps/api/src/feedback/workspace-feedback.service.ts
    - apps/api/src/roadmap/roadmap.service.ts
    - apps/api/test/api-keys.test.ts
decisions:
  - "Rate limit calls the shared ThrottlerStorage directly so the header is plain Retry-After, not Retry-After-<throttler>."
  - "Source has two shapes: public {kind,name} and admin adds apiKeyId; the anonymous portal never sees a key id."
  - "Story-20 surfaces (FAQ, products, statuses, categories) are pinned session-only with an explicit gap reason, not given scopes."
requirements: [D-05, D-11]
status: complete
duration: resumed after a server-restart cancellation; tasks 1-3 and the Task 4 RED were already committed
completed: 2026-11-07
estimate_ref: plan estimate tokens 120000
actuals:
  tokens: 19000   # chars/4 over the realized diff, excluding the generated 0020 snapshot JSON
  tasks: 4
  commits: 8
plan_head_before: 26bd397f9988391e25ad19491e56fc81f86cdb21
plan_head_after: 9079667101a9f7b87dfc3e7d5542d50df24798fe
---

# Phase quick-261107-flq Plan 01: API key lockout, integration attribution, per-key rate limit, automation docs

Status changes, posts and comments made through an API key are now traceable to the key on audit rows and in the DTOs (public surfaces show only the key name), every key request is rate limited per key with a correct `Retry-After`, and `docs/automation-api.md` is pinned to the enforced routes, scopes and limit by tests.

## Commits (8, measured from `26bd397`)

| Task | Type | Commit | What |
|------|------|--------|------|
| 1 | test | `cefbb5a` | RED: key status change recorded and exposed as source |
| 1 | feat | `dc3efd1` | `post_activity.api_key_id` + migration 0020; `source` on `ActivityEntry`; `keyName` on `ApiKeyPrincipal` |
| 2 | test | `0f7f884` | RED: source across posts, comments, activity, board and inbox |
| 2 | feat | `64bbac8` | `source` on public and admin DTOs; roadmap cascades attributed (`followItemStatus` takes the acting user) |
| 3 | test | `7b75ae6` | RED: full-scope key management lockout and per-key rate limit |
| 3 | feat | `98f2ac2` | `ApiKeyRateLimitGuard`, `API_KEY_RATE_LIMIT` (120 per 60 s), registered after `SessionGuard` |
| 4 | test | `7f2b77c` | RED: route inventory, session-only pinning, deny sweep, docs sync |
| 4 | docs | `9079667` | `docs/automation-api.md`; sync tests now pass |

Tasks 1-3 and the Task 4 RED were committed by the earlier, cancelled executor; they are summarised here from `git log` and `git diff`. This run wrote only Task 4's docs and commit.

## What was built

**Task 1 (tracer).** Migration `0020_post_activity_api_key.sql` adds one nullable uuid `api_key_id` on `post_activity` with an FK to `workspace_api_keys`, `ON DELETE SET NULL`. It came from drizzle-kit generate, holds two statements and no `device_info`. `ModerationService.changeStatus` writes the key id and returns `activity.source`. Human status changes record null; a re-sent status stays a no-op.

**Task 2.** `source` added to `PublicPostDetail`, `PublicComment` and `ActivityEntry` (`{kind: "integration", name}`), and to `AdminPostRow`, `WorkspaceRequestItem` and `WorkspaceCommentItem` (adds `apiKeyId`). Read paths join `workspace_api_keys` on id and name only; write paths derive the value from the actor's principal. `RoadmapService.followItemStatus` now receives the acting user, so a key-driven roadmap move attributes the cascaded status changes to the key.

**Task 3.** `ApiKeyRateLimitGuard` increments `api-key:{keyId}` on the shared throttler storage (sliding window, blockDuration 0) and returns 429 `rate_limited` with an integer `Retry-After`. Human sessions, other keys and invalid tokens never share a bucket. Added a full-scope and admin-only key lockout test on the three API-key routes. The enforcement itself was already shipped by 261106-f9k, so no production code changed for it.

**Task 4.** `docs/automation-api.md` has eight numbered sections: Authentication, Scopes, Product restrictions, Endpoints (47 rows), Pagination and export, Errors, Attribution, Rate limits. `apps/api/test/support/routes.ts` discovers every controller route with its scopes. `automation-routes.test.ts` covers:
- exactly one scope per scoped route, and every non-admin scope used by a route;
- every `:ws` route either scoped or pinned session-only with a reason;
- an admin-key sweep proving every unscoped route returns 403 `api_key_route_forbidden`;
- the docs Scopes table, Endpoints table (both directions) and the rate-limit sentence all equal the code.

## Verification evidence

- **Task 4 RED**: committed in `7f2b77c` with the docs file absent; the docs-sync cases failed on the missing file.
- **Task 4 GREEN**: `test/automation-routes.test.ts` 7/7 passed after the docs were added.
- **Docs drift check (run this session)**: removing the `/export/feedback` row from the docs failed the Endpoints test with "enforced but not documented". Changing `ExportController`'s decorator from `export:read` to `requests:read` failed both "every non-admin scope is used" and the Endpoints test. Both files were restored byte for byte afterwards.
- **Lockout mutation (re-run this session)**: with `@RequireScopes("admin")` temporarily on `ApiKeysController.listKeys`, `api-keys.test.ts` failed two tests (the new full-scope lockout test, which saw a 200 listing keys, and the session-only matrix). The controller was then restored and `git diff` on it is empty. The lockout test is not vacuous.
- **Migration**: 2 statements, 0 `device_info` hits, `db:check` reports "Everything's fine".
- **`bun run ci:check`: exit 0 on the second run** (lint, typecheck, packages build, API build, full tests, web builds, `db:check`). Test totals: types 32, db 6, api 694 across 53 files, web 260.

### ci:check first run failed, then passed unchanged

The first run exited 1. All 694 API tests passed, but `test/workspace-feedback.test.ts` reported `Hook timed out in 10000ms` in an `afterAll` (`await t?.close()`, around line 937), which failed the suite. That file passes alone (45/45), and a second full `ci:check` with no code change exited 0 with 53 of 53 files passing. This is a teardown timeout under full-suite load, not a defect in this plan's code. It is a flake risk on busy machines; the `afterAll` there could take a larger hook timeout. I did not change it, as it is outside this task.

## Story-20 gap (recorded, not hidden)

Story 20 lists FAQ and product-setting operations as automation targets. These controllers have no `@RequireScopes`, so every key (even `admin`) gets 403 `api_key_route_forbidden` on them:

- `FaqController`
- `ProductsController`
- `StatusesController`
- `CategoriesController`

They are pinned in `SESSION_ONLY_CONTROLLERS` in `automation-routes.test.ts` with a `story-20 gap` reason. To close the gap, add a scope to each route, add rows to the docs Endpoints table, and delete the pin. The docs state in section 4 that these surfaces are not available to keys.

The other pinned session-only controllers are intentional: `ApiKeysController`, `MembersController`, `TeamInvitesController`, `WorkspaceController`, `PushFollowController`, plus the handler `WorkspaceFeedbackController.markCommentRead` (a person's own read state).

## Known limits and intentionally not changed

- **In-memory limiter**: throttler storage is per API process. It is exact with the single replica in compose.yaml. It needs a shared store before a second replica runs. The guard comment and docs section 8 say so.
- Unauthenticated invalid-token floods are not limited per key, since no key exists to bucket on. Tokens carry 192 bits of entropy.
- Not in scope: a web UI label rendering `source`, `source` on webhook payloads, shared limiter storage, IP throttling.
- Unchanged: 261106-f9k enforcement, product restrictions, Bearer parsing, `UserThrottlerGuard` and human-route limits, existing `created_by_api_key_id` columns and export fields.
- The docs file is not linked from elsewhere: nothing in the repo links `docs/deploy.md`, so there was no pointer to mirror.

## Deviations from Plan

None to the production design. Two process notes:
- The earlier executor was cancelled by a server restart; this run resumed at Task 4 from `7f2b77c`.
- `ci:check` needed one rerun because of the teardown flake described above.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint or trust boundary beyond the plan's threat model. The only new surface, `source`, uses explicit allowlist schemas, selects key id and name only, and the anonymous portal never includes the key id.

## Self-Check: PASSED

- Files exist: `docs/automation-api.md`, `apps/api/test/automation-routes.test.ts`, `apps/api/test/support/routes.ts`, `apps/api/src/api-keys/api-key-rate-limit.guard.ts`, `packages/db/migrations/0020_post_activity_api_key.sql`, `apps/api/test/api-key-attribution.test.ts`.
- All 8 commits are ancestors of HEAD (`git rev-list --count 26bd397..HEAD` = 8).
- `git status` shows only the untracked `.planning/quick/...` directory; STATE.md, ROADMAP.md and PLAN.md are untouched, and nothing was pushed.
