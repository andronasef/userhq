---
phase: quick-261106-f9k
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-05, D-11]
files_modified:
  - apps/api/src/auth/guards.ts
  - apps/api/src/api-keys/api-key.decorator.ts
  - apps/api/src/api-keys/api-key.service.ts
  - apps/api/src/api-keys/api-keys.controller.ts
  - apps/api/src/tenancy/tenant.guard.ts
  - apps/api/src/feedback/posts.service.ts
  - apps/api/src/feedback/comments.service.ts
  - apps/api/src/feedback/workspace-feedback.service.ts
  - apps/api/test/api-keys.test.ts
  - apps/api/test/export.test.ts
estimate:
  tokens: 22000
  raw_tokens: 22000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - A valid API key is denied on every route without explicit automation scope metadata, even with admin scope or a valid accompanying cookie.
    - API activity uses a distinct persisted integration identity and never authenticates as the key creator.
    - Scopes, workspace boundaries, and product restrictions hold on both product routes and workspace routes, including webhooks and key management.
    - Existing authorized automation reads and writes and browser sessions continue to work.
  artifacts:
    - apps/api/test/api-keys.test.ts
    - apps/api/src/auth/guards.ts
    - apps/api/src/tenancy/tenant.guard.ts
  key_links:
    - SessionGuard checks explicit route scope metadata before accepting any bearer key or public-route bypass.
    - TenantGuard resolves only the key workspace and applies product policy before controller execution.
    - API actor persistence satisfies author and activity foreign keys without workspace membership or login credentials.
---

<objective>
Complete approved security fix 1: scoped credentials can perform only explicitly enabled automation operations, without acquiring their creator's account or escaping their product restrictions (D-05, D-11). This is corrective work on the current branch, not a new feature phase. Outbound URL/SSRF, notification delivery, inbox semantics, appearance, missing FAQ/settings scopes and API documentation remain in the separately approved follow-up work.
</objective>

<context>
@AGENTS.md
@.planning/STATE.md
@docs/specs/workspace-platform-expansion.md
@.planning/phases/09-admin-api/09-02-PLAN.md
@.planning/phases/09-admin-api/09-03-SUMMARY.md
@apps/api/src/auth/guards.ts
@apps/api/src/tenancy/tenant.guard.ts
@apps/api/src/api-keys/api-key.decorator.ts
@apps/api/test/api-keys.test.ts
@apps/api/test/export.test.ts

Use ask-matt's TDD discipline at the already approved Nest HTTP + real PostgreSQL seam. One behavior RED, implementation GREEN, repeat. Baseline api-keys.test.ts: 8/8 passed in 39 seconds on 2026-11-06. Tests run Vitest via Bun's script using Node, never bun test. No dependencies are needed. Do not print environment secrets. Other agents may be working: preserve their edits. Do not deploy, push, or create a new branch.
</context>

<tasks>
<task type="tracer" tdd="true">
  <name>1. Deny keys globally unless a route explicitly declares its automation scopes</name>
  <files>apps/api/src/auth/guards.ts, apps/api/src/api-keys/api-key.decorator.ts, apps/api/src/api-keys/api-keys.controller.ts, apps/api/test/api-keys.test.ts</files>
  <behavior>
    - Read-only and admin keys cannot call account deletion, workspace deletion/ownership actions, team invites, public vote/post/comment routes, or other unannotated handlers.
    - A valid session cookie accompanying a forbidden key does not cause fallback to session authorization.
    - requests:read still reads workspace requests but cannot write requests or read comments.
    - Real browser owner/admin sessions retain their existing allowed actions.
  </behavior>
  <action>First add one real HTTP regression demonstrating the creator-account or invite escalation and observe its behavioral failure. In SessionGuard, treat a key as a separate credential path and reject any handler/class without a nonempty RequireScopes declaration before the public-route return and before synthesizing any identity. Do not allow admin scope to override an absent declaration. Enforce declared scopes centrally so annotating a route without TenantGuard cannot omit scope enforcement; retain tenant enforcement. Reject recognized API-key Bearer credentials on the auth-handler bypass too. Keep invalid/revoked/expired token behavior intact. Make API-key management session-only by removing its automation opt-in: the accepted operations do not require keys to mint/revoke credentials, and product-restricted keys must never mint unrestricted descendants. Do not add broad class-level scope annotations to restore accidental access. Expand HTTP regressions one behavior at a time.</action>
  <verify><automated>bun run --filter @userhq/api test test/api-keys.test.ts</automated></verify>
  <done>Observed RED is recorded; unannotated routes reject both read-only and admin keys; allowed scope routes and owner/admin cookie actions work.</done>
</task>

