---
phase: quick-261107-flq
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-05, D-11]
files_modified:
  - packages/db/src/schema/feedback.ts
  - packages/db/migrations/0020_post_activity_api_key.sql
  - packages/db/migrations/meta/_journal.json
  - packages/db/migrations/meta/0020_snapshot.json
  - packages/types/src/api-keys.ts
  - packages/types/src/feedback.ts
  - apps/api/src/auth/principal.ts
  - apps/api/src/auth/guards.ts
  - apps/api/src/app.module.ts
  - apps/api/src/api-keys/api-key-rate-limit.guard.ts
  - apps/api/src/feedback/moderation.service.ts
  - apps/api/src/feedback/posts.service.ts
  - apps/api/src/feedback/comments.service.ts
  - apps/api/src/feedback/workspace-feedback.service.ts
  - apps/api/src/roadmap/roadmap.service.ts
  - apps/api/test/api-key-attribution.test.ts
  - apps/api/test/api-keys.test.ts
  - apps/api/test/automation-routes.test.ts
  - apps/api/test/support/routes.ts
  - docs/automation-api.md
estimate:
  tokens: 120000
  raw_tokens: 120000
  tasks: 4
  confidence: low
must_haves:
  truths:
    - A key holding every scope (the full API_KEY_SCOPES array, and separately an admin-only key) gets 403 api_key_route_forbidden when it lists, creates or revokes API keys. No key is minted, the victim key is not revoked and still authenticates, and no response carries a key hash or token. This is already enforced by 261106-f9k; this plan adds the missing full-scope coverage and proves the test is not vacuous.
    - A status change made through a key writes the key id onto its post_activity row (new nullable api_key_id column, FK to workspace_api_keys, set null on delete, generated migration only). The same holds for roadmap-driven status cascades. A status change by a signed-in human records null.
    - A `source` field is exposed in the relevant DTOs. Public-shaped DTOs (post detail, comment, activity entry) carry only {kind "integration", name}. Admin-shaped DTOs (admin board row, workspace request item, workspace comment item) add apiKeyId. Human-made content has null. The author stays the integration actor and is never the key's creator or a customer. No response or DTO ever contains a key hash or token, and the anonymous portal never contains a key id.
    - Every request authenticated by a key counts against a per-key-id limit built on the existing @nestjs/throttler storage. The request after the limit returns 429 rate_limited with an integer Retry-After header. Another key and a signed-in human using the same route are unaffected.
    - docs/automation-api.md documents every scoped route (method, path, scope), the scopes, product restrictions, pagination and export, the error format, attribution and rate limits. A test fails if the docs table, the @RequireScopes decorators, API_KEY_SCOPES or the rate-limit constant disagree, and fails if a :ws route is neither scoped nor deliberately pinned as session-only.
    - bun run ci:check exits 0. The migration comes from drizzle-kit generate only, db:check passes, and no device_info statement is in the new migration.
  artifacts:
    - packages/db/migrations/0020_post_activity_api_key.sql
    - apps/api/src/api-keys/api-key-rate-limit.guard.ts
    - apps/api/test/api-key-attribution.test.ts
    - apps/api/test/automation-routes.test.ts
    - docs/automation-api.md
  key_links:
    - Integration identity is already one persisted actor per key (user id "integration:{keyId}", name "{key name} (integration)"), created by ApiKeyService.integrationActor. The new api_key_id column makes the same fact queryable on audit rows; it does not replace the actor.
    - ApiKeyPrincipal gains keyName, set in SessionGuard from the validated key, so write paths can return source without a join. Read paths join workspace_api_keys on the existing posts.created_by_api_key_id and comments.created_by_api_key_id columns and on the new post_activity.api_key_id.
    - The rate-limit guard is registered as a third APP_GUARD after SessionGuard, because req.apiKey is only set once SessionGuard has validated the key and its scope. It reads and writes the same ThrottlerStorage instance the route-level UserThrottlerGuard uses.
    - The docs table is machine-read by automation-routes.test.ts, so docs/automation-api.md endpoint rows and scope rows have a fixed cell format (see Task 4).
---

<objective>
Close the remaining API-key and automation review items from slices 5-6: prove that API keys cannot manage API keys (D-05, D-11), record and expose which integration made a change (D-05, stories 22 and 23), rate limit key traffic per key, and publish the automation documentation with tests that keep code, types and docs in agreement.

Purpose: an API key is a long-lived credential held by third-party systems. It must not be able to mint more credentials, its changes must be traceable to the key without impersonating anyone, one runaway integration must not starve the API, and the documented contract must be the enforced one.
Output: migration 0020, `source` in the listed DTOs, a per-key rate-limit guard, `docs/automation-api.md`, and RED-first tests at the HTTP and route-inventory boundaries, plus a green ci:check.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.claude/CLAUDE.md
@.planning/STATE.md
@.planning/quick/261106-f9k-harden-api-key-auth-deny-by-default-key-/261106-f9k-SUMMARY.md
@docs/specs/workspace-platform-expansion.md
@apps/api/src/auth/guards.ts
@apps/api/src/auth/principal.ts
@apps/api/src/api-keys/api-key.service.ts
@apps/api/src/app.module.ts
@packages/types/src/api-keys.ts
@packages/db/src/schema/feedback.ts

