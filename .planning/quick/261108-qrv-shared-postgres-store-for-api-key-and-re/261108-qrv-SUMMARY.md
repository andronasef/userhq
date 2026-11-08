---
phase: quick-261108-qrv
plan: 01
subsystem: api
tags: [rate-limit, postgres, throttler, multi-replica]
requires: [261107-flq, 261107-s6l]
provides: [shared-rate-limit-store]
affects: [api-keys, webhooks-redeliver, all UserThrottlerGuard routes]
tech-stack:
  added: []
  patterns: [single-statement upsert counter, fail-open store, interval sweeper]
key-files:
  created:
    - packages/db/src/schema/rate-limits.ts
    - packages/db/migrations/0023_rate_limit_hits.sql
    - packages/db/migrations/meta/0023_snapshot.json
    - apps/api/src/common/postgres-throttler-storage.ts
    - apps/api/test/api-key-rate-limit-shared.test.ts
    - apps/api/test/postgres-throttler-storage.test.ts
  modified:
    - packages/db/src/index.ts
    - packages/db/migrations/meta/_journal.json
    - apps/api/src/app.module.ts
    - apps/api/src/api-keys/api-key-rate-limit.guard.ts
    - apps/api/test/support/test-app.ts
    - apps/api/test/api-keys.test.ts
    - apps/api/test/automation-routes.test.ts
    - docs/automation-api.md
decisions:
  - Fail open on rate limit store failure, with a logged warning
  - Logged (not UNLOGGED) table, no index
  - Database clock is the only clock
requirements: [QRV-01, QRV-02, QRV-03, QRV-04, QRV-05, QRV-06]
status: complete
commits: 6
plan_head_before: c09e5746080703c9b82bb3a0bd9d318b3b276bb1
plan_head_after: 390772b94151ac5cdb1b7b0433568f7d1e2f217c
actuals:
  tasks: 3
  commits: 6
---

# Phase quick-261108-qrv Plan 01: Shared Postgres store for API-key and redeliver rate limits Summary

Rate limit counters for API keys and all 12 `@Throttle` routes now live in a `rate_limit_hits` table behind a `PostgresThrottlerStorage` (one upsert per request, database clock), so N API replicas enforce one limit and a restart no longer resets it.

## Commits

| Step | Commit | Message |
| --- | --- | --- |
| Task 1 RED | 009de6d | test: RED two app instances share the api key limit |
| Task 1 GREEN | 7f72f80 | feat: shared postgres storage for api key rate limits |
| Task 2 RED | 1760143 | test: RED block mode parity, redeliver proof, housekeeping and fail-open |
| Task 2 GREEN | df3b6a5 | feat: block mode, housekeeping and fail-open for the shared rate limit store |
| Task 3 RED | 437c3be | test: RED docs state the shared limiter |
| Task 3 GREEN | 390772b | docs: document the shared postgres rate limit store |

`commits: 6` is measured from `git rev-list --count c09e574..HEAD`. No docs artifacts were committed; nothing was pushed.

## RED evidence

- Task 1, HTTP file (assertion failures, not import errors): "jointly enforces API_KEY_RATE_LIMIT across two instances" failed with `expected 200 to be 429`; "130 parallel requests" failed with `expected [ Array(130) ] to have a length of 120 but got 130`. Store file failed on the missing module: `Cannot find module '../src/common/postgres-throttler-storage.js'`.
- Task 2: 8 failures. HTTP: redeliver (`expected 404 to be 429`), account preferences (31st request not limited), fail-open (the store error was unhandled and surfaced as a 500: `relation "rate_limit_hits" does not exist`). Store: block-state seeding, one-query-in-block-mode, `purgeExpired`, sweeper and fail-open cases failed (5 of 13), on missing exports or the in-process block branch. The block-mode parity case passed at RED because the delegation branch is the oracle itself, as expected for the sequencing boundary.
- Task 3: `AssertionError: expected '8. Rate limits ...' to contain 'kept in PostgreSQL'`.

## What was built

- `rate_limit_hits (key text pk, hits bigint[], blocked_until, touched_at, expires_at bigint)`. Migration 0023 is generated, one `CREATE TABLE`, no `device_info`. `db:generate` reports no schema changes, `db:check` passes, db migration tests pass.
- `PostgresThrottlerStorage` implements `ThrottlerStorage`; two static statements (sliding no-block for `blockDuration` 0, block-then-reset for above 0). Passed to `ThrottlerModule.forRoot({ throttlers, storage })`, so `ThrottlerGuard` routes and `ApiKeyRateLimitGuard` (through `@InjectThrottlerStorage()`) move together.
- `purgeExpired()` plus `RateLimitSweeper` (60 s interval, unref, non-overlapping, errors logged, no interval under NODE_ENV test).
- `createTestApp` joins an existing database when `DATABASE_URL` is supplied (the creator owns the drop). No `listen` change; `test-isolation.test.ts` passes.
- `api-keys.test.ts` bucket test now compares `rate_limit_hits` rows before and after; behaviour asserted is unchanged.
- Docs section 8, guard comment and storage header describe the shared behaviour, per-request cost, and fail-open.