<task type="auto" tdd="true">
  <name>2. Give automated writes a real integration actor without human privileges</name>
  <files>apps/api/src/api-keys/api-key.service.ts, apps/api/src/auth/guards.ts, apps/api/src/feedback/posts.service.ts, apps/api/src/feedback/comments.service.ts, apps/api/src/feedback/workspace-feedback.service.ts, apps/api/test/export.test.ts</files>
  <behavior>
    - Key-created posts/comments and inbox replies succeed and display/record the integration rather than the creator as actor; createdByApiKeyId remains stamped.
    - Authorized key moderation/status writes succeed without granting its actor workspace membership.
    - API credentials have no human session, personal account access, auth account, or session records.
  </behavior>
  <action>Start with a failing HTTP write assertion that the returned/exported author differs from the key creator and identifies the integration. Introduce an explicit key principal containing keyId, workspaceId and permissions; do not set a human-authenticated req.session. Because posts/comments authorId and activity/read/handled references require real user rows, persist one non-login integration actor per key using a deterministic reserved id and integration display name. Create this safely and idempotently for existing and new keys; do not associate OAuth accounts, sessions or workspace membership. Keep creator id solely as key metadata. Resolve that actor only after route/scope authorization. Adapt existing authorized business paths to use the key's tenant-authorized admin context rather than isWorkspaceAdmin(actorId); ordinary sessions must still undergo membership checks. Inspect moderation and roadmap call sites for user FK and authorization assumptions; use the persisted actor for valid FKs and explicit API principal for authorization, never the creator id. Key-only workspace comment reads must not mutate a human's personal unread state. Preserve existing response schemas and integration attribution. Add each needed HTTP write/moderation regression before its implementation.</action>
  <verify><automated>bun run --filter @userhq/api test test/api-keys.test.ts test/export.test.ts</automated></verify>
  <done>Permitted writes work with a distinct persisted actor, no membership or login credential is granted, creator-attributed automation regressions are eliminated, and existing session tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>3. Fail closed for product-restricted keys on workspace resources</name>
  <files>apps/api/src/tenancy/tenant.guard.ts, apps/api/src/api-keys/api-key.decorator.ts, apps/api/test/api-keys.test.ts, apps/api/test/export.test.ts</files>
  <behavior>
    - A product-A key cannot read or write product B, any other workspace, workspace webhooks, signing secrets, deliveries, or credential management.
    - Workspace aggregate requests/comments/export return only allowed products where the service already supports an explicitly declared restriction policy.
    - A new workspace scope-annotated route without a product-restriction policy is denied to restricted keys.
  </behavior>
  <action>Write and observe RED for a product-A key reading the workspace webhook list or another product's subscription. Add explicit route metadata for restriction-aware workspace aggregation only after inspecting its actual query and item mutation policy. Product routes must check the resolved product against the key allowlist. Workspace routes deny product-restricted keys by default, including every webhook operation and key management; unrestricted keys retain their declared webhook scopes. This conservative workspace rejection closes the bypass without inventing webhook subresource semantics. If retaining requests/comments/export aggregation requires touching their controllers/services, restrict all queries, counts, cursors, nested results and comment-id mutations to the key product set and include those files in the executor's recorded scope; do not mark a route restriction-aware based on filters supplied by the caller alone. If the existing service cannot enforce the policy, deny the restricted key rather than leak data. Keep cross-workspace anti-enumeration 404 behavior. Test both matching/nonmatching product routes, denied workspace webhooks and unrestricted allowed webhook/session behavior.</action>
  <verify><automated>bun run --filter @userhq/api test test/api-keys.test.ts test/export.test.ts test/webhooks.test.ts test/cross-tenant.test.ts</automated></verify>
  <done>All workspace-wide bypasses are closed, supported restricted aggregation is proven or denied, and API-key, export, webhook and cross-tenant regressions pass.</done>
</task>
</tasks>

<threat_model>
| ID | Category | Boundary | Severity | Disposition | Mitigation |
| --- | --- | --- | --- | --- | --- |
| T-QF9K-01 | Elevation/spoofing | Bearer credential to human routes | critical | mitigate | Global explicit opt-in; no creator identity or session fallback |
| T-QF9K-02 | Elevation | Limited key to privileged mutation | critical | mitigate | Central scope check and session-only credential management |
| T-QF9K-03 | Disclosure/tampering | Product key to workspace resources | critical | mitigate | Deny restricted workspace routes unless proven restriction-aware |
| T-QF9K-04 | Repudiation | Integration to persistent author/activity | high | mitigate | Non-login actor plus key attribution; never creator substitution |
| T-QF9K-SC | Tampering | Dependencies | high | mitigate | No package installation required |
</threat_model>

<source_audit>
GOAL: Approved fix step 1 — tasks 1–3. REQ/CONTEXT: expansion D-05 scoped credentials, restricted products and attribution — tasks 1–3; D-11 tenant isolation — tasks 1/3. RESEARCH: existing Nest guards, real-DB harness and author FK constraints verified in source; no external dependency research needed (Level 0). Exclusions: approved fixes 2–6 and absent FAQ/settings automation/docs are separate work; this correction must not silently claim those complete. STATE.md predates later implementation commits; source plus approved fix scope govern this quick task.
</source_audit>

<verification>
Run the focused suites above and API typecheck, then the existing CI check appropriate to changed API code. Record real RED/GREEN evidence and any infrastructure failures honestly. Use ask-matt code-review on the final diff, covering standards and approved scope; fix findings before completion. Update quick SUMMARY.md and .planning/STATE.md quick-task row only after verified completion. Commit only this task's files locally; no push/deploy.
</verification>

<success_criteria>All must-have truths hold at the HTTP boundary, with no regression in existing allowed reads/writes, FK integrity, browser sessions, tenant isolation or private roadmap serialization.</success_criteria>

<output>Create SUMMARY.md beside this plan with commits, tests, RED/GREEN evidence, review outcome and remaining approved follow-up work.</output>
