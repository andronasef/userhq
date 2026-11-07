---
phase: quick-261107-s6l
plan: 01
subsystem: webhooks
tags: [webhooks, security, outbox, worker, docs]
requires: [D-06, D-08, D-10, D-11, D-14]
provides:
  - webhook signing secret shown once (create, rotate) and never on reads
  - session-only POST rotate-secret, immediate rotation
  - hardened webhook worker (claim-owned attempts, conditional completion, pool, tick, retention)
  - module gating (enqueue and delivery) with terminal suppressed state
  - guarded redeliver (state check, active endpoint, 10/min per caller)
  - post.merged, post.restored, comment.restored, roadmap-driven post.status_changed, once-only changelog.published
  - docs/automation-api.md Webhooks section pinned by tests
affects: [apps/api webhooks, roadmap, moderation, changelog, apps/web webhooks UI, docs]
key-files:
  created:
    - apps/api/test/support/webhook-receiver.ts
    - apps/api/test/webhook-secrets.test.ts
    - apps/api/test/webhook-worker.test.ts
    - apps/api/test/webhook-events.test.ts
    - apps/web/components/webhooks/webhook-secret-dialog.tsx
    - apps/web/test/webhooks.test.tsx
  modified:
    - packages/types/src/webhooks.ts
    - packages/types/src/index.ts
    - packages/db/src/schema/webhooks.ts
    - apps/api/src/webhooks/{webhook.service,webhooks.controller,webhook.worker,outbox}.ts
    - apps/api/src/feedback/{moderation.service,admin-posts.controller,admin-comments.controller}.ts
    - apps/api/src/roadmap/roadmap.service.ts
    - apps/api/src/changelog/changelog.service.ts
    - apps/api/vitest.config.ts
    - apps/api/test/{cross-tenant,automation-routes}.test.ts
    - apps/web/components/webhooks/{webhooks-manager,create-webhook-dialog,webhook-deliveries-dialog}.tsx
    - apps/web/lib/api-errors.ts
    - docs/automation-api.md
decisions:
  - Rotation is immediate with no overlap window; the worker signs at send time, so a retry after the swap uses the new secret. Documented.
  - Rotate has no @RequireScopes, so SessionGuard denies every key (even a key with all scopes) with 403 api_key_route_forbidden.
  - Redeliver does not reset attempts but caps them with LEAST(attempts, 4): a delivery that used all 5 gets exactly one more attempt, and the total never exceeds 5.
  - Events about merged posts are not suppressed (post.merged reports the merge).
  - Suppressed deliveries are terminal; re-enabling a module does not revive them.
  - Attempts are counted by the claim; a claim whose attempt number exceeds 5 (crash loop) fails without sending.
metrics:
  completed: 2026-11-07
status: complete
commits: 8
plan_head_before: 8561f9575e9c89ae50096587617c7197088489aa
plan_head_after: c0aff80eb0f203a6c54663942b772a37e2eb4482
actuals:
  tokens: 24900
  tasks: 4
  commits: 8
---

# Phase quick-261107-s6l Plan 01: Webhook secret rotation, missing events, worker hardening Summary

One-liner: the webhook signing secret is returned only on create and on a session-only rotate route, every D-06 event class now fires once with a stable `evt_` id, the delivery worker is exactly-once and crash-bounded with module gating and 30-day retention, and the integrator docs are pinned to the code by tests.

## Outcome

`bun run ci:check` exits 0 (run on the final working tree, immediately before the last commit c0aff80, which added only the docs and vitest config that tree already contained): lint (warnings only, all pre-existing or in files I did not add), typecheck, build, types 32, db 6, api 56 files / 742 tests, web 30 files / 262 tests, web builds, `db:check`.

`bun run --filter @userhq/db db:generate` reported "No schema changes". `git status --short packages/db/migrations` is empty. No migration, no new dependency. STATE.md and ROADMAP.md untouched. Nothing pushed.

