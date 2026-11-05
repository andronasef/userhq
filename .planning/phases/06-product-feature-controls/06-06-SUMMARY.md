---
phase: 06-product-feature-controls
plan: "06"
subsystem: customer-delivery
tags: [notifications, email-outbox, email-worker, tenancy, vitest]
status: complete
requires: [06-01]
provides: [board-disable-delivery-suppression, board-gated-fan-out, board-gated-email-worker]
affects: [06-08]
tech-stack:
  added: []
  patterns: [stateless-sql-gate-at-each-choke-point, derived-delivery-state-deletion-on-disable]
key-files:
  created: []
  modified:
    - apps/api/src/products/products.controller.ts
    - apps/api/src/email/outbox.ts
    - apps/api/src/notifications/notifications.service.ts
    - apps/api/src/email/worker.ts
    - apps/api/test/product-feature-delivery.test.ts
key-decisions:
  - Disable deletes only derived delivery state (unsent email items, unread notification rows) in the same transaction as the flag SET; posts, comments, activity and read notifications are untouched.
  - Every delivery choke point also re-checks the live Board flag, so events in the off-window never create delivery rows and a stale row can never surface.
requirements-completed: [CAP-02, CAP-07, CAP-08, CAP-09]
duration: resumed session
completed: 2026-11-05
actuals:
  tokens: 9000
  tasks: 3
  commits: 4
plan_head_before: 4c60ffca48c9ffbd0dc290bf99e422683df2ea87
plan_head_after: 879706aa1f8099a290d440d73d39ed0af97a2812
---

# Phase 6 Plan 06: Customer delivery suppression Summary

Disabling Board atomically deletes queued unsent mail items and unread notification rows for that product, and four SQL gates (status fan-out, `visible()`, comment-email enqueue, worker item query) keep off-window events from ever notifying, while events after re-enable deliver normally.

## Commits (06-06 only)

| Task | Commit | Change |
|---|---|---|
| 1 (RED) | 4ea5ca3 | Test demonstrating unread delivery replay after disable |
| 1 (GREEN) | f94db5a | Product PATCH: flag SET plus suppression in one scoped transaction |
| 2 | a792c95 | `fanOutStatusChange`, `visible()`, `enqueueCommentEmail` gates plus off-window and hidden-row tests |
| 3 | 879706a | `eq(products.boardEnabled, true)` in the worker item query plus worker tests |

`commits: 4` counts only 06-06 commits. The range `plan_head_before..plan_head_after` holds 9 commits because plan 06-02 commits are interleaved in the same branch.

## Behavior

- Fan-out: stakeholder SQL requires `products.id = productId AND workspace_id = workspaceId AND board_enabled`. Off-window status changes still write `post_activity` but create no notification rows.
- In-app read: `visible()` adds `eq(products.boardEnabled, true)`, so list, unread count and the embedded count agree.
- Enqueue: the recipients CTE requires the post's product to be in the workspace and Board-enabled, so no batch or item is created while Board is off (admin comments are possible then after 06-02).
- Worker: the existing scoped item query requires `boardEnabled`. This is the final item read before render and send. An empty result ends the batch `cancelled` (terminal, never reclaimed). Mixed-product batches send only the enabled product's items.

## Verification (real output)

- `bun run build:packages`: exit 0.
- RED before the gates: `bun run --filter @userhq/api test -- test/product-feature-delivery.test.ts` gave 1 failed, 2 passed. The off-window test failed at `expect(await f.list()).toHaveLength(0)` (received 1), a behavior failure, not a fixture failure.
- Mutation check, removing one gate at a time, each run on that one test file: removing fan-out failed the off-window test (1 failed, 4 passed); `visible()` failed the hidden-rows test (1 failed, 4 passed); enqueue failed the off-window test (1 failed, 4 passed); worker failed the worker test (1 failed, 4 passed). Each gate is independently covered. The hidden-rows and worker tests flip the flag with raw SQL so the PATCH cleanup cannot mask a missing read or send gate.
- Plan verify commands, run with explicit file arguments:
  - Task 1: `test/product-feature-delivery.test.ts test/product-features.test.ts`: 2 files passed, 9 tests passed.
  - Task 2: `test/product-feature-delivery.test.ts test/notifications.test.ts test/email.test.ts`: 3 files, 20 tests passed.
  - Task 3: `test/email.test.ts test/product-feature-delivery.test.ts test/email-render.test.ts`: 3 files, 30 tests passed.
- `bun run --filter @userhq/api typecheck`: exit 0. `bun run lint`: no warnings in 06-06 files (one pre-existing warning in `apps/web/components/color-field.tsx`, out of scope).

## Deviations from Plan

None in scope. Notes:
- **Environment:** Docker/colima was down. I started colima (it was already starting) and ran `bun run dev:services` to bring up Postgres 5432 and Mailpit 1025/8025, per 06-RESEARCH.
- **Tasks 2 and 3 share one test file.** The Task 2 commit already contains the worker test, so a checkout of a792c95 alone fails that one test until 879706a.
- **Interleaving test:** the worker's item read cannot be hooked between claim and read, so "toggle before the final item read" is proven by setting the flag directly (no cleanup) after the batch exists and before `runOnce`.

## Remaining Risks

- SMTP handoff is not atomic with the flag. A disable that lands after the final item read but before `sendMail` returns cannot recall that mail. This is the residual window the plan asked to document; it is bounded to one in-flight batch per worker tick.
- The gate relies on `board_enabled` being the only Board switch. Any new delivery pipeline must add the same predicate.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema changes.

## Self-Check: PASSED

Commits 4ea5ca3, f94db5a, a792c95, 879706a are ancestors of HEAD. Modified files exist and the working tree has no uncommitted 06-06 files.
