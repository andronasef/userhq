---
phase: quick-261108-bzd
plan: 01
subsystem: testing
tags: [postgresql, supertest, vitest, api-keys]
status: complete
tasks-completed: 4
tasks-total: 4
duration: multi-session (per-task validation times below)
actuals:
  tasks: 4
  commits: 31
plan_head_before: 0a497d47451394b59658114af25520c24beea276
plan_head_after: bdb16c9a5d12515f00e6df29aaf0b3047d007f04
task2_review_base: 6a3aebc
task3_review_base: 6b6b446
task4_review_base: dffd7ac
requires:
  - phase: quick-261108-b3i
    provides: Existing workspace automation endpoints and review fixes
provides:
  - Loopback-bound integration test servers
  - Graceful PostgreSQL test connection shutdown before database deletion
  - HTTP 400 validation errors for invalid API-key creation input
  - Durable scheduled changelog claims and atomic webhook enqueue
  - Readable accent text and focus colors across theme surfaces and tinted chips
  - Real-browser signing-secret rotation, follow persistence/rollback and synthetic push-click checks
affects: [integration-testing, workspace-automation]
tech-stack:
  added: []
  patterns: [Explicit loopback test listeners, await public PostgreSQL client end events]
key-files:
  created: [apps/api/test/test-isolation.test.ts, apps/api/src/changelog/changelog.scheduler.ts, apps/api/test/changelog-scheduler.test.ts, apps/web/test/contrast-sweep.test.ts, apps/api/test/browser/push-follow.spec.ts]
  modified: [apps/api/test/support/test-app.ts, apps/api/test/support/webhook-receiver.ts, apps/api/vitest.config.ts, apps/api/src/api-keys/api-keys.controller.ts]
requirements-completed: []
---

# Quick 261108-bzd: Tasks 1–4 complete

**Reliable integration listeners and PostgreSQL teardown, scheduled changelog event claims, readable theme accents, and browser coverage for webhook secrets, following and push-click routing.**

## Scope and status

Tasks 1–3 passed the parent's two-axis reviews with no material findings; Task 2's processing-time suppression qualification was recorded. All four tasks are implemented and their gates pass. Task 4 now stops for its final review; final verification (3 consecutive default-parallelism `ci:check` runs, exit 0, API 788, web 280) was re-run by the orchestrator on bdb16c9.

The original random status-code/parse failures came from supertest creating wildcard listeners on ephemeral ports already held by unrelated loopback-specific services: requests to `127.0.0.1` then reached those services instead of the test app. Owning one loopback listener per app removes that mechanism. A separate proven PostgreSQL teardown race required waiting for real client termination before forced database deletion. Full evidence, failed attempts, timing measurements and final five-API/three-CI reliability tables are in [DIAGNOSIS.md](./261108-bzd-DIAGNOSIS.md). Residual risk remains from a foreign wildcard listener using address reuse; no Vitest worker cap was added, and the old unexplained hook override was replaced by an explicitly measured integration-hook budget.

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

The commit count is measured by `git rev-list --count 0a497d4..bdb16c9` (31 commits), before this summary metadata update. It includes review/documentation commits. No actual token-usage measurement is available, so no diff-size estimate is presented as actual token usage.

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

## Task 3: Accent contrast and source sweep

- The accent policy now includes page, card and muted surfaces plus the 20-percent brand tint of each, in both themes. Brands that already failed on light page/card keep the established `#171717` fallback. Other light values darken by small steps until readable, preserving their hue; dark values lighten until readable.
- Static foreground, muted foreground and accent text are checked against all three base surfaces at 4.5:1. Static focus rings use the readable accent text color; product focus rings use the same light/dark pair as product accent text.
- One codemod, driven by the failing guard's file list, replaced **55 text/solid-ring utilities across 25 app/component files**. It preserves brand fills, borders, foregrounds and translucent drag/drop rings.
- The new source guard scans **195 TSX files**, checks native-checkbox exceptions remain present, and rejects raw primary text/arbitrary primary text/solid primary rings. Four native checkbox fills exist, rather than the plan's estimated three; all four are explicitly documented exceptions. The webhook checkbox's focus ring was converted while its native checked-control fill stayed unchanged.

### Task 3 TDD and verification