Ground rules from the orchestrator. Run API tests as `bun run --filter @userhq/api test <explicit files> --no-file-parallelism`; never `bun test`. Postgres is running (colima up, `bun run dev:services`). `@userhq/types` and `@userhq/db` are consumed from `dist`, so run `bun run build:packages` after editing anything under `packages/db/src` or `packages/types/src` before API typecheck or tests. No new dependencies. Migrations come only from `bun run --filter @userhq/db db:generate`, never `drizzle-kit push`. Do not edit STATE.md or ROADMAP.md. Do not push or deploy. Commit each task atomically with the quick id `quick-261107-flq`, with a `test(...)` RED commit before each `feat(...)` or `fix(...)` GREEN commit. Other agents may be working in this directory: preserve unrelated changes. Do not read or print `.env.docker` or `env.local.dev`.

Discovery: Level 0. Every fix follows a pattern already in the repo: the global guards in `apps/api/src/auth/guards.ts`, the ThrottlerStorage already registered by `ThrottlerModule.forRoot` in `app.module.ts`, the nullable FK attribution columns `created_by_api_key_id` on posts and comments, and the router-discovery loop in `apps/api/test/cross-tenant.test.ts`.

Review items already fixed by 261106-f9k, found by reading the code, and therefore not redone:
- Item 1 enforcement. `SessionGuard` rejects any key request to a handler with no `@RequireScopes` with 403 api_key_route_forbidden, even for an admin key and even with a human cookie. `ApiKeysController` has no scope decorator, so list, create and revoke are session-only today. `api-keys.test.ts` already asserts this for the scope sets `["requests:read"]` and `["admin"]`, and `cross-tenant.test.ts` already lists all three api-keys routes in `CROSS_TENANT_ROUTES` (the discovery-equality test keeps the matrix complete). Remaining gap: no test uses a key carrying every scope or proves nothing changed server-side. Task 3 adds that coverage and no production change for it.
- Posts and comments made through a key already store `created_by_api_key_id` (set by PostsService.createPost, CommentsService.createComment, and the reply path), and the export already returns `createdByApiKeyId` on posts and comments. The author is already the persisted integration actor, not the key creator, and key-made posts add no vote. All unchanged.
- Product restrictions, Better Auth middleware key rejection and case-insensitive Bearer parsing are unchanged.

Facts that shape the work:
- `post_activity` (packages/db/src/schema/feedback.ts) has only `actor_id`; it has no key column. It is written in two places: `ModerationService.changeStatus` and `RoadmapService.followItemStatus` (called from four places with `adminUser.id`). The second is how a key-driven roadmap move produces activity.
- Public and admin endpoints share DTO schemas: `PublicPostDetailSchema`, `PublicCommentSchema` and `ActivityEntrySchema` are served by the anonymous portal and by `AdminPostDetail`. Anything added to them is public. The admin-only schemas are `AdminPostRowSchema`, `WorkspaceRequestItemSchema` and `WorkspaceCommentItemSchema`. This is why the source shape is split in two.
- Serializer schemas strip unknown keys (`StandardSchemaSerializerInterceptor`), so a field that is not in the Zod schema never reaches the client. That is the existing guard against leaking a key hash; the new tests assert it rather than rely on it.
- ThrottlerGuard names its headers by throttler name, so a named throttler would emit `Retry-After-api-key`, not `Retry-After`. The rate-limit guard therefore calls the shared storage directly. With blockDuration 0 the storage uses a sliding window, allows exactly `limit` hits per window, does not count blocked attempts, and reports in `timeToBlockExpire` the seconds until the oldest counted hit leaves the window, which is the correct Retry-After.
- Throttler storage is in memory, per API process. Production deploys one API replica (compose.yaml), so the limit is exact there; the guard carries a comment naming this ceiling and the shared-store upgrade.
- Story 20 lists FAQ and product-setting operations as automation targets. Those controllers have no `@RequireScopes`, so keys are denied on them today. That is a scope gap outside the four items in this task; Task 4 documents the actual surface and records the gap in the SUMMARY rather than hiding it.
- Two `@RequireScopes` evaluators disagree in form (SessionGuard requires every listed scope, TenantGuard requires some). Every route declares exactly one scope, so they agree; Task 4 pins "exactly one scope per route" so they cannot diverge unnoticed.

