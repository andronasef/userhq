---
phase: quick-261108-unx
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-05, D-11]
files_modified:
  - packages/types/src/index.ts
  - packages/types/src/api-keys.ts
  - packages/types/src/webhooks.ts
  - packages/db/migrations/0024_unambiguous_product_restrictions.sql
  - packages/db/migrations/meta/_journal.json
  - packages/db/migrations/meta/0024_snapshot.json
  - packages/db/test/migrate.test.ts
  - apps/api/src/push/push.service.ts
  - apps/api/src/api-keys/authorization.ts
  - apps/api/src/api-keys/api-key.service.ts
  - apps/api/src/webhooks/webhook.service.ts
  - apps/api/src/webhooks/outbox.ts
  - apps/api/src/tenancy/tenant.guard.ts
  - apps/api/test/push.test.ts
  - apps/api/test/api-keys.test.ts
  - apps/api/test/webhooks.test.ts
  - docs/automation-api.md
estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - A push registration for an endpoint that another user already owns, with keys that do not match the stored p256dh and auth, returns 409 push_endpoint_conflict. The stored row is untouched (same id, user, keys, user agent, updated_at), no default preferences row is created for the caller, and the body names no owner. A request that matches only one of the two keys is also 409.
    - The same user may re-register the endpoint with new keys or user agent; the row keeps its id and is refreshed in place. A different user who presents the stored p256dh and auth (a browser profile switching accounts) gets 201 and the old owner's row is replaced, not reassigned, so the old owner's queued deliveries are dropped with it and are never sent to the new owner. Unregistering stays scoped to the owner, so a non-owner's DELETE leaves the row in place. The outbound URL guard and the existing push and push-worker suites stay green.
    - Creating an API key or a webhook subscription with productRestrictions [] returns 400 validation_failed and stores nothing, and so does a webhook PATCH with []. Omitted or null means unrestricted. A non-empty list must contain only live products of the caller's workspace; an unknown, foreign or soft-deleted id returns 400 validation_failed with one message that does not reveal which case it was. Duplicate ids are stored once.
    - One function decides product access for both read paths. TenantGuard (API keys) and enqueueWebhookEvent (webhook filter) both call it, and it treats null as all products, a list as exactly those products, and an empty or malformed value as no products. A key or subscription whose stored value is forced to [] directly in the database is therefore denied (403 product_restricted, no delivery) on both paths, never allowed on one and denied on the other.
    - Migration 0024, produced by drizzle-kit generate --custom, converts stored '[]' to NULL in workspace_api_keys and webhook_subscriptions and nothing else. This preserves effective behaviour because both read paths skipped the check for an empty list before this change (tenant.guard.ts line 123, outbox.ts line 108), and the RED run of the new fail-closed tests records that. An upgrade test proves conversion, that non-empty lists, NULLs and updated_at are untouched, and that re-running the SQL changes nothing.
    - The two web dialogs send null or a non-empty id list and no other form; docs/automation-api.md states the contract for keys and webhooks; the docs-sync suite stays green; bun run ci:check at default parallelism exits 0.
  artifacts:
    - packages/db/migrations/0024_unambiguous_product_restrictions.sql
    - apps/api/src/api-keys/authorization.ts
    - apps/api/test/push.test.ts
    - apps/api/test/api-keys.test.ts
    - apps/api/test/webhooks.test.ts
    - packages/db/test/migrate.test.ts
    - docs/automation-api.md
  key_links:
    - "push.service.ts registerSubscription becomes one transaction: first DELETE the row for this endpoint when it belongs to a different user and both stored keys equal the presented keys, then INSERT with ON CONFLICT (endpoint) DO UPDATE guarded by a setWhere that requires the existing row's user_id to equal the caller. A conflict row that fails the guard returns no row, which is the 409. Delete-then-insert (not an in-place user_id update) matters because push_deliveries.subscription_id cascades from push_subscriptions and push.worker.ts sends to whatever subscription row a delivery points at without comparing delivery.user_id to subscription.user_id."
    - "productRestrictionsInputSchema in packages/types/src/api-keys.ts is the single input rule (nullable, optional, min 1 id) used by createApiKeySchema, createWebhookSubscriptionSchema and updateWebhookSubscriptionSchema. The response schemas stay permissive so a legacy row can still be serialised."
    - "apps/api/src/api-keys/authorization.ts gains isProductAllowed (pure, read paths) and resolveProductRestrictions (async, write paths: dedupe plus a workspace-scoped, not-deleted products lookup). Both ApiKeyService.createKey and WebhookService create and update call the latter; tenant.guard.ts and outbox.ts call the former."
    - "Current behaviour, read from code before planning: an empty list is unrestricted in tenant.guard.ts and in outbox.ts, and the web managers (api-keys-manager.tsx line 164, webhooks-manager.tsx line 227) render it as All products, so all three agree today. Neither write path verifies that ids belong to the workspace today (api-key.service.ts createKey and webhook.service.ts createSubscription and updateSubscription store the ids as sent). API keys have no update route, only create, list and revoke; the update rule therefore applies to webhook PATCH only. Webhook and key-management routes are workspace-wide, so a restricted key cannot reach them (product_restricted)."
