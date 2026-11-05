# Phase 6 Validation Evidence (06-10)

Recorded 2026-11-05 on branch `docs/workspace-platform-expansion`, local disposable stack only (colima, `compose.dev.yaml` Postgres 18 on 5432 for API tests, `stack:up` Docker images with Postgres on 5433 for browser tests). No production target, no dependency install, no schema push.

## Prerequisites used

- `colima` running; `bun run dev:services` stack up (Postgres 5432, Mailpit, Caddy).
- `bun run build:packages` before API tests; `bun run stack:up` (rebuilds the api and web images) before the browser run, rebuilt after the last source commit.

## Results

| Check | Command | Result |
|---|---|---|
| CR-01 RED | `bun run test -- test/product-feature-delivery-race.test.ts` (before fix) | 2 failed (stale row survived disable and re-enable: length 1, expected 0) |
| CR-01 GREEN | same, after `159920c` | 2 passed, 3 consecutive runs |
| Delivery/notification/email/comment/admin | `... -- test/product-feature-delivery.test.ts test/notifications.test.ts test/email.test.ts test/comments.test.ts test/admin-board-features.test.ts test/product-feature-delivery-race.test.ts` | 6 files, 32 passed |
| Mapping refactor | `... -- test/public-product-features.test.ts test/public-contract.test.ts test/products.test.ts test/portal.test.ts test/product-features.test.ts test/portal-isolation.test.ts` | 6 files, 67 passed |
| Cross-tenant matrix | `... -- test/cross-tenant.test.ts` | 69 passed (route-set equality test passes; five admin Board routes registered in 06-04) |
| WR-01 RED | `test:browser -- test/browser/product-features.spec.ts -g "server refresh updates pristine"` against the old image | failed (FAQ checkbox stayed checked after a General-save refresh) |
| WR-01 GREEN | same, after image rebuild | passed |
| API full suite, serial | `bun run --filter @userhq/api test -- --no-file-parallelism` x3 | 43 files, 492 passed, 3 of 3 runs |
| API full suite, parallel | `bun run --filter @userhq/api test` | flaky: 492/492 on several runs, 1 to 4 random unrelated failures on others (see deferred-items.md) |
| Web tests | `bun run --filter @userhq/web test` | 154 passed |
| Types / db tests | within `bun run test` | 32 passed / 5 passed (incl. `migrate.test.ts` upgrade-defaults) |
| Typecheck | `bun run typecheck` | exit 0, 4 packages |
| Lint | `bun run lint` | exit 0, 2 pre-existing warnings |
| Builds | api, web (`build`, `build:next`), `db:check` | all exit 0 |
| Browser, product-features | `bun run --filter @userhq/api test:browser -- test/browser/product-features.spec.ts` | 8 passed |
| Browser, full suite | `bun run --filter @userhq/api test:browser` | 17 passed, 2 failed (pre-existing and stale, see deferred-items.md) |
| `bun run ci:check` end to end | | exit 1: stopped at the flaky parallel API run; its later stages were run individually (rows above) |

## CAP evidence map

- CAP-01/02 (per-product flags, settings UI, defaults): `product-features.test.ts`, `migrate.test.ts`, browser settings tests (save, keyboard, failed save, stale save, refresh sync).
- CAP-03 (public denial, all 16 combinations): `public-product-features.test.ts`; browser landing test (307 order, 200 noindex all-off, 404 pages without leaked titles, directory presence).
- CAP-04/05 (private admin management while off, restore): `admin-board-features.test.ts`, browser hidden-dashboard test (edit, comment, delete, merge search, restore on re-enable, 320/375/768 settings wrap).
- CAP-06/07 (projection suppression, nested links, roadmap privacy): `product-feature-projections.test.ts`, `canary-roadmap-leak.test.ts`, browser nested-links test.
- CAP-08/09 (delivery suppression, no replay, mixed-product email, race): `product-feature-delivery.test.ts`, `product-feature-delivery-race.test.ts`.
- Tenant isolation: `cross-tenant.test.ts`, foreign-workspace and customer-role cases in `product-features.test.ts` and `public-product-features.test.ts`.

## Not yet done (outside this executor)

- Matt code-review of the implementation diff and the GSD verifier/security/UI review through the orchestrator. Requirement boxes are intentionally not marked complete here.
