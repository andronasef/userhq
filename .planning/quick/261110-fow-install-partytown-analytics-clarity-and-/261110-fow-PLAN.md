---
phase: quick-261110-fow
plan: "01"
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [ANL-01, ANL-02, ANL-03, ANL-04, ANL-05, ANL-06]
files_modified:
  - apps/web/package.json
  - apps/api/package.json
  - bun.lock
  - packages/types/src/analytics.ts
  - packages/types/src/index.ts
  - apps/web/lib/analytics.ts
  - apps/web/lib/analytics-config.ts
  - apps/web/lib/analytics-navigation.ts
  - apps/web/components/analytics-provider.tsx
  - apps/web/app/layout.tsx
  - apps/web/lib/api-client.ts
  - apps/web/public/monitoring/newrelic-browser.js
  - apps/web/scripts/copy-partytown.mjs
  - apps/web/components/board/vote-button.tsx
  - apps/web/components/board/post-form-dialog.tsx
  - apps/web/components/post/comment-composer.tsx
  - apps/web/components/post/sign-in-prompt.tsx
  - apps/web/components/board/board-toolbar.tsx
  - apps/web/components/faq/faq-portal.tsx
  - apps/web/components/roadmap/public-roadmap-modal.tsx
  - apps/web/components/changelog/changelog-feed.tsx
  - apps/web/components/notifications/notification-item.tsx
  - apps/web/components/user-menu.tsx
  - apps/web/app/(app)/login/login-buttons.tsx
  - apps/web/app/error.tsx
  - apps/api/src/analytics/analytics.module.ts
  - apps/api/src/analytics/analytics.interceptor.ts
  - apps/api/src/analytics/analytics.service.ts
  - apps/api/src/analytics/analytics.controller.ts
  - apps/api/src/analytics/auth-outcome.ts
  - apps/api/src/auth/auth.ts
  - apps/api/src/app.module.ts
  - apps/api/src/common/api-error.filter.ts
  - apps/api/src/email/render.ts
  - apps/api/src/push/push.service.ts
  - apps/api/src/email/worker.ts
  - apps/api/src/push/push.worker.ts
  - apps/api/src/scripts/analytics-report.ts
  - apps/api/scripts/start.mjs
  - apps/api/newrelic.cjs
  - apps/api/Dockerfile
  - .env.example
  - compose.yaml
  - .gitignore
  - apps/web/test/analytics.test.ts
  - apps/api/test/analytics.test.ts
  - apps/api/e2e/analytics.spec.ts
  - docs/analytics.md
  - docs/deploy.md
  - docs/README.md
  - README.md
  - CHANGELOG.md
user_setup:
  - service: Google Tag Manager / GA4
    why: Only GTM-TNBWG655 was supplied; GA4 stream identity and container publishing remain operator actions.
    dashboard_config:
      - task: Configure a Google tag and an explicit custom-event tag from the committed event mapping, then publish GTM-TNBWG655.
        location: Google Tag Manager workspace and GA4 web stream
  - service: New Relic APM
    why: Supplied attachment is browser configuration; server APM requires a distinct ingest license key.
    env_vars:
      - name: NEW_RELIC_LICENSE_KEY
        source: New Relic API keys, ingest license key for server APM
estimate:
  tokens: 31500
  raw_tokens: 60000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - Production loads the supplied GTM container using Partytown and the supplied Clarity/New Relic integrations with working instrumentation rather than worker-only appearances.
    - Analytics never includes credentials, names, emails, user text, query strings, private roadmap fields or raw page titles; Clarity never observes private screens after SPA navigation.
    - Intent, confirmed success, known failure and incomplete observation are distinct; customers, tenant administrators, platform owner and integrations are not conflated.
    - Real browsing, authentication, participation, workspace setup/operations, public feedback outcomes and notification return journeys emit the documented typed events.
    - Analytics failure cannot fail or delay the user's transaction; development and platform-owner testing are excluded from adoption reports.
    - Provider setup and operational metrics limitations are explicit; no unconfigured dashboard, backend APM ingestion or deployed release is claimed.
  artifacts:
    - path: packages/types/src/analytics.ts
      provides: Safe fixed event catalogue, bounded properties, receipt schema and role classification contract
    - path: apps/web/components/analytics-provider.tsx
      provides: Provider initialization, opaque identity, page/content tracking and public/private recorder boundary
    - path: apps/api/src/analytics/analytics.interceptor.ts
      provides: Successful server-operation receipts with authenticated tenant/actor context
    - path: docs/analytics.md
      provides: Event definitions, GTM setup, provider dashboard recipes and metric denominators/limitations
  key_links:
    - from: API successful operations
      to: apiFetch receipt relay and GTM dataLayer
      via: Validated allowlisted non-cached analytics response metadata, one delivery owner per event
    - from: Partytown preparation script
      to: vinext standalone public worker assets
      via: Both dev and production build commands copy same-origin library files before startup/build
    - from: public portal navigation
      to: private dashboards/account/invite/auth routes
      via: Synchronous document boundary or verified recorder teardown before private content mounts