---

<objective>
Close two security-review observations without changing anything else: make the product restriction contract unambiguous for API keys and webhook subscriptions (D-05, D-11), and stop one user from taking over another user's browser push endpoint (D-11).

Purpose: an empty restriction list that silently means "everything" turns a mistaken or malicious edit into full access, and a push endpoint that any caller can re-point lets one account hijack or silence another account's notifications.
Output: a hardened push registration, one shared product-access rule used by both read paths, input validation that rejects the empty list and foreign ids, migration 0024 that normalises stored empty lists, updated docs, and RED-first tests at the HTTP and migration boundaries.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@.planning/quick/261107-flq-api-key-management-lockout-integration-a/261107-flq-PLAN.md
@apps/api/src/push/push.service.ts
@apps/api/src/api-keys/authorization.ts
@apps/api/src/tenancy/tenant.guard.ts
@apps/api/src/webhooks/outbox.ts
@packages/types/src/api-keys.ts

Ground rules from the orchestrator. Run API tests as `bun run --filter @userhq/api test <explicit files> --no-file-parallelism`; never `bun test`. Postgres is running (colima up, `bun run dev:services`). `@userhq/types` and `@userhq/db` are consumed from `dist`, so run `bun run build:packages` after editing anything under `packages/types/src` or `packages/db/src` before API typecheck or tests. No new dependencies. Migrations come only from drizzle-kit (`bun run --filter @userhq/db db:generate -- --custom --name unambiguous_product_restrictions`), never `drizzle-kit push`. Do not edit STATE.md or ROADMAP.md. Do not push or deploy. Commit each step atomically with the quick id `quick-261108-unx`, with a `test(...)` RED commit before each `fix(...)` GREEN commit. Other agents may be working in this directory: preserve unrelated changes. Do not read or print `.env.docker` or `env.local.dev`. `bun run ci:check` must exit 0 at its default parallelism; do not lower parallelism to get it green.

Discovery: Level 0. Every change follows a pattern already in the repo: ApiException with a code from API_ERROR_CODES, the Zod input schemas in packages/types, tenant-scoped drizzle queries, the journal-slicing migration upgrade test in packages/db/test/migrate.test.ts, and the data-only custom migration 0022.

Already true and not redone: the outbound URL guard (OutboundHttp.validateTarget) runs first in registerSubscription; the web API key dialog already refuses to submit "restrict to products" with no product selected (create-api-key-dialog.tsx line 180) and the webhook dialog sends null for "all" or a one-element list (create-webhook-dialog.tsx line 145), so no web path sends an empty list today; webhooks-manager.tsx PATCH sends only isActive; there is no API key update route; the web push client (push-preferences.tsx) always presents the browser's own endpoint and keys, so legitimate registrations never hit the 409 and its generic failure toast is acceptable; push routes are session-only and have no :ws parameter, so the route inventory and cross-tenant suites need no change.