Test isolation note: new describe blocks seed their own workspace, product, statuses (inserted directly, one default plus one more, no categories), users and keys in `beforeAll`, following the fixture shape of `apps/api/test/export.test.ts`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>1. Tracer: a status change through a key is recorded on post_activity and returned as source, end to end</name>
  <files>packages/db/src/schema/feedback.ts, packages/db/migrations/0020_post_activity_api_key.sql, packages/db/migrations/meta, packages/types/src/api-keys.ts, packages/types/src/feedback.ts, apps/api/src/auth/principal.ts, apps/api/src/auth/guards.ts, apps/api/src/feedback/moderation.service.ts, apps/api/test/api-key-attribution.test.ts</files>
  <precondition>Postgres is reachable at the test default (userhq@127.0.0.1:5432) so createTestApp can create temporary databases.</precondition>
  <read_first>
    - apps/api/src/feedback/moderation.service.ts lines 62-250 (changeStatus: the post_activity insert and the returned activity object)
    - apps/api/src/auth/principal.ts and apps/api/src/auth/guards.ts lines 108-131 (principal construction)
    - apps/api/src/api-keys/api-key.service.ts (integrationActor, ValidatedApiKey, hashToken)
    - packages/db/src/schema/feedback.ts (postActivity table and its workspaceApiKeys import)
    - packages/types/src/feedback.ts lines 323-338 (ActivityEntrySchema, StatusChangeResultSchema)
    - apps/api/test/export.test.ts lines 1-130 and 334-372 (fixture shape and an existing key-driven moderation flow)
    - docs/specs/workspace-platform-expansion.md D-05, stories 22 and 23
  </read_first>
  <behavior>
    - PUT /workspaces/:ws/products/:product/posts/:number/status with a requests:write key returns 200 and `activity.source` equal to `{kind: "integration", name: "<key name>"}`. `activity.actor.name` is still "<key name> (integration)". The response has no apiKeyId.
    - The inserted post_activity row has `api_key_id` equal to the key id and `actor_id` equal to `integration:<keyId>`.
    - The same change made by the signed-in human admin returns `activity.source` null and stores a null api_key_id.
    - Re-sending the same status is a no-op: `activity` null and no new row.
    - JSON.stringify of every response in the test contains neither the key token nor its sha256 hash (compute the hash with ApiKeyService.hashToken).
    - Migration shape: exactly one added nullable uuid column on post_activity and its FK to workspace_api_keys with on delete set null; no device_info statement.
  </behavior>
  <action>Per D-05 (integration attribution) and stories 22 and 23, write the failing test first and record RED, then implement the thinnest full-stack path. In a new apps/api/test/api-key-attribution.test.ts seed a workspace with an owner session, one product, two directly inserted statuses (one default), a requests:write key named "Attribution Key", and a human-created post (no categories exist, so no categoryId). Cover the behavior list above; read the current post version through the key's GET on the post before the PUT. For the DB assertion select from post_activity through the schema import so the RED is a real failure, then commit the test as `test(quick-261107-flq): RED key status change recorded and exposed as source`. Then implement. In packages/types/src/api-keys.ts add two exported Zod schemas and their types: IntegrationSourceSchema (kind literal "integration", name string) and AdminIntegrationSourceSchema, which extends it with a uuid apiKeyId. In packages/types/src/feedback.ts import IntegrationSourceSchema and add `source: IntegrationSourceSchema.nullable().optional()` to ActivityEntrySchema, following the nullable-optional pattern already used for deviceInfo so web fixtures keep compiling. In packages/db/src/schema/feedback.ts add `apiKeyId: uuid("api_key_id").references(() => workspaceApiKeys.id, { onDelete: "set null" })` to postActivity; add no index. In apps/api/src/auth/principal.ts add `keyName: string` to ApiKeyPrincipal, and add two small exported helpers next to Actor: one returning `actor.apiPrincipal?.keyId ?? null`, and one returning `{kind: "integration", name}` when the actor has a principal and null otherwise. In guards.ts set `keyName: result.key.name` where the principal object is built. In ModerationService.changeStatus pass the api-key id helper into the post_activity insert as apiKeyId, and set `source` on the returned activity from the source helper; the actor argument already carries apiPrincipal for key requests. Generate the migration with `bun run build:packages` then `bun run --filter @userhq/db db:generate -- --name post_activity_api_key`. Open the new SQL: if it contains any device_info statements from a stale snapshot, delete those lines, then re-run db:generate until it reports no schema changes, and finish with `bun run --filter @userhq/db db:check`. Rebuild packages, run the new suite to GREEN, and commit the schema, migration, types, principal and service change as `feat(quick-261107-flq): record api key on post_activity and expose source on status changes`. Do not add key ids to any public response and do not select the key hash or any token column anywhere.</action>
  <acceptance_criteria>
    - RED output captured before implementation (source undefined, and api_key_id absent); all new tests pass afterwards.
    - `ls packages/db/migrations | grep -c 0020_` prints 1 and `grep -c 'device_info' packages/db/migrations/0020_post_activity_api_key.sql` prints 0.
    - `bun run --filter @userhq/db db:generate` reports no schema changes after the commit, and `bun run --filter @userhq/db db:check` exits 0.
    - The test asserts the human case (null source, null api_key_id) and the no-op case (no row), not only the key case.
    - Existing moderation, roadmap and notifications suites still pass: test/posts.test.ts, test/statuses.test.ts, test/roadmap.test.ts and test/notifications.test.ts.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/api-key-attribution.test.ts test/posts.test.ts test/statuses.test.ts test/roadmap.test.ts test/notifications.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck && bun run --filter @userhq/db db:check</automated>
    <fails_when>The status change by a key leaves api_key_id null, returns no source, exposes apiKeyId or a token or hash in any response, the human case is attributed to a key, the migration drops or re-adds device_info, or any listed suite, the typecheck or db:check fails.</fails_when>
  </verify>
  <done>One key-made status change is traceable from the HTTP response down to a post_activity row keyed on the key id, on production-grade code, with the human case unchanged; RED and GREEN evidence recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>2. Expand attribution: roadmap cascades and `source` on posts, comments, activity timelines, board rows and the workspace inbox</name>
  <files>packages/types/src/feedback.ts, apps/api/src/roadmap/roadmap.service.ts, apps/api/src/feedback/posts.service.ts, apps/api/src/feedback/comments.service.ts, apps/api/src/feedback/moderation.service.ts, apps/api/src/feedback/workspace-feedback.service.ts, apps/api/test/api-key-attribution.test.ts</files>
  <precondition>Task 1 is committed and Postgres is reachable at the test default.</precondition>
  <read_first>
    - apps/api/src/roadmap/roadmap.service.ts lines 262-275, 395-410, 466-478, 555-566 and 672-710 (the four followItemStatus callers and the writer)
    - apps/api/src/feedback/posts.service.ts lines 540-660 (post detail query and author mapping) and 760-830 (timeline comment and activity queries)
    - apps/api/src/feedback/comments.service.ts lines 43-215 (createComment return), 216-315 (updateComment return) and 376-425 (shapeTimeline and its CommentRowWithAuthor row type)
    - apps/api/src/feedback/moderation.service.ts lines 251-346 (listAdminPosts select and mapper)
    - apps/api/src/feedback/workspace-feedback.service.ts lines 38-200 (listRequests), 205-360 (listComments) and 426-500 (replyToComment)
    - packages/types/src/feedback.ts (PublicPostDetailSchema, PublicCommentSchema, AdminPostRowSchema, WorkspaceRequestItemSchema, WorkspaceCommentItemSchema)
    - apps/api/test/portal.test.ts or test/portal-isolation.test.ts (how the anonymous portal post page is requested)
  </read_first>
  <behavior>
    - A roadmap item move or link through a roadmap:write key that changes the status of a linked post writes post_activity rows with that key id. The same move by the session admin writes null.
    - Post detail for a key-created post (session admin view and anonymous portal view) has `post.source` equal to `{kind: "integration", name}`. A human-created post has null. The author object is the integration actor, never the key's creator, and the key creator's name does not appear.
    - A key-created comment, and a key's reply to a human comment, show `comment.source` the same way in the post timeline and in the createComment and reply responses. Human comments show null.
    - The post timeline's activity entries show `activity.source` for key-made status changes (public and admin views) and null for human ones.
    - The anonymous portal response for a key-made post, comment and status change contains the key name but never the key id: JSON.stringify of the body does not contain the key uuid or the string apiKeyId.
    - Admin-shaped rows add apiKeyId: GET admin board rows, GET /workspaces/:ws/requests items and GET /workspaces/:ws/comments items (and the reply response item) show `source` equal to `{kind: "integration", name, apiKeyId}` for key-made content and null for human content.
    - No response anywhere in the file contains the key token or hash.
  </behavior>
  <action>Per D-05 and story 23, extend api-key-attribution.test.ts first with the cases above (a key-created post, a key-created comment, a key reply to a human comment, a key status change, a roadmap item created and moved through a roadmap:write key with one linked post, and the human equivalents), record RED, and commit as `test(quick-261107-flq): RED integration source across posts, comments, activity, board and inbox`. Then implement. In packages/types/src/feedback.ts add `source: IntegrationSourceSchema.nullable().optional()` to PublicPostDetailSchema and PublicCommentSchema, and `source: AdminIntegrationSourceSchema.nullable().optional()` to AdminPostRowSchema, WorkspaceRequestItemSchema and WorkspaceCommentItemSchema. In RoadmapService.followItemStatus replace the actorId string parameter with the acting user object, update the four callers to pass adminUser, and write the api-key id helper's value into the post_activity insert as apiKeyId; leave the notification fan-out arguments on the user id as they are. For read paths, left join workspace_api_keys on the existing created_by_api_key_id columns (posts, comments) and on post_activity.api_key_id, select only the key's id and name, and build source with a small shared formatter placed beside the Task 1 helpers: it returns null for a null id and the public or admin shape otherwise. Apply it in PostsService post detail and its timeline comment and activity queries, in CommentsService.shapeTimeline (add the key name column to CommentRowWithAuthor), in ModerationService.listAdminPosts, and in WorkspaceFeedbackService listRequests and listComments. For the write responses that already hold the actor, derive source from the actor's apiPrincipal without a join: CommentsService.createComment (public shape), WorkspaceFeedbackService.replyToComment (admin shape) and updateComment when the editor is a key. Keep the author object exactly as built today; do not alter isAdmin, name or image logic. Never select keyHash or any token column in these joins. Run the suite to GREEN. If context runs short, commit the public-DTO half (types, posts, comments, activity) and the admin-DTO half (board rows, requests, comments inbox, roadmap) as two feat commits, each with its tests passing. Commit as `feat(quick-261107-flq): expose integration source on feedback DTOs`.</action>
  <acceptance_criteria>
    - RED output captured before implementation; all new tests pass afterwards.
    - The anonymous portal assertions check the body text for the key uuid and for apiKeyId and find neither, in the same test that finds the key name.
    - `grep -c 'IntegrationSourceSchema' packages/types/src/feedback.ts` is at least 5 and `grep -c 'AdminIntegrationSourceSchema' packages/types/src/feedback.ts` is at least 3.
    - Each DTO in the behavior list has a test asserting both the key-made and the human case.
    - Existing suites still pass: test/export.test.ts, test/comments.test.ts, test/workspace-feedback.test.ts, test/portal.test.ts, test/portal-roadmap.test.ts, test/public-contract.test.ts, test/canary-roadmap-leak.test.ts and test/roadmap.test.ts.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/api-key-attribution.test.ts test/export.test.ts test/comments.test.ts test/workspace-feedback.test.ts test/portal.test.ts test/portal-roadmap.test.ts test/public-contract.test.ts test/canary-roadmap-leak.test.ts test/roadmap.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck && bun run --filter @userhq/web typecheck</automated>
    <fails_when>A key-made post, comment or status change shows no source in any listed DTO; a human-made item shows a source; the anonymous portal exposes a key id; the author becomes the key creator or a customer; a response carries a key hash or token; the public contract or roadmap-leak suites regress; or any listed suite or typecheck fails.</fails_when>
  </verify>
  <done>Every listed DTO identifies the integration that made the content or change, public surfaces show only its name, admin surfaces add the key id, and nothing impersonates a human or leaks a secret; RED and GREEN evidence recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>3. Key traffic policy: full-scope lockout coverage and a per-key rate limit with Retry-After</name>
  <files>packages/types/src/api-keys.ts, apps/api/src/api-keys/api-key-rate-limit.guard.ts, apps/api/src/app.module.ts, apps/api/test/api-keys.test.ts</files>
  <precondition>Postgres is reachable at the test default.</precondition>
  <read_first>
    - apps/api/src/app.module.ts (ThrottlerModule.forRoot and the APP_GUARD providers, in order)
    - apps/api/src/auth/guards.ts (SessionGuard sets req.apiKey only after scope validation)
    - apps/api/src/feedback/throttle.ts and one route using it (admin-posts.controller.ts createComment) for the existing per-route throttle
    - node_modules/.bun/@nestjs+throttler@6.7.1+15fe15006455a3d6/node_modules/@nestjs/throttler/dist/throttler.service.js (increment semantics with blockDuration 0)
    - apps/api/src/common/api-error.filter.ts (how a 429 is rendered and that headers set earlier survive)
    - apps/api/test/api-keys.test.ts lines 96-200 (existing session-only coverage and fixtures) and apps/api/test/comments.test.ts lines 370-415 (existing 429 assertions)
  </read_first>
  <behavior>
    - Lockout (characterization, expected to pass on first run because 261106-f9k already enforces it): for a key created with the whole API_KEY_SCOPES array and for an admin-only key, GET, POST and DELETE on the workspace api-keys routes all return 403 api_key_route_forbidden. After those calls the workspace's key count is unchanged, the victim key's revoked_at is still null, the victim token still authenticates a normal read, and no response body contains a key hash, the substring uhq_live_, or the word token.
    - Rate limit (RED first): a key making exactly `API_KEY_RATE_LIMIT.limit` successful reads inside the window gets 200 each time. The next request returns 429 with code rate_limited and a Retry-After header that is an integer between 1 and `API_KEY_RATE_LIMIT.windowSeconds`.
    - After key A is exhausted, a second key still gets 200 on the same route, and the signed-in human admin using a cookie on the same route still gets 200.
    - A request carrying an invalid token still returns 401 api_key_invalid and does not create a limiter bucket for any key.
  </behavior>
  <action>Per D-05 and D-11, write the tests first. In apps/api/test/api-keys.test.ts add the lockout test and the rate-limit tests using the file's existing fixtures. The rate-limit test creates its own key, sends the allowed number of `GET /workspaces/{ws}/requests?limit=1` calls sequentially and then one more. Run them and record RED: the lockout test passes immediately and the rate-limit test fails because the extra request returns 200. Prove the lockout test is not vacuous with a one-time mutation: temporarily add `@RequireScopes("admin")` to `ApiKeysController.listKeys`, confirm the new test fails on the list call, then restore the controller byte for byte and confirm `git diff apps/api/src/api-keys/api-keys.controller.ts` is empty. Commit the tests as `test(quick-261107-flq): full-scope key management lockout and per-key rate limit RED`. Then implement. In packages/types/src/api-keys.ts export `API_KEY_RATE_LIMIT` as a const object with `limit: 120` and `windowSeconds: 60`, the single source for the guard, the test and the docs. Create apps/api/src/api-keys/api-key-rate-limit.guard.ts: an injectable guard implementing CanActivate that receives the shared storage through `@InjectThrottlerStorage()` typed with `import type { ThrottlerStorage }`. When the request has no apiKey it returns true. Otherwise it calls `storage.increment` with the key `api-key:{req.apiKey.id}`, the window in milliseconds, the limit, a blockDuration of 0 and the throttler name "api-key". When the record is blocked it sets the `Retry-After` response header to the larger of 1 and `timeToBlockExpire`, as a string, and throws ApiException with code rate_limited and status 429 and a message that names the retry delay. Put a comment on the class stating the ceiling: storage is in memory per API process, which is exact with one replica, and a shared store is needed before running more than one. In apps/api/src/app.module.ts register `{ provide: APP_GUARD, useClass: ApiKeyRateLimitGuard }` directly after the SessionGuard entry; ordering matters because req.apiKey exists only after SessionGuard. Do not add a second named throttler to ThrottlerModule.forRoot and do not touch UserThrottlerGuard, so human routes and the existing per-route limits behave exactly as before. Run to GREEN and commit as `feat(quick-261107-flq): per-key rate limit with Retry-After`. Note the unauthenticated-token flood is not covered here: unknown tokens are rejected before a key exists, so there is nothing to key a bucket on, and tokens carry 192 bits of entropy.</action>
  <acceptance_criteria>
    - RED output captured for the rate-limit tests; the lockout test is recorded as passing at first run together with the mutation result (fails with the decorator present, passes after restore).
    - `grep -c 'API_KEY_RATE_LIMIT' apps/api/src/api-keys/api-key-rate-limit.guard.ts` is at least 1 and `grep -c 'ApiKeyRateLimitGuard' apps/api/src/app.module.ts` is at least 2 (import and provider).
    - `git diff --stat packages/db apps/api/src/feedback/throttle.ts` is empty for this task.
    - The 429 assertions check status, code, and the numeric Retry-After header, and the independence assertions cover another key and a cookie session.
    - Existing throttle suites still pass: test/comments.test.ts, test/votes.test.ts and test/uploads.test.ts.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/api-keys.test.ts test/cross-tenant.test.ts test/comments.test.ts test/votes.test.ts test/uploads.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck</automated>
    <fails_when>A key with every scope can list, create or revoke keys; the request after the limit succeeds or returns 429 without a numeric Retry-After; one key's exhaustion limits another key or a human session; a human route's limit changes; or any listed suite or the typecheck fails.</fails_when>
  </verify>
  <done>No key, whatever its scopes, can manage keys, proven non-vacuously; key traffic is limited per key id with a correct Retry-After; RED, mutation and GREEN evidence recorded.</done>
