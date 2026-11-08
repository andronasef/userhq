---
phase: quick-261108-bzd
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-01, D-02, D-05, D-06, D-08, D-10, D-11, D-14]
files_modified:
  - .planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-DIAGNOSIS.md
  - .planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-SUMMARY.md
  - apps/api/vitest.config.ts
  - apps/api/test/support/test-app.ts
  - apps/api/test/test-isolation.test.ts
  - apps/api/test/push.test.ts
  - apps/api/test/product-feature-delivery-race.test.ts
  - apps/api/test/public-product-features.test.ts
  - apps/api/test/api-keys.test.ts
  - apps/api/src/api-keys/api-keys.controller.ts
  - packages/db/src/schema/changelog.ts
  - packages/db/migrations/0021_changelog_announced_at.sql
  - packages/db/migrations/0022_backfill_changelog_announced.sql
  - packages/db/migrations/meta
  - apps/api/src/changelog/changelog.scheduler.ts
  - apps/api/src/changelog/changelog.module.ts
  - apps/api/src/changelog/changelog.service.ts
  - apps/api/test/changelog-scheduler.test.ts
  - docs/automation-api.md
  - apps/web/lib/accent.ts
  - apps/web/app/globals.css
  - apps/web/test/accent.test.ts
  - apps/web/test/contrast-sweep.test.ts
  - apps/web/test/faq-portal.test.tsx
  - apps/web/app/(app)/page.tsx
  - apps/web/components/activity/activity-feed.tsx
  - apps/web/components/api-keys/api-keys-manager.tsx
  - apps/web/components/api-keys/create-api-key-dialog.tsx
  - apps/web/components/changelog/changelog-editor.tsx
  - apps/web/components/changelog/changelog-studio.tsx
  - apps/web/components/changelog/changelog-tag-dialog.tsx
  - apps/web/components/changelog/changelog-timeline-item.tsx
  - apps/web/components/dashboard/status-list.tsx
  - apps/web/components/faq/faq-highlight.tsx
  - apps/web/components/faq/faq-not-found-prompt.tsx
  - apps/web/components/faq/faq-sidebar-nav.tsx
  - apps/web/components/home/product-showcase.tsx
  - apps/web/components/notifications/notification-item.tsx
  - apps/web/components/post/linked-roadmap-banner.tsx
  - apps/web/components/rich-text/rich-text-editor.tsx
  - apps/web/components/rich-text/rich-text-viewer.tsx
  - apps/web/components/roadmap/public-roadmap-modal.tsx
  - apps/web/components/roadmap/roadmap-item-modal.tsx
  - apps/web/components/theme-toggle.tsx
  - apps/web/components/user-menu.tsx
  - apps/web/components/webhooks/create-webhook-dialog.tsx
  - apps/web/components/webhooks/webhook-secret-dialog.tsx
  - apps/web/components/workspace-dashboard/workspace-comments-view.tsx
  - apps/web/components/workspace-dashboard/workspace-dashboard-tabs.tsx
  - apps/api/test/browser/webhooks.spec.ts
  - apps/api/test/browser/portal-branding.spec.ts
  - apps/api/test/browser/dashboard-header.spec.ts
  - apps/api/test/browser/votes.spec.ts
  - apps/api/test/browser/push-follow.spec.ts
estimate:
  tokens: 255000
  raw_tokens: 255000
  tasks: 4
  confidence: low
must_haves:
  truths:
    - The API suite flake has a demonstrated root cause recorded in 261108-bzd-DIAGNOSIS.md before any fix is written. After the fix, `bun run ci:check` exits 0 at default vitest parallelism (no worker cap in the environment) on three consecutive runs, and the API suite passes five consecutive standalone runs. The hook-timeout override added as a mitigation in 261107-s6l is removed, and the repo contains no worker-count cap.
    - Every test server in apps/api/test listens on 127.0.0.1. createTestApp owns exactly one listener per app, so supertest never starts its own wildcard listener. A guard test fails if any test file listens on another address or listens a Nest app a second time.
    - POST /workspaces/:ws/api-keys with an unknown scope (or any other schema violation) returns 400 `validation_failed` in the standard `{code, message}` format and creates no key. It no longer returns 500.
    - A changelog entry saved with a future publishedAt emits `changelog.published` exactly once when its date arrives, within one scheduler interval. It never emits twice (two scheduler instances racing, repeated ticks), never for a draft, never when the product's Changelog is off (and is not replayed on re-enable), and only to subscriptions of its own workspace. Unpublish or reschedule re-arms the next live transition. Existing live entries are not announced by the migration.
    - No raw brand colour is used for text or as a focus/selection indicator in apps/web. Accent text meets 4.5:1 on background, card and muted surfaces, including the 20 percent accent tint, in both themes for every brand in the test palette. Static muted-chip tokens meet 4.5:1 in both themes. Fills are unchanged.
    - The webhooks browser spec covers secret-shown-once and rotation. The two stale specs are fixed or precisely explained. Follow-toggle and push notificationclick-target browser cases exist or their infeasibility is reported with the exact blocker. The whole browser suite was run against a rebuilt Docker stack and its real pass/fail counts are reported.
  artifacts:
    - .planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-DIAGNOSIS.md
    - apps/api/test/test-isolation.test.ts
    - apps/api/src/changelog/changelog.scheduler.ts
    - packages/db/migrations/0021_changelog_announced_at.sql
    - packages/db/migrations/0022_backfill_changelog_announced.sql
    - apps/api/test/changelog-scheduler.test.ts
    - apps/web/test/contrast-sweep.test.ts
    - apps/api/test/browser/push-follow.spec.ts
  key_links:
    - supertest 7 calls `server.listen(0)` with no host (a wildcard bind) only when `server.address()` is null, and closes that listener after the last pending request. On macOS a wildcard bind to a port held by a 127.0.0.1-specific listener succeeds, and a connect to 127.0.0.1:port is answered by the specific listener. Five test files (webhooks, push, outbound-http, product-feature-delivery-race, public-product-features) and one support helper (webhook-receiver.ts) already hold long-lived 127.0.0.1 listeners. Making createTestApp listen once on 127.0.0.1 puts every test socket in the same address class, where the kernel's port choice is conflict-aware.
    - changelog_entries.announced_at is written by two paths that must agree: the in-transaction announceIfWentLive in ChangelogService (create, update, publish) and the new scheduler claim. Both are conditional on announced_at being null; unpublish and any change that leaves the entry not live set it back to null.
    - accent.ts ACCENT_SURFACES must equal --background, --card and --muted in globals.css (drift guard in accent.test.ts). Browser specs that pin computed accent colours (portal-branding.spec.ts, votes.spec.ts) take their expected value from the accent.test.ts pin for the #2563EB brand.
---

<objective>
Find and fix the root cause of the flaky API test suite so `bun run ci:check` is reliable at default parallelism, fix the 500 on unknown API-key scopes, announce scheduled changelog entries when their date arrives, finish the accent contrast sweep, and bring the browser specs up to date with the Docker stack.

Purpose: a green gate that passes only with a worker cap is a gate nobody can trust, and several security tests (404 where 403 is expected) can pass or fail for the wrong reason while requests land on a different test server. The remaining three items close review residue from the earlier quick tasks (261107-s6l known gap, 261107-2el residual items, 261107-1xs browser gap).
Output: DIAGNOSIS.md with evidence, a harness fix plus guard test, a createKey 400, migrations 0021 and 0022 with a scheduler job, the contrast sweep with extended tests, updated and new Playwright specs with real run results, and a green ci:check.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@.planning/phases/06-product-feature-controls/deferred-items.md
@.planning/quick/261108-b3i-phase-6-review-findings-and-api-key-scop/261108-b3i-SUMMARY.md
@.planning/quick/261107-s6l-webhook-secret-rotation-missing-events-w/261107-s6l-SUMMARY.md
@.planning/quick/261107-2el-fix-dark-mode-accent-contrast-and-theme-/261107-2el-SUMMARY.md
@.planning/quick/261107-1xs-fix-browser-push-slice-8-review-defects-/261107-1xs-SUMMARY.md
@apps/api/test/support/test-app.ts
@apps/api/vitest.config.ts
@apps/web/lib/accent.ts

