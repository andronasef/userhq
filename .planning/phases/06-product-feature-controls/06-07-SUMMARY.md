---
phase: 06-product-feature-controls
plan: "07"
subsystem: portal-web
status: complete
tags: [portal, capabilities, metadata, nextjs, react]
requires: [06-05]
provides: [feature-aware-portal-landing, public-page-denial, independent-module-ui]
affects: [06-08, 06-09, 06-10]
tech-stack:
  added: []
  patterns: [required feature props, pure portal composition helpers, availability before content loading]
key-files:
  created:
    - apps/web/lib/portal-features.ts
    - apps/web/lib/portal-features.test.ts
  modified:
    - apps/web/components/portal/portal-tabs.tsx
    - apps/web/app/[ws]/[product]/layout.tsx
    - apps/web/app/[ws]/[product]/page.tsx
    - apps/web/app/[ws]/[product]/roadmap/page.tsx
    - apps/web/app/[ws]/[product]/roadmap/public-roadmap-view.tsx
    - apps/web/app/[ws]/[product]/changelog/page.tsx
    - apps/web/app/[ws]/[product]/changelog/[slug]/page.tsx
    - apps/web/app/[ws]/[product]/faq/page.tsx
    - apps/web/app/[ws]/[product]/activity/page.tsx
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx
    - apps/web/components/faq/faq-portal.tsx
    - apps/web/components/faq/faq-not-found-prompt.tsx
    - apps/web/components/roadmap/public-roadmap-board.tsx
    - apps/web/test/faq-portal.test.tsx
key-decisions:
  - Product availability is checked before fetching module content, including metadata and canonical post redirects.
  - Portal tabs require ProductFeatures; the layout omits the entire tab wrapper for fewer than two visible tabs.
  - Existing null linked-roadmap banner and zero post-count rendering already satisfy suppressed API projections; no redundant changes.
requirements-completed: []
duration: 5 min
completed: 2026-11-05
actuals:
  tokens: 7658
  tasks: 3
  commits: 5
plan_head_before: da1b7dd1fdb7072c90c854cef98266d4ce05446d
plan_head_after: 04d72dc5e3a756386afcd8ecdc31c31c973b4484
---

# Phase 6 Plan 07: Feature-aware public portal Summary

The portal uses Board → Roadmap → Changelog → FAQ landing order, retains the branded neutral all-off page, and removes disabled module navigation, metadata and cross-links.

## Task Commits

| Task | Commits | Result |
|---|---|---|
| 1 | `0d1a912`, `c100682` | Pure helpers cover all sixteen combinations; root redirects only when Board is off; no modules renders the approved neutral state with noindex/nofollow; tabs and descriptions reflect features. |
| 2 | `dd15e8b` | Six direct module/permalink routes check feature metadata before content fetch and use notFound; disabled generateMetadata returns no module copy. API 404 is never converted into an empty successful page. |
| 3 | `ed30556`, `04d72dc` | FAQ feedback actions/prompts and Roadmap empty-state CTA disappear with Board off; neutral search guidance remains. Board availability is a required prop. |

## Verification

- Initial helper test import failed because the new module did not exist; this was not accepted as behavioral RED. Extracted the existing all-on behavior into the helper seam, then observed **16 failed / 1 passed** for availability behavior before implementing it.
- Helper GREEN: **17/17 passed**. Tracer rerun: **17/17 passed**.
- Cross-link RED: **4 failed / 13 passed**, exposing FAQ empty/list/search prompts and Roadmap feedback CTA with Board off.
- Combined helper/component GREEN: **34/34 passed**.
- Full web regression: **19 files / 151 tests passed**, exit 0.
- Web typecheck after each task and final wiring: exit 0.
- `git diff --check`: passed.
- Real HTTP status assertions (307 fallback, 404 deep links, all-off 200) remain the planned final Docker browser acceptance in 06-10; no browser result is claimed here.

## Deviations from Plan

1. **[Rule 3 — Blocking] Required prop propagation:** added the mechanically coupled `roadmap/public-roadmap-view.tsx` to forward Board availability from the page to `PublicRoadmapBoard`. No new behavior beyond the plan.
2. Task 2 uses its declared typecheck/helper verification; real page status tests are assigned to 06-10. No artificial failing page test was created at a new unapproved seam.
3. `LinkedRoadmapBanner` already returns null for absent roadmap data, and Roadmap cards/modal already omit linked content for zero counts/empty arrays. Existing implementation was retained and null-banner behavior was regression-tested.

## Known Stubs

None. The all-off state is deliberate product behavior. No new endpoint, dependency, auth flow, storage, or schema surface was added.

## Remaining Risks

Actual vinext HTTP status and metadata rendering require the final Docker browser suite. Directory/root routing was preserved unchanged, including all-off directory entries. Global tracking and requirement completion remain orchestrator-owned.

## Self-Check: PASSED

All created files exist. Five task commits are ancestors of HEAD. Owned source changes are committed; concurrent API test diagnostics were left untouched.
