---
phase: 06-product-feature-controls
verified: 2026-11-05T21:55:00Z
status: human_needed
score: 6/6 roadmap success criteria verified (automated); 9/9 CAP requirements verified (automated)
covered_files:
  - .planning/phases/06-product-feature-controls/06-01-PLAN.md
  - .planning/phases/06-product-feature-controls/06-01-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-02-PLAN.md
  - .planning/phases/06-product-feature-controls/06-02-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-03-PLAN.md
  - .planning/phases/06-product-feature-controls/06-03-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-04-PLAN.md
  - .planning/phases/06-product-feature-controls/06-04-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-05-PLAN.md
  - .planning/phases/06-product-feature-controls/06-05-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-06-PLAN.md
  - .planning/phases/06-product-feature-controls/06-06-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-07-PLAN.md
  - .planning/phases/06-product-feature-controls/06-07-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-08-PLAN.md
  - .planning/phases/06-product-feature-controls/06-08-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-09-PLAN.md
  - .planning/phases/06-product-feature-controls/06-09-SUMMARY.md
  - .planning/phases/06-product-feature-controls/06-10-PLAN.md
  - .planning/phases/06-product-feature-controls/06-10-SUMMARY.md
  - apps/api/src/email/outbox.ts
  - apps/api/src/email/unsubscribe.controller.ts
  - apps/api/src/email/worker.ts
  - apps/api/src/feedback/posts.service.ts
  - apps/api/src/notifications/notifications.service.ts
  - apps/api/src/portal/portal.guard.ts
  - apps/api/src/portal/product-features.ts
  - apps/api/src/products/products.controller.ts
  - apps/api/src/roadmap/portal-roadmap.controller.ts
  - "apps/web/app/[ws]/[product]/page.tsx"
  - apps/web/lib/portal-features.ts
  - packages/db/migrations/0013_product_features.sql
covered_digest: "v3:sha256:c304ec4afa885a4301b5a5c311c3d2fb167ec87abb97c24a6a23591edc7dd932"
behavior_unverified: 0
overrides_applied: 0
gaps: []
human_verification:
  - test: "Screen-reader and keyboard-only walkthrough of Settings > Portal features and the dashboard sidebar with a module off"
    expected: "Each checkbox announces its name and description; the 'Hidden from customers' text is read for the sidebar link; focus ring is visible on checkbox rows; focus returns to Save after the confirm dialog closes"
    why_human: "UI-SPEC lists the a11y label check as a manual backstop. Playwright covers keyboard operation and confirm flow, not assistive-technology output."
  - test: "Visual review of the all-modules-off unavailable page, the dashboard hidden-module notice, and the settings section at 320, 375 and 768px on a real browser/device"
    expected: "Branded neutral page (logo, accent, footer, no tabs), notice stacks with a full-width button on mobile, no horizontal scroll, copy matches the UI-SPEC contract"
    why_human: "Visual quality and brand feel cannot be judged from DOM assertions. Playwright asserts no horizontal scroll and wrapping only."
  - test: "Matt code-review of the implementation diff and GSD security/UI review (still marked outstanding in 06-VALIDATION.md)"
    expected: "Review signed off; REQUIREMENTS.md CAP-01..09 boxes and the ROADMAP Phase 6 box flipped by the orchestrator"
    why_human: "Process gate, not a codebase property. The execution plans intentionally left requirement boxes unchecked."
---

# Phase 6: Product Feature Controls Verification Report

**Phase Goal:** As a workspace owner or admin, I want to enable Board, Roadmap, Changelog and FAQ independently for each product, so that each portal shows only what that product uses.
**Verified:** 2026-11-05
**Status:** human_needed (no gaps; remaining items are manual visual/a11y checks and the outstanding review gate)
**Re-verification:** No, initial verification
**Fixed point for diff:** `8897b40..HEAD` (79 files, apps and packages)

## Summary

Every roadmap success criterion and every CAP requirement is backed by code I read and by tests I ran myself. The SUMMARY claims held up. I found no BLOCKER and no stub. The only open items are manual UI checks and the review gate that 06-VALIDATION.md already lists as not done.

## Goal Achievement: Roadmap Success Criteria

