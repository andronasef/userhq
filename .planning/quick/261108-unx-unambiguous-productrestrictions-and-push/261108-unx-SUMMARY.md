---
phase: quick-261108-unx
plan: 01
subsystem: security
tags: [api-keys, webhooks, browser-push, tenant-isolation]
status: complete
checkpoint: verified
tasks-completed: 3
tasks-total: 3
completed-date: 2026-11-08
plan_head_before: ffec0208fb5985b096f23d6147dd268df83a1ba6
plan_head_after: 7da676332a1a1bc06a2287d468fc70c7146e9cb8
actuals:
  tasks: 3
  commits: 11
requires:
  - phase: quick-261108-qrv
    provides: Shared PostgreSQL rate-limit storage and integration actor authentication
provides:
  - Explicit product-restriction input and fail-closed shared read policy
  - Ownership-preserving push registration and possession-proven account switching
  - Concurrency-safe integration actor initialization
affects: [workspace-automation, browser-push]
tech-stack:
  added: []
  patterns: [Shared restriction schema, possession-proven subscription replacement]
key-files:
  created: [packages/db/migrations/0024_unambiguous_product_restrictions.sql]
  modified: [apps/api/src/push/push.service.ts, apps/api/src/api-keys/authorization.ts, apps/api/src/api-keys/api-key.service.ts, apps/api/src/tenancy/tenant.guard.ts, apps/api/src/webhooks/outbox.ts, apps/api/src/webhooks/webhook.service.ts, packages/types/src/api-keys.ts, packages/types/src/webhooks.ts, docs/automation-api.md]
requirements-completed: [D-05, D-11]
---

# Quick 261108-unx: restriction and push ownership fixes

**Empty product restrictions are rejected, stored restrictions fail closed, and cross-account push registration requires both stored browser keys and replaces the previous owner's subscription rather than reassigning its queue.**

Implementation, verification and independent two-axis review are complete. Standards and security/specification reviews found no actionable issues. Review clarified the documentation: webhook PATCH omission preserves restrictions, while null removes them.

## Changes

- Keys and webhook create/update inputs share one nullable, optional, non-empty UUID-list schema. Null or omitted means unrestricted; duplicate IDs are deduplicated. Unknown, foreign and soft-deleted product IDs produce the same `400 validation_failed` message and no write.
- `isProductAllowed` is used by TenantGuard and webhook enqueue. Empty, scalar, mixed or otherwise malformed stored lists deny access. A valid list allows exactly its product IDs.
- Generated custom migration 0024 converts only existing empty arrays to NULL in the two restriction columns. Before this task both read paths skipped empty-list checks and both managers displayed them as All products; the migration therefore preserves those rows' prior effective access. The upgrade test covers unchanged non-empty lists, NULLs and timestamps, plus idempotence.
- A different user's endpoint registration returns `409 push_endpoint_conflict` unless both stored browser keys match. Refusal leaves the subscription unchanged and creates no preference row. A matching-key account switch deletes the old row before insertion, cascading its queued deliveries away. Same-owner refresh preserves the subscription ID; unregister remains owner-scoped.
- The earlier full CI failure exposed an integration actor first-use race. Its insert now arbitrates all unique conflicts, then refreshes only the exact deterministic ID/email identity and verifies a row was found. An unrelated identity collision fails closed rather than updating or impersonating it.

## TDD and provenance

Inherited RED commits `f7f97bc` (push ownership) and `9f7cb89` (restriction inputs/read paths/migration) precede their implementation commits. Their original raw run logs did not survive this interruption, so this continuation does not invent old failure counts. The interrupted PLAN was preserved in `3695024`; its text existed before that commit, but Git cannot prove earlier planning-file provenance.

The parent added mixed-malformed-list HTTP tests in `0099143`: `/tmp/unx-malformed-red.log` recorded two failures and 55 passes. `ef06f94` made the entire stored list pass the shared schema before membership checks; `/tmp/unx-malformed-green.log` passed all 57 tests.

The inherited `/tmp/unx-ci1.log` failed one of 830 API tests: a 130-request parallel first-use test returned 120 successes, nine rate-limit responses and one server error. A tightened real HTTP test creates fresh keys in eight waves of 130 parallel requests. Its second instrumented run failed with PostgreSQL `23505`, constraint `user_email_unique`, from integration actor creation (`/tmp/unx-actor-repeat.log`). Temporary external driver instrumentation logged only SQLSTATE, constraint and routine; it was never committed and is absent from final verification. The intentional rate-store-unavailable test also produced `42P01`; that expected error was not confused with the actor race.