</task>

<task type="auto" tdd="true">
  <name>4. Automation API documentation with code, types and docs kept in sync by tests; final CI gate</name>
  <files>docs/automation-api.md, apps/api/test/support/routes.ts, apps/api/test/automation-routes.test.ts</files>
  <precondition>Tasks 1-3 are committed and Postgres is reachable at the test default.</precondition>
  <read_first>
    - docs/deploy.md (style: H1 title, intro paragraph, numbered H2 sections separated by horizontal rules, tables, IMPORTANT callouts)
    - apps/api/test/cross-tenant.test.ts lines 331-382 (the router discovery loop to mirror) and apps/api/test/public-contract.test.ts lines 1-50
    - packages/types/src/api-keys.ts (API_KEY_SCOPES, createApiKeySchema, API_KEY_RATE_LIMIT) and packages/types/src/index.ts (ApiErrorCode list)
    - packages/types/src/export.ts, packages/types/src/feedback.ts (WorkspaceRequestsQuerySchema, WorkspaceCommentsQuerySchema, AdminBoardQuerySchema, AdminPostPageSchema) and the changelog and webhook delivery list query schemas, for exact pagination parameters
    - The seven scoped controllers: apps/api/src/feedback/admin-posts.controller.ts, admin-comments.controller.ts, workspace-feedback.controller.ts, apps/api/src/roadmap/roadmap.controller.ts, changelog/changelog.controller.ts, webhooks/webhooks.controller.ts, export/export.controller.ts
    - apps/api/src/tenancy/tenant.guard.ts (product_restricted rules) and every `@Throttle` on a scoped handler
    - apps/web/components/api-keys/create-api-key-dialog.tsx (SCOPE_LABELS wording, one source for scope descriptions)
  </read_first>
  <behavior>
    Route inventory (automation-routes.test.ts, real app via createTestApp, router discovery through the new support helper):
    - Every route declaring scopes declares exactly one scope, and it is a member of API_KEY_SCOPES.
    - Every non-admin scope in API_KEY_SCOPES is used by at least one route (no dead scope), and the admin scope is documented as "all scopes".
    - Every /workspaces/:ws route is either scoped or classified session-only in an explicit list inside the test, pinned by controller class with individual handler exceptions (the personal comment read-state route is the known handler exception). A new unclassified route fails the test with a message saying to add a scope and document it, or pin it with a reason.
    - Deny by default, runtime sweep: for every discovered route with no scopes, anywhere in the app, an admin key gets 403 api_key_route_forbidden (path params filled with dummy values; the guard answers before any parameter handling).
    Docs sync (same file):
    - The docs Scopes table lists exactly API_KEY_SCOPES, no more and no fewer.
    - The docs Endpoints table equals the set of scoped routes by method, full path and scope, in both directions (a documented route that does not exist fails; an undocumented scoped route fails).
    - The docs state the rate limit using API_KEY_RATE_LIMIT's numbers.
  </behavior>
  <action>Per D-05, write the tests first, record RED (the docs file does not exist), and commit as `test(quick-261107-flq): RED automation route inventory and docs sync`. Create apps/api/test/support/routes.ts exporting one function that takes the Nest app and returns every controller route as verb, full path including the controller prefix and without the global api/v1 prefix, controller class name, handler name, scopes read from REQUIRE_SCOPES metadata on handler then class, and the public flag; mirror the PATH_METADATA, METHOD_METADATA and ModulesContainer loop in cross-tenant.test.ts, including controller path arrays, and do not refactor the existing tests to use it. Write automation-routes.test.ts with the behavior list; read docs/automation-api.md from the repo root with a URL relative to the test file, slice sections by their H2 headings, and parse only these fixed cell formats: scope rows are a table row whose first cell is a backticked scope name, and endpoint rows are a table row whose first three cells are a backticked HTTP method, a backticked full path beginning with /api/v1, and a backticked scope. For the session-only classification, run discovery once, print the unscoped :ws routes grouped by controller, review each group as intentionally session-only (workspace settings, members, invites, API keys, products, statuses, categories, FAQ, push follow, personal read state) and pin them; if a group looks like it should be automation under story 20, such as FAQ or product settings, do not pin it silently: pin it with a comment saying so and record it in the SUMMARY as a story-20 gap. Then write docs/automation-api.md in the style of docs/deploy.md with numbered sections: 1 Authentication (Bearer token with the uhq_live_ prefix and a sample using an obvious dummy value, case-insensitive scheme, no Origin header needed, keys are created and revoked only by signed-in workspace owners and admins, the token is shown once and stored hashed, expiry up to 3650 days, and the 401 codes api_key_invalid, api_key_expired, api_key_revoked), 2 Scopes (all twelve, one row each, wording consistent with SCOPE_LABELS, admin meaning every scope but never session-only routes), 3 Product restrictions (restricted keys reach only product-scoped routes of allowed products; workspace-wide routes such as requests, comments, export and webhooks return 403 product_restricted; restrictions are product ids while URLs use slugs), 4 Endpoints (one row per scoped route in the fixed cell format plus a short description; list every route the discovery prints, about forty-seven), 5 Pagination and export (for each list route, the exact limit, cursor and filter parameters and the response envelope read from the Zod query and response schemas, including the export's limit, cursor, since and productId and its nextCursor and hasMore), 6 Errors (the `{code, message}` body, the status-to-code mapping, and every key-related code from ApiErrorCode including rate_limited and not_found for foreign workspaces), 7 Attribution (changes by a key are made by an integration actor named "<key name> (integration)", never the key's creator or a customer; the source field and its two shapes; createdByApiKeyId in the export; that nothing returns a key hash or token), 8 Rate limits (the API_KEY_RATE_LIMIT numbers in the exact phrasing "{limit} requests per {windowSeconds} seconds per key", sliding window, 429 rate_limited with Retry-After in seconds, per API process, plus any lower per-route limits found on scoped handlers with their numbers, such as the comment create limit on the product comments route). Add a one-line pointer to the new page wherever the repo already links docs/deploy.md, if such a link exists. Run the new suite to GREEN, then the final gates: `bun run build:packages` and `bun run ci:check`, requiring exit 0. If generated Next or vinext caches conflict, report it and clear only generated artifacts, never sources, as 261106-f9k did. Commit docs and tests as `docs(quick-261107-flq): automation API reference with sync tests` and write 261107-flq-SUMMARY.md.</action>
  <acceptance_criteria>
    - RED output captured before the docs exist; all new tests pass afterwards.
    - `grep -c '^## ' docs/automation-api.md` is at least 8, and the page contains the headings Authentication, Scopes, Product restrictions, Endpoints, Pagination, Errors, Attribution and Rate limits.
    - The endpoint-table test fails when a row is deleted from the docs and when a route's scope decorator is changed (verify each once, then restore).
    - The deny-by-default sweep covers every unscoped route and its failure message names the route.
    - `bun run ci:check` exits 0.
    - SUMMARY records the story-20 gap (FAQ and product-setting routes have no scope), the in-memory limiter ceiling, and the items intentionally not changed.
  </acceptance_criteria>
  <verify>
    <automated>bun run build:packages && bun run --filter @userhq/api test test/automation-routes.test.ts test/api-keys.test.ts test/cross-tenant.test.ts test/api-key-attribution.test.ts --no-file-parallelism && bun run --filter @userhq/api typecheck && bun run ci:check</automated>
    <fails_when>The docs omit or invent a route, scope or limit relative to the code; a new :ws route can be added unscoped without the test failing; an unscoped route accepts a key; the docs claim a pagination parameter the schema lacks; or any listed suite, the typecheck or ci:check fails.</fails_when>
  </verify>
  <done>The documented automation surface is exactly the enforced one, drift in scopes, routes or limits fails a test, unscoped routes are provably closed to keys, and the full repository passes ci:check; evidence recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Integration to API (bearer key) | A long-lived credential held by third parties selects which routes, workspace and products it can reach |