| # | Success criterion | Status | Evidence |
|---|---|---|---|
| 1 | Owner/admin toggles four modules independently, scoped to one product/workspace; existing products keep all four on | VERIFIED | `packages/db/src/schema/tenancy.ts` adds four `boolean NOT NULL DEFAULT true` columns; `0013_product_features.sql` is plain `ADD COLUMN ... DEFAULT true NOT NULL` and is in `_journal.json` (idx 13). `products.controller.ts` PATCH (under `TenantGuard`, update `WHERE id = tenant.productId AND workspace_id = tenant.workspaceId`) maps only provided keys, so sibling keys are preserved. `ProductFeaturesSchema.partial()` is `.strict()`, so unknown keys are rejected. `packages/db/test/migrate.test.ts` migrates to 0012, inserts a product, upgrades, and asserts all four flags true and content unchanged (passed). |
| 2 | Disabled module is gone from navigation, directory, links and previews; direct URL or public API read/write returns not-found | VERIFIED | `PortalGuard` resolves the product row with `productFeatureColumns`, then `featureEnabled(features, setting)` or throws `not_found` 404. Every `@Controller("portal/...")` class is decorated with `@PortalFeature(board/roadmap/changelog/faq)` (votes, comments, mutes, posts, activity = board; roadmap; changelog; faq) and `PortalController` is the only `exempt` (branding metadata). A missing classification throws a server error (fail closed), exercised by `UnclassifiedProbeController` in the test log. Web pages (`roadmap`, `changelog`, `changelog/[slug]`, `faq`, `activity`, `p/[ref]`) check `features.*` first and `notFound()` before loading content or metadata. `public-product-features.test.ts` exercises all 16 flag combinations (passed). Browser test confirms 404 pages carry no leaked titles. |
| 3 | Landing uses first enabled module (Board, Roadmap, Changelog, FAQ); all-off shows neutral branded unavailable page | VERIFIED | `apps/web/lib/portal-features.ts` `landingHref` returns first of `portalTabs(...)` in D-13 order. `[product]/page.tsx`: Board off redirects (`redirect()`, 307) to `landingHref`; none left renders `StatePage` "Nothing is available here right now" inside `PortalFrame` with HTTP 200 and `robots: noindex` in `generateMetadata`. Layout passes `tabs` only when 2 or more tabs. Directory (`PortalController.getPortalDirectory`) still lists the product and links only to the root. Browser test "public landing chooses enabled modules and all-off keeps branding and directory" passed against the Docker stack. |
| 4 | Admins can view, edit and prepare content in a disabled module; re-enable restores content, links and relationships unchanged | VERIFIED | Admin routes are `TenantGuard`-only with no feature check: roadmap, changelog, faq, statuses, categories controllers, plus new `admin-posts` (create comment, patch, delete post, merge) and `admin-comments` (patch, delete, restore) routes. Dashboard Board actions go through `boardApiBase("dashboard", ...)` = `/workspaces/:ws/products/:product`; no `/api/v1/portal` call remains under `app/dashboard`. Disabling only flips a column and deletes derived unsent delivery state; posts, roadmap links, comments are untouched. `product-feature-projections.test.ts` re-asserts the same `roadmapItem` and `postCount` after re-enable. Browser test "hidden dashboard modules remain manageable" passed. |
| 5 | Customers are not notified about or linked to disabled content; suppressed notifications are not replayed on re-enable | VERIFIED | See CAP-07. Disable of Board deletes unread `notifications` and unsent comment email items in the same transaction as the flag update; fan-out and enqueue return early when Board is off; the email worker query has `eq(products.boardEnabled, true)`; in-app list and unread count filter on `boardEnabled`. `product-feature-delivery.test.ts` "never revives queued mail or unread notifications after disabling and re-enabling" passed. |
| 6 | Cross-tenant, bypass, migration-default, re-enable, public-roadmap-privacy tests pass | VERIFIED | Run by me, see Test Evidence. `cross-tenant.test.ts` registers the five new admin Board routes and keeps its route-set-equality check. `canary-roadmap-leak.test.ts` and the projection tests pass. |

**Score:** 6/6 truths verified. 0 present-but-behavior-unverified: the one behavior-dependent invariant (disable serialized against in-flight delivery) has a passing named test that holds real transactions open and checks `pg_stat_activity` for the lock wait.

## Requirements Coverage (CAP-01 to CAP-09)

