---
phase: quick-261107-1xs
plan: 01
subsystem: push
tags: [web-push, outbox, tenant-isolation, service-worker, vapid]
requires: [quick-261107-052]
provides:
  - send-time recheck with durable `suppressed` status for browser push
  - admin-only tenant-guarded product follow
  - canonical push click url with per-post tag
affects: [apps/api/src/push, apps/web/public/sw.js, apps/web dashboard Products tab]
key-files:
  created:
    - apps/api/src/push/push-follow.controller.ts
    - apps/web/components/workspace-dashboard/product-follow-toggle.tsx
    - apps/api/test/push-worker.test.ts
    - apps/api/test/env.test.ts
    - apps/web/test/push-sw.test.ts
    - apps/web/test/product-follow-toggle.test.tsx
  modified:
    - apps/api/src/push/push.service.ts
    - apps/api/src/push/push.worker.ts
    - apps/api/src/push/push.config.ts
    - apps/api/src/push/push.controller.ts
    - apps/api/src/push/push.module.ts
    - apps/api/src/products/products.controller.ts
    - apps/api/src/env.ts
    - packages/db/src/schema/push.ts
    - apps/web/public/sw.js
    - apps/web/lib/api-server.ts
    - apps/web/app/dashboard/[ws]/page.tsx
    - .env.example
    - compose.yaml
    - apps/api/test/push.test.ts
    - apps/api/test/cross-tenant.test.ts
decisions:
  - "Suppression is terminal: claim picks only pending rows and stale sending rows, so a suppressed row is never replayed (D-14)."
  - "No migration: push_deliveries.status is plain text, `suppressed` is a type-only union edit."
  - "compose.yaml passes VAPID variables with the `:-` form, not `:?`, so CI `docker compose build` keeps working; the API boot check enforces them."
status: complete
completed: 2026-11-06
duration: ~1h
tasks: 4
files: 21
commits: 8
plan_head_before: 1cc0d539580cac18a5801fb87ee223c2af598ccb
plan_head_after: 4b2845b435068d689b14beb556aeb7e120547a2a
actuals:
  tokens: 90000
  tasks: 4
  commits: 8
---

# Phase quick-261107-1xs Plan 01: Browser push slice 8 review defects Summary

Browser push now re-validates every delivery against current state at send time and records a terminal `suppressed` outcome, follows are admin-only behind TenantGuard, clicks land on the real post page, and production refuses to boot without VAPID keys.

## What was built

**Task 1 (tracer): notification path.** All four enqueue methods share one `postUrl` helper (canonical `/{ws}/{product}/p/{n}-{slug}`, bare `/p/{n}` when the title slugifies to nothing) and one `lockBoardEnabled` helper (`SELECT 1 FROM products ... board_enabled AND deleted_at IS NULL FOR SHARE`). Board disable now also deletes `pending`/`sending` push rows by `data->>'productId'` in the same transaction. The encrypted payload carries `tag: post-{postId}` and `renotify: true` for post events. `sw.js` sets `renotify` only with a non-empty tag, resolves the click target against `self.location.origin` (foreign, protocol-relative and unparsable urls fall back to the origin root), focuses an exact-match tab or opens one, never navigates an existing tab.

**Task 2: worker.** `suppressionReason` runs before any encryption or network work, in this order: master switch, per-event flag (all four event types), recipient banned/deleted, then one joined read for Board/product/workspace/post/comment/mute, then follow row and `isWorkspaceAdmin` for `new_post`/`new_comment`. Pinned reasons: `preferences_disabled`, `event_disabled`, `recipient_inactive`, `board_unavailable`, `post_unavailable`, `comment_deleted`, `post_muted`, `not_following`, `not_workspace_admin`. Claim also reclaims `sending` rows older than ten minutes (`FOR UPDATE SKIP LOCKED` retained). 401 and 403 now remove the subscription like 404 and 410. `loadEnv` and `getVapidKeys` both fail in production without VAPID keys (the key check runs before the cache lookup). `.env.example` documents the keys; `compose.yaml` passes them to the api service.

