---
phase: quick-261107-2el
plan: 01
subsystem: web-theming
tags: [dark-mode, accent, contrast, theme, playwright]
requires: []
provides:
  - dual-variant --primary-text (light-dark pair) meeting 4.5:1 in both themes
  - single first-paint theme script (THEME_INIT_SCRIPT)
  - document-derived ThemeProvider
affects: [apps/web portal theming, product branding preview]
key-files:
  created:
    - apps/web/test/accent.test.ts
  modified:
    - apps/web/lib/accent.ts
    - apps/web/lib/theme.ts
    - apps/web/app/layout.tsx
    - apps/web/components/theme-provider.tsx
    - apps/web/app/dashboard/[ws]/[product]/settings/product-branding-form.tsx
    - apps/web/test/theme.test.ts
    - apps/web/lib/accent.test.ts
    - apps/api/test/browser/appearance.spec.ts
decisions:
  - Dropped the userhq_theme cookie; localStorage is the only store.
  - Muted surface excluded from the 4.5:1 guarantee (page background and card only).
metrics:
  tasks: 3
  completed: 2026-11-07
status: complete
commits: 6
plan_head_before: 38d5f4054a66cb1b876162087ba60dbe54e305f9
plan_head_after: 02e23fe343d4ee56e8278645f1e9d95b6699fe5f
actuals:
  tokens: 40000
  tasks: 3
  commits: 6
---

# Phase quick-261107-2el Plan 01: Dark-mode accent contrast and theme infrastructure Summary

Portal accent text is now a `light-dark(lightValue, darkValue)` pair that meets 4.5:1 on page background and card in both themes for every brand colour, and the theme machinery has one first-paint script, one store, and a provider derived from the document.

## Commits

| Commit | Type | Description |
| --- | --- | --- |
| 1accbf2 | test | RED: accent contrast matrix, drift guard (19 of 44 failing) |
| 8a375f6 | fix | GREEN: primaryTextDark, ACCENT_SURFACES, light-dark() pair, branding preview via accentStyle |
| ac77f2d | test | RED: first-paint script matrix, document preference, no cookie (12 of 16 failing) |
| 8505763 | fix | GREEN: THEME_INIT_SCRIPT, cookie removed, layout-effect provider, reapplyDocumentTheme |
| edd58c7 | test | Playwright cases (system change, head-script first paint, accent contrast) |
| 02e23fe | test | Update legacy `lib/accent.test.ts` to the new token contract (deviation below) |

## RED / GREEN evidence

- Task 1 RED: `bun run --filter @userhq/web test test/accent.test.ts` gave 19 failed, 25 passed (primaryTextDark / ACCENT_SURFACES undefined, `accentStyle` returned `#2563EB`, not a pair). GREEN: accent.test.ts, portal-accent.test.tsx, product-branding-form.test.tsx 50 passed; typecheck 0.
- Task 1 drift guard check: altering `#F6F8F7` to `#F6F8F8` in ACCENT_SURFACES made exactly the drift test fail; restored.
- Task 2 RED: theme.test.ts gave 12 failed, 4 passed (new exports missing, script undefined). GREEN: theme.test.ts, theme-toggle.test.tsx, accent.test.ts 62 passed; typecheck 0.
- Acceptance greps (no COOKIE or document.cookie in theme.ts / layout.tsx, no localStorage in layout.tsx, no getStoredThemePreference in the provider, `light-dark(` present in accent.ts, hand-built style gone from the branding form) all pass. portal-frame.tsx untouched.

## Browser run (executed)

Docker was down; started with `colima start`. Rebuilt with a throwaway VAPID pair exported in the same shell as `bun run stack:up` (`.env.docker` not read or edited). Then `bun run test:browser appearance.spec.ts` in apps/api:

**5 passed, 0 failed** (the two existing tests plus: "System follows the OS scheme live; an explicit choice is not overridden", "stored dark is painted by the head script alone (no app scripts)", "accent link text meets 4.5:1 on page and card in light and dark"). No unrelated failures, no smoke-database drift this time.

These three cases verify the GREEN state and were not written RED-first; the RED evidence for every behaviour change lives in the unit tests above. The provider wiring (layout-effect timing, live listener) is only covered by these browser cases because the web vitest environment is node-only.

## CI gate

`bun run build:packages` then `bun run ci:check`: **exit 0** (lint, typecheck, builds, tests: types 32, db 6, api 672, web 260 passed, web build and build:next, db:check "Everything's fine").

## Deviations from Plan

**1. [Rule 1 - Bug] Legacy `apps/web/lib/accent.test.ts` asserted the old token shape**
- **Found during:** Task 3 first `ci:check` run (3 failures: `toEqual` on tokens without `primaryTextDark`, and `--primary-text` as a plain hex).
- **Fix:** switched the two token assertions to `toMatchObject` and the style assertion to the `light-dark(...)` pair; no behavioural assertion weakened. The file was not in the plan's `files_modified`, and the Task 1 verify did not run it.
- **Commit:** 02e23fe

Otherwise the plan was executed as written.

## Decisions

- Cookie dropped (nothing server-side read it; a second store could disagree with storage and caused the flash). Stale cookies expire on their own.
- Muted surface excluded from the contrast guarantee so the default accent's light link text does not flip to near-black.

## Residual items (not in this plan)

- Raw `text-primary`, `ring-primary` and `--ring` focus outlines still render the brand colour itself.
- Text on `bg-muted` chips is not covered by the 4.5:1 guarantee.
- Browsers without `light-dark()` (pre-2024) drop `--primary-text` to the inherited foreground colour, which stays legible.
- A custom admin-chosen button text colour is honoured as-is (the branding form warns below 3:1).

## Known Stubs

None.

## Threat Flags

None. All values interpolated into the light-dark pair are validated `#RRGGBB` (T-2EL-01); the script accepts only the three preference values (T-2EL-02); it is a static string plus the JSON-encoded storage key (T-2EL-03); contrast is asserted over the real palette with a drift guard (T-2EL-04).

## Self-Check: PASSED

All 6 commits are ancestors of HEAD; created/modified files exist; `git status` shows only the untracked planning directory.
