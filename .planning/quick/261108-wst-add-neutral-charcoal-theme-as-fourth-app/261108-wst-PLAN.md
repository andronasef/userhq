---
phase: quick-261108-wst
plan: 01
type: execute
autonomous: true
status: in-progress
requirements: [D-01]
---

# Complete verification of the fourth appearance option

The user requested a neutral near-black Charcoal theme alongside System, Light and the existing navy Dark. A previous provider implemented changes in the working tree and reported passing tests, but did not persist the original plan or commit the implementation. This continuation records a completion plan; it does not claim that historical RED-first evidence exists.

## Task 1 — Inspect and verify the existing implementation

Check stored preference recognition, resolved theme, pre-hydration script, root classes and color scheme, selection controls, explicit preference behavior on OS changes, CSS palette, and product-accent contrast. Run the focused theme, toggle and accent suites plus web typechecking. Do not change unrelated work. Report gaps to the parent before code changes. After the initial report, the parent explicitly authorized a two-file policy correction: include Navy Dark and Charcoal base/tinted surfaces in the shared dark-accent calculation, and extend the existing palette regression to all three themes. Preserve current tested palette outputs.

Acceptance: the focused suites and typecheck pass; Charcoal preserves both dark variants and its neutral palette; coverage and limits are described accurately rather than inferred from the previous provider's response.

## Task 2 — Record the completion checkpoint

Write a summary with directly observed results, source review and historical browser evidence limitations. The parent owns the combined browser verification, code changes, changelog/user guide updates, review, STATE bookkeeping and final scoped commit. Do not commit on protected main from this executor; do not switch the shared branch, modify configuration, push, deploy, move tags, add dependencies or touch the unrelated calibration artifact.

## Verification

`bun run --filter @userhq/web test test/theme.test.ts test/theme-toggle.test.tsx test/accent.test.ts`

`bun run --filter @userhq/web typecheck`

No browser stack run is delegated here: the parent will verify the combined appearance/post-link changes once.
