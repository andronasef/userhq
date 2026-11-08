---
phase: quick-261108-qrv
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QRV-01, QRV-02, QRV-03, QRV-04, QRV-05, QRV-06]
files_modified:
  - packages/db/src/schema/rate-limits.ts
  - packages/db/src/index.ts
  - packages/db/migrations/0023_rate_limit_hits.sql
  - packages/db/migrations/meta/_journal.json
  - packages/db/migrations/meta/0023_snapshot.json
  - apps/api/src/common/postgres-throttler-storage.ts
  - apps/api/src/app.module.ts
  - apps/api/src/api-keys/api-key-rate-limit.guard.ts
  - apps/api/test/support/test-app.ts
  - apps/api/test/api-key-rate-limit-shared.test.ts
  - apps/api/test/postgres-throttler-storage.test.ts
  - apps/api/test/api-keys.test.ts
  - apps/api/test/automation-routes.test.ts
  - docs/automation-api.md
estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Two independent Nest app instances (separate pools, separate processes' worth of state) on one database jointly enforce API_KEY_RATE_LIMIT (120 per 60 s per key): requests 1-120 split across the two return 200, request 121 on either returns 429 rate_limited with an integer Retry-After. Another key and a signed-in human on the same route are unaffected.
    - A freshly created app instance does not reset counters. Counters survive app restarts.
    - Concurrency is exact. 50 parallel store calls with limit 20 allow exactly 20 and reject 30, from one store and from two stores on separate pools. 130 parallel HTTP requests across two apps allow exactly 120.
    - The counter update is one INSERT ... ON CONFLICT DO UPDATE statement per request, one round trip, no read-modify-write, using the database clock so replica clock skew cannot matter.
    - Behaviour is unchanged for callers. Same constants, same 429 body, same Retry-After header. Sliding window with no counting of refused hits when blockDuration is 0 (API keys). Block-then-reset when blockDuration is above 0 (the 12 @Throttle routes, including redeliver). A parity test runs the same call script against the throttler package's own memory storage and the Postgres storage and requires matching isBlocked and totalHits, and timeToBlockExpire / timeToExpire within one second.
    - The 12 @Throttle routes on UserThrottlerGuard (uploads, votes, comments, posts, mutes, admin posts, account preferences and delete, unsubscribe, redeliver) all use the module-level storage, so one storage swap moves all of them. Redeliver (REDELIVER_THROTTLE 10 per 60 s) is proven across two instances.
    - Store failure never takes the API down. Decision (QRV-03) is fail open with a logged warning. Rate-limit counters protect availability and abuse, not secrets; no throttled route is credential guessing (API-key authentication, 401 for bad tokens, runs before and independent of the limiter, and sign-in throttling belongs to Better Auth). The decision is recorded in code, docs, tests and SUMMARY.
    - Expired rows are deleted by an interval job with the webhook retention job's shape (setInterval skipped in NODE_ENV test, unref, non-overlapping tick, errors logged not thrown). It never deletes a live or blocked row.
    - The migration comes from drizzle-kit generate only, with no device_info statement, db:generate then reports no schema changes, db:check passes, and the packages/db migration upgrade tests still pass.
    - docs/automation-api.md section 8 and the guard comment no longer describe a process-local limiter, and state the shared Postgres behaviour and the per-request cost. 261107-flq / 261107-s6l docs-sync assertions still pass.
    - bun run ci:check at default parallelism exits 0 twice in a row.
  artifacts:
    - packages/db/src/schema/rate-limits.ts
    - packages/db/migrations/0023_rate_limit_hits.sql
    - apps/api/src/common/postgres-throttler-storage.ts
    - apps/api/test/api-key-rate-limit-shared.test.ts
    - apps/api/test/postgres-throttler-storage.test.ts
    - docs/automation-api.md
  key_links:
    - ThrottlerModule.forRoot accepts { throttlers, storage }. Passing the Postgres storage there swaps it for ThrottlerGuard (every UserThrottlerGuard route) and for ApiKeyRateLimitGuard, which reads the same instance through @InjectThrottlerStorage(). One swap, no per-guard code path.
    - ThrottlerGuard passes blockDuration = ttl by default (route/throttler blockDuration ?? ttl), so every @Throttle route runs the block-mode path; ApiKeyRateLimitGuard passes 0 and runs the sliding no-block path. The storage must implement both or the swap changes behaviour of the human routes.
    - The throttler storage key already embeds the throttler name for ThrottlerGuard keys (md5 of class, handler, throttler name, tracker) and is the literal api-key:{id} for the key guard, so the Postgres primary key is the key alone and the throttlerName argument is not stored.
    - apps/api/test/api-keys.test.ts "an invalid token is 401 and creates no limiter bucket" reads the in-process storage's .storage Map. That introspection stops existing, so the test is rewritten to compare rows of the new table before and after; the asserted behaviour is identical.
---

<objective>
Make the API-key and redeliver rate limits correct when more than one API replica runs, using the PostgreSQL that is already deployed. No Redis, no new service, no new dependency.

Purpose: 261107-flq and 261107-s6l shipped limiters whose counters live in each API process. With N replicas the effective limit becomes N times the documented one, and a restart wipes the counters. A leaked or runaway automation key is exactly the case the key limit exists for. docs/automation-api.md and the guard comment both name this as the known ceiling.
Output: a `rate_limit_hits` table (generated migration 0023), a `PostgresThrottlerStorage` behind the existing `ThrottlerStorage` interface and wired through `ThrottlerModule.forRoot`, a housekeeping job, a fail-open policy with a test, RED-first multi-instance proofs, updated docs and comments, and a report of every other limiter found.

Requirement ids (from the brief): QRV-01 shared atomic Postgres store, same keys and semantics; QRV-02 Drizzle schema plus generated migration; QRV-03 housekeeping plus failure mode decision with a test; QRV-04 RED-first tests; QRV-05 docs and comment updates, single round trip; QRV-06 audit and migrate or list the other in-memory throttler storage.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@.planning/quick/261107-flq-api-key-management-lockout-integration-a/261107-flq-SUMMARY.md
@.planning/quick/261107-s6l-webhook-secret-rotation-missing-events-w/261107-s6l-SUMMARY.md
@.planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-SUMMARY.md
@apps/api/src/api-keys/api-key-rate-limit.guard.ts
@apps/api/src/feedback/throttle.ts
@apps/api/src/app.module.ts
@apps/api/src/webhooks/webhook.worker.ts
@apps/api/test/support/test-app.ts
@packages/db/src/index.ts
@packages/types/src/api-keys.ts

Ground rules from the orchestrator. Run API tests as `bun run --filter @userhq/api test <explicit files> --no-file-parallelism`, never `bun test`. Postgres is running (colima up, `bun run dev:services`). `@userhq/types` and `@userhq/db` are consumed from `dist`, so run `bun run build:packages` after editing anything under `packages/db/src` or `packages/types/src` before API typecheck or tests. No new dependencies. Migrations come only from `bun run --filter @userhq/db db:generate`, never `drizzle-kit push`. Do not edit STATE.md or ROADMAP.md. Do not push. Commit each task atomically with the quick id `quick-261108-qrv`, with a `test(...)` RED commit before each `feat(...)` GREEN commit. Other agents may be working in this directory: preserve unrelated changes (`.planning/ui-reviews/` is untracked and not yours). Do not read or print `.env.docker` or `env.local.dev`. No emojis anywhere.

Discovery: Level 0. The pattern exists: `@nestjs/throttler` 6.7.1 `ThrottlerModule.forRoot({ throttlers, storage })` takes a custom `ThrottlerStorage`; `WebhookWorker` is the interval-job template; `db.execute(sql...)` and `(res as any).rows ?? res` is the raw-SQL idiom; `pg.Pool` is already built in `AppModule.register` as `deps.pool`.

Facts grounded in the code (read, not assumed):
- `ThrottlerStorage` is one method: `increment(key, ttl, limit, blockDuration, throttlerName)` returning `{ totalHits, timeToExpire, isBlocked, timeToBlockExpire }` (seconds for the last two). ttl and blockDuration are milliseconds.
- `ApiKeyRateLimitGuard` calls it with key `api-key:{id}`, ttl 60000, limit 120, blockDuration 0, name "api-key", and answers `Retry-After = max(1, timeToBlockExpire)` with `ApiException("rate_limited", 429, ...)`. API_KEY_RATE_LIMIT lives in `packages/types/src/api-keys.ts`.
- The built-in storage with blockDuration 0 is a sliding-window log: every counted hit has its own expiry of ttl, a hit is refused (and not counted) when live hits are already at the limit, and `timeToBlockExpire` is the seconds until the oldest live hit leaves the window. With blockDuration above 0 it counts the exceeding hit, then blocks the key for blockDuration, then on expiry resets to a single fresh hit.
- `ThrottlerGuard` resolves `blockDuration` as route value, else throttler value, else ttl. So the 12 `@Throttle` sites on `UserThrottlerGuard` (uploads.controller, portal-votes x2, portal-comments, portal-mutes x2, admin-posts, portal-posts, webhooks.controller redeliver, unsubscribe, account x2) all run the block path with blockDuration equal to ttl.
- No test or web code reads X-RateLimit-Remaining / X-RateLimit-Reset. ThrottlerGuard emits them from `totalHits` and `timeToExpire`.
- `createTestApp` always creates and drops its own database. `overrides` is spread last into env, so `DATABASE_URL` can already be overridden, but a throwaway database would still be created. `test-isolation.test.ts` guards the loopback-listener invariant and must keep passing; this plan adds no `listen` call.
- Migration tests derive their expected count from `_journal.json`, so migration 0023 needs no test edit.
- Drizzle pg-core 0.45.3 and drizzle-kit 0.31.11 contain no UNLOGGED option (grepped). Decision: logged table. An UNLOGGED table would need a hand edit of generated SQL, which the brief forbids, and a logged table keeps counters across a Postgres crash.
- Better Auth is configured in `apps/api/src/auth/auth.ts` with no `rateLimit` option. Its own limiter is a separate mechanism, not @nestjs/throttler.

Verified SQL shape (prototyped against a throwaway local Postgres on 2026-11-08, database dropped). Positional parameters: $1 key, $2 ttl ms, $3 limit, $4 block ms (block statement only). `L` is the live-hits subselect `ARRAY(SELECT h FROM unnest(r.hits) AS h WHERE h > excluded.touched_at - $2::bigint)`. In the block statement, `B` is `CASE WHEN r.blocked_until > 0 AND r.blocked_until <= excluded.touched_at THEN '{}'::bigint[] ELSE L END` and `SB` is `r.blocked_until > excluded.touched_at`. Build the two statements as static strings from shared JS constants for L, B and SB. Observed: limit 3 gave hits 1,2,3 allowed then refused; 50 parallel calls with limit 20 gave exactly 20 allowed and 30 refused; block mode gave 1,2,3 allowed, refused from the 4th, and a backdated block reset to a single fresh hit.

No-block statement (blockDuration 0):

    INSERT INTO rate_limit_hits AS r (key, hits, blocked_until, touched_at, expires_at)
    SELECT $1::text, ARRAY[c.n], 0, c.n, c.n + $2::bigint
    FROM (SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint AS n) AS c
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN cardinality(L) >= $3::int THEN L ELSE L || excluded.touched_at END,
      blocked_until = CASE WHEN cardinality(L) >= $3::int
                           THEN (SELECT min(h) FROM unnest(L) AS h) + $2::bigint ELSE 0 END,
      touched_at = excluded.touched_at,
      expires_at = excluded.touched_at + $2::bigint
    RETURNING cardinality(hits)::int AS hits_count,
              (SELECT min(h) FROM unnest(hits) AS h) AS oldest, blocked_until, touched_at

Block statement (blockDuration above 0): same INSERT ... SELECT head and RETURNING, with

      hits = CASE WHEN SB THEN L ELSE B || excluded.touched_at END,
      blocked_until = CASE WHEN SB THEN r.blocked_until
                           WHEN cardinality(B) >= $3::int THEN excluded.touched_at + $4::bigint
                           ELSE 0 END,
      touched_at = excluded.touched_at,
      expires_at = excluded.touched_at + $2::bigint

Reading the result (bigint columns arrive as strings, wrap in Number): `rejected = blocked_until > touched_at`; `isBlocked = rejected`; `timeToBlockExpire = rejected ? ceil((blocked_until - touched_at) / 1000) : 0`; `timeToExpire = ceil((oldest + ttl - touched_at) / 1000)`; `totalHits = hits_count + (rejected and blockDuration <= 0 ? 1 : 0)` (the built-in storage reports limit plus one for a refused hit). `blocked_until` therefore means "refused until this epoch-ms": the end of the block in block mode, and the moment the oldest counted hit leaves the window in no-block mode.

Source coverage audit (no CONTEXT.md, no RESEARCH.md, quick task): GOAL multi-replica-safe limiters on Postgres, covered by Tasks 1-2. QRV-01 Task 1 (no-block) and Task 2 (block). QRV-02 Task 1. QRV-03 Task 2. QRV-04 RED commits in Tasks 1 and 2. QRV-05 Task 3. QRV-06 Task 2 (the swap covers all 12 sites; parity and two-instance proof) and the SUMMARY report in Task 3. Out of scope and not planned: Redis or any new service, changing any limit constant, Better Auth's own limiter (reported only), a store query timeout (listed in SUMMARY as a ceiling).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>1. Tracer: two app instances on one database jointly enforce the API-key limit, through a Postgres storage</name>
  <files>apps/api/test/support/test-app.ts, apps/api/test/api-key-rate-limit-shared.test.ts, apps/api/test/postgres-throttler-storage.test.ts, packages/db/src/schema/rate-limits.ts, packages/db/src/index.ts, packages/db/migrations/0023_rate_limit_hits.sql, packages/db/migrations/meta, apps/api/src/common/postgres-throttler-storage.ts, apps/api/src/app.module.ts, apps/api/test/api-keys.test.ts</files>
  <precondition>Postgres is reachable at the test default (userhq@127.0.0.1:5432) so createTestApp and the migration tests can create temporary databases.</precondition>
  <read_first>
    - apps/api/src/api-keys/api-key-rate-limit.guard.ts (whole file: the exact storage call and Retry-After handling that must not change)
    - apps/api/src/app.module.ts lines 55-148 (ThrottlerModule.forRoot, APP_GUARD order, providers)
    - apps/api/test/support/test-app.ts (whole file: database creation, env spread, close order)
    - apps/api/test/api-keys.test.ts lines 1-75 and 410-520 (fixture shape, asAdmin, mint, the existing limit test and the bucket-introspection test that must be rewritten)
    - apps/api/test/test-isolation.test.ts lines 1-80 (the listener invariant this plan must not disturb)
    - packages/db/src/schema/webhooks.ts lines 1-45 (schema style) and packages/db/src/index.ts (schema barrel, Db type)
    - apps/api/node_modules/@nestjs/throttler/dist/throttler.service.js (the reference semantics for blockDuration 0)
  </read_first>
  <behavior>
    HTTP level, new file apps/api/test/api-key-rate-limit-shared.test.ts (two apps, one database):
    - Two key requests alternate across app A and app B until 120 total return 200; the 121st returns 429 with code "rate_limited" and an integer Retry-After from 1 to 60, on app A and again on app B.
    - A second key is unaffected on both apps; a signed-in human on the same route is unaffected on both apps.
    - A third app C created after exhaustion still returns 429 for the exhausted key (a new instance does not reset counters). After closing C, a fourth app D is still refused (restart).
    - 130 parallel requests alternating across A and B return exactly 120 responses with status 200 and exactly 10 with status 429, never more than 120 allowed.
    Store level, new file apps/api/test/postgres-throttler-storage.test.ts (blockDuration 0 only in this task):
    - 50 parallel increment calls with limit 20 allow exactly 20 and refuse 30, from one storage and from two storages built on two separate pools.
    - A refused call does not consume a slot: after the window the next call is allowed and totalHits for a refused call is limit plus one.
    - Different keys are independent.
    - Retry-After value: seed one row with 120 live hits whose oldest is 45 seconds old; the 121st call is refused with timeToBlockExpire between 14 and 15.
    - Window expiry frees slots: seed a row whose hits are all older than the ttl; the next call is allowed and the row holds exactly one hit. Seed hits at 50, 40 and 30 seconds old with limit 3; a call is refused with timeToBlockExpire 10 (sliding, not fixed), and with the oldest moved to 61 seconds old a call is allowed.
    - The row after a call contains only epoch-ms integers, the key, and no other data.
  </behavior>
  <action>Implements QRV-01, QRV-02 and QRV-04 for the API-key path. Start with the harness: in apps/api/test/support/test-app.ts, when `overrides.DATABASE_URL` is set, skip createTestDatabase, use that url, and make close() skip the drop (the creator of the database owns its drop); with no override the behaviour is byte-for-byte what it is today, and add no listen call. Then write both new test files from the behavior list and capture RED. The HTTP file imports only things that already exist (createTestApp, signedInCookie, schema, API_KEY_RATE_LIMIT), seeds a workspace, an owner membership and two requests:read keys the way apps/api/test/api-keys.test.ts does, builds the second and later apps with `createTestApp({ DATABASE_URL: first.env.DATABASE_URL })`, reuses one session cookie across apps (sessions are database-backed and the secret is the same), and must fail on its assertions, not on an import, because each app currently has its own counter. The store file imports `PostgresThrottlerStorage` from src/common/postgres-throttler-storage.js and the `rateLimitHits` table from @userhq/db, so it is allowed to fail at import for RED; seed rows through the schema import, never by guessing column names. Record both RED outputs, then commit as `test(quick-261108-qrv): RED two app instances share the api key limit`. GREEN: add packages/db/src/schema/rate-limits.ts exporting `rateLimitHits` for table `rate_limit_hits` with columns key (text primary key), hits (bigint array in number mode, not null), blocked_until (bigint number mode, not null, default 0), touched_at (bigint number mode, not null) and expires_at (bigint number mode, not null); add no index (every request rewrites the row and an index on expires_at would block in-place updates; the sweeper scans a table that holds only active limiter keys); a short comment states it is global infrastructure keyed by opaque limiter keys, holds only timestamps, and carries no tenant data. Export it from packages/db/src/index.ts in the schema map and the export list. Run `bun run build:packages`, then `bun run --filter @userhq/db db:generate -- --name rate_limit_hits`. Open the new SQL: it must be one CREATE TABLE; if it contains device_info lines from a stale snapshot, delete those lines and re-run db:generate until it prints no schema changes, then run db:check. Do not hand-edit the SQL otherwise (no UNLOGGED: the schema builder cannot express it and a logged table keeps counters across a database crash). Create apps/api/src/common/postgres-throttler-storage.ts exporting `PostgresThrottlerStorage implements ThrottlerStorage`, built from a `pg.Pool`. Its `increment` makes exactly one `pool.query` with the verified no-block statement from the context section for blockDuration 0 and maps the row as described there; the database clock is the only clock, the SQL text is a static string with bound parameters only, and the throttlerName argument is ignored with a one-line reason. For blockDuration above 0 in this task, delegate the call to a private instance of the throttler package's built-in memory storage (the same class ThrottlerModule uses by default), so the human routes behave exactly as before while the key path moves; Task 2 replaces that branch with the shared block statement, and the delegation is a sequencing boundary, not a design. The mapping assumes limit of at least 1, so throw a clear error from the constructor path or increment if limit is below 1. In apps/api/src/app.module.ts create one `new PostgresThrottlerStorage(deps.pool)` inside register and pass it as `ThrottlerModule.forRoot({ throttlers: [the existing default throttler], storage })`; keep the global guard order and the existing default throttler values. Change nothing in ApiKeyRateLimitGuard except what Task 3 will do to its comment. Rewrite the api-keys.test.ts bucket-introspection test to read `rateLimitHits` rows (all keys) before and after the invalid-token request and assert equality; the asserted behaviour (401 api_key_invalid and no bucket created) is unchanged. Run both new files to GREEN and commit schema, migration, storage, wiring and the rewritten test as `feat(quick-261108-qrv): shared postgres storage for api key rate limits`.</action>
  <acceptance_criteria>
    - RED captured before implementation: the HTTP file fails on assertions (more than 120 allowed across two apps, or a new app resetting counters), and the store file fails on the missing module. Both outputs are quoted in the SUMMARY.
    - After GREEN, all new tests pass and the existing "limits each key to API_KEY_RATE_LIMIT" and "invalid token creates no limiter bucket" tests in api-keys.test.ts pass.
    - `ls packages/db/migrations | grep -c 0023_` prints 1, `grep -c 'device_info' packages/db/migrations/0023_rate_limit_hits.sql` prints 0, `grep -c 'CREATE TABLE' packages/db/migrations/0023_rate_limit_hits.sql` prints 1.
    - `bun run --filter @userhq/db db:generate` reports no schema changes after the commit and `bun run --filter @userhq/db db:check` exits 0. `bun run --filter @userhq/db test` (migration upgrade tests) passes.
    - The increment path issues exactly one query per call (assert with a spy on pool.query in the store test) and contains no SELECT-then-UPDATE.
    - test/test-isolation.test.ts still passes.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/api-key-rate-limit-shared.test.ts test/postgres-throttler-storage.test.ts test/api-keys.test.ts test/automation-routes.test.ts test/test-isolation.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck && bun run --filter @userhq/db test && bun run --filter @userhq/db db:check</automated>
    <fails_when>Two apps on one database allow more than 120 key requests in total, a new app instance starts with empty counters, 50 parallel calls allow more than the limit, a refused call consumes a slot, Retry-After is not the seconds until the oldest counted hit leaves the window, the increment uses more than one query, the migration contains device_info or more than the one table, or any listed suite, the typecheck, the db tests or db:check fails.</fails_when>
  </verify>
  <done>One keyed request is counted in Postgres through the existing storage interface, two independent app instances enforce one shared limit, concurrency is exact, and the migration is generated and clean, with RED and GREEN evidence recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>2. Expand: block mode for the 12 @Throttle routes, redeliver proof, housekeeping job, fail-open policy</name>
  <files>apps/api/src/common/postgres-throttler-storage.ts, apps/api/src/app.module.ts, apps/api/test/postgres-throttler-storage.test.ts, apps/api/test/api-key-rate-limit-shared.test.ts</files>
  <read_first>
    - apps/api/src/common/postgres-throttler-storage.ts (Task 1 output, including the delegation branch to replace)
    - apps/api/src/webhooks/webhook.worker.ts lines 54-122 (interval start skipped in test, unref, running flag, tick returning null when busy, purge idiom)
    - apps/api/src/webhooks/webhooks.controller.ts lines 40-45 and 183-205 (REDELIVER_THROTTLE and the guard order on the redeliver route)
    - apps/api/src/account/account.controller.ts lines 136-160 (preferences route: PATCH, 30 per 60 s, session user, body commentEmails)
    - apps/api/test/webhook-worker.test.ts lines 515-520 and 597-610 (how the redeliver limit is asserted today)
    - apps/api/node_modules/@nestjs/throttler/dist/throttler.service.js lines 94-139 (block-mode reference semantics for the parity test)
  </read_first>
  <behavior>
    Parity (store file, both modes; the oracle is the throttler package's own memory storage called with identical arguments): for limit 3, ttl 60000, six sequential calls, isBlocked and totalHits match the oracle at every step and timeToBlockExpire and timeToExpire are each within 1 second of it. Run once with blockDuration 0 and once with blockDuration 60000.
    Block mode semantics (seeded, deterministic): a key blocked until 30 seconds from now stays refused with timeToBlockExpire 30 (plus or minus 1) and gains no hit while blocked; with blocked_until moved into the past, the next call is allowed and the row holds exactly one fresh hit and blocked_until 0.
    HTTP two-instance:
    - Redeliver: with one admin on a workspace they own, 10 redeliver POSTs split across app A and app B return non-429 (guards run before the handler, so unknown delivery ids answering 404 still count), and the 11th on either app returns 429 rate_limited with an integer Retry-After. The limit comes from REDELIVER_THROTTLE, not a literal.
    - A second @Throttle route, account preferences (PATCH, limit 30): 30 requests split across A and B succeed and the 31st on either returns 429.
    Housekeeping:
    - purgeExpired deletes rows whose expires_at and blocked_until are both in the past, keeps a row with a live hit, keeps a row blocked into the future, and returns the deleted count.
    - The sweeper tick returns null when a pass is already running (hold the first with a gate on purgeExpired, call tick again, release, assert one purge), and resolves without throwing when the table is missing, logging a warning. No interval is started under NODE_ENV test.
    Failure mode (fail open): with the table renamed away, storage.increment resolves with isBlocked false and does not reject, a key request through the HTTP stack returns 200 (not 5xx and not 429), and Logger.warn was called with a message containing "fail open". After renaming the table back, limiting resumes (the next calls count).
  </behavior>
  <action>Implements QRV-01 (block mode), QRV-03 and QRV-06. Write the new tests first and capture RED. In the store file add the parity, block-semantics, housekeeping and failure-mode cases; in the HTTP file add the redeliver and account-preferences two-instance cases, reusing the Task 1 fixture style (workspace plus owner membership by direct insert, one session cookie reused across apps, Origin header set to the app's PUBLIC_URL on mutating requests). For the HTTP failure case, rename the table with a plain query on the shared database and rename it back in a finally block. Spy with vi.spyOn on Logger.prototype.warn. The block-semantics, parity (block mode), purge, sweeper and failure cases must fail at RED for real reasons: the delegation branch makes block-mode seeding and the table-based assertions fail, and missing exports fail the housekeeping cases. Record RED and commit as `test(quick-261108-qrv): RED block mode parity, redeliver proof, housekeeping and fail-open`. GREEN in postgres-throttler-storage.ts: (a) replace the delegation branch with the verified block statement from the context section, built from the same shared L constant, so both modes are the single-statement upsert and the memory-storage instance is gone from the source file; (b) wrap the query in a try/catch: on any error log one warning through a Nest Logger, whose text begins "Rate limit store failed, allowing the request (fail open):" followed by the error message and the throttler name (never the key), and return an allowed record (isBlocked false, totalHits 0, timeToBlockExpire 0, timeToExpire the ttl in seconds) so the caller proceeds; document at the top of the file that this is the chosen policy and why (counters protect availability and abuse, no throttled route guards a secret, authentication runs before and independent of the limiter), and that a future limiter that guards a secret must not reuse this path silently; (c) add `purgeExpired(): Promise<number>` doing one DELETE of rows where expires_at and blocked_until are both below the database clock, returning the deleted count; (d) add an `@Injectable()` sweeper class in the same file shaped exactly like the WebhookWorker interval job: setInterval of 60000 ms started in onApplicationBootstrap only when env.NODE_ENV is not "test", unref, cleared in onApplicationShutdown, a `running` flag so ticks never overlap, `tick()` returning null when busy and otherwise the purge count, and a catch inside tick that logs a warning and never rethrows (an unhandled rejection from a timer would crash the process). In app.module.ts register the storage instance as a provider under its class token with useValue, add the sweeper as a provider, and let the sweeper take the storage by that token and ENV by the existing token. State once in a ponytail-style comment the ceilings: no batching of the delete (table holds only active limiter keys), no query timeout (a hung store waits like any other database call on the shared pool). Run the new cases to GREEN, then run the existing throttle-bearing suites unchanged (votes, comments, uploads, webhook-worker, api-keys, account, unsubscribe) to prove the block-mode swap changed no human-route behaviour, and commit as `feat(quick-261108-qrv): block mode, housekeeping and fail-open for the shared rate limit store`.</action>
  <acceptance_criteria>
    - RED captured; after GREEN every new case passes, including parity in both modes.
    - votes.test.ts (61st vote 429), comments.test.ts (6th post and 11th comment 429), uploads.test.ts, webhook-worker.test.ts (11th redeliver 429), account.test.ts and unsubscribe.test.ts all pass unchanged.
    - `grep -c 'ThrottlerStorageService' apps/api/src/common/postgres-throttler-storage.ts` prints 0 and the file's increment path contains exactly one pool.query call site per mode statement (the spy test from Task 1 still asserts one query per call for both modes).
    - The failure-mode tests prove: no rejection, HTTP 200, a warn containing "fail open", and recovery after the table is restored.
    - No setInterval is created under NODE_ENV test (asserted).
  </acceptance_criteria>
  <verify>
    <automated>bun run --filter @userhq/api test test/postgres-throttler-storage.test.ts test/api-key-rate-limit-shared.test.ts test/votes.test.ts test/comments.test.ts test/uploads.test.ts test/webhook-worker.test.ts test/account.test.ts test/unsubscribe.test.ts test/api-keys.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck</automated>
    <fails_when>Block mode differs from the oracle on isBlocked or totalHits, redeliver or a second @Throttle route allows more than its limit across two instances, an expired row is kept or a live or blocked row is deleted, two sweeper ticks overlap, a store error rejects increment, surfaces as a 5xx, or logs nothing, or any listed suite or the typecheck fails.</fails_when>
  </verify>
  <done>Every limiter that uses the module-level throttler storage (API keys and all 12 @Throttle routes, including redeliver) is shared across instances with unchanged semantics, expired rows are swept without overlap, and a store failure degrades to a logged fail-open instead of an outage.</done>
</task>

<task type="auto">
  <name>3. Docs, comments, audit report, and the final gate</name>
  <files>docs/automation-api.md, apps/api/src/api-keys/api-key-rate-limit.guard.ts, apps/api/src/common/postgres-throttler-storage.ts, apps/api/test/automation-routes.test.ts</files>
  <read_first>
    - docs/automation-api.md lines 215-232 (section 8 as it stands) and lines 316-330 (the redelivery bullet that points to Rate limits)
    - apps/api/test/automation-routes.test.ts lines 1-30 and 128-160 (section() helper and the two existing rate-limit docs assertions that must keep passing)
    - apps/api/src/api-keys/api-key-rate-limit.guard.ts lines 1-20 (the ceiling comment to replace)
  </read_first>
  <action>Implements QRV-05 and the QRV-06 report. Docs-sync RED first: in apps/api/test/automation-routes.test.ts add one test that the Rate limits section states the new behaviour: it contains the phrases "kept in PostgreSQL" and "fail open", and it no longer contains the old process-local sentence (it begins "The counter lives in"); leave the two existing assertions (the 120-per-60-seconds sentence and the redeliver sentence built from REDELIVER_THROTTLE) untouched, and confirm the new test fails against the current docs, then commit as `test(quick-261108-qrv): RED docs state the shared limiter`. GREEN: in docs/automation-api.md section 8 replace only the bullet that describes a per-process counter with these statements, keeping every other bullet and the existing sentences verbatim: counters are kept in PostgreSQL, so every API replica counts against the same limit and a restart does not reset it; each keyed request costs one small database write, and a route with its own limit costs one more; if the counter store is unavailable the request is allowed and a warning is logged, so rate limits fail open while authentication does not depend on them. In api-key-rate-limit.guard.ts replace the ceiling note in the class comment with the new behaviour (counters live in PostgreSQL through the shared throttler storage and are exact across any number of API instances; one upsert per keyed request; fail open on store failure, see the storage file) and keep the existing explanation of why the storage is called directly (header name). Make sure the storage file header states the chosen failure policy, the clock choice (database clock, so replica skew cannot matter) and the meaning of blocked_until in each mode. Do not touch any limit constant. Then run the final gate: `bun run ci:check` at default parallelism, twice in a row, both exit 0 (each run is long; use a generous timeout or a background run and wait for its exit code). Commit docs, comments and the test as `docs(quick-261108-qrv): document the shared postgres rate limit store`. In the SUMMARY (written by the executor per the workflow) include the QRV-06 report: the 12 @Throttle sites and the nine controllers that use UserThrottlerGuard, all of which shared the same per-process gap and are all migrated by the one storage swap (list them); Better Auth's built-in limiter in apps/api/src/auth/auth.ts is a separate mechanism with no rateLimit option configured, so it keeps its library default of process-local counters in production (confirm against the installed better-auth version's docs or source before stating it) and is listed here, not migrated, with the note that its database storage option needs a Better Auth schema table and a separate task; the decisions (fail open and why, logged table and why no UNLOGGED, no index, database clock, X-RateLimit-Reset now counts down to the oldest counted hit leaving the window instead of the old fixed per-key countdown, which nothing reads); and the ceilings (no query timeout, no batching, one write per request).</action>
  <acceptance_criteria>
    - The new docs-sync test failed before the docs edit and passes after; the two existing rate-limit docs assertions pass unchanged.
    - `! grep -riE 'in[- ]memory|per API process' apps/api/src/api-keys/api-key-rate-limit.guard.ts apps/api/src/common/postgres-throttler-storage.ts docs/automation-api.md` succeeds (no leftover process-local wording in the guard, the storage or the docs).
    - `bun run ci:check` exits 0, run twice consecutively at default parallelism; both exit codes and the API and web test counts are quoted in the SUMMARY.
    - `bun run --filter @userhq/db db:generate` still reports no schema changes; `git status --short packages/db/migrations` shows only the 0023 files from Task 1 (no edits after that commit).
    - STATE.md and ROADMAP.md are untouched and nothing is pushed.
    - The SUMMARY contains the QRV-06 report and the decision list above.
  </acceptance_criteria>
  <verify>
    <automated>bun run --filter @userhq/api test test/automation-routes.test.ts --no-file-parallelism && bun run ci:check && bun run ci:check</automated>
    <fails_when>The docs or the guard comment still describe a per-process counter, the new docs assertion is vacuous (it passes against the old docs), a limit constant changed, either ci:check run exits non-zero, or the SUMMARY omits the audit report.</fails_when>
  </verify>
  <done>The docs, the guard comment and the storage header state the shared Postgres behaviour, its per-request cost and the fail-open decision; the other limiters are audited and reported; ci:check is green twice.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| API process to Postgres | The limiter now depends on the database; any store error reaches the request path |
| Client to limiter key | Keys derive from api-key ids (server-side) or md5 of class, handler, throttler name and tracker (user id or client IP); the client never supplies a raw key |
| App replicas to each other | Replicas coordinate only through row locks in the shared table |

## STRIDE Threat Register

Threat IDs are unique within this plan.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qrv-01 | Tampering | Concurrent increments across replicas (lost update, over-admit) | high | mitigate | One INSERT ... ON CONFLICT DO UPDATE per call; Postgres row lock re-evaluates the SET against the latest row version. Proven by 50 parallel calls on one and on two pools and 130 parallel HTTP requests across two apps admitting exactly the limit |
| T-qrv-02 | Denial of Service | Store failure (database error, missing table) takes the API down | high | mitigate | increment catches every error and fails open with a logged warning; the sweeper tick catches and never rethrows, so no unhandled rejection from a timer. Tested with the table removed and restored |
| T-qrv-03 | Elevation of Privilege | Fail open lets a caller who can induce store errors bypass a limit | medium | accept | Counters guard availability and abuse, not secrets: no throttled route is credential guessing; API-key authentication and sign-in throttling are outside this store. The warning is logged on every failure, never silent. Recorded in code, docs and SUMMARY; a future secret-guarding limiter must not reuse this path silently |
| T-qrv-04 | Tampering | SQL injection through limiter keys | high | mitigate | Static SQL text with bound parameters only; keys never concatenated into SQL. Keys are server-derived, not raw client input |
| T-qrv-05 | Information Disclosure | Rows or logs expose identity | low | accept | Rows hold an opaque key (key id or md5), epoch-ms integers and nothing else; the warning logs the error message and throttler name, never the key. Asserted in the store test |
| T-qrv-06 | Denial of Service | Table growth from many distinct trackers (for example spraying client IPs at the public unsubscribe route) | medium | mitigate | Sweeper deletes expired, unblocked rows every 60 s; rows are small (at most limit plus one bigint values) and bounded by distinct trackers per minute. Ceiling noted: no batching |
| T-qrv-07 | Tampering | Replica clock skew distorts windows | low | mitigate | The database clock is the only clock used for hits, expiry and Retry-After |
| T-qrv-08 | Repudiation | Behaviour drift for human routes after the storage swap | medium | mitigate | Parity test against the throttler package's own memory storage in both modes, plus the unchanged existing 429 suites (votes, comments, uploads, webhook-worker, account, unsubscribe) |
| T-qrv-SC | Tampering | npm/pip/cargo installs | high | mitigate | No new dependency is added and no install task exists, so the package-legitimacy gate has nothing to audit; the executor must not add a package |
</threat_model>

<verification>
- Task 1, 2 and 3 automated commands pass; `bun run --filter @userhq/db db:generate` reports no schema changes; `bun run --filter @userhq/db db:check` exits 0.
- RED output exists for each of the three `test(...)` commits and GREEN follows each.
- `bun run ci:check` exits 0 twice at default parallelism.
- Multi-instance proof: two apps on one database enforce 120 per key, a new instance does not reset counters, redeliver is 10 across two apps.
- The SUMMARY lists every other limiter found and its disposition.
</verification>

<success_criteria>
- A second API replica no longer multiplies any rate limit: API keys (120 per 60 s per key), redeliver (10 per 60 s per caller) and all other @Throttle routes are counted once, in Postgres.
- One statement and one round trip per limited request; no Redis; no new dependency; migration generated, committed, clean.
- Behaviour and docs of 261107-flq / 261107-s6l are unchanged except the removed process-local caveat.
- A database fault degrades rate limiting to a logged fail-open, never to an outage.
</success_criteria>

<output>
Create `.planning/quick/261108-qrv-shared-postgres-store-for-api-key-and-re/261108-qrv-SUMMARY.md` when done
</output>
