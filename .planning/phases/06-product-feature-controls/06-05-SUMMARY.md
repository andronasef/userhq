---
phase: 06-product-feature-controls
plan: "05"
subsystem: public-projection-privacy
tags: [nestjs, drizzle, http-tests, product-features, unsubscribe]
status: complete
requires: [06-04]
provides: [feature-aware-linked-content, feature-aware-portal-metadata, hidden-board-unsubscribe]
affects: [06-07, 06-08, 06-09, 06-10]
tech-stack:
  added: []
  patterns: [explicit public projection context, conditional related-content queries]
key-files:
  created:
    - apps/api/test/product-feature-projections.test.ts
  modified:
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/portal-posts.controller.ts
    - apps/api/src/roadmap/portal-roadmap.controller.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/api/src/email/unsubscribe.controller.ts
    - apps/api/test/unsubscribe.test.ts
key-decisions:
  - Public post detail explicitly supplies feature projection context; admin detail retains its existing linked Roadmap presentation.
  - Roadmap list counts use a product-scoped correlated count only with Board enabled; disabled Board queries contain no posts join or count subquery.
  - Hidden Board leaves token-scoped posts live for mute/unmute but removes their title and URL from every unsubscribe response.
requirements-completed: [CAP-02, CAP-06, CAP-08]
duration: 5 min
completed: 2026-11-05
actuals:
  tokens: 4293
  tasks: 2
  commits: 9
plan_head_before: ecbf1feb6ce6d40afaac583afd7d9dd84f4e3c95
plan_head_after: fc282dfd4d7002d7550bc94b3190dd37dab435bf
---

# Phase 6 Plan 05: Public projection privacy Summary

Enabled modules no longer expose linked data from disabled Board or Roadmap modules; metadata and unsubscribe responses obey the same visibility choices without deleting source content or relationships.

## Changes

- Public request detail returns `roadmapItem: null` with Roadmap off, including for owner sessions on public URLs. Its Roadmap join cannot return the hidden title. Admin detail retains the link.
- Public Roadmap list reports zero linked requests with Board off and does not query posts; detail skips its linked-post query and returns an empty posts array and zero count. Re-enable returns identical saved links, titles and votes.
- Public metadata omits Board categories with Board off. Statuses are all available with Board on, limited to public Roadmap columns with only Roadmap on, and empty with both off. Returned statuses have `isPublicRoadmap: false` while Roadmap is off; persisted flags are unchanged. Branding remains available.
- Valid unsubscribe tokens still perform GET, mute and unmute with Board off; responses contain null request title/URL. Re-enable restores the original title and permalink with the correct subscription state.

## Commits and RED/GREEN evidence

| Slice | RED | GREEN |
|---|---|---|
| Request → Roadmap projection | `1624207`: expected null, received ROADMAP_TITLE_CANARY | `f77bf20` |
| Roadmap → Board projection | `8b674ff`: expected zero linked requests, received one | `e00acd3` |
| Metadata categories/statuses | `6975c72`: expected empty categories, received BOARD_CATEGORY_CANARY | `37c2292` |
| Unsubscribe token presentation | `1fa1fe2`: expected null title/URL, received hidden request details | `e3852e5` |

`fc282df` only improves line wrapping in the projection parameter and count SQL. The ledger records nine implementation/test/style commits; this final summary commit is excluded from measured actuals.

## Verification

- Task 1: `bun run --filter @userhq/api test -- test/product-feature-projections.test.ts test/canary-roadmap-leak.test.ts test/portal-roadmap.test.ts`: **3 files, 12 passed**, exit 0. Tracer feedback rerun: **12 passed**, exit 0.
- Metadata slice: projection and portal suites **13 passed**, exit 0.
- Task 2: `bun run --filter @userhq/api test -- test/product-feature-projections.test.ts test/unsubscribe.test.ts test/public-contract.test.ts`: **3 files, 23 passed**, exit 0.
- Final combined run added canary, Roadmap, portal, portal isolation, posts and admin Board suites: **9 files, 57 passed**, exit 0.
- API typecheck: exit 0. `git diff --check`: exit 0.
- Tests exercised real Nest HTTP interfaces and fixture-created migrated local PostgreSQL databases. No skipped tests, dependency installation, schema changes, Docker rebuild or production access.

The contract suite intentionally logs its unclassified-probe 500. The combined test run also emitted existing Node MaxListeners warnings while exiting 0; no assertions failed.

## Deviations from Plan

None in behavior or scope. Task 1 and Task 2 each used two vertical RED/GREEN slices so each distinct exposure was demonstrated before its fix. The list endpoint uses a conditional product-scoped count subquery in place of the prior posts join/grouping, ensuring no Board query is generated when it is disabled.

## Known Stubs

None. Empty linked-post/category/status arrays and null previews are intentional projections of disabled modules, not placeholders. The saved content and relationships are proven to return through HTTP after re-enable.

## Threat review

No new endpoint, auth path, dependency or schema surface. Queries use guard-resolved product IDs; public Roadmap still never joins internal planning fields, and existing canary/tenant-isolation tests pass. Unsubscribe token verification and expiry behavior are unchanged.

## Remaining risks

Portal navigation/pages, complete settings UI and hidden-module admin notices remain later plans. Global STATE/ROADMAP are parent-owned and were not edited here. Final Docker acceptance and independent phase reviews are still required.

## Self-Check: PASSED

All seven changed source/test files and this summary exist. All nine listed commits are ancestors of HEAD. Both declared verification commands executed with nonzero test counts and final exit 0.