---

<objective>
Give the platform owner meaningful product and reliability analytics for ordinary customers and workspace teams, implementing the accepted six-outcome measurement model through Google Analytics/GTM, Clarity and New Relic, using Partytown where compatible. This is an authorized quick task on the current checkout, not an implementation phase or deployment.

ANL-01: safe provider loading and Partytown deployment. ANL-02: discovery, participation and real OAuth outcome tracking. ANL-03: administrator onboarding, triage and public progress. ANL-04: retention and notification returns. ANL-05: private data boundaries, nonblocking delivery and errors. ANL-06: truthful documentation, provider configuration and verification. These are quick-task source IDs, not new ROADMAP requirements.
</objective>

<execution_context>
@~/.Codex/gsd-core/workflows/execute-plan.md
@~/.Codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/quick/261110-fow-install-partytown-analytics-clarity-and-/261110-fow-RESEARCH.md
@.planning/quick/261110-fow-install-partytown-analytics-clarity-and-/COVERAGE.md
@apps/web/lib/api-client.ts
@apps/web/app/layout.tsx
@apps/api/src/auth/auth.ts
@apps/api/src/app.module.ts
@apps/api/src/auth/me.controller.ts
@apps/api/src/tenancy/tenant.guard.ts
</context>

<decisions>
D-01: The owner uses provider dashboards; do not add an analytics UI inside UserHQ.
D-02: Use GA4 through supplied GTM-TNBWG655, Clarity zbe3hrnykn and the supplied New Relic browser snippet. Use Partytown for compatible analytics code; preserve real page monitoring where a main-thread exception is required and document evidence.
D-03: Track discovery, completed intent, customer attention, workspace activation/operation, visible progress and reliability. Reading without signing up is valid engagement; do not infer resolution or failure from an exit.
D-04: Track per-current-workspace visitor/customer/admin/owner role. Exclude platform-owner testing/development and separate integration activity. API guard context is authoritative for completed operations.
D-05: Workspace activation requires first outside contribution and team response/public decision. Keep intermediate stages and elapsed time; acknowledgement, decision and delivery are distinct.
D-06: Retention differs for readers, contributors and admins. Track notification channel/type and follow-on action without recipient identities or tokens.
D-07: Clarity is anonymous session-only, strictly public browsing/contribution screens, mask content and personal data, exclude dashboard/account/credentials/auth callbacks and private activity screens. No recorder bleed across SPA navigation.
D-08: GA gets an opaque identity after authenticated sign-in and clears it on sign-out. No emails/names/raw search or customer text. No automatic raw URLs, titles or referrers.
D-09: Default enabled production. Explicit user decision: no consent prompt, opt-out control or related UI; privacy/consent policy review deferred. Do not add an approval gate.
D-10: Fail harmlessly, never make business writes wait for vendors. Do not fabricate GA4 measurement IDs, Measurement Protocol secrets or a server New Relic key. No deployment, push, release/tag or external provider account mutation.
</decisions>

<tasks>