Ground rules from the orchestrator. Run API tests as `bun run --filter @userhq/api test <explicit files>`; never `bun test`. The old `--no-file-parallelism` flag was a workaround for the flake: do not use it for any gate or stress run in this plan (it may still be used for a quick single-file iteration). Postgres is running (colima up, `bun run dev:services`). `@userhq/types` and `@userhq/db` are consumed from `dist`, so run `bun run build:packages` after editing anything under `packages/db/src` or `packages/types/src` before API typecheck or tests. No new dependencies. Migrations come only from `bun run --filter @userhq/db db:generate`, never `drizzle-kit push`; if generate emits spurious device_info lines, delete them and re-run until it reports no schema changes. Do not edit STATE.md or ROADMAP.md. Do not push or deploy. Commit each task atomically with the quick id `quick-261108-bzd`, with a `test(...)` RED commit before each `fix(...)` or `feat(...)` GREEN commit. Other agents may be working in this directory (an untracked `.planning/ui-reviews/` exists): preserve unrelated changes and stage only your own files. Do not read or print `.env.docker` or `env.local.dev`. `apps/api/tsconfig.json` includes only `src`, so API tests are not type-checked; assert behavior at runtime. When running the suite many times, redirect each run to a log under /tmp and extract only failing test names and first error lines; never print whole logs.

Discovery: Level 0 for tasks 1-3 (every change follows an existing pattern: Nest `@Body({ schema })` as in products.controller.ts, the WebhookWorker interval and tick pattern, the 261107-2el accent token machinery). Task 4 drives existing tooling.

