---
status: complete
quick_id: 261106-f9k
completed: 2026-11-07
---

# API key security hardening

Completed approved fix 1 through GSD quick execution and ask-matt HTTP TDD and
separate standards/spec reviews. All changes remain local on the existing branch.

## Delivered

- Global explicit scope opt-in: unannotated routes reject keys, including admin
  keys and requests carrying a valid human cookie. Key management is session-only.
- API keys use a distinct persisted integration actor and explicit principal,
  without a human session, login capability or workspace membership. Existing
  keys acquire an actor idempotently. Automated posts no longer add a fake vote.
- Permitted feedback writes and moderation retain valid author/activity FKs and
  integration attribution without impersonating the creator.
- Product restrictions apply to resolved product routes. Restricted keys are
  denied on workspace-wide routes, including webhooks, comments, exports and
  requests. Aggregation is intentionally unavailable to these keys until its
  queries can enforce product restrictions; unrestricted scoped keys retain it.
- Better Auth middleware rejects key credentials before cookie handling. Shared
  parsing recognizes case-insensitive Bearer schemes and separating whitespace.

## Commits

- `50f5b26` — execution plan.
- `aa39863` / `697a90e` — account impersonation RED and explicit-route fix.
- `e54e43c` / `d794391` — attribution RED and integration actor implementation.
- `1ac0d94` — workspace resource restriction regression and fix.
- `1df7611` — review corrections for auth middleware and Bearer parsing.

## Verification

- Baseline: API key suite 8/8 passed; it did not cover the privilege escapes.
- Actual RED: account access returned 200 instead of 403; automation export used
  the creator as author; restricted webhook list returned 200 instead of 403.
- Review REDs: Better Auth get-session and lowercase bearer account access each
  returned 200 instead of 403. Added sign-out/session-preservation coverage.
- Focused GREEN: API keys, exports, webhooks and cross-tenant suites, 124 tests.
- Final `bun run ci:check`: passed. API 566, web 163, types 32, DB 5 tests, plus
  lint-rule tests, repository typechecks, API build, vinext build, Next fallback
  build and committed migration checks.
- First full-check attempt hit stale generated Next validator / vinext route
  types. Moved only the generated validator to /tmp, then full checks passed
  twice, including after review corrections. No source workaround was required.
- Docker was restarted after interruption; initial database connection refusal
  was infrastructure failure, not counted as a behavioral RED.

## Review

See `261106-f9k-REVIEW.md`. Standards reported one blocker; Spec reported two
blockers, with the auth middleware finding shared. All were fixed and tested.
Focused corrections were inspected by the primary agent without another
delegate review. No outstanding finding remains from this quick task.

## Remaining approved work

2. Shared outbound URL safety for webhooks and browser push.
3. Inbox reply handling and historical attention backfill.
4. Push delivery access/preferences checks, disabled-board cleanup, URLs/grouping.
5. Dark mode product-accent contrast.
6. Remaining important gaps, API documentation and regression coverage.

This summary does not claim the overall expansion or deployment is complete.