<task type="tracer" tdd="true">
  <name>Wire a safe successful-vote journey through providers and prove the recording boundary</name>
  <files>packages/types/src/analytics.ts, packages/types/src/index.ts, apps/web/lib/analytics.ts, apps/web/lib/analytics-config.ts, apps/web/lib/analytics-navigation.ts, apps/web/components/analytics-provider.tsx, apps/web/app/layout.tsx, apps/web/lib/api-client.ts, apps/web/components/board/vote-button.tsx, apps/web/package.json, apps/web/scripts/copy-partytown.mjs, apps/web/public/monitoring/newrelic-browser.js, apps/api/src/analytics/analytics.module.ts, apps/api/src/analytics/analytics.interceptor.ts, apps/api/src/analytics/analytics.service.ts, apps/api/src/app.module.ts, .env.example, .gitignore, bun.lock, apps/web/test/analytics.test.ts, apps/api/test/analytics.test.ts, apps/api/e2e/analytics.spec.ts</files>
  <behavior>One real successful vote emits one server-confirmed success with role/product context; a rejected vote emits no success. Unknown properties and sensitive URLs/text are discarded. Disabled/test/platform-owner tracking does nothing. Public-to-private click, imperative navigation and back/forward never allow active replay to observe private DOM. Missing/throwing SDKs do not affect votes.</behavior>
  <action>Implement ANL-01 and ANL-05 per D-01 through D-04 and D-07 through D-10. Install the legitimate pinned Partytown package and copy its same-origin library assets for dev, vinext build and the standalone image; ignore generated worker copies. Follow supported dataLayer.push forwarding and valid GTM initialization including gtm.start/gtm.js. The provided gtag('js') call alone is not GA configuration: route fixed dataLayer custom events to the supplied container and document external tag setup, never invent a G-ID.

Define a shared strict event schema with fixed event names, enum-valued properties and explicit numeric counts/durations. Use bounded surface/module/action/actor/source/environment/release properties, opaque workspace/product/user identifiers where warranted, sanitized route templates and generic titles; no arbitrary record pass-through. Suppress adoption events for platform owner, localhost/dev/test and automation; preserve automation as a separate diagnostic source only. No arbitrary proxy endpoint. Derive completed-event actor/workspace/product context from req.user, req.apiKey, req.tenant or req.portal; on public portal writes resolve membership against the current workspace, not global workspace ownership. Relay a validated safe receipt in response metadata from a Nest interceptor after successful execution, consumed once by apiFetch; do not add a second browser success emitter. Limit receipts to same-origin, human browser requests and successful actual state transitions; distinguish idempotent PUT retries from a new vote. Do not change business response schemas or expose internal context in public DTOs.

Build a client provider that initializes opaque GA identity from /me, clears it on logout, handles route/content page views once without query/hash/title/referrer leakage and excludes sensitive token routes. New Relic's attached browser loader lives in an audited static file/config assembly, with safe supplied public browser values, no APM credential reuse, payload/replay/session-trace/user-action capture disabled for diagnostic-only use. Keep its needed global error/performance interception on the main thread with documented reason. Attempt Clarity in Partytown only if a real replay/DOM test proves it works; otherwise document and implement the smallest main-thread recording exception, while GTM remains worker-loaded. Do not label an unverified worker recorder as working.

Initialize recorder only after actor resolution and a strict public-route allowlist; mask whole content area plus all inputs, user menus/avatars/aria/title attributes as needed. Recorder teardown before private rendering must be proven; a hard document boundary is preferable to asynchronously removing a script that has already patched observers. Cover anchor clicks, programmatic router transitions, popstate and direct loads. A strict public iframe recording boundary is also acceptable if it preserves UX and genuinely records the public interaction; do not refactor unrelated routes. Add a valid smoke browser test using the existing Playwright runner with vendor stubs so no test data reaches real projects.</action>
  <verify><automated>bun run --filter @userhq/types build &amp;&amp; bun run --filter @userhq/web test -- test/analytics.test.ts &amp;&amp; bun run --filter @userhq/api test -- test/analytics.test.ts</automated><human-check>Inspect provider initialization and a public-to-private navigation with the existing browser test runner; assert worker libraries are present in the production standalone output. Do not use unasked preview tools.</human-check></verify>
  <done>The vote tracer and sanitization/private-route tests pass; GTM actually runs through Partytown; recorder/monitoring exceptions are explicit and justified; generated worker assets ship in standalone output; scripts never activate for tests unless explicitly stubbed.</done>
</task>