Facts gathered at planning time (read from the code and measured on this host; the executor must re-verify them in the diagnosis step, not assume them):
- Most API tests call `request(testApp.http)`. createTestApp never listens. supertest 7.3 (`node_modules/.bun/supertest@*/node_modules/supertest/lib/test.js`, `serverAddress` and `end`) calls `app.listen(0)` with no host when `address()` is null, so each burst of requests binds the IPv6 wildcard on an ephemeral port and closes it after the last request settles.
- Long-lived `listen(0, "127.0.0.1")` listeners exist in webhooks.test.ts (mock receiver), push.test.ts (https server plus the app), outbound-http.test.ts (https server and a stalled net server), product-feature-delivery-race.test.ts and public-product-features.test.ts (the app), and test/support/webhook-receiver.ts (used by webhook-events, webhook-secrets and webhook-worker). The comment in public-product-features.test.ts and the note in deferred-items.md show an earlier attempt to fix flakiness by adding such fixtures; that attempt would have added more loopback listeners.
- On this host (macOS, Node 24), a probe showed: a wildcard bind to a port held by a 127.0.0.1 listener succeeds, and `GET 127.0.0.1:port` is then answered by the loopback listener, not the wildcard server. With 4 held loopback listeners, 12 of 60000 wildcard `listen(0)` calls landed on a held port; with every listener on 127.0.0.1, 0 of 60000 did. A request that lands on another test process's server explains the recorded symptoms: 401 where 200 expected and 404 where 403 expected (a different database), `Parse Error: Expected HTTP/` (a TLS or raw socket server), `socket hang up`, and webhook-worker tests that count requests at their receiver.
- Ruled out by reading (re-confirm by grep): no src or test code mutates `process.env`; `PORT: 3999` is never bound; ThrottlerModule.forRoot creates its storage per Nest app and `REDELIVER_THROTTLE` is a constant, so limiter state is per app; worker intervals do not start when NODE_ENV is test (webhook, email, push); no global undici dispatcher is set; vitest uses `pool: "forks"` with default file parallelism (8 CPUs; record vitest's actual worker count in the diagnosis).
- The earlier `hook-timeout` mitigation (30000) in apps/api/vitest.config.ts was recorded in 261107-s6l as a likely, not proven, fix.
- `ApiKeysController.createKey` runs `createApiKeySchema.parse(body)` by hand; the ZodError reaches ApiErrorFilter as an unknown exception and becomes 500 `internal_error`. The validation pipe (`apps/api/src/common/validation.ts`) already turns Standard Schema issues into 400 `validation_failed`.
- Changelog: `isLiveAt` and `announceIfWentLive` in changelog.service.ts announce only on a not-live to live transition made by a request. A future-dated entry never announces. The portal already filters by `published_at <= now()` and portal-changelog.test.ts line 221 asserts future entries stay off the portal until their date arrives. `enqueueWebhookEvent` already drops events for a product whose Changelog is off (D-08, D-10) and the webhook worker re-checks at send time (D-14). docs/automation-api.md line 261 states the known gap.
- Contrast numbers at planning time: static `--muted-foreground` on `--muted` is 5.42 (light) and 5.94 (dark); static `--primary-text` on muted is 5.60 and 8.19; the raw default brand #087F75 on muted is 4.23. For custom brands the current guarantee covers only background and card: #2563EB is 4.48 on light muted, and in dark the lightened text of #7C3AED, #0000FF, #EF4444 and others is 4.08 to 4.45 on muted. About 60 raw brand text or ring usages exist across about 32 files in apps/web (`text-primary` and its hover variants, `text-[var(--primary)]`, solid `ring-primary`); the sweep test, not this count, defines the set.
- Browser specs: the deferred-items note says portal-branding and dashboard-header are stale, but at planning time portal-branding.spec.ts already expects the og:title "Sunny · Acme" and dashboard-header.spec.ts already locates the wordmark by href. Trust a baseline run against a rebuilt stack, not the note.

Split points (the plan is over the 40 percent smart-zone target): stop and hand over after Task 1 (SPLIT-1: it is the gate for everything else and should land and be reviewed alone) and after Task 3 (SPLIT-2: Task 4 needs a Docker rebuild and long browser runs). At a split, create or update 261108-bzd-SUMMARY.md with status `in-progress`, the finished tasks, commit hashes and evidence, and commit it as `docs(quick-261108-bzd): progress through task N`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>1. Tracer: diagnose the API suite flake with evidence, fix it at the root, make createKey return 400</name>
  <files>.planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-DIAGNOSIS.md, apps/api/test/test-isolation.test.ts, apps/api/test/support/test-app.ts, apps/api/test/push.test.ts, apps/api/test/product-feature-delivery-race.test.ts, apps/api/test/public-product-features.test.ts, apps/api/vitest.config.ts, apps/api/test/api-keys.test.ts, apps/api/src/api-keys/api-keys.controller.ts</files>
  <precondition>Postgres is reachable at the test default (userhq@127.0.0.1:5432) and `git status --short` shows no uncommitted changes under apps/api other than your own.</precondition>
  <read_first>
    - apps/api/test/support/test-app.ts (createTestApp: no listen, a fresh database per app)
    - node_modules/.bun/supertest@*/node_modules/supertest/lib/test.js lines 55-110 and 170-240 (when supertest listens and closes)
    - apps/api/test/support/webhook-receiver.ts and the listen call sites: `grep -rn "listen(" apps/api/test --include='*.ts'`
    - apps/api/vitest.config.ts and .planning/phases/06-product-feature-controls/deferred-items.md
    - .planning/quick/261108-b3i-phase-6-review-findings-and-api-key-scop/261108-b3i-SUMMARY.md lines 65-72 (the recorded failures)
    - apps/api/src/api-keys/api-keys.controller.ts, apps/api/src/common/validation.ts, apps/api/src/products/products.controller.ts line 63 (the `@Body({ schema })` pattern), packages/types/src/api-keys.ts (createApiKeySchema)
    - apps/api/test/api-keys.test.ts lines 96-140 (fixtures and request style)
  </read_first>
  <behavior>
    - Diagnosis (evidence first): DIAGNOSIS.md records, before any fix, the baseline failure rate at default parallelism, a mechanism probe, in-suite proof that requests reach the wrong server, an exclusion experiment, the hypotheses ruled out, and a one-paragraph conclusion.
    - createTestApp returns an app whose `http.address()` is `{address: "127.0.0.1", port > 0}` before the first request, and the port is unchanged after two supertest requests.
    - No file under apps/api/test (excluding test/e2e and test/browser) calls `.listen(` without the host "127.0.0.1", and none calls `.listen(` on a createTestApp app or its http server.
    - POST /api/v1/workspaces/:ws/api-keys with scopes ["not:a:scope"] returns 400 with body code `validation_failed` and a string message. The same holds for scopes [], scopes given as a string, a missing name, and expiresInDays 4000. No api key row is inserted by any of these. A valid body still returns 201 with a token.
  </behavior>
  <action>Per D-11 (tenant-isolation and privacy tests must be trustworthy, so a test that can pass or fail by hitting another server is a defect in the trust boundary) and D-05 (key creation input validation).

STEP A, diagnose before changing any source. Write nothing into apps/ except the temporary patch in A4, which you revert. (A1) Baseline: run `bun run --filter @userhq/api test` five times at default parallelism with no worker cap in the environment, each to /tmp/bzd-base-N.log. For each run record the exit code, duration, and the failing test names plus first error line (grep the log for failure markers; do not print logs). Record `git rev-parse --short HEAD`, the CPU count, vitest's worker count, and Postgres `show max_connections`. (A2) Ruled-out checklist: with grep and reading, confirm and record each of: no process.env mutation in src or test; PORT 3999 never bound; limiter and throttler state created per Nest app (ThrottlerModule.forRoot per AppModule.register call); workers do not start intervals under NODE_ENV test; no global dispatcher; every createTestApp has a matching close in an after hook (count them). Record any file that breaks a rule. (A3) Mechanism probe: write two throwaway Node scripts under /tmp, outside the repo. Script one holds a server on `127.0.0.1` port 0, binds a second server on the wildcard to the same port, requests `127.0.0.1:port`, and prints which server answered. Script two keeps four 127.0.0.1 listeners open and performs 60000 wildcard `listen(0)` plus close, counting landings on a held port, then repeats with `listen(0, "127.0.0.1")`. Record both outputs next to the planning-time numbers (answered by the loopback server; 12 of 60000 versus 0 of 60000). (A4) In-suite proof, temporary and uncommitted: patch the request handler in test/support/webhook-receiver.ts to write a `STRAY-SUPERTEST` line to stderr when the request's user-agent contains `node-superagent` (supertest's agent; the app's own webhook deliveries send a different agent). Run the default suite five times, count STRAY-SUPERTEST lines per run, and relate them to failing tests. Then revert with `git checkout -- apps/api/test/support/webhook-receiver.ts` and confirm `git diff` is empty. (A5) Exclusion experiment: run the default suite five times with the files that create long-lived 127.0.0.1 listeners excluded (webhooks, push, outbound-http, product-feature-delivery-race, public-product-features, webhook-events, webhook-secrets, webhook-worker) using vitest's exclude option on the command line. Record failures per run. (A6) Write 261108-bzd-DIAGNOSIS.md with: a runs table for A1, A4 and A5, the probe outputs, the ruled-out list with the grep evidence, and a conclusion that names the confirmed cause or says it is refuted. Commit it alone as `docs(quick-261108-bzd): record flaky API suite diagnosis`. DECISION GATE: proceed to Step B only if the mechanism is reproduced and at least one of A4 (stray requests observed) or A5 (failures disappear) supports it. If neither does, the cross-talk hypothesis is refuted: test the next hypotheses with the same evidence discipline (peak connection count from pg_stat_activity during a run against max_connections, CREATE DATABASE contention, timers starved by CPU load, supertest start and close churn within one process), and if none is demonstrated stop and return `## CHECKPOINT REACHED` with the evidence. Never apply a fix on a guess.

STEP B, RED (assuming the diagnosis confirms cross-talk between loopback-specific and wildcard listeners). (B1) Create apps/api/test/test-isolation.test.ts with three groups. First, createTestApp's http server address is 127.0.0.1 with a positive port before any request, and stays identical after two supertest requests. Second, a static scan of apps/api/test/**/*.ts (skip test/e2e and test/browser) fails, naming file and line, for any `.listen(` call whose host argument is not the string "127.0.0.1" and for any `.app.listen(` or `http.listen(` on a createTestApp result outside test/support/test-app.ts; it also asserts the scan found at least six listen call sites so it cannot pass vacuously. (B2) In apps/api/test/api-keys.test.ts add the createKey cases from the behavior list, asserting status 400, code `validation_failed`, a string message, and an unchanged key count in the database after the whole group. (B3) Run both files, record the RED output (address null; the three explicit app listen calls; 500 versus 400), and commit as `test(quick-261108-bzd): RED loopback-only test servers and 400 for invalid api key input`.

STEP C, GREEN, as two fix commits. (C1) In test/support/test-app.ts, after `app.init()`, call `await app.listen(0, "127.0.0.1")` and take `http` from `app.getHttpServer()`, with a short comment stating the invariant: every listener in the suite binds 127.0.0.1 so the kernel's ephemeral port choice cannot collide with a socket in another address class, and supertest only starts its own wildcard listener when the server is not already listening. Keep `close()` as it is (app.close closes the listener); add closing of lingering connections only if an after hook is observed hanging. Delete the three explicit app listen calls in push.test.ts, product-feature-delivery-race.test.ts and public-product-features.test.ts, and the now-misleading comment above the last one. Remove the hook-timeout override and its comment from apps/api/vitest.config.ts so vitest's default applies, and confirm by grep that no script, workflow or doc outside .planning sets a worker cap. Commit as `fix(quick-261108-bzd): bind every test server to 127.0.0.1 and drop flake mitigations`. (C2) In ApiKeysController.createKey replace the manual parse with the `@Body({ schema: createApiKeySchema })` parameter typed CreateApiKeyInput, per the products controller pattern, so the existing validation pipe produces the 400. Grep apps/api/src for any other `.parse(` or `.safeParse(` that takes request body, query or params input (response serializers that parse their own output are correct to throw); expected none, and any hit gets the same fix and a test. Commit as `fix(quick-261108-bzd): 400 validation_failed for invalid api key input`.

STEP D, prove reliability. Run `bun run --filter @userhq/api test` five more times and `bun run ci:check` three times, all at default parallelism with no worker cap, each to its own /tmp log, in the background. Append a post-fix table to DIAGNOSIS.md (run, exit code, duration, failures). If any run fails: treat each failing test as new evidence, re-run it alone, diagnose it with the same rigour and record it, and do not re-add a mitigation without a recorded cause. If after-hook timeouts reappear without the hook-timeout override, that is a second, separate cause: record hook durations and the Postgres connection count during DROP DATABASE, and only then restore a timeout with a comment citing that evidence. Commit the DIAGNOSIS.md update as `docs(quick-261108-bzd): record post-fix reliability runs`. Create 261108-bzd-SUMMARY.md with status in-progress (SPLIT-1) and stop for review unless instructed to continue.

Residual risk to state in DIAGNOSIS.md: a foreign process that binds a wildcard ephemeral port (for example another worktree still running old test code) can still collide with a 127.0.0.1 listener; after this change every run of this repo is protected from every other run of this repo.</action>
  <acceptance_criteria>
    - DIAGNOSIS.md is committed before the first fix commit (`git log --oneline` shows the docs commit older than both fix commits) and contains the A1, A4 and A5 run tables, both probe outputs, the ruled-out list and the conclusion.
    - RED output for test-isolation.test.ts and the createKey cases is captured before C1 and C2; all new tests pass afterwards.
    - The temporary instrumentation was reverted: `git status --short apps/api/test/support/webhook-receiver.ts` prints nothing and `git log --oneline --grep 'quick-261108-bzd' -- apps/api/test/support/webhook-receiver.ts` prints nothing.
    - `grep -c 'hookTimeout' apps/api/vitest.config.ts` prints 0, and `grep -rn 'VITEST_MAX_WORKERS' . --include='*.json' --include='*.yml' --include='*.yaml' --include='*.ts' --include='*.md' --exclude-dir=node_modules --exclude-dir=.planning` prints nothing.
    - Five standalone API runs and three `bun run ci:check` runs at default parallelism all exit 0, recorded in DIAGNOSIS.md.
    - `grep -rn 'createApiKeySchema.parse' apps/api/src` prints nothing.
  </acceptance_criteria>
  <verify>
    <automated>for i in 1 2 3 4 5; do bun run --filter @userhq/api test > /tmp/bzd-post-api-$i.log 2>&1 || { echo "API run $i failed"; exit 1; }; done && for i in 1 2 3; do bun run ci:check > /tmp/bzd-post-ci-$i.log 2>&1 || { echo "ci:check run $i failed"; exit 1; }; done</automated>
    <fails_when>The cause is applied without recorded evidence; the fix commit precedes DIAGNOSIS.md; any default-parallelism run fails or needed a worker cap; the mitigation is removed but after-hook timeouts return with no recorded cause; an invalid scope still returns 500; or a test file listens on a non-loopback address.</fails_when>
  </verify>
  <done>The flake's cause is demonstrated and recorded, the harness removes it for every test socket, a guard test keeps it removed, default-parallelism ci:check is green three times without masking, and invalid API-key input returns 400.</done>
</task>

<task type="auto" tdd="true">
  <name>2. Announce scheduled changelog entries when their date arrives (migration, scheduler job, tests with controlled time, docs)</name>
  <files>packages/db/src/schema/changelog.ts, packages/db/migrations/0021_changelog_announced_at.sql, packages/db/migrations/0022_backfill_changelog_announced.sql, packages/db/migrations/meta, apps/api/src/changelog/changelog.scheduler.ts, apps/api/src/changelog/changelog.module.ts, apps/api/src/changelog/changelog.service.ts, apps/api/test/changelog-scheduler.test.ts, docs/automation-api.md</files>
  <precondition>Task 1 is committed and 261108-bzd-DIAGNOSIS.md records three consecutive passing default-parallelism `bun run ci:check` runs. If it does not, stop; do not start this task.</precondition>
  <reversibility rating="costly">Migrations 0021 and 0022 ship in the image and apply at API boot; the column and backfill cannot be cheaply undone once deployed.</reversibility>
  <read_first>
    - apps/api/src/changelog/changelog.service.ts lines 20-30 and 140-375 (isLiveAt, announceIfWentLive, create, update, publish, unpublish)
    - apps/api/src/webhooks/webhook.worker.ts lines 56-100 (interval, non-overlapping tick, NODE_ENV test gate, shutdown) and apps/api/src/email/worker.ts lines 31-60
    - apps/api/src/webhooks/outbox.ts (enqueueWebhookEvent: Changelog gate, share lock on the product row, workspace scoping)
    - apps/api/src/portal/product-features.ts (featureEnabled, pickFeatures, productFeatureColumns)
    - packages/db/src/schema/changelog.ts and packages/db/src/schema/tenancy.ts (products and workspaces deleted_at columns)
    - packages/db/migrations/0018_comment_attention_index.sql, 0019_backfill_comment_attention.sql and meta/_journal.json (generated versus custom migration precedent)
    - apps/api/test/webhook-events.test.ts lines 255-330 (existing changelog event fixtures) and apps/api/test/portal-changelog.test.ts lines 215-250
    - docs/automation-api.md lines 240-275 and how apps/api/test/automation-routes.test.ts reads that file
  </read_first>
  <behavior>
    - A product with Changelog on and an active subscription to `changelog.published`: an entry created through the API with publishedAt in the future creates no delivery. `scheduler.tick(now)` with now before the date claims nothing and creates no delivery. `tick(now)` with now after the date claims exactly one entry and creates exactly one pending delivery whose payload data is `{id, title, summary, publishedAt}`. A second tick at the same or a later time creates nothing more, and the entry's announced_at is set.
    - Exactly once under a race: two separate ChangelogScheduler instances, plus overlapping `Promise.all([tick, tick])` calls on one instance, produce exactly one delivery. The overlapping call on the same instance resolves null (non-overlapping ticks).
    - A draft entry (null publishedAt) is never claimed. An entry created live (past date) is marked announced by the existing request path, produces its one delivery at creation, and is never produced again by any tick.
    - Changelog gate (D-08, D-10, D-14): when the product's Changelog is switched off before the date arrives, the tick produces no delivery, and after the Changelog is switched back on a later tick still produces none (the entry was claimed, not replayed).
    - Tenant scoping (D-11): two workspaces each with a subscription and one due entry; each subscription receives only its own workspace's event. Entries of a soft-deleted product are not announced.
    - Re-arming: unpublishing an announced entry clears announced_at; publishing it again with a future date creates no immediate delivery and exactly one when the date arrives. Rescheduling a live announced entry to a future date clears announced_at and re-announces once on arrival. Editing a live announced entry without changing its liveness changes nothing.
    - Portal visibility follows the publish date (verify, no change expected): a future entry is absent from the portal list and detail until its date has passed (existing test at portal-changelog.test.ts line 221 stays green).
    - Migration shape: 0021 adds exactly one nullable timestamptz column `announced_at` to changelog_entries and nothing else, with no device_info statement. 0022 is idempotent, DDL-free SQL that sets announced_at for rows with a non-null published_at at or before now and announced_at null; future and draft rows stay null. Applying 0022's SQL twice to a test database changes nothing the second time, and live rows are not re-announced after migration.
    - Neither the admin nor the public changelog responses contain announced_at or announcedAt.
  </behavior>
  <action>Per D-06 (signed webhooks cover published content), D-08 and D-10 (a disabled Changelog sends nothing), D-14 (nothing suppressed while disabled is replayed on re-enable) and D-11 (tenant isolation).

RED first. Create apps/api/test/changelog-scheduler.test.ts covering every behavior above. It seeds its own workspaces, products, statuses-free changelog fixtures and subscriptions directly (follow the fixture style of webhook-events.test.ts), reads announced_at through the Drizzle schema import so the RED is a real failure, drives time only through the `now` argument of `tick` and by choosing entry dates relative to a fixed base, and for the migration cases reads packages/db/migrations/0022_*.sql with a path relative to the test file, runs it against a throwaway rows set in the test database, and runs it a second time. Run it and record the RED output (no announced_at column, no scheduler class). Commit as `test(quick-261108-bzd): RED scheduled changelog announcement`.

Schema and migrations. Add `announcedAt: timestamp("announced_at", { withTimezone: true })` (nullable, no default, no index; the claim filters on a small due set) to changelogEntries with a comment that null means not yet announced. Run `bun run build:packages`, then `bun run --filter @userhq/db db:generate -- --name changelog_announced_at`. Open the SQL: if it contains device_info statements from a stale snapshot, delete those lines and re-run until db:generate reports no schema changes. Then create the custom backfill with `bun run --filter @userhq/db db:generate -- --custom --name backfill_changelog_announced` and write one UPDATE that sets announced_at to published_at for rows with published_at not null, published_at at or before now, and announced_at null (a comment explaining that entries already live before this migration were either announced inline or are past the old gap and must not be announced retroactively). Run `bun run --filter @userhq/db db:check` and `bun run build:packages`. Commit as `feat(quick-261108-bzd): changelog announced_at column and backfill`.

Scheduler. Create apps/api/src/changelog/changelog.scheduler.ts with an injectable ChangelogScheduler following the WebhookWorker pattern: injected DB and ENV, `onApplicationBootstrap` starts a 60 second interval only when NODE_ENV is not test, unref'd, with a catch that logs and never rejects; `onApplicationShutdown` clears it; a public `tick(now: Date = new Date())` that returns null when a pass is already running (running flag cleared in finally) and otherwise the number of entries announced. In one transaction the tick claims due entries with a single conditional UPDATE joined to products and workspaces: announced_at is null, published_at is at or before the `now` parameter (bound as a parameter, never the SQL clock, so tests control time), the product and its workspace are not soft-deleted, ordered by published_at, limited to 100 and locked with `FOR UPDATE SKIP LOCKED`, returning id, product_id, title, summary, published_at and the product's workspace_id; the UPDATE sets announced_at to `now`. For each claimed row call `enqueueWebhookEvent` inside the same transaction with the row's own workspace id and product id and event type `changelog.published` and the same four data fields as the request path. The existing gate in enqueueWebhookEvent drops the event for a product whose Changelog is off while the claim still marks the entry announced, which implements D-14 (never replayed); keep it that way and put one comment saying so. Add a `ponytail:` comment naming the ceiling: one batch per tick, and an enqueue that throws rolls the whole tick back and retries next tick. Register the provider in changelog.module.ts.

Request-path agreement in changelog.service.ts: when announceIfWentLive announces, also set announced_at on that entry in the same transaction. Whenever create, update, publish or unpublish leaves an entry not live (null date, or a future date), set announced_at to null in the same statement that changes the date. Do not change who is announced or the payload. Do not expose announced_at in any DTO.

Docs. In docs/automation-api.md replace the sentence at line 261 about future-dated entries not announcing with the new behavior: a future-dated entry is announced by a background job within about a minute of its date arriving (the job runs every 60 seconds, then the webhook queue's own delivery interval applies), once per transition to live; an entry whose date arrives while the product's Changelog is off is never announced and is not replayed on re-enable; unpublishing or rescheduling re-arms it. Keep every phrase the docs-sync tests look for (run automation-routes.test.ts and fix the test or doc, whichever the test intends). Run `bun run build:packages`, the new suite to GREEN, then the verify command. Commit the scheduler, service change and docs as `feat(quick-261108-bzd): announce scheduled changelog entries when their date arrives`.</action>
  <acceptance_criteria>
    - RED output captured before any implementation; all new tests pass afterwards.
    - `ls packages/db/migrations | grep -c '^002[12]_'` prints 2, `grep -c 'device_info' packages/db/migrations/0021_changelog_announced_at.sql` prints 0, `bun run --filter @userhq/db db:generate` reports no schema changes, and `bun run --filter @userhq/db db:check` exits 0.
    - The scheduler never uses the SQL clock for the due comparison: the claim statement binds the `now` argument (visible in the test via a tick at a time far from the real clock).
    - Both the two-instance race and the overlapping-tick case are asserted; the Changelog-off, re-enable, draft, soft-deleted product and cross-workspace cases each have a test.
    - `grep -n 'does not announce itself' docs/automation-api.md` prints nothing, and the docs-sync tests in test/automation-routes.test.ts pass.
    - Existing suites stay green at default parallelism: test/changelog.test.ts, test/portal-changelog.test.ts, test/webhook-events.test.ts, test/webhook-worker.test.ts, test/webhook-event-modules.test.ts, test/product-feature-delivery.test.ts, test/cross-tenant.test.ts.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/changelog-scheduler.test.ts test/changelog.test.ts test/portal-changelog.test.ts test/webhook-events.test.ts test/webhook-worker.test.ts test/webhook-event-modules.test.ts test/product-feature-delivery.test.ts test/automation-routes.test.ts test/cross-tenant.test.ts && bun run --filter @userhq/api typecheck && bun run --filter @userhq/db db:check</automated>
    <fails_when>A future-dated entry is never announced, is announced twice (two instances, repeated ticks, or request path plus tick), is announced while Changelog is off or replayed after re-enable, reaches another workspace's subscription, a draft or soft-deleted product's entry is announced, existing live entries are announced by the migration, the migration carries device_info statements, announced_at appears in a response, or any listed suite or the typecheck fails.</fails_when>
  </verify>
  <done>A scheduled changelog entry produces exactly one changelog.published when its date arrives, behind the same Changelog gate and tenant scoping as every other webhook event, with a durable marker, a committed generated migration plus an idempotent backfill, controlled-time tests, and docs that no longer carry the known gap; RED and GREEN evidence recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>3. Contrast sweep: accent text and focus indicators use the accessible token, accent text clears every surface including muted chips, tests extended</name>
  <files>apps/web/lib/accent.ts, apps/web/app/globals.css, apps/web/test/accent.test.ts, apps/web/test/contrast-sweep.test.ts, apps/web/test/faq-portal.test.tsx, apps/web/app/(app)/page.tsx, apps/web/components (the files the sweep test reports, about 30), apps/api/test/browser/portal-branding.spec.ts, apps/api/test/browser/votes.spec.ts</files>
  <precondition>Task 1 is committed and 261108-bzd-DIAGNOSIS.md records three consecutive passing default-parallelism `bun run ci:check` runs. If it does not, stop; do not start this task.</precondition>
  <read_first>
    - apps/web/lib/accent.ts (ACCENT_SURFACES, meetsOn, accentTokens, accentStyle) and apps/web/lib/accent.test.ts
    - apps/web/test/accent.test.ts (BRANDS list, palette parsed from globals.css, the pinned "preserves light behaviour" cases and the `--ring` assertion in the accentStyle test)
    - apps/web/app/globals.css lines 17-110 (static tokens, `--primary-text`, `--ring`, `@theme inline` already exposes `--color-primary-text`)
    - apps/web/test/portal-accent.test.tsx and apps/web/test/faq-portal.test.tsx lines 85-115 (class strings asserted in tests)
    - .planning/quick/261107-2el-fix-dark-mode-accent-contrast-and-theme-/261107-2el-SUMMARY.md lines 85-95 (the residual items this task closes)
    - apps/api/test/browser/portal-branding.spec.ts lines 141-181 and votes.spec.ts lines 305-390 (pinned computed colours for the #2563EB brand)
    - A grep of apps/web/app and apps/web/components for the raw brand utilities (see the action for the exact set)
  </read_first>
  <behavior>
    - Surfaces: ACCENT_SURFACES gains `muted` for both themes (light #EAF0ED, dark #1A2638), and the drift guard test parses `--muted` from globals.css as it already does for background and card.
    - Guarantee: for every brand in the test palette, `primaryText` (light) meets 4.5:1 on background, card and muted and on the worst-case 20 percent accent tint of each of those three, and `primaryTextDark` meets 4.5:1 on the same six dark surfaces. The existing fallback is kept: a brand that fails 4.5:1 on light background or card still resolves to #171717 (so #FACC15, #FFFFFF, #14B8A6 and #EF4444 are unchanged); a brand that passes those but fails muted or a tint is darkened toward black in small steps until it passes, keeping its hue; in dark, the existing lighten loop now runs against all six surfaces.
    - Pins: the previously pinned `accentTokens("#2563EB").primaryText` equal to the brand is replaced by an assertion that it is a darkened blue (not the brand, hue preserved, meets the guarantee) plus an explicit hex pin for the new value; `#FACC15` and `#FFFFFF` still resolve to #171717; the default accent's text stays teal.
    - Static tokens: tests parse globals.css and assert 4.5:1 for `--muted-foreground`, `--foreground` and `--primary-text` on each of background, card and muted, in both themes, and that static `--ring` equals static `--primary-text` per theme.
    - Focus: `accentStyle(...)["--ring"]` equals the same light-dark pair as `--primary-text`; fills (`--primary`, `--primary-foreground`, `--entity-accent`) are unchanged.
    - Sweep test (contrast-sweep.test.ts): scanning every .tsx under apps/web/app and apps/web/components finds no use of the raw brand as text or indicator: the text utility for `--color-primary` (including hover, group-hover, focus and data-state variants, with or without an opacity suffix), the arbitrary-value text and ring utilities that read `var(--primary)`, and the solid (no opacity suffix) ring utility on `--color-primary`. An explicit allowlist covers the native checkbox inputs (fills, not text) with a reason each; the test fails if an allowlist entry no longer exists, and asserts it scanned at least 100 files.
    - Browser pins: portal-branding.spec.ts and votes.spec.ts expect the new computed colour for the #2563EB brand, derived from the accent.test.ts pin.
  </behavior>
  <action>Per D-01 (light, dark and system themes must stay readable) and the closed residual items from 261107-2el: accent text on muted chips, raw brand text, and brand focus outlines.

RED first. (1) Before changing anything, record fill counts: `grep -rc` for the fill utilities that must not change (`bg-primary`, `border-primary`, `accent-primary`, `ring-primary/` with an opacity suffix, `--primary)` as a fill) over apps/web/app and apps/web/components into a temp file. (2) Extend apps/web/test/accent.test.ts and create apps/web/test/contrast-sweep.test.ts as described in the behavior list, with the palette-wide guarantee over the six surfaces (compose the 20 percent tint by blending the brand over each surface channel-wise in the test), the static-token pair checks, the `--ring` assertions, and the source scan. Run them and record the RED output (the muted failures for #2563EB, #087F75 and others, the scan reporting the offending file and line list). Commit as `test(quick-261108-bzd): RED accent text on muted chips and raw brand text sweep`.

GREEN. (3) accent.ts: add `muted` to ACCENT_SURFACES and update the comment that previously excluded it (the exclusion is why raw default text failed on chips); extend meetsOn to take the three surfaces plus their 20 percent brand tints; implement the light and dark rules from the behavior list with one small mixWithBlack helper beside mixWithWhite; make accentStyle emit `--ring` as the same light-dark pair as `--primary-text`. (4) globals.css: set static `--ring` to the static `--primary-text` value in each theme; change nothing else. (5) Sweep the components with one scripted codemod rather than hand edits: read the offender list from the sweep test, then apply these rewrites with the string forms already used in this codebase: the raw brand text utility (and each variant prefix) becomes the arbitrary-value utility reading `var(--primary-text)`; arbitrary-value text utilities reading `var(--primary)` become the same; the solid raw ring utility becomes the arbitrary-value ring utility reading `var(--primary-text)`. Do not touch: filled backgrounds, borders, the opacity-suffixed ring utilities used as transient drag and drop highlights, `accent-primary`, `--primary` itself, `--entity-accent`, the primary foreground token, or the three native checkbox inputs (allowlist them in the test with the reason that the colour there is a form-control fill, not text). Update the class string asserted in apps/web/test/faq-portal.test.tsx for the search highlight. (6) Run the full web test suite and fix every pin that legitimately changed (each changed pin is listed in the SUMMARY with its old and new value and why); do not weaken any contrast assertion. (7) Compute the new light colour for the #2563EB brand from the accent.test.ts pin, convert it to rgb, and update the two pinned computed colours in apps/api/test/browser/portal-branding.spec.ts and votes.spec.ts with a comment pointing at the unit-test pin (the browser specs run in Task 4). (8) Re-run the fill counts and diff them against the temp file; they must be identical. Run `bun run lint`, web typecheck and the full web suite. Commit as `fix(quick-261108-bzd): accessible accent text and focus colour across surfaces and muted chips`. Update the SUMMARY with status in-progress (SPLIT-2) and stop for review unless instructed to continue.</action>
  <acceptance_criteria>
    - RED output captured before implementation; all new and updated tests pass afterwards.
    - The fill counts file recorded before the sweep and the same grep after the sweep produce identical output (`diff` exits 0).
    - `bun run --filter @userhq/web test` passes in full, `bun run --filter @userhq/web typecheck` and `bun run lint` exit 0.
    - contrast-sweep.test.ts scans at least 100 files, every allowlist entry still resolves, and removing a codemod rewrite from one file makes the test fail (verify once, then restore).
    - The SUMMARY lists every changed pin (old value, new value, reason), including the #2563EB light value and the two browser spec constants.
  </acceptance_criteria>
  <verify>
    <automated>bun run --filter @userhq/web test && bun run --filter @userhq/web typecheck && bun run lint</automated>
    <fails_when>Any raw brand text or solid ring usage remains outside the allowlist; accent text on muted or its tint falls below 4.5:1 for any palette brand in either theme; a fill, border or foreground token changes; a contrast assertion is loosened to make a test pass; the browser spec pins are left on the old colour; or the web suite, typecheck or lint fails.</fails_when>
  </verify>
  <done>Accent text and focus indicators render the accessible token, text on muted surfaces and accent tints meets 4.5:1 in both themes for every palette brand and for the static tokens, fills are untouched, and a scan test keeps the raw brand out of text; RED and GREEN evidence recorded.</done>
</task>

<task type="auto">
  <name>4. Browser specs: webhook secret and rotation, stale specs, Follow toggle, push click target, full suite on a rebuilt stack, final gate</name>
  <files>apps/api/test/browser/webhooks.spec.ts, apps/api/test/browser/portal-branding.spec.ts, apps/api/test/browser/dashboard-header.spec.ts, apps/api/test/browser/push-follow.spec.ts, .planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-SUMMARY.md</files>
  <precondition>Tasks 1-3 are committed and 261108-bzd-DIAGNOSIS.md records three consecutive passing default-parallelism `bun run ci:check` runs. If it does not, stop; do not start this task. Docker is reachable (`docker ps` works); if not, run `colima start` first.</precondition>
  <read_first>
    - apps/api/test/browser/webhooks.spec.ts (the full current lifecycle test) and apps/web/components/webhooks/webhooks-manager.tsx, create-webhook-dialog.tsx, webhook-secret-dialog.tsx (the real test ids and button names: rotate, rotated secret, done buttons, ping, deliveries, delete)
    - apps/web/components/workspace-dashboard/product-follow-toggle.tsx and apps/web/app/dashboard/[ws]/page.tsx lines 200-240 (where the toggle renders), packages/db/src/schema/push.ts (pushFollowedProducts)
    - apps/web/public/sw.js (the notificationclick handler and resolveTarget) and apps/web/test/push-sw.test.ts (the unit cases to mirror), apps/api/src/push/push.service.ts (the post url format it sends)
    - apps/api/test/support/stack.ts (openStack, mintSession, seedWorkspaceRows, createProductViaApi, cleanupWorkspaces), apps/api/playwright.config.ts, and apps/api/test/browser/workspace-dashboard.spec.ts lines 1-130 (fixture pattern, cookie injection)
    - apps/api/test/browser/portal-branding.spec.ts and dashboard-header.spec.ts (current locators)
    - .planning/quick/261107-1xs-fix-browser-push-slice-8-review-defects-/261107-1xs-SUMMARY.md lines 60-90 (stack rebuild, VAPID export, the local smoke database drift gotcha)
  </read_first>
  <action>Per D-06 (webhook signing secret shown once, rotation), D-02 (browser push: the admin Follow toggle and the click target), D-05 (admin-only management) and D-01 (the accent colour pins).

STEP A, stack. Check `colima status`; run `colima start` only if it is down. Generate a throwaway VAPID pair and export it in the same shell command that runs the stack, without echoing it: from apps/api, evaluate a short node command using the `web-push` package's key generator and export VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, then `cd` to the repo root and run `bun run stack:up` (rebuilds images, so it includes the Task 2 migrations and job and the Task 3 web changes; allow up to 10 minutes and run it in the background). Never read, print or edit `.env.docker`. If the api container crash-loops with an "already exists" migration error because the local smoke database on port 5433 has objects without migration records (seen in 261107-1xs), inspect first, touch only that smoke database, drop only empty smoke-only tables in one transaction as that task did, and record exactly what you changed.

STEP B, baseline. Run the whole browser suite once before editing any spec: `bun run --filter @userhq/api test:browser > /tmp/bzd-browser-before.log 2>&1`. Extract only the pass/fail summary and, per failing spec, the test name and first error line. This is the real starting state; it decides which specs are actually stale (do not trust the deferred-items note) and shows whether the Task 3 colour pins hold.

STEP C, specs. (1) webhooks.spec.ts: update to the current UI using the real test ids, and add coverage for the secret contract. Create a webhook, read the `whsec_` secret from the create dialog, finish, reload the page and assert neither the DOM nor any list response (fetch the workspace webhooks list through the page's request context with the session) contains that secret or a secret field; rotate through the row's rotate button and confirmation, assert the rotated-secret dialog shows a different `whsec_` value with the one-time wording, finish, reload and assert the new secret is gone from the DOM and the list response too; assert through the stack database that the stored secret equals the rotated one and no longer the first. Keep the ping, deliveries and delete steps, fixed to the current locators, and clean up everything created. (2) Stale specs: fix portal-branding.spec.ts and dashboard-header.spec.ts only when the baseline run shows a failure and the correct expectation is clear from the current components (for example the og:title format, the brand `aria-label` locator); otherwise leave the spec untouched and report precisely which assertion fails, the observed versus expected value, and why the fix is not clear. (3) Create push-follow.spec.ts. Follow toggle: an admin opens the workspace dashboard, finds the toggle by its `Follow {product name}` label, asserts `aria-pressed` false and the label "Follow", clicks, asserts pressed true and "Following", asserts the pushFollowedProducts row exists in the stack database, reloads and asserts it is still pressed, clicks again and asserts the row is gone; add the rollback case by routing the push-follow request to a 500 and asserting the toggle returns to its previous state with the error toast. Push click target: with notification permission granted to the context, register `/sw.js` from the app origin, obtain the service worker, and in the worker context install recorders on `self.clients.matchAll` and `self.clients.openWindow`, dispatch a plain Event of type `notificationclick` carrying a fake notification (close recorder and data.url set to the real post path format that the push service sends) with a waitUntil that collects the promise, and assert openWindow receives the same-origin absolute URL for that path; also assert a foreign-origin url falls back to the origin root. A synthetic event is the only automatable option because a real OS notification click cannot be driven from Playwright; if service worker registration or the worker evaluation is not possible in the project's headless Chromium after two focused attempts, do not leave a skipped test: remove that case and report the exact blocker. Clean up every row created. Use the existing fixture helpers and the cookie injection pattern from workspace-dashboard.spec.ts.

STEP D, run. Run each edited and new spec on its own, then the whole suite again to /tmp/bzd-browser-after.log. Report real counts and, for every failing spec, the name, first error line and whether it also failed in the baseline (pre-existing) or is new. Do not mark a failing spec as expected without a stated reason. Leave the stack running as you found it unless it was down.

STEP E, final gate and summary. Run `bun run build:packages` then `bun run ci:check` at default parallelism and require exit 0. Complete 261108-bzd-SUMMARY.md with status complete only when every must-have truth is proven: commits for all four tasks, the root cause in one paragraph with a pointer to DIAGNOSIS.md, the removed mitigations, the createKey fix, the scheduler design and the Changelog-off semantics (claimed without an event, not replayed), the changed contrast pins, the browser results before and after, anything not done and why, and the residual wildcard-listener risk. Commit specs as `test(quick-261108-bzd): browser specs for webhook secrets, follow toggle and push click target` and the summary as `docs(quick-261108-bzd): summary`.</action>
  <acceptance_criteria>
    - The baseline and final browser run logs exist and the SUMMARY reports passed, failed and skipped counts from them, with every failing spec explained.
    - webhooks.spec.ts asserts the secret is absent after reload and from the list response, and that rotation shows a different secret once and stores it; push-follow.spec.ts asserts both the Follow toggle persistence (database row present then absent) and the rollback; the push click case either asserts the same-origin target URL or is absent with the blocker reported.
    - Each edited or new spec passes when run alone against the rebuilt stack.
    - `bun run ci:check` exits 0 at default parallelism after all commits.
    - `git status --short` shows no uncommitted changes of yours, `git log --oneline --grep 'quick-261108-bzd' -- .planning/STATE.md .planning/ROADMAP.md` prints nothing, and nothing was pushed.
  </acceptance_criteria>
  <verify>
    <automated>bun run --filter @userhq/api test:browser webhooks.spec.ts push-follow.spec.ts portal-branding.spec.ts dashboard-header.spec.ts votes.spec.ts && bun run build:packages && bun run ci:check</automated>
    <fails_when>The browser suite was not run against a rebuilt stack or its results are summarised without counts; a failing spec is hidden by a skip or deletion without a stated reason; secrets from the stack or `.env.docker` are read or printed; the webhooks spec still targets removed locators; or ci:check fails at default parallelism.</fails_when>
  </verify>
  <done>The webhook secret contract, Follow toggle and push click target are covered in a real browser (or their infeasibility is precisely reported), stale specs are fixed or explained, the real results of the whole browser suite are reported against a rebuilt stack, and ci:check is green without masking; evidence recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test harness to API under test | A request that lands on a different test server can make an authorization assertion (401, 403, 404) pass or fail for the wrong reason |
| Client to POST api-keys | Untrusted body (scopes, name, expiry) crosses into key creation |
| Scheduler to webhook outbox | A system job with no request context fans events out to subscriptions across all workspaces |
| Product module gate to outbound events | A disabled Changelog must send and replay nothing |
| Admin-visible internals to responses | announced_at is internal state |
| Test stack to developer machine | The browser run uses the local Docker stack, its database and throwaway VAPID keys |

## STRIDE Threat Register

Threat IDs are unique within this quick task; it numbers its own.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-BZD-01 | Repudiation | API test harness (supertest wildcard listeners versus loopback listeners) | high | mitigate | Evidence-first diagnosis, then one bind address for every test server and a guard test that fails on any other listen; tenant-isolation and privacy suites (D-11) can no longer pass or fail by reaching another app (Task 1) |
| T-BZD-02 | Tampering | POST api-keys unvalidated input surfacing as an unhandled exception | medium | mitigate | Standard Schema validation at the controller boundary returns 400 validation_failed and creates no key; tests for unknown scope, empty scopes, wrong types, missing name, over-long expiry (D-05, Task 1) |
| T-BZD-03 | Information disclosure | Scheduler fan-out crossing workspaces | high | mitigate | Each claimed row is enqueued with its own product's workspace id inside the same transaction; a two-workspace test asserts each subscription receives only its own event (D-11, Task 2) |
| T-BZD-04 | Information disclosure | Announcing content of a product whose Changelog is off, or replaying it on re-enable | high | mitigate | Claim marks the entry announced while the existing enqueue gate drops the event; tests for off at due time and for re-enable (D-08, D-10, D-14, Task 2) |
| T-BZD-05 | Denial of service | Duplicate webhook deliveries to third-party receivers (two replicas, overlapping ticks, request path plus job) | medium | mitigate | Conditional claim with a durable marker under FOR UPDATE SKIP LOCKED, non-overlapping tick, request path writes the same marker; tests with two scheduler instances and overlapping ticks (D-06, Task 2) |
| T-BZD-06 | Information disclosure | announced_at leaking in admin or public changelog DTOs | low | mitigate | Never added to any DTO or serializer schema; response assertions in the scheduler test (Task 2) |
| T-BZD-07 | Information disclosure | Webhook signing secret persisting in the DOM or list responses after the one-time display | high | mitigate | Browser spec asserts absence after reload in both the DOM and the list response, and that rotation shows a new value only once (D-06, Task 4) |
| T-BZD-08 | Information disclosure | Throwaway VAPID keys or `.env.docker` contents exposed through shell output or committed files | low | mitigate | Keys generated into the environment without echo, never written to a file, `.env.docker` never read or printed; Playwright test-results and traces are gitignored (Task 4) |
| T-BZD-09 | Tampering | Browser specs writing to the local smoke database | low | accept | Only the local Docker smoke database on port 5433 is touched, every spec cleans up the rows it creates, and any drift repair is limited to empty smoke-only tables and recorded |
| T-BZD-10 | Denial of service | A foreign process holding a wildcard ephemeral port can still collide with a loopback test listener | low | accept | After the fix every run of this repo uses one address class; the residual risk (another worktree on old test code) is recorded in DIAGNOSIS.md |
| T-BZD-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency installs; uses installed packages only, so no package legitimacy audit applies |
</threat_model>

<source_audit>
| Source | ID | Item | Task | Status |
| --- | --- | --- | --- | --- |
| GOAL | Quick goal | Reliable default-parallelism gate, scheduled changelog announce, contrast sweep, browser specs | 1-4 | COVERED |
| CONTEXT | G-1 | Find the root cause with evidence (support files, shared state, ports, throttlers, intervals, vitest config) | 1 | COVERED (diagnosis step A with recorded evidence before any code change) |
| CONTEXT | G-2 | Reproduce, fix at the root, default-parallelism ci:check passes reliably (at least 3 runs) | 1, 4 | COVERED (5 standalone plus 3 ci:check runs in Task 1; final ci:check in Task 4) |
| CONTEXT | G-3 | Remove the hook-timeout and worker-count masking if the cause is fixed | 1 | COVERED (hook-timeout override removed; no worker cap exists in the repo, verified by grep) |
| CONTEXT | G-4 | createKey with unknown scope returns 400 in the standard format, with a test | 1 | COVERED |
| CONTEXT | D-1 | Future-dated entry emits changelog.published when its date arrives; verify portal visibility follows the date | 2 | COVERED (portal behavior verified by the existing test, kept green) |
| CONTEXT | D-2 | Small interval job in the API, non-overlapping ticks, conditional update, exactly once, durable marker via drizzle-kit generate, committed SQL, never push, tests with controlled time | 2 | COVERED |
| CONTEXT | D-3 | Respect the Changelog-disabled gate; update docs/automation-api.md and remove the known-gap note | 2 | COVERED |
| CONTEXT | E-1 | Replace raw text-primary, ring-primary and focus-outline brand usages used as text with the accessible token across apps/web | 3 | COVERED (the sweep test defines the set; the checkbox fills are allowlisted with reasons; the brief's "about 20" is about 60 across about 32 files) |
| CONTEXT | E-2 | Text on bg-muted chips meets 4.5:1 in both themes | 3 | COVERED (static tokens and accent text on muted plus the 20 percent tint) |
| CONTEXT | E-3 | Extend accent.test.ts-style tests; do not change fills | 3 | COVERED (fill counts diffed before and after) |
| CONTEXT | F-1 | webhooks.spec.ts updated for secret-shown-once and rotation | 4 | COVERED |
| CONTEXT | F-2 | Fix the two stale specs if the fix is clear, else report precisely | 4 | COVERED |
| CONTEXT | F-3 | Playwright cases for the admin Follow toggle and the push notificationclick URL if feasible | 4 | COVERED (feasibility rule and exact-blocker reporting for the click case) |
| CONTEXT | F-4 | Stack setup (colima, VAPID in the same shell), run the whole browser suite, report real results | 4 | COVERED |
| CONTEXT | Process | Behavior-first RED, atomic commits, no push, explicit-file API tests, never bun test, ci:check exits 0 at default parallelism | 1-4 | COVERED |
| REQ | D-01 | Light, dark and system themes stay readable | 3, 4 | COVERED |
| REQ | D-02 | Browser push for admins: follow, click target | 4 | COVERED |
| REQ | D-05 | API keys: explicit permissions and safe creation input | 1, 4 | COVERED |
| REQ | D-06 | Signed webhooks cover published content | 2, 4 | COVERED |
| REQ | D-08, D-10, D-14 | Disabled modules send nothing and do not replay | 2 | COVERED |
| REQ | D-11 | Tenant isolation is a trust boundary | 1, 2 | COVERED |
| RESEARCH | None for a quick task | | | n/a |

Not in this plan, each outside the four requested items: a web UI hint about scheduled announcement timing; adding scheduled-publish data to webhook payloads beyond the existing four fields; a shared throttle or limiter store for multiple replicas; running the browser suite in CI; changing the colours of any fill. Deferred ideas: none recorded for this scope.
</source_audit>

<verification>
Observe RED, then GREEN, for tasks 1-3. Finish with `bun run build:packages` and `bun run ci:check` exiting 0 at default parallelism (no worker cap in the environment), three consecutive times after Task 1 and once more after Task 4. Review the final diff on two axes: standards (CLAUDE.md constraints: committed generated migrations only and no db push, no new dependencies, tenant scoping on every query, the web app importing no server-only package, Bun for installs and scripts, Node runtime) and spec (D-01, D-02, D-05, D-06, D-08, D-10, D-11, D-14). Confirm `git status --short packages/db/migrations` shows only the generated 0021 and 0022 files and meta, and that no commit of this task touches STATE.md or ROADMAP.md. The parent orchestrator owns STATE.md. No push or deployment.
</verification>

<success_criteria>
The API suite's flake has a recorded, demonstrated cause and is fixed at the root with a guard test; `bun run ci:check` is green at default parallelism reliably and without masking; invalid API-key input returns 400; scheduled changelog entries announce exactly once when due behind the existing module gate; accent text and focus indicators meet 4.5:1 on every surface including muted chips with fills unchanged; and the browser suite has been run against a rebuilt stack with its real results reported, including webhook secret and rotation, the Follow toggle and the push click target.
</success_criteria>

## Artifacts this plan produces

| Path | Kind | Symbols / contents |
|------|------|--------------------|
| .planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-DIAGNOSIS.md | created | Baseline, probe, stray-request and exclusion evidence, ruled-out list, conclusion, post-fix runs |
| apps/api/test/test-isolation.test.ts | created | Loopback-only listener invariant and static listen scan |
| apps/api/test/support/test-app.ts, vitest.config.ts | modified | createTestApp owns one 127.0.0.1 listener; hook-timeout override removed |
| apps/api/src/api-keys/api-keys.controller.ts | modified | createKey validated through `@Body({ schema })` |
| packages/db/migrations/0021_changelog_announced_at.sql, 0022_backfill_changelog_announced.sql, meta/ | created | `announced_at` column; idempotent backfill of already-live entries |
| apps/api/src/changelog/changelog.scheduler.ts, changelog.module.ts, changelog.service.ts | created, modified | `ChangelogScheduler.tick(now)`; announced_at kept in step with the request path |
| apps/web/lib/accent.ts, app/globals.css, test/accent.test.ts, test/contrast-sweep.test.ts | modified, created | Muted and tint surfaces in the accent guarantee; `--ring` as text-safe token; raw-brand text scan |
| apps/web/components/** (about 30 files) | modified | Raw brand text and solid ring utilities replaced by the `--primary-text` token |
| apps/api/test/browser/webhooks.spec.ts, push-follow.spec.ts, portal-branding.spec.ts, dashboard-header.spec.ts, votes.spec.ts | modified, created | Secret and rotation, Follow toggle and click target, corrected pins |
| docs/automation-api.md | modified | Scheduled changelog announcement documented; known-gap sentence removed |

<output>
Create `.planning/quick/261108-bzd-flaky-api-suite-root-cause-scheduled-cha/261108-bzd-SUMMARY.md` when done
</output>
