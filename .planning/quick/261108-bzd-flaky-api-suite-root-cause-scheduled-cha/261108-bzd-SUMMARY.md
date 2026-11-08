---
phase: quick-261108-bzd
plan: 01
subsystem: testing
tags: [postgresql, supertest, vitest, api-keys]
status: in-progress
tasks-completed: 2
tasks-total: 4
checkpoint: TASK-2-REVIEW
checkpoint-date: 2026-11-08
duration: 26 min continuation
actuals:
  tasks: 2
  commits: 20
plan_head_before: 0a497d47451394b59658114af25520c24beea276
plan_head_after: 5063ed05d291af7a6f1b2dd6ad2180a80dd3bfc4
task2_review_base: 6a3aebc
requires:
  - phase: quick-261108-b3i
    provides: Existing workspace automation endpoints and review fixes
provides:
  - Loopback-bound integration test servers
  - Graceful PostgreSQL test connection shutdown before database deletion
  - HTTP 400 validation errors for invalid API-key creation input
  - Durable scheduled changelog claims and atomic webhook enqueue
affects: [integration-testing, workspace-automation]
tech-stack:
  added: []
  patterns: [Explicit loopback test listeners, await public PostgreSQL client end events]
key-files:
  created: [apps/api/test/test-isolation.test.ts]
  modified: [apps/api/test/support/test-app.ts, apps/api/test/support/webhook-receiver.ts, apps/api/vitest.config.ts, apps/api/src/api-keys/api-keys.controller.ts]
requirements-completed: []
---

# Quick 261108-bzd: Tasks 1–2 checkpoint

**The integration harness now binds one loopback listener per app and closes PostgreSQL clients before dropping each test database; invalid API-key bodies return standard HTTP 400 errors.**

## Scope and status

Task 1 passed the parent's two-axis review with no findings. Task 2 is implemented and verified, and stops here for its own review. Tasks 3–4 (the contrast sweep and browser specifications) have not started; the overall plan remains in progress.

## Changes

- `createTestApp` owns one `127.0.0.1` listener, preventing supertest wildcard listeners from sharing ports with unrelated local services. Three redundant app listeners were removed; runtime and source guards cover the invariant.
- Invalid key scopes and other invalid request bodies go through the existing Standard Schema validation pipe, returning `400 validation_failed` without creating keys.
- A second demonstrated teardown race was fixed: `pg-pool.end()` can resolve before clients' public `end` events. The harness waits for those events before `DROP DATABASE ... WITH (FORCE)`.
- The webhook fixture rejects non-POST probes while continuing to record malformed POSTs, so missing delivery headers still fail webhook assertions.
- The integration hook budget is 30 seconds, justified by recorded database lifecycle/checkpoint costs and a real 10-second hook failure at default parallelism.

## Commits

Prior to this continuation:

- `c9a138f` — RED loopback/server and key-validation assertions.
- `e08b721` — One loopback listener per app; redundant listeners removed.
- `0d8b096` — Standard-schema API-key input validation.

This continuation:

- `a56a315` — RED receiver probe/malformed-POST assertions.
- `99b24cd` — Ignore non-POST probes without suppressing malformed deliveries.
- `c414ee2` — Real PostgreSQL full-pool teardown regression.
- `6e697da` — Await client termination before database deletion.
- `e8cd160` — Preserve inherited diagnosis and record the additional teardown cause.
- `7c305f4` — Preserve the interrupted plan artifact.
- `ae236cd` — Apply the measured integration-hook budget and evidence.
- `daa4fea` — Record five passing API and three consecutive passing full CI runs.

The commit count is measured by `git rev-list --count 0a497d4..5063ed0` (20 commits), before this summary metadata update. It is a partial-plan count including review/documentation commits. No actual token-usage measurement is available, so the previous diff-size estimate has been removed from `actuals`.

## TDD and verification

The inherited RED commit precedes the listener and API validation fixes. The new receiver test failed before the fixture change and passed afterward. A focused four-file run passed 60 tests. The teardown race reproduced in a full run (775 passing assertions but exit 1 with unhandled `57P01`); an independent real-Postgres event-order probe confirmed that pool shutdown resolved before client termination. The focused teardown test passed before the fix too because the error is a race; it is not presented as deterministic RED evidence.

After the teardown fix, five consecutive default-parallel API runs passed all **776 tests in 59 files**. The first full CI attempt then exposed genuine 10-second hook timeouts; the diagnosis records the failure, bounded query timings and PostgreSQL activity samples before adjusting the integration hook budget.

Three consecutive complete `bun run ci:check` runs passed in **79.2, 122.0 and 92.3 seconds**, each including **776 API, 264 web, 32 types and 6 database tests**, lint/typechecks, package/API builds, vinext and Next fallback builds, and migration checks. No worker cap or diagnostic preload was used in final verification. The full run table and failed earlier attempts are preserved in DIAGNOSIS.md.

## Deviations and limitations