Test isolation: new describe blocks append at the END of their file (api-keys.test.ts and webhooks.test.ts have order-dependent counts earlier in the file, for example "lists subscriptions for workspace" expects exactly one subscription), seed their own rows, and delete any subscription or key they create before finishing.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>1. Tracer: a push endpoint cannot be taken over, and an account switch with matching keys replaces the old owner's row</name>
  <files>packages/types/src/index.ts, apps/api/src/push/push.service.ts, apps/api/test/push.test.ts</files>
  <precondition>Postgres is reachable at the test default (userhq@127.0.0.1:5432) so createTestApp can create temporary databases.</precondition>
  <read_first>
    - apps/api/src/push/push.service.ts lines 46-99 (registerSubscription upserts on endpoint and sets user_id to the caller; unregisterSubscription is already scoped by user_id)
    - apps/api/src/push/push.controller.ts lines 42-61 (the controller only forwards user.id and the validated body; the status comes from the service)
    - packages/db/src/schema/push.ts lines 17-39 and 81-118 (unique index on endpoint; push_deliveries.subscription_id references push_subscriptions with onDelete cascade)
    - apps/api/src/push/push.worker.ts lines 192-216 (the worker loads the subscription by id and sends to its endpoint without comparing delivery.user_id with subscription.user_id)
    - apps/api/test/push.test.ts lines 17-176 (fixtures userA, userB, the unique-endpoint convention, the idempotent re-register test that asserts the id is unchanged) and lines 540-560 (a delivery row seeded directly through the schema)
    - apps/api/src/common/api-error.filter.ts lines 12-19 and packages/types/src/index.ts lines 20-96 (ApiException takes a code from API_ERROR_CODES)
  </read_first>
  <behavior>
    - Cross-user attempt: user A registers endpoint E with keys K1; user B posts E with different keys K2. Response 409, code push_endpoint_conflict. The row for E is unchanged in every column including id and updated_at, still owned by A with K1. The body contains neither A's user id nor A's email. A third user who is refused this way gets no push_preferences row.
    - Partial key match: B presents E with the stored p256dh but a different auth, and separately the stored auth with a different p256dh. Both are 409 and the row is unchanged.
    - Same-user refresh: A posts E again with new keys and a new user agent. 201, the same row id, keys and user agent updated, user_id still A, one row for E.
    - Account switch: B posts E with exactly K1 (both p256dh and auth equal). 201, exactly one row for E, owned by B with a different id than before, and the row owned by A is gone. A pending push_deliveries row that had been queued for A's old subscription no longer exists, and B has none.
    - Owner-scoped delete: B sends DELETE for E while A owns it. 200 {success: true} as today, and the row still exists, owned by A. A's own DELETE removes it.
    - Concurrency: A and B register the same brand-new endpoint at the same time with different keys. Exactly one request is 201 and the other is 409, and the final single row belongs to the 201 caller.
    - Unchanged: the private endpoint test still returns 400 invalid_url before anything is stored, and the existing idempotent re-register test keeps the same id.
  </behavior>
  <action>Per D-11, write the tests first and record RED. Add a nested describe to the first describe block of apps/api/test/push.test.ts that reuses testApp, userA and userB, signs in a third user for the no-side-effect assertion, uses a fresh endpoint per test (the Date.now plus counter convention already in the file), and reads rows through the schema import rather than through the API so the assertions cannot be satisfied by response shape alone. Cover every behavior above. Run only the new tests plus the existing push file, record the RED output (the cross-user and partial-match cases return 201 today, and the account-switch case keeps the old row id), and commit as `test(quick-261108-unx): RED push endpoint takeover, account switch and owner-scoped delete`. Then implement. In packages/types/src/index.ts append `push_endpoint_conflict` to API_ERROR_CODES. In apps/api/src/push/push.service.ts rewrite registerSubscription so that after the existing validateTarget call it runs one database transaction. Inside it, first delete the subscription row for this endpoint when its user_id is not the caller and both its p256dh and auth equal the presented keys; this is the proof of possession for an account switch, and it must delete rather than reassign because the cascade on push_deliveries.subscription_id then drops the old owner's queued deliveries, whereas an in-place user change would let the worker send them to the new owner's browser. Then insert the caller's row with onConflictDoUpdate on the endpoint target whose set refreshes p256dh, auth, user agent and updated_at but does not touch user_id or created_at, guarded by a setWhere that requires the existing row's user_id to equal the caller, and read the result with returning. When no row comes back, throw ApiException with code push_endpoint_conflict, status 409 and a message that says the endpoint is already registered to another account without naming anyone. Create the default push_preferences row only after a row was returned, so a refused request has no side effects. Add `ne` to the drizzle-orm import. Leave unregisterSubscription and push.controller.ts unchanged; the owner scoping already in unregisterSubscription is what the owner-scoped delete test pins. Do not add an in-process lock; the unique index plus the guarded upsert is what makes the concurrent case deterministic. Run `bun run build:packages`, then the push, push-worker and outbound-http files to GREEN, and commit as `fix(quick-261108-unx): refuse push endpoint takeover, replace the row only on proof of possession`.</action>
  <acceptance_criteria>
    - RED output captured before implementation; every new push test and every existing test in test/push.test.ts, test/push-worker.test.ts and test/outbound-http.test.ts passes afterwards.
    - `grep -c 'push_endpoint_conflict' packages/types/src/index.ts` prints 1, and `grep -c 'setWhere' apps/api/src/push/push.service.ts` is at least 1.
    - After the Task 1 commits, `git diff --stat ffec020..HEAD -- apps/api/src/push/push.controller.ts packages/db` prints nothing (ffec020 is the base commit this plan was written on).
    - The cross-user test asserts the stored row's id, user_id, p256dh, auth, user_agent and updated_at against a snapshot taken before the attempt, not just the status code.
    - The account-switch test asserts the old owner's queued delivery is gone and that no row owned by the old owner remains for the endpoint.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/push.test.ts test/push-worker.test.ts test/outbound-http.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck</automated>
    <fails_when>A different user can overwrite or take an existing endpoint without presenting both stored keys; a refused request changes the row or creates a preferences row; an account switch keeps the old owner's row or leaves queued deliveries that can reach the new owner; a non-owner's DELETE removes the row; two simultaneous registrations both succeed; the private-endpoint check regresses; or any listed suite or the typecheck fails.</fails_when>
  </verify>
  <done>A push endpoint belongs to one account at a time, changes hands only when the presenter holds the stored keys, and a hand-over discards the previous owner's queue; RED and GREEN evidence recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>2. productRestrictions contract: reject the empty list, verify workspace membership, one read rule, and migration 0024</name>
  <files>packages/types/src/api-keys.ts, packages/types/src/webhooks.ts, apps/api/src/api-keys/authorization.ts, apps/api/src/api-keys/api-key.service.ts, apps/api/src/webhooks/webhook.service.ts, apps/api/src/webhooks/outbox.ts, apps/api/src/tenancy/tenant.guard.ts, packages/db/migrations/0024_unambiguous_product_restrictions.sql, packages/db/migrations/meta, packages/db/test/migrate.test.ts, apps/api/test/api-keys.test.ts, apps/api/test/webhooks.test.ts</files>
  <precondition>Task 1 is committed and Postgres is reachable at the test default.</precondition>
  <read_first>
    - apps/api/src/tenancy/tenant.guard.ts lines 121-131 (the only reader of a key's restrictions; the inline emptiness test lets [] skip the check)
    - apps/api/src/webhooks/outbox.ts lines 59-72 and 100-112 (the only webhook filter; the same inline test)
    - apps/api/src/api-keys/authorization.ts (currently only apiKeyToken) and api-key.service.ts lines 46-78 and 156-167 (createKey stores dto ids unchecked; validateToken hands the stored value to the guard)
    - apps/api/src/webhooks/webhook.service.ts lines 65-141 (createSubscription and updateSubscription store ids unchecked; update passes null through as a clear)
    - packages/types/src/api-keys.ts lines 26-43 and packages/types/src/webhooks.ts lines 24-40 (three input schemas that each repeat the nullable array)
    - packages/db/test/migrate.test.ts lines 134-200 and 291-303 (journal slicing with MIGRATIONS_FOLDER, direct inserts, re-executing the migration SQL split on the statement breakpoint) and packages/db/migrations/0022_backfill_changelog_announced.sql (the data-only custom migration to mirror)
    - packages/db/src/schema/api-keys.ts and schema/webhooks.ts (column types and NOT NULL columns needed for the test inserts)
    - apps/api/test/api-keys.test.ts lines 136-158 (the invalidBodies table) and 270-300 (restriction enforcement), apps/api/test/webhooks.test.ts lines 31-60, 322-360 and 380-470 (mock receiver, worker.runOnce, delivery assertions)
  </read_first>
  <behavior>
    - Key create: productRestrictions [] returns 400 validation_failed and inserts no key. A product id that exists only in another workspace, a mix of a valid and a foreign id, a soft-deleted product of this workspace, and a well-formed unknown uuid each return 400 validation_failed and insert nothing. Omitted and null both return 201 with productRestrictions null. [A, A] returns 201 and stores [A] once. A valid [A] keeps working as in the existing test.
    - Webhook create: the same table of bodies on POST, no subscription stored when rejected. PATCH with [] returns 400 and the stored value is unchanged. PATCH with null clears the restriction (200, null) and a following post.created event in either product is delivered. PATCH with a foreign id returns 400. PATCH with [B] restricts to B.
    - Single read rule: a key created normally and then forced to [] directly in the database gets 403 product_restricted on a product-scoped route and on a workspace-wide route; a key left at NULL reaches both. A webhook subscription forced to [] directly in the database receives no delivery for a post.created in a product, while an unrestricted subscription created beside it does. A stored non-array value is denied rather than throwing.
    - RED evidence for current behaviour: before the fix, the forced-[] key reaches the product route and the forced-[] subscription receives the delivery. That run is the recorded proof that an empty list currently means unrestricted on both read paths.
    - Migration: after migrating a database to just before 0024, a key and a subscription each stored with '[]' become SQL NULL after the full migrate; rows stored with a non-empty list and rows stored with NULL are byte-identical, updated_at included; running the SQL a second time changes nothing.
  </behavior>
  <action>Per D-05 and D-11, work in three commits. Step A, RED: write all tests first. In the appended describe blocks of api-keys.test.ts and webhooks.test.ts cover every behavior above (create the foreign product and the soft-deleted product by direct insert; force the stored value with a direct update through the schema import; prove the webhook enqueue path with the file's mock receiver and webhookWorker.runOnce or by counting webhook_deliveries rows for the subscription). In packages/db/test/migrate.test.ts add the upgrade test in the style of the comment-attention test: copy the migrations folder, slice the journal to entries before the tag ending in `_unambiguous_product_restrictions`, assert that index is found (it is not yet, which is part of the RED), migrate, insert a workspace, a user and the four row shapes into each table with direct SQL (workspace_api_keys needs name, key_prefix, a unique key_hash and scopes; webhook_subscriptions needs url, secret and events), record updated_at, run the full migrate through runMigrateCli, assert, then re-run the SQL file split on the statement breakpoint and assert nothing moved. Run the three files, record the RED output verbatim, and commit as `test(quick-261108-unx): RED empty productRestrictions rejected, one read rule, migration to NULL`. Step B, migration: run `bun run build:packages` then `bun run --filter @userhq/db db:generate -- --custom --name unambiguous_product_restrictions`, which must create 0024_unambiguous_product_restrictions.sql, its journal entry and 0024_snapshot.json. Replace the empty SQL body with two UPDATE statements separated by the drizzle statement breakpoint marker, one per table, each setting product_restrictions to NULL where it equals the jsonb empty array, with a short comment that the empty list already behaved as unrestricted in tenant.guard.ts and outbox.ts so this only makes the stored value say what it did, and do not touch updated_at. Run `bun run --filter @userhq/db db:check` and the migrate test to GREEN, confirm `bun run --filter @userhq/db db:generate` then reports no schema changes, and commit as `fix(quick-261108-unx): convert stored empty productRestrictions to NULL`. This commit is safe to ship alone because both read paths treat NULL exactly as they treated the empty list. Step C, contract and read paths. In packages/types/src/api-keys.ts export productRestrictionsInputSchema: an array of uuid strings with min 1 and a message telling the caller to select at least one product or leave the restriction off, made nullable and optional, and use it in createApiKeySchema; import it into packages/types/src/webhooks.ts for createWebhookSubscriptionSchema and updateWebhookSubscriptionSchema; leave the response schemas permissive. In apps/api/src/api-keys/authorization.ts add isProductAllowed, a pure function: a null or undefined restriction allows every product; any other value allows a product only when it is an array that includes that product id and the product id is present, so an empty or malformed value allows none. Add resolveProductRestrictions in the same file, taking the Db, the workspace id and the input: it returns null for null or undefined, otherwise dedupes the ids, selects the matching ids from products filtered by that workspace id and a null deleted_at, and throws ApiException validation_failed with status 400 and one message about unknown products when the counts differ, so a foreign, deleted or unknown id is indistinguishable. Call it from ApiKeyService.createKey and from WebhookService.createSubscription and, only when the input field is present, updateSubscription, storing its result. Replace the inline emptiness test in tenant.guard.ts with a call to isProductAllowed for API key requests (keep the product_restricted error, status and message) and replace the one in outbox.ts with the same call, keeping the existing guard that applies it only when the event carries a product id. Do not change the web managers' display, the response schemas, or any other behaviour. Run `bun run build:packages`, then to GREEN the three test files plus the regression files listed in the acceptance criteria, and commit as `fix(quick-261108-unx): reject empty productRestrictions, verify workspace products, decide access in one place`.</action>
  <acceptance_criteria>
    - RED output captured: the empty-list and foreign-id requests succeed, the forced-[] key reaches the product route and the forced-[] subscription receives its delivery (this is the recorded proof of current behaviour), and the migration test fails on the missing journal entry; all new tests pass afterwards.
    - `ls packages/db/migrations | grep -c '^0024_'` prints 1, `git status --short packages/db/migrations` shows only the 0024 sql, its snapshot and the journal, `bun run --filter @userhq/db db:check` exits 0, and `bun run --filter @userhq/db db:generate` reports no schema changes.
    - `grep -v '^\s*//' apps/api/src/tenancy/tenant.guard.ts | grep -c 'productRestrictions.length'` prints 0 and the same command on apps/api/src/webhooks/outbox.ts prints 0; `grep -c 'isProductAllowed' apps/api/src/tenancy/tenant.guard.ts apps/api/src/webhooks/outbox.ts` shows at least 2 per file (import and call).
    - `grep -c 'productRestrictionsInputSchema' packages/types/src/api-keys.ts packages/types/src/webhooks.ts` shows at least 2 in api-keys.ts (definition and use) and at least 3 in webhooks.ts (import and two uses).
    - The migration SQL contains exactly two UPDATE statements and assigns no updated_at: `grep -c '^UPDATE' packages/db/migrations/0024_unambiguous_product_restrictions.sql` prints 2 and `grep -v '^--' packages/db/migrations/0024_unambiguous_product_restrictions.sql | grep -ci 'updated_at'` prints 0 (comment lines excluded).
    - Existing suites still pass: test/api-keys.test.ts, test/webhooks.test.ts, test/webhook-events.test.ts, test/webhook-event-modules.test.ts, test/webhook-secrets.test.ts, test/webhook-worker.test.ts, test/automation-config-routes.test.ts, test/cross-tenant.test.ts, and the packages/db migrate tests.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/db test && bun run --filter @userhq/db db:check && bun run --filter @userhq/api test test/api-keys.test.ts test/webhooks.test.ts test/webhook-events.test.ts test/webhook-event-modules.test.ts test/webhook-secrets.test.ts test/webhook-worker.test.ts test/automation-config-routes.test.ts test/cross-tenant.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck && bun run --filter @userhq/web typecheck</automated>
    <fails_when>An empty restriction list is accepted on key create, webhook create or webhook update; an id from another workspace, a deleted product or an unknown product is accepted; TenantGuard and the webhook filter can disagree about the same stored value; the migration touches any row other than an empty list, changes updated_at, or drizzle-kit reports drift or the 0024 files are hand-made; or any listed suite or typecheck fails.</fails_when>
  </verify>
  <done>An empty list is no longer a valid or reachable restriction, workspace membership of the ids is verified on every write, both read paths share one fail-closed rule, and existing empty rows were normalised by a generated, tested, behaviour-preserving migration; RED and GREEN evidence recorded.</done>
</task>

<task type="auto">
  <name>3. Web audit, documentation and final gate</name>
  <files>docs/automation-api.md</files>
  <precondition>Tasks 1 and 2 are committed and Postgres is reachable at the test default.</precondition>
  <read_first>
    - apps/web/components/api-keys/create-api-key-dialog.tsx lines 113-190 (restrictProducts, selectedProductIds, the empty-selection guard and the payload expression)
    - apps/web/components/webhooks/create-webhook-dialog.tsx lines 61 and 135-150 (selectedProductId and the payload expression)
    - apps/web/components/webhooks/webhooks-manager.tsx lines 70-85 (the PATCH body) and apps/web/components/api-keys/api-keys-manager.tsx lines 160-170
    - docs/automation-api.md sections 3 (Product restrictions), 6 (Errors) and 9 (Webhooks, Subscriptions and the signing secret)
    - apps/api/test/automation-routes.test.ts lines 1-30 and the docs-parsing helpers (which cells and headings the sync test reads, so prose edits cannot break it)
  </read_first>
  <action>Per D-05 and D-11. First the web audit, expected to need no code change: confirm from the files above that the API key dialog sends null when product restriction is off and a non-empty selection otherwise (an empty selection is stopped by its own error before any request), that the webhook dialog sends null or a one-element list, that webhooks-manager only PATCHes isActive, and that no other file under apps/web builds a productRestrictions value for a request (search the web app, excluding tests). Record the exact lines audited in the SUMMARY. If the audit finds a path that can send an empty list, fix that path so it refuses to submit with an error and does not widen the restriction to unrestricted, and add a web test for it in the style of apps/web/test/api-keys.test.tsx. Then update docs/automation-api.md without touching the Scopes table, the Endpoints table or the rate-limit sentence. In section 3 add the contract: productRestrictions is optional on key creation; omitted or null means the key reaches every live product in its workspace; otherwise it is a non-empty list of product ids that must all be live products of the same workspace; an empty list is rejected with 400 validation_failed because it is neither "all" nor "none"; an unknown, foreign or deleted product id is rejected the same way; duplicates are stored once; and keys created before this rule with an empty list were unrestricted and are now stored as unrestricted. In section 6 add a 400 validation_failed row to the error table covering an invalid body, including an empty productRestrictions list and a product id outside the workspace. In section 9 extend the productRestrictions bullet so it states the same rule for POST and PATCH of a subscription, that PATCH with null removes the restriction and PATCH with an empty list is rejected, and that a restricted subscription receives only events of the listed products. Do not document push in the automation reference: push registration is a session-only browser route. Finally run the whole gate. Run `bun run build:packages`, the listed API files with --no-file-parallelism, the web and types test suites, and then `bun run ci:check` at its default parallelism with a long timeout or in the background. If generated Next or vinext caches conflict, report it and clear only generated artifacts, never sources, as 261106-f9k did. Confirm `git status --short` shows only the files this plan lists, that no migration other than 0024 changed, and that STATE.md and ROADMAP.md are untouched. Commit as `docs(quick-261108-unx): document the productRestrictions contract` and write 261108-unx-SUMMARY.md recording commits, RED and GREEN evidence for both tasks, the audited web lines, the read-path facts (an empty list was unrestricted in tenant.guard.ts and outbox.ts, the managers displayed it as All products, and no write path verified workspace membership), the ci:check result, and the items intentionally not changed.</action>
  <acceptance_criteria>
    - `grep -rIn 'productRestrictions: \[\]' apps/web --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=test` prints nothing, and the SUMMARY lists the audited expressions with file and line.
    - `grep -c 'validation_failed' docs/automation-api.md` is at least 3 and the Product restrictions section mentions the empty list, workspace products and the earlier-stored empty lists.
    - The docs commit, whose sha the SUMMARY records, touches docs/automation-api.md only (inspect with `git show --stat <docs-sha>`), plus the SUMMARY if committed with it; if the audit required a web fix, the changed web component and its test are also listed and explained in the SUMMARY.
    - test/automation-routes.test.ts (docs-sync) passes without edits to the test.
    - `bun run ci:check` exits 0 at default parallelism.
    - SUMMARY states: no push, no deploy, the DB CHECK constraint on the column was deliberately not added (it would need a second migration ordered after the data fix and a schema change; the application rule plus the normalising migration cover every writer today), and the web managers' All products display of a hand-forced empty list is unchanged because that state is unreachable after the migration and write validation.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/automation-routes.test.ts test/api-keys.test.ts test/webhooks.test.ts test/push.test.ts test/cross-tenant.test.ts --no-file-parallelism && bun run --filter @userhq/types test && bun run --filter @userhq/web test && bun run ci:check</automated>
    <fails_when>The docs describe a restriction rule the API does not enforce or omit that an empty list is rejected; the docs-sync suite fails; a web path can send an empty restriction list; unrelated files, STATE.md or ROADMAP.md changed; or ci:check exits non-zero.</fails_when>
  </verify>
  <done>The documented contract matches the enforced one for keys and webhooks, the web app is shown not to send the rejected form, and the full repository passes ci:check; evidence recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Admin or integration input to restriction storage | A restriction list decides which products a long-lived credential or webhook can reach |
| API key to product routes (TenantGuard) | The stored restriction is the only product isolation for keys |
| Event to webhook subscription (outbox filter) | The stored restriction decides which products' events leave the system |
| Browser to push registration | A caller-supplied endpoint URL becomes a delivery target for a stored user |
| Push subscription row to queued deliveries | A delivery is sent to whatever endpoint its subscription row holds |

## STRIDE Threat Register

Threat IDs are unique within this quick task; it numbers its own.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-UNX-01 | Elevation of privilege | An empty restriction list meaning "all products" on keys and webhooks, so a cleared or mistaken list widens access | high | mitigate | Input schema rejects the empty list (400 validation_failed) on create and update; read rule is fail-closed for an empty or malformed stored value; both enforced by tests (D-05) |
| T-UNX-02 | Elevation of privilege | Restriction ids from another workspace, deleted or unknown products accepted and stored | medium | mitigate | resolveProductRestrictions selects ids from products scoped by workspace id and not deleted, one indistinguishable error (D-11) |
| T-UNX-03 | Tampering | Existing rows holding an empty list, and two read paths deciding differently | medium | mitigate | Generated custom migration converts only '[]' to NULL because current behaviour was unrestricted on both paths; one isProductAllowed function shared by TenantGuard and the outbox; upgrade test plus forced-[] tests |
| T-UNX-04 | Tampering, Denial of service | A user re-registering another user's push endpoint, silencing the owner and redirecting that browser's notifications to attacker-chosen content | high | mitigate | 409 unless the presenter holds both stored keys; the guarded upsert cannot change user_id; unregister stays owner-scoped (D-11) |
| T-UNX-05 | Information disclosure | Queued deliveries of a previous owner reaching the next owner of an endpoint | high | mitigate | Hand-over deletes the old row so queued deliveries cascade away; no in-place user_id change |
| T-UNX-06 | Information disclosure | The 409 confirming that an endpoint is registered | low | accept | The caller must already hold the endpoint URL; the response names no owner and the endpoint is a capability URL |
| T-UNX-07 | Spoofing | Guessing the stored auth secret to win a hand-over | low | accept | auth is a 128-bit browser-generated secret and the match is required together with p256dh; SQL equality over the network is not a practical oracle at that entropy |
| T-UNX-08 | Denial of service | Race between two registrations of one endpoint | low | mitigate | Unique index on endpoint plus the guarded upsert in one transaction; concurrent test expects exactly one winner |
| T-UNX-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency installs; uses installed drizzle-orm, drizzle-kit, zod and pg, so no legitimacy audit applies |
</threat_model>

<source_audit>
| Source | ID | Item | Task | Status |
| --- | --- | --- | --- | --- |
| GOAL | Review observations | Unambiguous productRestrictions and push endpoint takeover fix | 1, 2, 3 | COVERED |
| REQ | D-05 | Explicit, unambiguous permissions for keys and webhooks | 2, 3 | COVERED |
| REQ | D-11 | Tenant and user isolation: workspace-scoped ids, no cross-user endpoint takeover | 1, 2 | COVERED |
| CONTEXT | Arg 1a | Reject [] with 400 validation_failed on create and update for keys and webhooks | 2 | COVERED (keys have no update route; webhook PATCH covered) |
| CONTEXT | Arg 1b | null or omitted unrestricted; non-empty ids must belong to the workspace | 2 | COVERED (membership was not verified before; now it is) |
| CONTEXT | Arg 1c | No UI path sends [] (normalise to null) | 3 | COVERED by audit; both dialogs already send null or a non-empty list, so no code change; the empty-selection error is kept rather than converted to null because converting would silently widen a key |
| CONTEXT | Arg 1d | Existing [] rows safe; custom migration to NULL only if behaviour-preserving, upgrade test | 2 | COVERED (behaviour read from code and recorded by the RED run; drizzle-kit generate --custom; migrate.test.ts) |
| CONTEXT | Arg 1e | docs/automation-api.md updated, docs-sync green | 3 | COVERED |
| CONTEXT | Arg 1f | Read paths never treat [] inconsistently | 2 | COVERED (one shared function, fail-closed) |
| CONTEXT | Arg 2 | 409 for other user's endpoint; matching p256dh and auth replaces the old owner's row; only same user refreshes keys; delete owner-scoped; tests for cross-user, refresh, account switch, mismatched keys; URL guard and existing push tests green | 1 | COVERED |
| CONTEXT | Gates | Explicit-file API tests with --no-file-parallelism, drizzle-kit only, atomic commits, no push, ci:check at default parallelism | 1, 2, 3 | COVERED |
| RESEARCH | None for a quick task | | | n/a |

Not in this plan, each outside the two requested observations: a database CHECK constraint on product_restrictions (would need a second, ordered migration); user-facing 409 copy in the web push toggle; showing a hand-forced empty list as "No products" in the web managers; rate limiting push registration; changing how workspace-level webhook events without a product are filtered. Deferred ideas: none recorded for this scope.
</source_audit>

<verification>
Observe RED, then GREEN, for each behavior group (push, restrictions and read rule, migration). Finish with `bun run build:packages` and `bun run ci:check` exiting 0 at default parallelism. Review the final diff on two axes: standards (CLAUDE.md constraints: tenant scoping on every query, generated and committed migrations only with no db push, no new dependencies, public responses unchanged, the web app importing no server-only package) and spec (D-05, D-11 and the two observations). Confirm `git status --short packages/db/migrations` shows only the generated 0024 files, `git diff --stat ffec020..HEAD -- .planning/STATE.md .planning/ROADMAP.md` prints nothing, and no commit was pushed. Record commits, RED and GREEN evidence, the audited web lines, the ci:check result and the intentionally unchanged items in 261108-unx-SUMMARY.md, with status complete only when every must-have truth is proven. The parent orchestrator owns STATE.md.
</verification>

<success_criteria>
A push endpoint can no longer be taken over by another account, and the only hand-over path requires the stored keys and discards the previous owner's queue. An empty productRestrictions list can no longer be written for keys or webhooks, ids are verified against the workspace, every stored empty list was normalised by a generated and tested migration without changing who has access, and both read paths decide through one fail-closed function. The docs state the enforced contract and ci:check exits 0.
</success_criteria>

## Artifacts this plan produces

| Path | Kind | Symbols / contents |
|------|------|--------------------|
| apps/api/src/push/push.service.ts | modified | registerSubscription as a transaction: possession-proven delete, guarded upsert, 409 on refusal |
| packages/types/src/index.ts | modified | `push_endpoint_conflict` in API_ERROR_CODES |
| packages/types/src/api-keys.ts, webhooks.ts | modified | `productRestrictionsInputSchema` used by create key, create webhook and update webhook |
| apps/api/src/api-keys/authorization.ts | modified | `isProductAllowed`, `resolveProductRestrictions` |
| apps/api/src/api-keys/api-key.service.ts, webhooks/webhook.service.ts | modified | write paths call resolveProductRestrictions |
| apps/api/src/tenancy/tenant.guard.ts, webhooks/outbox.ts | modified | read paths call isProductAllowed |
| packages/db/migrations/0024_unambiguous_product_restrictions.sql, meta/ | created | two data-only UPDATE statements, journal entry, snapshot |
| packages/db/test/migrate.test.ts, apps/api/test/push.test.ts, api-keys.test.ts, webhooks.test.ts | modified | RED-first coverage for push ownership, restriction input, read rule and migration |
| docs/automation-api.md | modified | restriction contract for keys and webhooks, 400 validation_failed row |

<output>
Create `.planning/quick/261108-unx-unambiguous-productrestrictions-and-push/261108-unx-SUMMARY.md` when done
</output>