<task type="auto" tdd="true">
  <name>Expand the proven path across authentication, customer journeys and workspace outcomes</name>
  <files>apps/api/src/analytics/analytics.controller.ts, apps/api/src/analytics/auth-outcome.ts, apps/api/src/analytics/analytics.interceptor.ts, apps/api/src/analytics/analytics.service.ts, apps/api/src/auth/auth.ts, apps/web/app/(app)/login/login-buttons.tsx, apps/web/components/user-menu.tsx, apps/web/components/board/post-form-dialog.tsx, apps/web/components/post/comment-composer.tsx, apps/web/components/post/sign-in-prompt.tsx, apps/web/components/board/board-toolbar.tsx, apps/web/components/faq/faq-portal.tsx, apps/web/components/roadmap/public-roadmap-modal.tsx, apps/web/components/changelog/changelog-feed.tsx, apps/web/components/notifications/notification-item.tsx, apps/api/src/email/render.ts, apps/api/src/email/worker.ts, apps/api/src/push/push.service.ts, apps/api/src/push/push.worker.ts, apps/web/lib/analytics.ts, apps/web/components/analytics-provider.tsx, packages/types/src/analytics.ts, apps/web/test/analytics.test.ts, apps/api/test/analytics.test.ts</files>
  <behavior>Real account creation and returning OAuth login yield distinct confirmed events; a normal refresh does not count as login; callback errors and cancellation remain distinct. Contribution intent survives the login boundary without storing draft content in telemetry. Only committed changed public statuses count as visible decisions/progress; private notes/read state are never acknowledgement. Notification markers preserve destination behavior and contain no recipient identifier.</behavior>
  <action>Implement ANL-02 through ANL-04 per D-03 through D-08 and D-10. Expand the shared interceptor receipt map to successful feedback/comments, workspace/product creation/configuration, team invitation acceptance, triage/read/handled operations, public replies/decisions, roadmap links/status moves and actual changelog publication. Use handler metadata or explicit route templates; never generic payload traversal or dynamic event names. For operations where a response alone cannot prove a public transition or a new write, attach the receipt at the service/controller point that knows the committed transition; the exact additional source files must be selected from a live search of those handlers. Do not count scheduled publication as already published, private roadmap movement as public progress, unvote as new demand, or noop/retry updates as new transitions. Compute acknowledgement/decision/delivery and activation milestone durations from existing DB state where possible, with accurate human-versus-integration attribution and no new schema. Keep metric definitions testable and documented.

Track browser intents at actual starts of vote/comment/submission, sign-in prompt exposure/selection and validation failures without form values. Record debounced search completion, result counts/zero-results and explicit result opens for board/FAQ; do not send raw searches or count auto-expanded FAQ search results as user-opened answers. Content-open page/modal events must not double count the same open on hydration. Store only a bounded pending action/type and timestamp for post-auth continuation; abandonment means no observed completion, not a technical failure. Do not implement unrelated draft UX changes; report whether an already-existing draft survived only where observable.

Confirm auth outcomes from Better Auth's actual account/session lifecycle, not timestamp guesses or a browser redirect alone. Use a short-lived purpose-bound signed outcome receipt and a same-origin authenticated consumption path if necessary; bind it to the matching session/user, clear after use and prevent replay. Never expose or store OAuth codes/session cookies in analytics. Test created-account versus existing-account login, canceled/failed callback, stale/missing receipt, reload and logout. If adding an endpoint, use explicit serializer, auth guards/rate limits and update canonical API docs/global skill references.

Add notification attribution for in-app clicks and safe generic email/push destination markers: channel and notification type only, preserve hashes and destination, consume/remove markers before third-party initialization. Never attribute opens of unsubscribe/mute token URLs, use tracking pixels, or treat provider accepted as delivered/read. Record queued/provider-accepted/failed sends separately through the server diagnostic sink when configured; browser return and subsequent contribution events carry only bounded channel/type attribution. Retention uses cohort reports based on reader/contributor/admin events; do not add invented daily-usage thresholds.</action>
  <verify><automated>bun run --filter @userhq/web test -- test/analytics.test.ts &amp;&amp; bun run --filter @userhq/api test -- test/analytics.test.ts &amp;&amp; bun run --filter @userhq/web typecheck &amp;&amp; bun run --filter @userhq/api typecheck</automated></verify>
  <done>Every event family in the accepted catalogue has a reachable production call site, distinct authoritative delivery owner and safe tests; no false signup/reload/public-progress events; notifications and post-login continuation can be analyzed without sensitive payloads.</done>