- **Historical commit provenance:** DIAGNOSIS.md was untracked after the interruption although its text says it was written before the previous fixes. Git cannot prove that ordering. This continuation commits the preserved evidence and documents the gap; history was not rewritten.
- **Additional teardown cause:** uninstrumented verification confirmed the earlier suspected `57P01` race, so the public-client termination wait was added before repeating the gates.
- **Measured hook budget:** the original plan required no `hookTimeout` override. A real CI failure and measured checkpoint/DDL costs justified a parent-approved 30-second integration-hook budget. Default parallelism remains unchanged.
- **Receiver observation limit:** original raw logs identifying unsolicited GETs did not survive interruption. The new fixture contract and HTTP assertions are verified, but this continuation does not claim attribution to a particular local process.
- No production deployment, push, dependency addition, schema change, or STATE/ROADMAP update was made. No new application stub was introduced.

## Task 2: Scheduled changelog announcements

- Generated migration `0021_changelog_announced_at.sql` adds one nullable private timestamp column; custom migration `0022_backfill_changelog_announced.sql` idempotently marks already-live entries so historical releases never replay. No applied migration was changed, and no `device_info` statement was generated.
- A registered 60-second job claims at most 100 due entries per tick, using the supplied clock, entry row locks and `SKIP LOCKED`. The durable claim and webhook outbox insert commit in one transaction. Failed enqueue rolls the claim back for retry; overlapping calls on one instance return null.
- Request-driven publication shares the same durable marker and entry lock. Moving back to a draft or future date clears the marker. An ordinary live edit does not announce again.
- The claim excludes deleted products/workspaces and routes each entry through its own workspace. When the job processes an entry while Changelog is disabled, it keeps the claim but queues no event, preventing later replay of that processed event.
- Explicit admin/public DTO allowlists exclude the marker. Automation documentation now describes scheduled timing, the 100-entry batch ceiling, suppression and re-arming.

### Task 2 commits and TDD

Review base: `6a3aebc`; implementation head: `5063ed05d291af7a6f1b2dd6ad2180a80dd3bfc4`.

- `540fef1` — First due-date test: the real HTTP future entry produces no immediate outbox event; RED occurred at the missing scheduler boundary, as anticipated by the plan. This is boundary-absence evidence, not a pre-existing scheduler predicate failure.
- `2b09d21` — Schema/migrations and transactional due-date scheduler; first behavior GREEN.
- `dede1f4` → `0a046b9` — Genuine behavioral RED (worker claimed an already-inline-announced entry, expected zero), then shared request-path marker GREEN.
- `8546d2e` → `415ca7f` — Genuine behavioral RED (rescheduled entry was not claimed), then re-arming GREEN.
- `5063ed0` — Existing security/concurrency behavior characterized through real HTTP/DB/job-clock/outbox seams; documentation updated.

No internal service mocks were used. Rollback is tested with a real PostgreSQL trigger rejecting outbox insertion, followed by a successful retry. A test-fixture cleanup ordering failure was corrected to delete products before their restricted parent workspace; it was not an application failure.

### Task 2 verification

- New scheduler suite: **12/12 passing** (2.35 seconds), including controlled far-future time, drafts/live entries, separate-instance and same-instance races, HTTP publication race, re-arming, disabled processing/no replay, tenant routing, deleted tenants, actual SQL backfill run twice, response privacy, batch ceiling and rollback/retry.
- Required focused gate: **9 files, 181 tests passing** (14.87 seconds), including changelog/public visibility, existing webhook events/worker/module gates, product-feature delivery, automation documentation and cross-tenant suites.
- Package build, API typecheck, migration check, no-drift migration generation and lint passed. Existing unrelated lint warnings remain. Logs: `/tmp/bzd-task2-focused.log`, `/tmp/bzd-task2-typecheck.log`, `/tmp/bzd-task2-dbcheck.log`, `/tmp/bzd-scheduler-no-drift.log`, `/tmp/bzd-task2-lint.log`.
- Full CI was not repeated for this checkpoint; Task 1's three passes remain historical evidence, and the plan calls for another full gate after Task 4.

### Task 2 timing limitation for review

Suppression is evaluated when the job processes the due entry, matching the plan's explicit test sequence (disable, tick, re-enable, tick). If Changelog is disabled when a date passes but re-enabled before any job tick, this implementation can still announce that entry. There is no historical feature-state timestamp to infer the state at the exact arrival time. The docs deliberately describe processing-time suppression and do not claim that stronger between-ticks guarantee. The parent requested this truthful checkpoint for review instead of expanding into feature-toggle history/lock-order changes.

## Next action

Return Task 2 to the parent for two-axis review. Tasks 3–4 remain unexecuted; do not begin Task 3 automatically from this executor.

## Self-Check: PASSED

The plan, diagnosis, summary, scheduler, new integration test and both new migration files exist. Task 1 and Task 2 commits are ancestors of HEAD. `git diff --check` passes. The only unrelated untracked directory is `.planning/ui-reviews/`, which was preserved. Task 2 review and state bookkeeping remain pending.
