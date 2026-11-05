# Phase 6 — Matt Standards Review

Reviewed HEAD: `fcd944bd2574c532fd4dcf89cc5f6fda2977b6f3`.
Fixed point: `8897b404dd4ec8fb1082affe62ccccb03ea23686`.
Scope: `git diff 8897b40...HEAD`; fixed point resolved, diff was nonempty, and `git log 8897b40..HEAD --oneline` was inspected. Concurrent final acceptance work is excluded until committed and reviewed.

Standards sources: `AGENTS.md`, its mirrored `.claude/CLAUDE.md`, `README.md`, `GLOSSARY.md`, and Phase 6 `06-PATTERNS.md` / `06-RESEARCH.md`. No `CODING_STANDARDS.md`, `CONTRIBUTING.md`, or project skill indexes were found. Tool-enforced rules were excluded from findings.

## Documented violations

None found in the reviewed changes. Thin admin controller adapters and explicit public column allowlists follow documented project guidance; their repetition is therefore not treated as a baseline violation.

## Heuristic findings

### WR-01 — WARNING: possible Duplicated Code in feature mapping

**Files:** `apps/api/src/products/products.controller.ts:147-150,165-170,188-191,209-214`; `apps/api/src/portal/portal.controller.ts:127-130,184-189`; `apps/api/src/portal/product-features.ts:15-22`.

The new controllers repeat the same four column selections and translation shape: `board: row.boardEnabled, roadmap: row.roadmapEnabled, changelog: row.changelogEnabled, faq: row.faqEnabled`. Meanwhile, `productFeatureColumns` already defines the canonical column map. `SETTINGS` separately repeats `"board", "roadmap", "changelog", "faq"` although `PRODUCT_FEATURE_KEYS` is exported by shared contracts.

This is a judgment call, not a hard documented breach. Independent copies create maintenance risk: changing a capability requires updating the guard, public metadata, and both admin responses together, and the runtime metadata whitelist can drift from the shared feature keys.

**Fix:** Reuse `productFeatureColumns` in those selections, extract one typed conversion where needed, and build the metadata whitelist from `PRODUCT_FEATURE_KEYS` plus `"exempt"`.

Standards totals: **0 hard violations; 1 WARNING heuristic**.

## Resolution notes

- **WR-01 — resolved** in `48004ee`. `portal/product-features.ts` gains one typed `pickFeatures(row)` helper, and its `SETTINGS` whitelist is now `[...PRODUCT_FEATURE_KEYS, "exempt"]`. `products.controller.ts` (list and detail), `portal.controller.ts` and `portal.guard.ts` select `...productFeatureColumns` and convert with `pickFeatures`. No behavior change: public-product-features, public-contract, products, portal, product-features and portal-isolation passed (67/67) and the API typecheck was clean.
