---
phase: quick-261108-wkq
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [WORK-01, PROD-04, ROAD-11, D-01, D-02, D-03, D-04, D-05, D-06, D-11, D-14]
files_modified:
  - docs/user-guide.md
  - docs/api-guide.md
  - docs/llm-guide.md
  - llms.txt
  - docs/automation-api.md
  - CHANGELOG.md
  - AGENTS.md
  - README.md
  - docs/README.md
  - docs/deploy.md
estimate:
  tokens: 26250
  raw_tokens: 50000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - A customer or workspace administrator can find the user guide and follow the implemented feedback-to-roadmap-to-changelog workflow, including workspace inbox attention, product modules, theme and push controls.
    - A human integrator and an LLM can find the canonical API reference, identify real routes and scopes, and use source-checked JSON examples without inventing authentication or exposing internal roadmap information.
    - CHANGELOG.md records the features, fixes and production configuration requirements shipped in the already published v0.3.0 release, without moving or recreating that tag.
    - AGENTS.md explicitly requires a changelog and documentation review before every release tag and alongside behavior changes that affect docs, including breaking API, migration and environment changes.
    - Operator instructions explain persistent production VAPID configuration and how a missing pair prevents API startup and sign-in.
  artifacts:
    - docs/user-guide.md
    - docs/api-guide.md
    - docs/llm-guide.md
    - llms.txt
    - docs/README.md
    - CHANGELOG.md
    - AGENTS.md
  key_links:
    - README.md and docs/README.md link to the user, API and LLM guides and the deployment runbook.
    - llms.txt uses repository-relative Markdown links to the guides and canonical automation reference; it does not claim a public HTTP documentation endpoint exists.
    - docs/api-guide.md and docs/llm-guide.md use docs/automation-api.md as the single route/scope reference, grounded in controllers and packages/types input schemas.
    - docs/deploy.md environment requirements agree with apps/api/src/env.ts, apps/api/src/push/push.config.ts, compose.yaml and .env.example.
---

<objective>
Document the released UserHQ platform for customers, administrators, human integrators and LLM assistants; backfill the v0.3.0 changelog; and make documentation maintenance a persistent release rule.

Purpose: the release added several workflows and a production VAPID prerequisite without a matching changelog or a discoverable usage guide. Users and agents need instructions grounded in what is implemented.
Output: user guide, practical API guide, LLM guide and discovery index, updated canonical API reference where necessary, a docs index, release notes, deployment prerequisites and an explicit AGENTS.md release checklist.
</objective>

<execution_context>
@~/.codex/gsd-core/workflows/execute-plan.md
@~/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@README.md
@CHANGELOG.md
@docs/automation-api.md
@docs/deploy.md
@docs/specs/workspace-platform-expansion.md
@.planning/STATE.md
@apps/api/test/automation-routes.test.ts

The current user explicitly asked for documentation and release rules, not another feature implementation. These are documentation tasks and do not need new TDD tests that mirror prose. Continue GSD planning/commits and ask-matt's independent Standards and Spec review, using the existing API docs-sync suite as the executable contract check. Discovery is Level 0: no dependency, library or architecture decision is introduced. Source code and shared DTOs override stale planning notes and stale README milestones.

Scope limits: edit only the ten listed documentation files, plus the quick task's summary and parent-owned STATE bookkeeping. No application source, test, dependency, workflow or migration changes. No credential values, production operations, network mutation, tag changes or push. The published v0.3.0 tag resolves to d951050a96eaaecb2664878137813faf186acc8b; document that release in a later docs commit without retagging it. Do not read local secret files or copy the generated VAPID values. No browser UI is needed for this source-grounded documentation task.

File ownership and ordering: Task 1 owns docs/user-guide.md. Task 2 owns docs/api-guide.md, docs/llm-guide.md, llms.txt and docs/automation-api.md. These tasks may run concurrently. Task 3 owns CHANGELOG.md, AGENTS.md, README.md, docs/README.md and docs/deploy.md; finalize its navigation and link verification after Tasks 1 and 2 exist. Workers are not alone in the repository and must preserve one another's changes. Stage only owned files.
</context>

<tasks>