Review base: `6b6b446`; implementation head: `dbb1051855a58535d9fda614a285be0770f29af5`.

- `f5b5cc5` → `88d5e9e`: six-surface color policy RED (11 assertions failed), then GREEN (57 accent assertions).
- `f89d9d1` → `44aa343`: static/product focus policy RED (3 failed), then GREEN (59 accent assertions).
- `98907c4` → `dbb1051`: source guard RED (55 offenders), then codemod/render-pin GREEN. The first full web run exposed six stale expected values in the existing accent, FAQ markup and portal style tests; these were updated to the new contract without relaxing contrast thresholds.
- Full web suite: **280/280 passing in 31 files** (2.55 seconds); web typecheck and lint passed. No full CI run was added at this checkpoint.
- The protected fill inventory is byte-identical before/after: **195 files, 46 utilities**, recorded in `/tmp/bzd-task3-fills-before.json` and `/tmp/bzd-task3-fills-after.json`. It includes brand backgrounds, borders, native accents, translucent rings and arbitrary primary fills. CSS fill/foreground tokens also remain unchanged; only static ring tokens changed in globals.css.
- A deliberate mutation restored `text-primary` in `faq-highlight.tsx`; the guard failed and named that exact line. The original rewritten source was restored in `finally`, then the final full web suite passed. Log: `/tmp/bzd-task3-guard-mutation.log`.
- Logs: `/tmp/bzd-task3-color-red.log`, `/tmp/bzd-task3-color-green.log`, `/tmp/bzd-task3-focus-red.log`, `/tmp/bzd-task3-focus-green.log`, `/tmp/bzd-task3-sweep-red.log`, `/tmp/bzd-task3-sweep-green.log`, `/tmp/bzd-task3-web-green.log`, `/tmp/bzd-task3-typecheck.log`, `/tmp/bzd-task3-lint.log`.

### Task 3 changed expected values

| Pin / contract | Previous | New | Reason |
|---|---|---|---|
| Blue accent text in both accent test files | `#2563EB` | `#1E4FBC` | The old blue fails tinted muted. The preceding darkening step `#1F54C8` reaches only 4.417:1; the selected value reaches 4.814:1. |
| Dark teal retention assertion | `#14B8A6` retained unchanged | Lightens to `#20BCAA`, covered by lightening and six-surface assertions | The unchanged teal fails dark muted's 20-percent tint. Yellow remains unchanged when already readable. |
| Blue inline style / portal ring expectation | `#2563EB` | `light-dark(#1E4FBC, #719AF2)` | Focus uses the same readable theme pair as accent text. |
| Amber portal ring expectation | `#F59E0B` | `light-dark(#171717, #F59E0B)` | Preserves the existing light-text fallback and readable dark amber. |
| Static ring values | Light `#087F75`, dark `#14B8A6` | Light `#066A62`, dark `#2DD4BF` | Matches each existing static readable accent text token. |
| Two FAQ highlight markup assertions | `text-primary` | `text-[var(--primary-text)]` | Uses the readable token while preserving `bg-primary/20`. |
| Portal branding and vote browser color constants | `rgb(37, 99, 235)` | `rgb(30, 79, 188)` | RGB form of the new `#1E4FBC` unit-test pin, cited in both specs. These browser specs run in Task 4. |

No fills, border colors, native checkbox fill colors, `--primary`, `--primary-foreground` or `--entity-accent` changed. The discovered fourth native checkbox exception is the only Task 3 plan adjustment.

## Task 4: Rebuilt-stack browser verification and final gate

Review base: `dffd7ac`; implementation head: `bdb16c9a5d12515f00e6df29aaf0b3047d007f04`.