## Proven

- Two apps on one database: 120 per key jointly, 121st is 429 `rate_limited` with an integer `Retry-After` on either app; other key and human unaffected; a third app does not reset counters; a fourth after a close is still refused.
- 130 parallel requests across two apps: exactly 120 x 200 and 10 x 429. 50 parallel store calls with limit 20: exactly 20 allowed from one store and from two pools.
- Parity against the throttler package's own storage in both modes (`isBlocked`, `totalHits`, `timeToExpire` within 1 s; `timeToBlockExpire` within 1 s when blocked).
- Redeliver (`REDELIVER_THROTTLE`, 10) and account preferences (30) are enforced across two instances.
- Fail open: table renamed away, key request returns 200, warn contains "fail open", limiting resumes after the rename back.
- Unchanged suites pass: votes, comments, uploads, webhook-worker, account, unsubscribe, api-keys.

## Final gate: `bun run ci:check` at default parallelism

| Run | Exit | API tests | Web tests | Other |
| --- | --- | --- | --- | --- |
| 1 | 0 | 62 files, 807 tests passed | 31 files, 280 tests passed | types 32, db 6, db:check ok |
| 2 | 0 | 62 files, 807 tests passed | 31 files, 280 tests passed | types 32, db 6, db:check ok |

## QRV-06: audit of other limiters

- Nine controllers use `UserThrottlerGuard` with 12 `@Throttle` sites: `uploads`, `portal-votes` (x2), `portal-comments`, `portal-posts`, `portal-mutes` (x2), `admin-posts`, `webhooks` (redeliver), `email/unsubscribe`, `account` (preferences and delete). All shared the same per-process gap and are all migrated by the one storage swap.
- Better Auth's built-in limiter: `apps/api/src/auth/auth.ts` sets no `rateLimit` option and no `secondaryStorage`. In better-auth 1.7.7 (`dist/context/create-context.mjs`) the limiter is enabled in production and its storage defaults to `"memory"`, so it keeps process-local counters. Listed, not migrated. Moving it needs Better Auth's database storage option and its own schema table, a separate task. Sign-in throttling therefore remains per replica.

## Decisions

- Fail open (QRV-03): counters protect availability and abuse, not secrets. No throttled route is credential guessing; API-key authentication and its 401 run before and independent of the limiter. Recorded in code, docs and tests. A future secret-guarding limiter must not reuse this path silently.
- Logged table, not UNLOGGED: drizzle-orm 0.45.3 and drizzle-kit 0.31.11 cannot express UNLOGGED without hand-editing generated SQL, and a logged table keeps counters across a Postgres crash.
- No index: every request rewrites its row, and an index on `expires_at` would block in-place updates; the sweeper scans a table that holds only active limiter keys.
- Database clock only (`clock_timestamp()`), so replica clock skew cannot matter.
- `X-RateLimit-Reset` now counts down to the oldest counted hit leaving the window, instead of the old fixed per-key countdown. Nothing in tests or web reads it.
- The throttler name is not stored; keys already embed it.

## Ceilings

- No query timeout: a hung store waits like any other call on the shared pool.
- No batching of the purge DELETE.
- One database write per keyed request (a route with its own limit costs one more).
- The package's in-process storage reports a meaningless negative `timeToBlockExpire` when not blocked; the new storage returns 0 there. Callers only read it when blocked.

## Deviations from Plan

None - plan executed as written. The Task 1 delegation of block mode to the package's memory storage was the planned sequencing boundary and was replaced in Task 2.

Environment note: colima was stopped at start; `colima start` and `bun run dev:services` brought Postgres up.

## Known Stubs

None.

## Threat Flags

None. The new table holds opaque keys and epoch-ms integers only.

## Self-Check: PASSED

- Files present: rate-limits.ts, 0023 SQL and snapshot, postgres-throttler-storage.ts, both new test files, this SUMMARY.
- All six commits are ancestors of HEAD; `git status` shows only untracked planning paths that were not mine.
- `0023` appears once in `ls packages/db/migrations`, has 0 `device_info` lines and 1 `CREATE TABLE`; no leftover "in-memory" or "per API process" wording in the guard, storage or docs.
