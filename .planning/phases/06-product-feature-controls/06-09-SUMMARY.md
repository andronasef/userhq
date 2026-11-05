---
phase: 06-product-feature-controls
plan: "09"
subsystem: dashboard-feature-visibility
status: complete
tags: [dashboard, feature-controls, accessible-notices]
requires: [06-08]
provides: [hidden-module-notices, hidden-sidebar-state, conditional-public-preview-links]
affects: [06-10]
tech-stack:
  added: []
  patterns: [required capability props, shared module notice]
key-files:
  created:
    - apps/web/components/dashboard/hidden-module-notice.tsx
    - apps/web/test/dashboard-feature-controls.test.tsx
  modified:
    - apps/web/components/dashboard/sidebar.tsx
    - apps/web/components/dashboard/board-table.tsx
    - apps/web/components/post/post-actions-menu.tsx
    - apps/web/components/changelog/changelog-studio.tsx
    - apps/web/components/changelog/changelog-editor.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/board-view.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/[number]/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx
    - apps/web/app/dashboard/[ws]/[product]/roadmap/roadmap-view.tsx
    - apps/web/app/dashboard/[ws]/[product]/changelog/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/changelog/new/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/changelog/[id]/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/faq/page.tsx
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx
    - apps/web/test/changelog-admin.test.tsx
key-decisions:
  - Actual client header owners render notices directly below their headers; route loaders pass required saved capability props.
  - Categories retains its existing redirect to the Board categories tab and inherits the Board notice; shared Statuses stays undecorated.
  - Root View portal links stay available; disabled-module public permalink actions are omitted.
requirements-completed: []
duration: 5 min
completed: 2026-11-05
actuals:
  tokens: 6238
  tasks: 2
  commits: 4
plan_head_before: 0a9a75de8e0258a5c980c7d0c105fd1a76dba35d
plan_head_after: 57cb8afad03943b08145164ebc7a3a1259aaba2e
---

# Phase 6 Plan 09: Hidden modules remain manageable Summary

Dashboard pages keep private editing available while module-specific notices, accessible sidebar state and conditional public actions explain what customers cannot see.

## Task Commits

| Task | Commit | Result |
|---|---|---|
| 1 RED | `34e5521` | Existing sidebar retained module links but lacked hidden-state labels. |
| 1 GREEN | `75aa88b` | Shared notice, sidebar EyeOff/text/title, Board list/detail notices. |
| 2 RED | `ad77538` | Hidden Changelog studio/editor lacked the retained-content notice. |
| 2 GREEN | `57cb8af` | Changelog/Roadmap/FAQ notices, required capability propagation, disabled public preview suppression. |

## Verification

- Task 1 RED: dashboard component test failed because no hidden-state titles existed; GREEN **2/2 passed**.
- Task 1 `bun run --filter @userhq/web typecheck`: exit 0.
- Task 2 RED: authoring test failed because the notice was absent; existing **7 tests passed**, new test failed.
- Task 2 targeted dashboard/changelog/portal helper suite: **27/27 passed**.
- Final `bun run --filter @userhq/web typecheck`: exit 0.
- Final `bun run --filter @userhq/web test`: **154/154 passed across 20 files**, exit 0.
- Final `git diff --check`: exit 0.
- No Docker rebuild or browser run in this plan; final plan 10 owns actual browser acceptance and responsive verification.

## Deviations from Plan

1. **[Rule 2 — Required header/capability wiring]** Headers live in `RoadmapView`, `ChangelogStudio`, `ChangelogEditor` and `PostDetailView`, so notices were placed there instead of above the entire page. `BoardTable` and the public post-page caller mechanically propagate the now-required Board flag to `PostActionsMenu`. Parent approved these coupled files.
2. **[Scope preservation]** `categories/page.tsx` is only a redirect into the Board categories tab; its existing behavior stays intact and the target page provides the notice. Roadmap's shared Statuses tab remains undecorated as specified.
3. **[Source inventory]** `NewPostButton` in `post-form-dialog.tsx` has only public Board page callers; its login/create link cannot render when Board is disabled because that page is gated. No dashboard create control uses it. Dashboard post-edit already uses the private endpoint from 06-02, so no unnecessary change to that component was made. Board empty-state and sidebar View portal links target the product root and remain available per the UI contract.

One mechanical edit initially added a Board flag to `DeletedItems`; typechecking caught it and it was removed before the GREEN commit.

## Known Stubs

None. No new endpoint, authentication path, storage access, schema or dependency was introduced. Private edit/comment/delete/search routing from 06-02 is preserved; browser proof remains plan 10.

## Remaining Risks

- Static component tests prove notices and retained authoring. Dropdown interaction, all dashboard surfaces, narrow layouts and actual off/on editing journeys still need the final Docker browser matrix in 06-10.
- Global STATE/ROADMAP/requirements completion is parent-owned and was not changed here.

## Self-Check: PASSED

All created files exist; four task commits are ancestors of HEAD. Owned implementation and test changes are committed; final web tests/typecheck/diff checks passed.