| Req | Status | Evidence |
|---|---|---|
| CAP-01 independent per-product toggles, workspace-scoped | VERIFIED | Columns + strict partial PATCH under `TenantGuard`; `product-features.test.ts` covers round-trip, invalid/unknown keys unchanged, customers denied, foreign workspace denied, concurrent distinct keys merge. Settings form PATCHes only `{ features }`; browser tests for save, reload, stale-key, and refresh sync pass. |
| CAP-02 defaults on upgrade; toggling preserves data; re-enable restores | VERIFIED | Migration default test (real upgrade from 0012); projection and delivery tests assert identical data after re-enable. |
| CAP-03 disabled modules reject public reads/writes and direct URLs, enforced by the API | VERIFIED | `PortalGuard` + `@PortalFeature`; fail-closed classification; 16-combination test; Board write/activity denial test asserts no row changes. |
| CAP-04 admins keep private management without weakening auth/tenant guards | VERIFIED | Admin routes use `TenantGuard` (session required, membership, suspended/deleted checks, product scoped to workspace). Services filter by `portal.productId` (e.g. `updateComment`/`deleteComment` join `posts.productId`). `admin-board-features.test.ts` denies customers, anonymous and another tenant. |
| CAP-05 navigation, directory and landing honor modules incl. standalone and all-off | VERIFIED | `portalTabs`/`landingHref`/`portalDescription` unit tests (web 154 passed); layout hides single-tab bar; browser landing test. |
| CAP-06 no disabled-module content in cross-links, previews, nested projections; relationships survive | VERIFIED | Post page: `getPostPage(..., {kind:"public", features})` forces the roadmap join to `false` and nulls `roadmapItem` when Roadmap is off (admin projection unchanged). Roadmap list/detail: `postCount` is `0` and `linkedPosts` is `[]` when Board is off. `PortalController.getPortalProduct`: categories empty when Board off; statuses limited to roadmap statuses and `isPublicRoadmap` forced false when Roadmap off. Unsubscribe returns `{live:true,title:null,url:null}` when Board is off. FAQ CTA, roadmap empty state and LinkedRoadmapBanner react to the flags. Projection tests and browser "nested links" test pass. |
| CAP-07 delivery re-checks availability and suppresses links into disabled modules | VERIFIED | Four layers confirmed in code: (1) enqueue `SELECT ... board_enabled ... FOR SHARE OF pr` in `outbox.ts`; (2) same `FOR SHARE` gate in `NotificationsService.fanOutStatusChange`; (3) PATCH disable deletes unread notifications and pending/retrying/sending comment email items atomically; (4) worker item query joins `boardEnabled = true` at send time and cancels a batch with no remaining items. In-app `visible()` also filters `boardEnabled`. Race test (notification and email) passed. |
| CAP-08 cross-tenant, bypass, migration, re-enable, roadmap-privacy tests | VERIFIED | All present and passing (serial API run 492/492 on two of three runs, see Test Evidence). |
| CAP-09 one reusable capability policy composing with existing authorization | VERIFIED | `apps/api/src/portal/product-features.ts` exports `PortalFeature`, `productFeatureColumns`, `pickFeatures` and the pure `featureEnabled(features, setting)`, used by the guard, projections, notification service and worker. Composes with `PortalGuard` (suspended/deleted checks retained) and does not replace `TenantGuard`. |

No orphaned requirements: REQUIREMENTS.md maps CAP-01..09 to Phase 6 and all nine appear in plan frontmatter.

## Required Artifacts and Wiring

| Artifact | Status | Details |
|---|---|---|
| `packages/db/migrations/0013_product_features.sql` + snapshot + journal | VERIFIED | Four NOT NULL DEFAULT true columns; journal idx 13 present |
| `packages/types/src/tenancy.ts` `ProductFeaturesSchema`, `PRODUCT_FEATURE_KEYS` | VERIFIED | Required (not optional) `features` on `PublicPortalProduct`, `ProductSummary`, `ProductDetail`: a consumer cannot fail open |
| `apps/api/src/portal/product-features.ts`, `portal.guard.ts` | VERIFIED | Wired into all 8 portal controllers |
| `admin-posts.controller.ts`, `admin-comments.controller.ts` | VERIFIED | Registered, tenant-scoped, covered in cross-tenant matrix |
| `products.controller.ts` PATCH with transactional cleanup | VERIFIED | Cleanup scoped by product and workspace |
| `apps/web/lib/portal-features.ts`, `portal-tabs.tsx`, `[product]/page.tsx`, `layout.tsx` | VERIFIED | Used by layout, board page, tests |
| `product-features-form.tsx`, `hidden-module-notice.tsx`, `sidebar.tsx` | VERIFIED | Notice on Board list/detail, Roadmap, Changelog list/new/edit, FAQ. Categories is a redirect into the Board categories tab, which inherits the notice (documented in 06-09-SUMMARY) |

## Data-Flow Trace (Level 4)

| Value | Source | Real data | Status |
|---|---|---|---|
| `features` on portal/admin payloads | `products.*_enabled` columns through `pickFeatures` | Yes | FLOWING |
| `postCount` / linked posts on public roadmap | SQL count over `posts` gated on `features.board` | Yes when Board on, deliberate `0`/`[]` when off | FLOWING |
| `roadmapItem` on public post page | roadmap join gated on `features.roadmap` | Yes | FLOWING |
| Unread badge / notification list | `notifications` joined to `products.boardEnabled` | Yes | FLOWING |

## Behavioral Spot-Checks and Test Evidence (run by me, 2026-11-05)

Environment: colima running, `compose.dev.yaml` Postgres on 5432, Docker stack on 8080/5433, `bun run build:packages` first. No application code modified. `bun test` never used.