**Task 3: follow.** `POST/DELETE workspaces/:ws/products/:product/push-follow` under `TenantGuard` (product from the slug pair, no `RequireScopes` so API keys get `api_key_route_forbidden`). The raw-id `POST /push/followed-products/:productId` route is removed; the user-scoped `DELETE` stays for the account-page Unfollow. The followed list and both follower queries in `enqueueNewPostPush`/`enqueueNewCommentPush` inner join `workspace_members`. Both new routes are in `CROSS_TENANT_ROUTES`, plus a check that tenant B has no follow rows after the sweep.

**Task 4: dashboard.** `ProductFollowToggle` (native button, `aria-pressed`, `aria-label="Follow {name}"`, optimistic update with rollback and sonner error, disabled while pending) on each Products-tab row. `getPushFollowedProducts` seeds initial state; a failed read renders every toggle off.

## Verification

- RED observed before GREEN in every task (test commits precede fix commits). Task 1 RED: 8 API failures and 8 service-worker failures. Task 2 RED: 29 failures. Task 3 RED: 8 failures. Task 4 RED: module not found.
- The race test fails (2 surviving rows) when the `FOR SHARE` is removed, and passes with it. Verified once locally, then restored.
- `bun run ci:check`: exit 0. Types 32, db 6, API 672 (51 files), web 204 (28 files) tests passed.
- `bun run --filter @userhq/db db:check`: clean; `git status packages/db/migrations` empty (no migration generated).
- Browser: `workspace-dashboard.spec.ts` 1 passed (3.3s) against the rebuilt Docker stack with generated VAPID keys exported into the shell (`.env.docker` untouched). That spec does not exercise the Follow toggle or a push click; the toggle is covered by markup and fetch-stub tests only, not driven in a real browser.

## Deviations from Plan

**1. [Rule 1 - Bug] 404/410/401/403 cannot leave a `failed` row.** The plan asked for the delivery to be marked failed with a message naming the code. `push_deliveries.subscription_id` is `ON DELETE CASCADE`, so deleting the subscription removes the delivery (the pre-existing code updated a row it had just cascaded away, a dead write). I dropped the dead update and the tests assert the subscription is gone and the row no longer exists. Changing the FK would need a migration, which the plan excludes. Consequence: the "failed" audit trail for rejected subscriptions does not exist, and other queued rows for that subscription are dropped too.

**2. [Rule 3 - Blocking] Local Docker smoke DB drift.** After `stack:up` rebuilt the api image, the container crash-looped: the local compose Postgres (port 5433) already contained the four `push_*` tables but `drizzle.__drizzle_migrations` had no record of `0017_browser_push`, so migration 0017 failed with "already exists". This predates my changes (I generated no migration). All four tables had zero rows, so I dropped them in one transaction, and the api re-created them via migrations on restart. Only the local smoke DB was touched. If anyone else relies on that DB's push tables being manually created, they were recreated empty and identical to the migration.

**3. Test-only adjustments.** Existing push.test.ts tests were changed as planned (canonical urls, follow via the new route, a third admin user for the new-post fan-out). The race and cleanup tests use a `beforeEach` that resets the Board flag so one failing test cannot make a later one pass vacuously.

## Residual risk

- Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (and optionally `VAPID_SUBJECT`) in Dokploy before the next API deploy; the API now refuses to start in production without them. Generate once and keep stable.
- Browsers subscribed under the previous throwaway keys will return 401/403 on first send and their subscriptions are removed; users must re-enable push.
- No browser-level check of the Follow toggle or a real notification click was performed.
- Pre-existing lint warnings (unused imports in push.service.ts, push.test.ts, dashboard views) were left alone as out of scope.

## Known Stubs

None.

## Threat Flags

None. The new route is covered by T-1XS-01 and the cross-tenant matrix.

## Self-Check: PASSED

All 8 commits resolve in `git log`; all created files listed above exist; `bun run ci:check` exited 0.