## Commits (all on docs/workspace-platform-expansion)

| # | Hash | Message |
|---|------|---------|
| 1 | 8e601a8 | test: RED secret shown once, session-only rotation, worker signs with rotated secret |
| 2 | 6d540a5 | feat: show webhook secret once, add session-only rotate-secret |
| 3 | 223cd48 | test: RED worker robustness, module gating, redeliver guard |
| 4 | f9cc084 | feat: harden webhook worker, gate disabled modules, guard redeliver |
| 5 | f96bd6f | test: RED missing webhook events with stable ids |
| 6 | 5f0e185 | feat: emit roadmap, merge, restore and changelog go-live events |
| 7 | f151a69 | test: RED webhook docs sync |
| 8 | c0aff80 | docs: webhook reference with sync tests |

## RED and GREEN evidence

- Task 1 RED: reads returned the secret (list), rotate was 404 (key case got 404 not 403, signing case 404); 3 of 4 failed (the foreign-workspace 404 case passed because the route did not exist). GREEN: 5 files, 138 tests (secrets, webhooks, api-keys, cross-tenant, automation-routes).
- Task 2 RED: 17 of 28 failed. Passing at first run (characterization): pinned headers/signature/body, per-attempt timestamps, backoff offsets 1/5/30/120 and fifth-attempt failure, silent-receiver timeout, 1.5 MB body truncation, paused endpoint, overlapping runs deliver once, stuck reclaim, redeliver of final rows, deleted/foreign/non-member 404. GREEN: 28/28.
- Task 3 RED: 9 of 12 failed. Passing at first run: inbox reply emits exactly one `comment.created` per subscription (characterization), rejected merges emit nothing, draft and future-dated changelog entries emit nothing. GREEN: 12/12, plus roadmap, merge, changelog, dashboard-board, workspace-feedback, comments, posts suites: 252 tests.
- Task 4 RED: no Webhooks section (3 tests). GREEN: 10/10. Drift checks done once each: renaming a documented event row fails the event-table test, adding an event to `WEBHOOK_EVENTS` without a row fails it too; both restored.

## Items already fixed before this task (found by reading, not redone)

- Bounded response read and request timeout: `OutboundHttp.post` (261107-052) has a 10 s deadline and an 8192-byte read cap; the worker keeps 1000 characters. Only worker-level tests were added.
- Backoff cap: `BACKOFF_MINUTES[n-1] ?? 360` already capped at 6 h. Lifted into exported `backoffMinutes`, behaviour unchanged.
- Stuck `sending` reclaim after 10 minutes already existed; pinned by a test and extended with attempts counted at claim.
- Inbox replies already emitted `comment.created` exactly once through `CommentsService.createComment`; a characterization test pins it.
- Admin-only redeliver: TenantGuard already admits only owners/admins (or a key with the scope); characterized. The documented `webhooks:write` automation scope was not narrowed.
- Secret on create already existed.

## Decisions

- **Immediate rotation**, no overlap window (T-S6L-11 accepted). A delivery that fails around the swap retries on the 1/5/30/120 minute schedule and is signed with the new secret at send time. Proven end to end (a pending retry after rotation verifies with the new secret and fails with the old).
- **Redeliver counts toward the 5 attempts.** Redeliver sets `attempts = LEAST(attempts, 4)` in the same conditional UPDATE, so a delivery that used all five gets exactly one more attempt and the stored count never exceeds 5. A side effect: the stored attempt count of a redelivered row can drop (5 to 4) before the new attempt.
- **Merged posts are not suppressed**, with a test that a pending `post.created` for a since-merged post is delivered.
- Suppression reason strings are `board_unavailable` and `changelog_unavailable`; a deleted product also suppresses.
- `attempts` now counts claims, not sends: a delivery that is suppressed or fails because its endpoint is paused still shows the claimed attempt.
- Enqueue product lookup is now also scoped by workspace id (tenant rule), a small addition inside `outbox.ts`.