</task>

<task type="auto">
  <name>Complete diagnostic delivery, operational truth, provider setup guides and verification</name>
  <files>apps/api/package.json, apps/api/scripts/start.mjs, apps/api/newrelic.cjs, apps/api/src/common/api-error.filter.ts, apps/web/app/error.tsx, apps/api/src/scripts/analytics-report.ts, apps/api/Dockerfile, compose.yaml, .env.example, bun.lock, docs/analytics.md, docs/deploy.md, docs/README.md, docs/automation-api.md, docs/api-quickstart.md, docs/llm-guide.md, docs/user-guide.md, llms.txt, README.md, CHANGELOG.md, apps/web/lib/i18n/locales/en.json, apps/web/lib/i18n/locales/ar.json, apps/web/lib/i18n/locales/de.json, apps/web/lib/i18n/locales/es.json, apps/web/lib/i18n/locales/fil.json, apps/web/lib/i18n/locales/fr.json, apps/web/lib/i18n/locales/hi.json, apps/web/lib/i18n/locales/id.json, apps/web/lib/i18n/locales/ja.json, apps/web/lib/i18n/locales/ko.json, apps/web/lib/i18n/locales/pt.json, apps/web/lib/i18n/locales/ru.json, apps/web/lib/i18n/locales/zh.json, apps/api/test/analytics.test.ts, apps/web/test/analytics.test.ts</files>
  <action>Complete ANL-05/06 per all decisions. Add optional real NestJS New Relic APM instrumentation using the legitimate newrelic Node package, enabled only with the correct server license key, preloaded before Nest/pg and with official ESM loader support. Preserve ordinary startup when absent; wire container/runtime environment without passing a secret at build time, and never treat the browser license as server ingest authorization. Filter raw errors/logs/SQL/headers/body and use safe error classes/codes, release/environment and correlation IDs. Hook API 5xx and browser error boundary failures into safe diagnostics without duplicating automatic captures; distinguish expected 4xx/user cancellations from incidents. Disable automatic log forwarding/contentful custom attributes. Do not create vendor alert rules without dashboard access; provide exact suggested alert queries, thresholds as operator-tunable examples and minimum volume qualifications.

Implement a read-only existing-DB operational report CLI for current backlog, unanswered ages, response-time distribution and workspace activation milestones; aggregate by authorized operator scope with no customer text/contact details, document running locally and optionally forwarding bounded snapshots to New Relic when APM is configured. Current outstanding work must remain in the denominator; event-only completed-response averages cannot represent ignored work. Do not require migrations or add private public-facing metrics endpoints. Preserve no-DB-credentials-in-web architecture.

Write docs/analytics.md as the event catalogue and dashboard guide: exact names/properties/delivery owners, discovery/participation/auth/workspace/attention/progress/retention metrics, filters and denominators, sampled/missing events, GA identity limitations, GA high-cardinality tenant caveat, worker page-exit limitations, default-on/no-control decision and deferred privacy review. Provide precise GTM Google tag/custom event trigger/variable mapping and disable automatic raw pageviews/enhanced search/form/link capture; use only sanitized explicit page/content events. No unknown GA4 stream ID is silently invented; the supplied container can be loaded while GA delivery remains dependent on publication. Include Clarity strict masking/route exclusions and real worker exception; New Relic browser versus APM setup, release/source-map management and absence-of-key behavior. Record setup that cannot be verified against private provider accounts honestly.

Update deployment/env/docs index/README/unreleased changelog and affected privacy strings across every supported locale to disclose these providers and purposes rather than claiming only auth cookies/no analytics. Do not add consent/disable UI. Review canonical guides and update only those affected; where changed, synchronize the global userhq skill references per AGENTS.md and report deployment-tool availability accurately. Run meaningful targeted and full web/API tests, types, lint, package/API builds, vinext production build and worker static-output assertions. Run the new browser spec through the existing Playwright tooling with stubs and isolated supported test setup. Do not claim external ingestion, OAuth-provider success or production runtime verification without evidence. Fix any regression introduced by this task; report unrelated pre-existing failures with precise evidence. No release tag, push, deployment or PR.</action>
  <verify><automated>bun run build:packages &amp;&amp; bun run --filter @userhq/api build &amp;&amp; bun run typecheck &amp;&amp; bun run --filter @userhq/api test &amp;&amp; bun run --filter @userhq/web test &amp;&amp; bun run --filter @userhq/web build &amp;&amp; bun run lint</automated><human-check>Check deployed configuration is still an operator step; report which browser/worker/provider calls were stubbed and whether private-account ingestion was unverified.</human-check></verify>
  <done>Verified code, tests, accurate localized disclosures, provider setup guide and operational report exist; supplied browser config is wired; missing GA4 publication/APM ingest secrets are clearly isolated setup items; source files committed atomically and quick summary written.</done>