- Rebuilt the existing local Docker stack successfully (27.3 seconds) with a throwaway VAPID pair generated into the build process environment. No key was printed or written to a file; `.env.docker` was not directly read, printed or edited. Existing stack/config scripts consumed their normal configuration. No database drift repair was needed.
- The first browser launch attempt had **0 passed, 27 failed, 0 skipped**, all before browser execution with the same missing `chromium_headless_shell-1243` executable error. Installed the browser binary using the already-installed official Playwright CLI; no package, lockfile or dependency changed. This was environment setup, not an application failure. Log: `/tmp/bzd-browser-launch-failure.log`.
- **Real baseline before Task 4 spec edits: 27 passed, 0 failed, 0 skipped (47.2 seconds)** against the rebuilt stack. Both previously suspected stale specs (`portal-branding` and `dashboard-header`) passed; their locators/expectations were left unchanged in Task 4. Task 3's browser color pins passed.
- Extended the webhook lifecycle to verify the original secret disappears from DOM markup/input values and list responses after reload; rotation displays a different secret with one-time wording, stores the replacement and removes the old value, then both values are absent after another reload. Ping, deliveries and deletion remain covered. Secret comparisons use booleans so assertion failures do not print secret material.
- Added Follow-button browser coverage for initial off state, optimistic follow, real database persistence, reload, unfollow/database removal, and a controlled 500 that rolls the UI back and shows its error toast.
- The real registered `/sw.js` worker handles synthetic `notificationclick` events in headless Chromium. Its external clients methods are recorded while the real handler runs, verifying the canonical post URL becomes the same-origin absolute target and a foreign URL falls back to the origin root. This covers worker routing, not a physical OS notification click; no case was skipped or left as a placeholder.
- All new fixtures clean up their own rows. The local stack was already running and remains running. No production service was deployed or changed.

### Task 4 browser results and coordination correction

| Run | Passed | Failed | Skipped | Duration |
|---|---:|---:|---:|---|
| Real full baseline | 27 | 0 | 0 | 47.2s |
| Extended webhook spec alone | 1 | 0 | 0 | 5.5s |
| New push/follow spec alone, corrected sequential run | 3 | 0 | 0 | 3.2s |
| Portal branding spec alone | 2 | 0 | 0 | 4.8s |
| Votes spec alone | 2 | 0 | 0 | 6.3s |
| Final full browser suite | 30 | 0 | 0 | 47.2s |

One earlier focused push run had **2 passed / 1 failed**: its synthetic-click test reached `browserContext.close: ENOENT ...test-results/.playwright-artifacts-0/traces/...network` because two Playwright CLI invocations shared the same output directory concurrently. This was an executor coordination mistake; it was corrected by running the specs sequentially. There was no service-worker registration or application assertion failure, and the sequential focused and full runs passed. No production code or test assertion was weakened to address it. Log: `/tmp/bzd-push-follow-focused.log`.

Baseline and final application-assertion failures: **none**. There are no failed specs to classify as pre-existing or new in the actual baseline/final runs. Full logs: `/tmp/bzd-browser-before.log`, `/tmp/bzd-browser-after.log`. Focused logs: `/tmp/bzd-webhooks-focused.log`, `/tmp/bzd-push-follow-focused-2.log`, `/tmp/bzd-portal-branding-focused.log`, `/tmp/bzd-votes-focused.log`.

### Final validation and commit

`bdb16c9` commits the Task 4 browser specifications. After that commit, `bun run build:packages` followed by **`bun run ci:check` passed at default Vitest parallelism**, with no worker override or diagnostic preload, in 79.6 seconds including the package pre-build. The gate includes **788 API tests, 280 web tests, 32 type tests and 6 database tests**, lint/typechecks, package/API builds, vinext standalone/Next fallback builds and migration checks. Log: `/tmp/bzd-final-ci.log`. No extra repetitions were added after these gates passed.

All four implementation tasks are verified, subject to the recorded accepted qualifications: historical diagnosis commit provenance, the measured integration-hook budget, and processing-time Changelog suppression rather than reconstructing feature state between ticks. The final two-axis review and parent-owned STATE/ROADMAP bookkeeping remain outstanding. Nothing was pushed or deployed.

## Next action

Return Task 4 to the parent for its final two-axis review, then let the parent mark this summary complete and record the quick task in project state. No further implementation or verification is running.

## Self-Check: PASSED

The plan, diagnosis, summary, scheduler, integration tests, both new migrations, contrast guard and push/follow browser spec exist. Task 1–4 commits are ancestors of HEAD. `git diff --check` passes. No commit of this quick task touches STATE.md or ROADMAP.md. The only unrelated untracked directory is `.planning/ui-reviews/`, which was preserved. Final review and state bookkeeping remain pending.