## Deviations from Plan

1. **[Rule 3 - Blocking] `REDELIVER_THROTTLE` constant.** The docs-sync test needs the limit as a constant; I exported `REDELIVER_THROTTLE` from `webhooks.controller.ts` and used it in `@Throttle`. No behaviour change. It landed in the RED docs commit (f151a69) because the test imports it.
2. **Worker file amended once.** A leftover unused `base` helper in `webhook-worker.test.ts` was removed with `git commit --amend` before any later commit existed (unpushed).
3. **Plan verify list.** Where the plan listed explicit test files per task, I ran those; the full API suite also ran inside `ci:check`.
4. **Web e2e spec** (`apps/api/test/browser/webhooks.spec.ts`, Playwright, not part of ci:check) still reads the secret from the create dialog's success view, which is unchanged, so it needs no edit. Not executed here.

## Known gaps and accepted risks

- **Future-dated changelog entries do not announce themselves when their date arrives.** There is no scheduler job; `changelog.published` fires only on create, edit or publish of an entry that is live at that moment. Documented in the Webhooks section. Fix needs a go-live job.
- **Signing secrets stay plaintext in `webhook_subscriptions`** (T-S6L-09): the worker must recover them to sign. At-rest encryption is out of scope.
- **Throttle state is in API process memory** (T-S6L-10); exact with the single replica deployed.
- Retention purge is one unbatched statement (ponytail comment in code); add LIMIT batches if the table ever reaches millions of rows.
- The tick overlap guard and purge timer are per process, like the throttle.

## Flake finding (afterAll timeout in workspace-feedback.test.ts)

Likely, not proven, cause: `vitest.config.ts` set only `testTimeout`, so the hook timeout stayed at vitest's 10 s default; the file has four describe blocks that each create a temporary database and run every migration in `beforeAll`, and `app.close`, `pool.end` and `DROP DATABASE ... WITH (FORCE)` in `afterAll`, which can pass 10 s under full-suite load on a shared Postgres. Evidence gathered: run alone, the whole file takes 3.5 s total (45 tests), so each hook is far below 10 s in isolation; I could not reproduce the timeout, and vitest's verbose reporter does not print hook durations. Mitigation applied: `hookTimeout: 30000`. If it recurs, look at the failing run's hook duration and the Postgres connection count during `DROP DATABASE` (a lingering connection makes FORCE drop wait).

Also observed twice, once in a combined 8-file run and once in an `automation-routes.test.ts` run: `admin keys are denied ... on every route without a scope` failed with `socket hang up`, and in the first occurrence a few `webhooks.test.ts` cases failed. Both times the immediately following reruns of the identical command passed (6 consecutive passes of the file, then green full `ci:check`), and this followed a kill of an earlier hung vitest run that left 12 temporary test databases (which I dropped). I could not tie it to my change; treat it as an intermittent environmental flake and watch for it.

## Intentionally not changed

Signing-secret overlap window, at-rest secret encryption, announcing future-dated changelog entries, a throttle on the ping route, per-endpoint ordering or fairness, an environment setting or web control for retention, batching the retention delete, narrowing the `webhooks:write` scope for redeliver.

## Threat Flags

None beyond the plan's threat model. New surface is limited to the unscoped `rotate-secret` route, which is session-only, in `CROSS_TENANT_ROUTES` and pinned in `SESSION_ONLY_HANDLERS`.

## Known Stubs

None.

## Self-Check: PASSED

- Created files exist: webhook-receiver.ts, webhook-secrets.test.ts, webhook-worker.test.ts, webhook-events.test.ts, webhook-secret-dialog.tsx, webhooks.test.tsx (all present and committed).
- All 8 commits are ancestors of HEAD (`git rev-list --count 8561f95..HEAD` = 8, measured from the persisted ledger).
- `bun run ci:check` exit 0; `db:generate` reports no schema changes; no migration files changed.