| API key to key-management routes | A credential must not be able to create, enumerate or revoke credentials |
| Audit rows and DTOs to clients | Attribution data crosses to public (anonymous) and admin surfaces |
| API process to shared throttle storage | One key's traffic must not consume capacity of another key or a human |
| Docs to enforced contract | Published scopes and routes become what integrators and admins rely on |

## STRIDE Threat Register

Threat IDs are unique within a phase; this quick task numbers its own.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-FLQ-01 | Elevation of privilege | API-key routes reachable with a key of any scope, minting or revoking credentials | critical | mitigate | Deny-by-default in SessionGuard (already present); Task 3 full-scope and admin-key tests assert 403 and no server-side change, with a mutation check; Task 4 sweep covers every unscoped route; the three routes stay in the cross-tenant matrix (D-05, D-11) |
| T-FLQ-02 | Information disclosure | Key hash or token leaking through DTOs, joins or audit rows | critical | mitigate | Joins select only key id and name; serializer schemas strip unknown fields; Tasks 1-3 assert no token or hash substring in any response; public DTOs never carry the key id |
| T-FLQ-03 | Repudiation | Automated changes not traceable to a key | medium | mitigate | New post_activity.api_key_id column, roadmap cascades included, and `source` on the listed DTOs (D-05, stories 22 and 23) |
| T-FLQ-04 | Spoofing | Integration content passing as a customer or the key's creator | medium | mitigate | Author stays the persisted integration actor; tests pin that the creator and customers are never the author; `source` labels the origin explicitly (story 23) |
| T-FLQ-05 | Denial of service | A runaway or compromised key saturating the API | medium | mitigate | Per-key sliding-window limit with 429 and Retry-After, independent of other keys and human sessions (Task 3) |
| T-FLQ-06 | Elevation of privilege | New route added without a scope silently becoming automation, or docs claiming a scope the route does not enforce | high | mitigate | Exactly-one-scope rule, unscoped-route classification and docs-versus-code equality tests (Task 4) |
| T-FLQ-07 | Denial of service | Limiter state held in process memory, bypassed by a second API replica | low | accept | Single replica today; the guard carries a ceiling comment and the docs state the limit is per API process |
| T-FLQ-08 | Denial of service | Unauthenticated flood of invalid tokens | low | accept | Unknown tokens cannot be keyed to a bucket; 192-bit token entropy; a hashed index lookup is cheap |
| T-FLQ-09 | Spoofing | Admin-chosen key name rendered publicly as the source name | low | accept | Names are entered only by workspace owners and admins, bounded to 100 characters, and shown beside an explicit integration kind and the "(integration)" author suffix |
| T-FLQ-SC | Tampering | npm/pip/cargo installs | high | mitigate | No dependency installs; uses installed @nestjs/throttler, drizzle and zod, so no legitimacy audit applies |
</threat_model>

