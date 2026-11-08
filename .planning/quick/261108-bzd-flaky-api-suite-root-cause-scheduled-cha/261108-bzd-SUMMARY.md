---
phase: quick-261108-bzd
plan: 01
subsystem: testing
tags: [postgresql, supertest, vitest, api-keys]
status: in-progress
tasks-completed: 1
tasks-total: 4
checkpoint: SPLIT-1
checkpoint-date: 2026-11-08
duration: 26 min continuation
actuals:
  tokens: 25117
  tasks: 1
  commits: 11
plan_head_before: 0a497d47451394b59658114af25520c24beea276
plan_head_after: daa4fea75c29c77ec68a1a5bd44182063e6cc132
requires:
  - phase: quick-261108-b3i
    provides: Existing workspace automation endpoints and review fixes
provides:
  - Loopback-bound integration test servers
  - Graceful PostgreSQL test connection shutdown before database deletion
  - HTTP 400 validation errors for invalid API-key creation input
affects: [integration-testing, workspace-automation]
tech-stack:
  added: []
  patterns: [Explicit loopback test listeners, await public PostgreSQL client end events]
key-files:
  created: [apps/api/test/test-isolation.test.ts]
  modified: [apps/api/test/support/test-app.ts, apps/api/test/support/webhook-receiver.ts, apps/api/vitest.config.ts, apps/api/src/api-keys/api-keys.controller.ts]
requirements-completed: []
---

# Quick 261108-bzd: Task 1 checkpoint

**The integration harness now binds one loopback listener per app and closes PostgreSQL clients before dropping each test database; invalid API-key bodies return standard HTTP 400 errors.**

## Scope and status

Only Task 1 was executed in this continuation. Tasks 2–4 (scheduled changelog events, the contrast sweep, and browser specifications) have not started. The plan remains in progress and stops here for the parent's two-axis review before Task 2.

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

The checkpoint actuals measure the committed diff through `daa4fea` (100467 characters / 4, rounded up) and `git rev-list --count 0a497d4..daa4fea` (11 commits), before this summary metadata commit. They are partial-plan measurements, not a claim that Tasks 2–4 are complete.

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

## Next action

Task 1 verification is complete. Return this checkpoint to the parent for two-axis review; Tasks 2–4 remain unexecuted. Do not begin Task 2 automatically from this executor.

## Self-Check: PASSED

The plan, diagnosis, summary and new isolation test exist. Prior RED/fix commits and the new teardown/budget commits are ancestors of HEAD. `git diff --check` passes. The only unrelated untracked directory is `.planning/ui-reviews/`, which was preserved. Parent review and state bookkeeping remain pending.
