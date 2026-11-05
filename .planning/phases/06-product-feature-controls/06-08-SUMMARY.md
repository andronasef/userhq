---
phase: 06-product-feature-controls
plan: "08"
subsystem: product-settings-web
status: complete
tags: [react-hook-form, product-features, confirmation, browser]
requires: [06-02, 06-06, 06-07]
provides: [independent-feature-settings-form, dirty-key-save, feature-confirmation-states]
affects: [06-09, 06-10]
tech-stack:
  added: []
  patterns: [dedicated form mutation, dirty-key-only feature patch, disabled-until-hydrated controls]
key-files:
  created:
    - apps/web/app/dashboard/[ws]/[product]/settings/product-features-form.tsx
  modified:
    - apps/web/app/dashboard/[ws]/[product]/settings/product-general-form.tsx
    - apps/web/app/dashboard/[ws]/[product]/settings/page.tsx
    - apps/api/test/browser/product-features.spec.ts
key-decisions:
  - General settings no longer includes feature fields; the dedicated form sends only dirty feature keys.
  - Feature controls remain disabled until hydration attaches handlers, preventing lost early checkbox interactions.
  - Existing shared errorCopy and ConfirmDialog error presentation are reused.
requirements-completed: []
duration: 17 min
completed: 2026-11-05
actuals:
  tokens: 6519
  tasks: 1
  commits: 6
plan_head_before: dd61a9bab8898584cd1760eafa32004e1adfd148
plan_head_after: ea93f8a0406c927d6e3b6960ed3a34279ef3e12d
---

# Phase 6 Plan 08: Independent portal feature settings Summary

Owners/admins can save Board, Roadmap, Changelog and FAQ independently through a dedicated Portal features form, with disable confirmations, saved-state badges and recoverable failures.

## Task Commits

| Commit | Result |
|---|---|
| `e2fdd40` | RED: dedicated section, feature labels and save action expected at the browser seam. |
| `b3170c5` | Dedicated four-checkbox form; removed feature payload from General settings; confirmation variants and changed-key-only PATCH. |
| `5bb8b0f` | Keyboard/cancel/all-off, pending/error/retry and stale disjoint-key browser coverage. |
| `253593a` | RED: successful retry must clear the prior error; readiness and modal DOM assertions corrected. |
| `e33ba8a` | Hydration guard and successful-retry error reset. |
| `ea93f8a` | Removed stale native defaultChecked competing with react-hook-form reset. |

## Verification

- Initial browser attempt failed because Colima was stopped; this was infrastructure failure, not behavioral RED. Started Colima and the existing local stack.
- Behavioral tracer RED: expected Portal features heading visible, but it did not exist; exit 1.
- Tracer GREEN on rebuilt Docker images: **1/1 passed**, exit 0.
- Expanded browser run exposed lost pre-hydration input; controls now stay disabled until mounted. The browser fixture waits for the saved initial checked/enabled state, rather than assuming server HTML is interactive.
- Error/retry RED: error alert remained after a successful retry. Success now clears it.
- Stale-key regression exposed a native defaultChecked value overriding the reset response. Removing that competing source passed the focused test **1/1**.
- Final `bun run --filter @userhq/api test:browser -- test/browser/product-features.spec.ts`: **4/4 passed**, exit 0. This also reruns the tracer end to end.
- Final `bun run --filter @userhq/web typecheck`: exit 0.
- `git diff --check`: exit 0.
- Local Node 24 Docker images rebuilt with `docker compose -f compose.yaml -f compose.local.yaml --env-file .env.docker up -d --build --wait`; API/web/Postgres/Caddy healthy.

The four browser cases prove reload persistence, keyboard toggle, cancel with no write, one/multiple/all-off confirmation copy, notification note, saved badges, pending disabled controls and blocked dismissal, retained failed input, successful retry/error clear, exact partial PATCH payload, another admin's unrelated FAQ change preserved, and direct enable-only save without confirmation.

## Deviations from Plan

1. **[Rule 3 — Infrastructure]** Colima was stopped at resume; started the existing local runtime/stack. No dependency or infrastructure definition changed.
2. **[Rule 1 — Lost early interaction]** Added a hydration readiness guard after real keyboard/checkbox actions were overwritten before handlers attached. The fieldset is disabled until mounted; no arbitrary delay or retry was added.
3. **[Rule 1 — Retry error]** Cleared the retained form error after a successful dialog retry.
4. **[Rule 1 — Competing default]** Removed an intermediate native defaultChecked prop after the stale-admin test showed it overriding the returned form reset. react-hook-form owns checkbox values throughout.

## Known Stubs

None. All form actions use the existing real product PATCH endpoint and ProductDetail response schema. No new dependency, endpoint, authentication path or schema was introduced.

## Remaining Review Notes

The UI contract's proposed generic fallback sentence differs from the repository's existing shared `errorCopy` fallback. This plan follows its explicit instruction to use shared `errorCopy`, including in ConfirmDialog; mapped errors are verified in both places. No global error-copy change was made. Full dashboard notices, responsive/browser matrices and independent phase reviews remain plans 09/10 and orchestrator scope.

Global STATE/ROADMAP and requirement completion remain parent-owned.

## Self-Check: PASSED

All four owned files exist; six task commits are ancestors of HEAD. Owned changes are committed and the final browser/typecheck/diff checks passed.