<source_audit>
| Source | ID | Item | Task | Status |
| --- | --- | --- | --- | --- |
| GOAL | Slice 5-6 review | API keys are safe to hold, attributable, bounded and documented | 1-4 | COVERED |
| REQ | D-05 | Explicit permissions, integration attribution, customer-attributed submissions identify their source | 1, 2, 3, 4 | COVERED |
| REQ | D-11 | Tenant isolation is a trust boundary | 3, 4 | COVERED |
| REQ | Story 22 | Integration audit attribution | 1, 2 | COVERED |
| REQ | Story 23 | Integration-submitted feedback retains its source | 2 | COVERED |
| REQ | Story 20 | Documented operations for requests, comments, status, roadmap, changelog; FAQ and product settings | 4 | PARTIAL: the first five are documented; FAQ and product-setting routes carry no scope today and are recorded as a gap in the SUMMARY |
| CONTEXT | Request 1 | Keys cannot create, list or revoke keys; full-scope test; cross-tenant matrix | 3 | COVERED (enforcement and matrix entries already present from 261106-f9k; coverage added) |
| CONTEXT | Request 2 | apiKeyId and key name on activity rows and key-made content; `source` in DTOs; no key hash or secret in output; migration via drizzle-kit generate | 1, 2 | COVERED |
| CONTEXT | Request 3 | Per-key-id rate limit on the existing throttler, 429 with Retry-After, test | 3 | COVERED |
| CONTEXT | Request 4 | docs page for every endpoint, scopes, restrictions, pagination and export, errors, attribution, limits; scope list in code, types and docs match; every automation route declares a scope | 4 | COVERED |
| RESEARCH | None for a quick task | | | n/a |

