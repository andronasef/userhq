---
phase: quick-261108-wst
plan: 01
subsystem: appearance
tags: [themes, charcoal, accessibility]
status: in-progress
checkpoint: parent-review-and-commit
verified-date: 2026-11-09
requires:
  - phase: quick-261107-2el
    provides: Stored theme preference and first-paint theme initialization
provides:
  - Verification of the existing fourth-theme implementation
affects: [dashboard, public-portals, product-branding]
tech-stack:
  added: []
  patterns: [Charcoal adds dark and charcoal root classes]
key-files:
  created: []
  modified: [apps/web/lib/theme.ts, apps/web/lib/accent.ts, apps/web/app/globals.css, apps/web/components/theme-toggle.tsx, apps/web/components/user-menu.tsx, apps/web/app/(app)/account/page.tsx, apps/web/test/theme.test.ts, apps/web/test/theme-toggle.test.tsx, apps/web/test/accent.test.ts, apps/api/test/browser/appearance.spec.ts]
---

# Charcoal theme verification checkpoint

**The existing Charcoal implementation passes its 94 focused tests and web typechecking; all tested product accents clear 4.5:1 across Charcoal base and tinted surfaces.**

## Continuation scope

A previous provider left the implementation uncommitted and reported full repository and browser verification. The original plan was not on disk. This continuation wrote a completion plan before writing this checkpoint, inspected the implementation and ran focused verification. It did not reconstruct historical RED-first provenance or claim the previous provider's browser run as newly observed evidence.

The parent owns the combined browser verification, changelog/user-guide corrections, independent review, STATE bookkeeping and final scoped commits. After the initial inspection, the parent explicitly authorized this executor to update only `accent.ts` and `accent.test.ts` so the shared dark accent policy covers both dark palettes. No other application file was edited by this executor. It did not switch the shared branch or commit on protected `main`.

## Directly observed verification

| Check | Result |
| --- | --- |
| `bun run --filter @userhq/web test test/theme.test.ts test/theme-toggle.test.tsx test/accent.test.ts` | 94 passed across three files; exit 0 |
| `bun run --filter @userhq/web typecheck` | Exit 0 |
| Focused diff whitespace check | Passed |
| Actual `accentTokens` values for 12 palette brands on three Charcoal surfaces and their 20% brand tints | 72 checks; minimum contrast 4.8103314997:1; no failures |
| Palette output comparison before/after explicit two-palette policy | All 12 brand token outputs unchanged |

Final focused logs: `/tmp/wst-focused-theme-final.log`, `/tmp/wst-web-types-final.log`. The expanded tint characterization already passed before the policy change (`/tmp/wst-charcoal-tint-characterization.log`); this is not claimed as a new RED failure. No worker caps, dependencies or production requests were involved.

## Source review

- Stored `charcoal` is recognized by both the runtime theme resolver and the pre-hydration script.
- Charcoal applies both `.dark` and `.charcoal`, sets CSS `color-scheme: dark`, and preserves its own `data-theme` preference. Switching to navy Dark removes `.charcoal`; switching to Light removes both classes.
- Explicit Charcoal remains Charcoal when the operating system preference changes. System retains the established navy Dark/Light resolution.
- The palette provides neutral near-black backgrounds, gray cards and muted surfaces, and light text while preserving the product accent mechanism.
- The shared dark accent token now explicitly checks Navy Dark and Charcoal page/card/muted surfaces and each 20% tint. The durable palette test exercises all six surfaces in each of the three resolved themes.
- ThemeToggle, the user-menu submenu and account appearance copy include the fourth option.

## Qualifications reported to the parent

- **Resolved with parent authorization:** inherited contrast outputs passed current Charcoal surfaces, but the generator's guarantee only named Navy Dark. The two-file policy correction explicitly includes both palettes and adds six-surface Charcoal coverage without changing the 12 tested brand outputs.
- The inherited changelog diff places Charcoal inside the already-published `v0.3.0` entry. The parent must move this addition to Unreleased rather than claim the historical tag contained it. The user-guide introduction also needs to distinguish the subsequent Charcoal addition from the v0.3.0 baseline.
- No new browser run was performed by this executor. The parent is coordinating one rebuilt-stack run for the combined appearance and post-link changes. Historical “5/5 browser tests” and “all repository tests passed” are previous-provider reports, not evidence re-observed here.

## Self-check

PLAN and SUMMARY exist. Only the two parent-authorized accent files and these planning artifacts were edited by this executor. STATE, tags, configuration, dependencies and unrelated calibration artifacts were untouched. Implementation remains uncommitted for the parent's coordinated commit; this checkpoint is intentionally not marked complete.