<task type="tracer">
  <name>1. Publish the source-grounded customer and workspace administrator guide</name>
  <files>docs/user-guide.md</files>
  <read_first>
    - apps/web/app/dashboard/[ws]/page.tsx and components under apps/web/components/workspace-dashboard for actual Requests, Comments, attention, filter and Follow controls
    - apps/web/app/dashboard/[ws]/[product]/settings/page.tsx and product-features-form.tsx, product-general-form.tsx and product-branding-form.tsx for names and module controls
    - apps/web/components/theme-toggle.tsx, apps/web/app/(app)/account/push-preferences.tsx and apps/web/components/user-menu.tsx for reachable theme and push settings
    - apps/api/src/feedback/workspace-feedback.service.ts, comments.service.ts and apps/api/src/push/push.worker.ts for attention and current-access behavior
    - apps/api/src/portal/product-features.ts, apps/api/src/roadmap/portal-roadmap.controller.ts and packages/types/src/roadmap.ts for public/private boundaries
    - apps/api/src/workspaces/workspaces.controller.ts, team-invites.controller.ts and apps/api/src/platform/platform.controller.ts for account and invite constraints
  </read_first>
  <action>Create docs/user-guide.md for people using UserHQ, with separate customer and administrator paths. Begin with signing in using Google/GitHub, portal and dashboard URL shapes and role boundaries; do not imply self-service workspace creation if it requires an invite. Give a complete feedback-to-release journey: finding a product, searching before submitting, voting and commenting; reviewing demand in the workspace Requests inbox; replying from Comments; recording private roadmap work; making the public fields visible only in a public-roadmap status; linking feedback and updating status; publishing changelog entries and organizing FAQ answers. Per D-03 and D-04, explain the distinction between team-shared Needs attention/Handled and personal read state, how replies resolve attention and customer follow-ups reopen it, and preserve custom product status names in the explanation. Per D-01 and D-02, give the real UI locations for Light/Dark/System and browser push, explicit permission enabling, product Follow, event/previews settings and browser permission recovery; distinguish personal follow from enabling push delivery. Per D-11, D-13 and D-14, explain all four product switches, hidden public modules, preserved admin data, landing fallback and notification suppression without promising historical replay. Include product branding, statuses/categories, team invites, API key and webhook entry points with links to the integrator guide, and troubleshooting for failed sign-in/API unavailability with the operator runbook as the configuration source. Use verified labels and links to code or docs for uncertain detail; do not describe unimplemented controls or infer behavior from old plans. Keep implementation mechanics out of ordinary user steps. Provide a short role/task comparison and a concise troubleshooting table.</action>
  <verify>
    <automated>test -s docs/user-guide.md &amp;&amp; git diff --check -- docs/user-guide.md</automated>
    <human-check>Compare each named control, URL and role claim with the read_first sources. Follow the guide's written customer and administrator journey through the corresponding source routes; verify roadmap internals are never represented as customer visible.</human-check>
  </verify>
  <done>The guide is usable from sign-in through feedback triage and a published release, covers the requested dark mode, push, workspace inbox and product-module workflows, and clearly separates customers, admins and operators.</done>
</task>

<task type="auto">
  <name>2. Add practical API and LLM guides while retaining one canonical route reference</name>
  <files>docs/api-guide.md, docs/llm-guide.md, llms.txt, docs/automation-api.md</files>
  <precondition>The local integration-test Postgres service is reachable for createTestApp; if it is down, restore the existing development services before running the docs-sync suite.</precondition>
  <read_first>
    - docs/automation-api.md and apps/api/test/automation-routes.test.ts, including the exact headings and tables the docs-sync test parses
    - apps/api/src/api-keys/api-keys.controller.ts, api-key.service.ts, authorization.ts, apps/api/src/auth/guards.ts and apps/api/src/tenancy/tenant.guard.ts
    - apps/api/src/feedback/admin-posts.controller.ts, admin-comments.controller.ts and workspace-feedback.controller.ts with packages/types/src/feedback.ts and workspace-feedback.ts
    - apps/api/src/roadmap/roadmap.controller.ts, apps/api/src/changelog/changelog.controller.ts, apps/api/src/faq/faq.controller.ts and packages/types/src/roadmap.ts, changelog.ts, faq.ts and rich-text.ts
    - apps/api/src/products/products.controller.ts, statuses.controller.ts, feedback/categories.controller.ts and packages/types/src/tenancy.ts
    - apps/api/src/webhooks/webhooks.controller.ts, signature.ts, webhook.worker.ts, outbox.ts and apps/api/src/export/export.controller.ts
  </read_first>
  <action>Create docs/api-guide.md as a human integrator on-ramp and docs/llm-guide.md as a concise operating contract for assistants, with llms.txt as a root repository-relative Markdown discovery index. Link to docs/automation-api.md for the full endpoint/scope table rather than copying that table into multiple files. Per D-05, explain creating a key in a signed-in admin session, one-time token display, least privilege, expiration/revocation, workspace slugs versus product slugs versus UUIDs, product restrictions including rejected empty lists, PATCH omission versus null, session-only operations and integration attribution. Give shell examples using environment variables and fake placeholders, never literal credentials: discover product/status/category IDs; list or create a feedback post; reply to a specific comment; create or move a roadmap item; create and publish a changelog entry; create an FAQ category/question; update product modules; create a webhook; and page through feedback export. Ground every method, path, request body, response identifier and scope in the actual controller and shared DTO. Rich-text examples must use the accepted JSON document schema, not stored HTML; preserve internal versus public roadmap field separation. Explain cursor continuation, fixed versus configurable page sizes, the error code envelope, rate limit handling without automatic write replay, absence of a general idempotency-key contract and the need to reconcile uncertain write outcomes. Per D-06, show exact raw-body webhook signature verification inputs, timestamp tolerance and stable delivery/event identity without conflating them, retries and secret rotation limitations. Include disabled-feature semantics and the scheduler's processing-time qualification. In the LLM guide add a compact goal-to-route/scope lookup for common operations, a source hierarchy, required preflight identifiers, privacy cautions and verification after writes; never invent endpoints or treat an API key as a personal session. Audit the canonical reference for omissions or misleading prose exposed by these examples and correct it while preserving its parsed headings/table format. Explain that llms.txt is a repository file, with no new served web endpoint implied. Commit only these four files.</action>
  <verify>
    <automated>bun run --filter @userhq/api test test/automation-routes.test.ts &amp;&amp; git diff --check -- docs/api-guide.md docs/llm-guide.md llms.txt docs/automation-api.md</automated>
    <human-check>Cross-check each executable example against its controller and packages/types input schema. Check each response field used by a following example, each required scope, and every signature/header statement against implementation. Do not send mutating example requests to production.</human-check>
  </verify>
  <done>Humans and LLMs have discoverable, source-checked instructions for the platform API, examples span the requested useful operations, and the existing canonical route/scope/limit documentation test passes unchanged.</done>