Not in this plan, each outside the four requested items: a web UI label that renders `source`; adding `source` to webhook payloads (event data still carries the integration actor id as author or actor); scoped FAQ and product-setting automation routes (story 20); shared rate-limit storage for multiple replicas; throttling invalid-token floods by IP. Deferred ideas: none recorded for this scope.
</source_audit>

<verification>
Observe RED, then GREEN, for each behavior group. Finish with `bun run build:packages` and `bun run ci:check` exiting 0. Review the final diff on two axes: standards (CLAUDE.md constraints: tenant scoping on every query, committed generated migrations only and no db push, no new dependencies, public responses built from explicit allowlist schemas, the web app importing no server-only package) and spec (D-05, D-11, stories 22 and 23). Confirm `git status --short packages/db/migrations` shows only the generated 0020 files and `git diff --stat` shows no change to STATE.md or ROADMAP.md. Record commits, RED and GREEN evidence, the mutation check, the ci:check result, the story-20 gap and the in-memory limiter ceiling in 261107-flq-SUMMARY.md, with status complete only when every must-have truth is proven. The parent orchestrator owns STATE.md. No push or deployment.
</verification>

<success_criteria>
No API key can create, list or revoke API keys, proven with a full-scope key and a non-vacuous test. Every status change, post and comment made through a key is attributable to that key on audit rows and in the listed DTOs, without impersonating a human and without leaking a secret or a key id to the public. Key traffic is limited per key with a correct Retry-After. docs/automation-api.md is exactly the enforced contract and tests fail on drift. ci:check exits 0.
</success_criteria>