| Check | Command | Result |
|---|---|---|
| API full suite, serial, run 1 | `bun run test -- --no-file-parallelism` (in `apps/api`), while I was also running web tests | 491 of 492; one failure `public-product-features.test.ts` "keeps admin comment management usable..." with `Parse Error: Expected HTTP/, RTSP/ or ICE/` (the known socket cross-talk signature). File re-run alone: 17/17 pass. |
| API full suite, serial, run 2 | same | 43 files, 492/492 tests pass. Process exit 1 from 2 vitest "unhandled errors" (`terminating connection due to administrator command`, pg 57P01) attributed to `test/votes.test.ts` teardown, a file Phase 6 did not touch. |
| API full suite, serial, run 3 | same | 43 files, 492/492 pass, exit 0 |
| Web tests | `bun run test` (in `apps/web`) | 20 files, 154 passed |
| Types and db tests | `bun run test` in each | types 32 passed; db 5 passed (includes upgrade-defaults test) |
| Typecheck | `bun run typecheck` | exit 0 for all 4 packages |
| Browser, feature spec | `bun run test:browser -- test/browser/product-features.spec.ts` | 8/8 passed against the Docker stack |
| Browser, full suite | `bun run test:browser` | 17 passed, 2 failed (both known-unrelated, below) |
| Debt markers | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in the Phase 6 diff | none |

## Known-Unrelated Failures (not Phase 6 gaps)

1. `apps/api/test/browser/portal-branding.spec.ts` "OG and favicon metadata backstop" expects `og:title` "Sunny" but the layout has emitted `${product} · ${workspace}` since before the fixed point. I confirmed `const title = \`${p.name} · ${workspace.name}\`` exists at `8897b40` and the Phase 6 layout diff does not touch it. Stale test.
2. `apps/api/test/browser/dashboard-header.spec.ts` "320px dashboard header fits one line" looks for a text wordmark; the brand became an `<img aria-label>` in `0078f0a`. Stale test.
3. Parallel API suite flakiness (random 401/404 and `Parse Error: Expected HTTP/`). Reproduced once in this verification (serial run 1, with another test process running at the same moment), 0 of 2 clean serial reruns. `bun run ci:check` will therefore not be reliably green until the runner is fixed or serialized. Documented in `deferred-items.md`; not caused by Phase 6.
4. `votes.test.ts` pg 57P01 unhandled errors on teardown can make vitest exit non-zero even with all tests passing. Pre-existing file, untouched by Phase 6.

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `packages/db/src/schema/tenancy.ts`, `packages/types/src/tenancy.ts`, `packages/db/test/migrate.test.ts` | Unrelated Prettier reformatting mixed into the feature diff (trailing commas, line wraps) | Info | Noisier review diff; no behavior change |
| UI-SPEC Surface 6, "concurrency" row | Two admins saving different modules: no "changed by someone else" message | Info | Accepted as unresolved in UI-SPEC; API merge-by-key prevents data clobbering and a test covers it |
| `NotificationsService.markRead` with no ids | Marks hidden-module rows read too | Info | Harmless; rows are already invisible and unread ones are deleted on disable |

No stubs, hollow props, static fallbacks, or fail-open defaults found in the Phase 6 paths.

## Residual Risks (non-blocking)

- Read notifications from before a Board disable are intentionally kept (read history survives), so they reappear in the list after re-enable. Unread ones and queued mail do not (D-14/D-16). This matches the stated design and test "preserves read history".
- An email already handed to SMTP before a concurrent disable cannot be recalled. The worker re-checks immediately before send, so the window is a single send attempt.

## Human Verification Required

### 1. Screen-reader and keyboard walkthrough
**Test:** Settings > Portal features and the dashboard sidebar with a module off, using a screen reader.
**Expected:** Checkbox names and descriptions announced; "Hidden from customers" read for sidebar links; visible focus ring; focus returns to Save after the dialog.
**Why human:** UI-SPEC marks the a11y label check as a manual backstop. Playwright covers keyboard operation only.

### 2. Visual review of unavailable page, notice and settings at 320/375/768px
**Test:** Look at the all-off portal page, a hidden-module dashboard notice and the settings form on real viewports.
**Expected:** Branded neutral page without tabs; notice stacks; no horizontal scroll; copy matches the contract.
**Why human:** Visual quality is not provable from DOM assertions.

### 3. Review gate
**Test:** Complete the Matt code review and GSD security/UI review listed as outstanding in 06-VALIDATION.md.
**Why human:** Process gate. After sign-off the orchestrator should check CAP-01..09 in REQUIREMENTS.md and the Phase 6 box in ROADMAP.md (both still unchecked).

## Gaps Summary

None. No truth failed, no artifact is missing or stubbed, no key link is broken. Status is `human_needed` solely because of the manual UI/a11y checks and the pending review gate above.

---

_Verified: 2026-11-05_
_Verifier: Claude (gsd-verifier)_