</task>

<task type="auto">
  <name>3. Backfill the release notes, publish navigation and enforce documentation maintenance before tags</name>
  <files>CHANGELOG.md, AGENTS.md, README.md, docs/README.md, docs/deploy.md</files>
  <read_first>
    - CHANGELOG.md, README.md, AGENTS.md and docs/deploy.md; preserve existing historical entries and generated AGENTS blocks
    - .github/workflows/release.yml, .github/workflows/ci.yml and git log v0.2.2..v0.3.0 for what the published release actually contains
    - .env.example, compose.yaml, apps/api/src/env.ts and apps/api/src/push/push.config.ts for persistent VAPID requirements
    - apps/api/src/changelog/changelog.scheduler.ts and completed quick summaries for release facts only, with implementation as authority
    - docs/user-guide.md, docs/api-guide.md, docs/llm-guide.md and llms.txt after Tasks 1 and 2 finish
  </read_first>
  <action>Add a v0.3.0 entry dated 2026-11-08 above the existing releases in CHANGELOG.md. Describe shipped dark/light/system themes and readable accent colors, workspace-wide feedback/comment triage and attention handling, browser push and product follows, per-product Board/Roadmap/Changelog/FAQ controls, workspace automation scopes/export/integration attribution, signed outbound webhooks and scheduled changelog publication, and the significant security/reliability fixes. Add an operator upgrade note that persistent VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required in production, migrations apply at API startup and operators must preserve database/upload volumes. This is a retrospective changelog entry for the already published tag; do not suggest the new documentation existed inside that immutable tag. Add docs/README.md as the user, integrator, LLM and operator entry point; add discoverable links in README.md and replace its stale unchecked feature-roadmap presentation with an accurate implemented-feature overview linked to the live planning roadmap. Correct the stale compose file name in its repository tree if still present. Add a manually maintained release/documentation policy section to AGENTS.md outside all generated markers. Require a changelog entry before every major, minor and patch tag; compare changes since the previous release; review and update affected user/API/LLM/deployment docs and llms.txt when interfaces, behavior, auth/scopes, public visibility, configuration, dependencies or migrations change; document breaking changes, migration/upgrade action and new required environment keys before tagging. Require checking examples/links and running the existing docs-sync gate when API documentation is affected, recording docs reviewed/no-impact rationale for releases with no guide changes, committing docs before tagging, and preserving already published tags. Major behavioral changes must update docs in the same work even when no release is being tagged. The policy must not silently authorize future pushes/deployments. In docs/deploy.md add the three VAPID variable names to the environment guidance, a one-time generation procedure using the already installed web-push package, persistent storage/reuse across deploys, startup/log diagnosis for missing keys, and a check that public API health and OAuth initiation work after redeployment. Never include generated values or ask users to commit keys. Clarify the distinction between pushing main's deployment and the tag's GitHub release workflow where the current runbook obscures it. Finish relative-link verification across all created/modified guides, check v0.3.0 still points to its original commit, and record source checks and test output in the quick summary.</action>
  <verify>
    <automated>test -s docs/README.md &amp;&amp; git diff --check &amp;&amp; git rev-parse 'v0.3.0^{}'</automated>
    <human-check>Verify the tag output is d951050a96eaaecb2664878137813faf186acc8b; check every new local Markdown link resolves with a read-only path resolver (strip fragment/query, ignore external/mailto links, resolve relative to each file). Match v0.3.0 release claims to the tagged implementation and the VAPID instructions to env.ts/compose.yaml. Confirm the persistent policy covers every tag and major documentation-impacting change and sits outside generated AGENTS blocks.</human-check>
  </verify>
  <done>v0.3.0 release notes, guide navigation, production VAPID instructions and the persistent release/documentation checklist are committed, all local links resolve, and the published tag remains unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| Documentation examples to real API requests | Readers may execute a method/body against a workspace with powerful credentials. |