## Artifacts this plan produces

| Path | Kind | Symbols / contents |
|------|------|--------------------|
| packages/db/migrations/0020_post_activity_api_key.sql, meta/ | created | One nullable uuid column on post_activity with FK to workspace_api_keys, on delete set null |
| packages/db/src/schema/feedback.ts | modified | `postActivity.apiKeyId` |
| packages/types/src/api-keys.ts | modified | `IntegrationSourceSchema`, `AdminIntegrationSourceSchema`, `API_KEY_RATE_LIMIT` |
| packages/types/src/feedback.ts | modified | `source` on ActivityEntry, PublicPostDetail, PublicComment, AdminPostRow, WorkspaceRequestItem, WorkspaceCommentItem |
| apps/api/src/auth/principal.ts, guards.ts | modified | `keyName` on ApiKeyPrincipal; api-key id and source helpers |
| apps/api/src/api-keys/api-key-rate-limit.guard.ts, app.module.ts | created, modified | `ApiKeyRateLimitGuard` registered as an APP_GUARD after SessionGuard |
| apps/api/src/feedback/*.service.ts, roadmap.service.ts | modified | api_key_id writes and `source` mapping with key-name joins |
| apps/api/test/api-key-attribution.test.ts, api-keys.test.ts, automation-routes.test.ts, support/routes.ts | created, modified | Attribution, lockout, rate-limit, route inventory and docs sync coverage |
| docs/automation-api.md | created | Authentication, Scopes, Product restrictions, Endpoints, Pagination and export, Errors, Attribution, Rate limits |

<output>
Create `.planning/quick/261107-flq-api-key-management-lockout-integration-a/261107-flq-SUMMARY.md` when done
</output>