RED `0311fee` precedes GREEN `7da6763`. The actor table has separate ID and email uniqueness constraints; targeting only ID did not arbitrate the concurrent email conflict. The replacement uses `ON CONFLICT DO NOTHING` for all unique conflicts and an explicit ID-and-email-scoped UPDATE with a required returned row. No retries, error suppression or identity reassignment were added. A separate HTTP assertion verifies that an unrelated existing email owner is unchanged and no fabricated actor is accepted.

Primary API references consulted: [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and [Drizzle insert conflict handling](https://orm.drizzle.team/docs/insert#on-conflict-do-nothing).

## Verification

- Focused affected API gate: **244 tests in eight files passed** (`/tmp/unx-focused-final.log`), including push/worker, keys, webhook, attribution, cross-tenant, docs-sync and shared rate-limit behavior.
- Final `bun run build:packages` and complete **`bun run ci:check` exited 0** at default parallelism, without diagnostic preload or worker caps (`/tmp/unx-build-final.log`, `/tmp/unx-ci-final.log`).
- Full gate: **834 API tests in 62 files, 280 web tests in 31 files, 32 types tests, seven database tests, and 26 lint-rule tests passed**. Lint/typechecks, package/API builds, vinext standalone and Next fallback builds, and migration checks passed. Expected error-path logs and nonblocking lint warnings remain.
- The full database test includes the migration upgrade/idempotence assertions. Only migration 0024, its snapshot, and the journal changed; no earlier migration was edited and no database push was used.
- `git diff --check` passes. This quick task has not changed STATE.md or ROADMAP.md; parent owns final state recording. No new dependencies, push or deployment.

## Web audit and documentation

- `apps/web/components/api-keys/create-api-key-dialog.tsx:180` rejects an enabled restriction with no selection; line 190 sends null or the validated non-empty selection.
- `apps/web/components/webhooks/create-webhook-dialog.tsx:145` sends null for All products or one selected product ID.
- `apps/web/components/webhooks/webhooks-manager.tsx:79` PATCH sends only `isActive`.
- No `productRestrictions: []` submission was found under app/components. No web change was needed.
- Documentation-only commit `db45f4a` changes `docs/automation-api.md` and no source/test file. The docs-sync test passed without modification.

## Commits

| Commit | Result |
| --- | --- |
| `f7f97bc` | RED push endpoint ownership/account-switch tests |
| `bc33281` | Push ownership protection and replacement on proof of possession |
| `9f7cb89` | RED restriction input/read-policy/migration tests |
| `c7aea4b` | Normalize stored empty arrays through migration 0024 |
| `0e1d763` | Shared input, workspace product validation and read policy |
| `db45f4a` | Restriction contract documentation |
| `0099143` | RED mixed malformed stored restriction tests |
| `3695024` | Preserve interrupted plan artifact |
| `ef06f94` | Fail closed on the entire malformed restriction list |
| `0311fee` | RED concurrent integration actor first use |
| `7da6763` | Arbitrate actor uniqueness and verify exact identity |

The measured implementation count is 11 commits from `ffec020` through `7da6763`, before this summary metadata commit. No model-token usage is inferred from diff size.

## Deviations and intentionally unchanged items

- **[Rule 1 — Bug] Complete malformed-list validation:** the initial read helper rejected scalar values but still allowed a matching ID in a mixed invalid array. Parent added failing HTTP cases and changed the helper to validate the whole list.
- **[Rule 3 — Blocking issue] Actor concurrency:** the failed full gate revealed the independently reproducible uniqueness race described above. The parent authorized this minimal completion fix; it adds no endpoint, schema or auth approach.
- Verification used default parallelism, including focused API runs; the plan's optional single-file-iteration worker restriction was unnecessary.
- No database CHECK constraint was added: it would require an additional ordered migration and schema change; write validation, the shared read rule and the normalization migration cover current writers.
- The managers' All products display for a hand-forced empty stored list remains unchanged (`api-keys-manager.tsx:164`, `webhooks-manager.tsx:227`). Such a value cannot be produced by current validated writers after migration; authorization still denies it.
- The generic push registration failure toast, rate-limiting policy, workspace-level webhook events without a product, and plaintext webhook-secret storage are unchanged.
- No known stub, skipped test, unrun required verification, or new threat surface was introduced.

## Self-Check: PASSED

The plan, migration SQL/snapshot, changed tests and summary exist. All listed commits are ancestors of HEAD. The final CI exit code was observed directly. Both review axes passed; the documentation clarification was checked with the existing docs-sync suite. No unrelated changes were staged. Nothing was pushed or deployed.