| Internal roadmap and credentials to published prose | Examples and assistant guidance must not leak real tokens, key values or private fields into public instructions. |
| Release guidance to production deployment | An inaccurate environment requirement or moved tag can break startup or conceal release history. |

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-WKQ-01 | Tampering | Invented or incorrect API examples | medium | mitigate | Task 2 verifies routes, scopes, DTOs and identifier chaining against source and preserves the docs-sync gate. |
| T-WKQ-02 | Information disclosure | Credentials or internal roadmap content in docs | high | mitigate | Tasks 1–3 use placeholders, separate public/private fields, and never read local secret files or reproduce generated VAPID values. |
| T-WKQ-03 | Denial of service | Missing production VAPID configuration | high | mitigate | Task 3 documents the startup prerequisite, stable key reuse and health/OAuth checks; no guard is bypassed. |
| T-WKQ-04 | Repudiation | Existing release tag rewritten to include later docs | medium | mitigate | Task 3 checks the existing target and records retrospective notes without moving the published tag. |
| T-WKQ-SC | Tampering | Dependency installation | high | mitigate | Documentation-only task; no installation or dependency change. |
</threat_model>

<source_audit>
| Source | ID | Item | Task | Status |
| --- | --- | --- | --- | --- |
| GOAL | User request | Update changelog and usable platform/API docs for people and LLMs | 1–3 | COVERED |
| CONTEXT | User release rule | Docs checked on every tag and alongside major behavior changes | 3 | COVERED |
| CONTEXT | Published release | Preserve v0.3.0 and document it retrospectively | 3 | COVERED |
| CONTEXT | Sign-in incident | Missing persistent VAPID prevents production API startup | 1, 3 | COVERED |
| CONTEXT | D-01, D-02 | Themes, push permission/preferences and follows | 1, 3 | COVERED |
| CONTEXT | D-03, D-04 | Workspace inbox, attention versus personal read state | 1, 2 | COVERED |
| CONTEXT | D-05, D-06 | Scoped API keys, attribution/export and signed webhooks | 1–3 | COVERED |
| CONTEXT | D-11, D-13, D-14 | Privacy, product switches, landing fallback and suppression semantics | 1–3 | COVERED |
| REQ | WORK-01, PROD-04, ROAD-11 | Setup role constraints, public portals and private/public roadmap boundary | 1, 2 | COVERED |
| RESEARCH | Level 0 | Existing controllers, DTOs, UI and docs-sync test are authority; no external research decision | 1–3 | COVERED |

Excluded: feature changes, new routes, serving documentation in the app, CI workflow implementation, production configuration changes, tag movement and pushing. These were not requested; no requested documentation audience or release requirement is deferred.
</source_audit>

<verification>
Run the existing automation-routes docs-sync suite, git diff --check, a local Markdown-link path check, and source/DTO cross-checks for every example. Do not add tests that merely assert this prose exists and do not rerun the full application suite for documentation-only edits. Finish with independent Standards and Spec review through ask-matt; apply small review fixes, record evidence and commit the quick summary. Parent owns STATE bookkeeping. The plan estimate is calibrated from raw 50000 tokens by factor 0.525 (24 samples, high confidence), not a token budget or actual usage claim.
</verification>

<success_criteria>
All ten documentation artifacts are present and linked; the user guide covers implemented customer/admin workflows; the human API and LLM guides contain valid examples and refer to one canonical route table; deployment instructions prevent repeating the VAPID startup failure; v0.3.0 has accurate release notes; AGENTS.md enforces docs updates for every release tag and documentation-impacting changes; source checks, links and the unchanged docs-sync suite pass; no tag or production state changes.
</success_criteria>

<output>
Create .planning/quick/261108-wkq-update-v0-3-0-changelog-user-and-llm-pla/261108-wkq-SUMMARY.md after verification and review. Parent updates STATE.md.
</output>