</task>
</tasks>

<threat_model>
ASVS level 1; high findings block completion.

| Boundary | Description |
|---|---|
| Browser/API to vendors | Third parties must receive only deliberately allowlisted analytics/diagnostics |
| Public portal to private UI | An already-running recorder cannot cross into private DOM |
| User-supplied URLs and metadata | Query/hash/referrer/title/user text can contain tokens or PII |
| API keys to human analytics | Integration actors must not be mistaken for human users |
| Browser agent to server APM | Browser public key is not server ingest credential |

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-261110-fow-01 | Information disclosure | All telemetry payloads | high | mitigate | Strict shared property schemas; route templates; no body/text/title/query forwarding; adversarial payload tests |
| T-261110-fow-02 | Information disclosure | Clarity navigation | high | mitigate | Public allowlist before initialization and synchronous tested public/private document boundary |
| T-261110-fow-03 | Spoofing | Success/role analytics | medium | mitigate | Auth/tenant-derived server receipt and committed-state transitions; ignore browser-asserted roles |
| T-261110-fow-04 | Denial of service | Vendor failures | medium | mitigate | Bounded nonblocking receipt/diagnostic paths; no vendor awaited inside business transactions |
| T-261110-fow-05 | Spoofing | Auth outcomes | high | mitigate | Purpose-bound short-lived signed receipt bound to authenticated session, consumed once; replay and stale tests |
| T-261110-fow-06 | Information disclosure | Logs/errors/APM | high | mitigate | Safe error codes and attrs only; disable payload capture/log forwarding/replay and sensitive route initialization |
| T-261110-fow-SC | Tampering | npm installs | high | mitigate | Official package sources verified in RESEARCH; pin reviewed releases, inspect Bun lifecycle changes |
</threat_model>

<source_audit>
| Source | ID | Requirement | Coverage |
|---|---|---|---|
| GOAL | quick request | Implement all agreed analytics with Partytown and supplied configs | Tasks 1-3 |
| REQ | ANL-01 | Provider/worker installation and production assets | Task 1 |
| REQ | ANL-02 | Browsing/participation/auth success and failures | Tasks 1-2 |
| REQ | ANL-03 | Team onboarding/operations/public outcomes | Task 2 |
| REQ | ANL-04 | Role-aware retention and notification returns | Task 2 |
| REQ | ANL-05 | Safe data/replay boundaries/nonblocking diagnostics | Tasks 1-3 |
| REQ | ANL-06 | Provider setup/docs/validation/current-state metrics | Task 3 |
| RESEARCH | Partytown | Same-origin assets, forwarded dataLayer, unreliable worker exit events | Tasks 1, 3 |
| RESEARCH | vendor constraints | GTM publication, browser/APM credential split, unknown recorder worker support | Tasks 1, 3 |
| CONTEXT | D-01 through D-10 | Locked conversation decisions | Explicit task citations above |
</source_audit>

<verification>
Each event family has production wiring and a tested delivery owner. Negative tests try sensitive query/path/hash/title/body/error/attribution input, private route transitions, platform-owner/test/integration exclusion, idempotent retries, signed-auth receipt misuse and missing/throwing vendors. Production build verifies Partytown files and safe public config are present without server credentials in web output. Provider account configuration is documented rather than falsely declared verified.
</verification>

<output>
Create .planning/quick/261110-fow-install-partytown-analytics-clarity-and-/261110-fow-SUMMARY.md with status: complete only when all implemented scope and required verification pass. Commit implementation/docs in atomic task commits; orchestrator owns PLAN/SUMMARY/STATE commits and STATE updates. Do not edit ROADMAP.md.
</output>
