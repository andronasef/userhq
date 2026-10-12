---
phase: 05-changelog-faq
plan: 02
subsystem: api-services-and-controllers
tags: [changelog, faq, lexorank, portal, admin, nestjs, api, drizzle]

# Dependency graph
requires: [05-01]
provides:
  - "Default changelog tags (New, Improved, Fixed) seeded upon product creation in products.controller.ts"
  - "Admin changelog CRUD, tag management, publishing/unpublishing, and slug collision detection in ChangelogService and ChangelogController"
  - "Public portal changelog feed and permalink endpoints with strict draft isolation (CHLG-04) in PortalChangelogController"
  - "Admin FAQ category and question CRUD with transactional LexoRank fractional reordering in FaqService and FaqController"
  - "Public portal FAQ endpoint returning hierarchical categories and questions ordered by LexoRank in PortalFaqController"
  - "FaqModule and ChangelogModule registered in AppModule"
  - "Cross-tenant isolation tests and public contract assertions for all Phase 5 routes"
affects: [05-03, 05-04, 05-05]

actuals:
  tokens: 48000
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Product-scoped auto-seeding of changelog tags during product creation"
    - "Unique slug derivation from title with auto-increment suffix (-2, -3) on collision"
    - "Draft isolation returning 404 for unreleased changelog drafts on public permalinks"
    - "Transactional single-row LexoRank reordering using SELECT FOR UPDATE with ASCII collation"
    - "Cross-tenant isolation registry coverage asserting 404 for foreign workspace/product access"

key-files:
  created:
    - apps/api/src/changelog/changelog.service.ts
    - apps/api/src/changelog/changelog.controller.ts
    - apps/api/src/changelog/portal-changelog.controller.ts
    - apps/api/src/changelog/changelog.module.ts
    - apps/api/src/faq/faq.service.ts
    - apps/api/src/faq/faq.controller.ts
    - apps/api/src/faq/portal-faq.controller.ts
    - apps/api/src/faq/faq.module.ts
    - apps/api/test/changelog.test.ts
    - apps/api/test/portal-changelog.test.ts
    - apps/api/test/faq.test.ts
    - apps/api/test/portal-faq.test.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/products/products.controller.ts
    - packages/types/src/rank.ts
    - packages/types/src/faq.ts
    - apps/api/test/public-contract.test.ts
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/support/seed.ts

key-decisions:
  - "Seeded SEEDED_CHANGELOG_TAGS within product creation transaction ensuring all products start with New (#10B981), Improved (#3B82F6), and Fixed (#F59E0B)"
  - "Changelog draft isolation: unreleased entries return 404 on public /portal/:ws/:product/changelog/:slug permalinks (CHLG-04)"
  - "Postgres ASCII byte-order collation: ORDER BY rank COLLATE \"C\" combined with JS sorting to match LexoRank generateKeyBetween character ordering"
  - "LexoRank fractional reordering: single-row updates with SELECT ... FOR UPDATE within transaction supporting both intra-category and inter-category moves"

patterns-established:
  - "Changelog entry tags managed atomically via relational joins and many-to-many junction table changelog_entry_tags"
  - "FAQ categories and questions arranged hierarchically ordered by LexoRank strings"
  - "Public contracts enforce @SerializeOptions across all portal changelog and FAQ routes"

requirements-completed: [CHLG-01, CHLG-02, CHLG-03, CHLG-04, FAQ-01, FAQ-02, FAQ-03, FAQ-04, FAQ-05]

duration: 25min
completed: 2026-10-12
---

# Plan 05-02: Changelog & FAQ API Services, Admin/Portal Controllers, and Reordering Summary

Implemented core backend services, admin and public controllers, LexoRank reordering, and automated test suites for Changelog and FAQ in Phase 05.

### 1. Changelog Service & Controllers (`apps/api`)
- **Tag Seeding**: Updated `apps/api/src/products/products.controller.ts` to automatically insert `SEEDED_CHANGELOG_TAGS` into `changelogTags` inside the product creation transaction.
- **Admin Changelog**:
  - `apps/api/src/changelog/changelog.service.ts`:
    - `listAdminEntries`: returns entries joined with associated tags, sorting by `publishedAt desc nulls first, createdAt desc`.
    - `getAdminEntryById`: fetches entry by ID scoped to tenant product.
    - `createEntry`: generates unique slug from title (with collision handling `-2`, `-3`), inserts entry with rich text AST, associates tags in `changelogEntryTags`.
    - `updateEntry`: updates title, summary, content, slug, and tag associations.
    - `deleteEntry`: cascades removal of entry and tag links.
    - `publishEntry` / `unpublishEntry`: sets or clears `publishedAt`.
    - `listTags`, `createTag`, `deleteTag`: manages product changelog tags with duplicate name prevention.
  - `apps/api/src/changelog/changelog.controller.ts`:
    - Admin routes guarded by `TenantGuard` and authenticated session.
- **Public Portal Changelog**:
  - `apps/api/src/changelog/portal-changelog.controller.ts`:
    - `GET /portal/:ws/:product/changelog`: returns published feed with tag filtering and optional author information.
    - `GET /portal/:ws/:product/changelog/:slug`: returns published entry by slug; strictly isolates drafts (`publishedAt is null`) by returning 404 (`CHLG-04`).
- **Module Wiring**: Created `ChangelogModule` and registered in `AppModule`.

### 2. FAQ Service, Controllers & LexoRank Reordering (`apps/api`)
- **FAQ Service**:
  - `apps/api/src/faq/faq.service.ts`:
    - `listAdminFaq`: fetches categories and questions ordered by `rank COLLATE "C" asc`, returning nested category tree with questions.
    - `createCategory`: assigns LexoRank at bottom if not provided; enforces case-insensitive uniqueness (`category_name_taken`).
    - `updateCategory`, `deleteCategory` (cascading questions).
    - `reorderCategory`: validates target rank with `isValidRank`, locks row with `.for("update")`, and performs single-row rank update.
    - `createQuestion`: verifies category belongs to product, generates LexoRank at category tail, inserts ProseMirror answer AST.
    - `updateQuestion`: supports modifying question, answer AST, or moving across categories.
    - `deleteQuestion`: deletes question.
    - `reorderQuestion`: validates target rank with `isValidRank`, locks question row with `.for("update")`, supports reordering within the same category or moving and reordering across categories.
- **Admin FAQ Controller**:
  - `apps/api/src/faq/faq.controller.ts`:
    - Implemented REST endpoints for category and question CRUD + fractional reordering (`/categories/:id/reorder`, `/questions/:id/reorder`).
- **Public Portal FAQ Controller**:
  - `apps/api/src/faq/portal-faq.controller.ts`:
    - `GET /portal/:ws/:product/faq`: returns ordered category hierarchy and questions with `PublicFaqResponseSchema`.
- **Module Wiring**: Created `FaqModule` and registered in `AppModule`.

### 3. Tests & Verification
- Authored test suites:
  - `apps/api/test/changelog.test.ts` (7 tests): admin CRUD, tag creation, slug collisions, publish/unpublish, and tenant isolation.
  - `apps/api/test/portal-changelog.test.ts` (5 tests): public changelog feed, tag filtering, slug permalinks, and draft isolation (404 on unreleased notes).
  - `apps/api/test/faq.test.ts` (5 tests): category CRUD and duplicate prevention, question CRUD, LexoRank category reordering, intra/inter-category question reordering, and tenant isolation.
  - `apps/api/test/portal-faq.test.ts` (3 tests): public portal FAQ tree structure, LexoRank sorting, 404 and suspended workspace handling.
- Updated `apps/api/test/public-contract.test.ts` to assert public changelog and FAQ portal routes.
- Updated `apps/api/test/cross-tenant.test.ts` and `apps/api/test/support/seed.ts` registering 20 new admin endpoints with 100% 404 isolation coverage.
- Full workspace test suite: **511 tests passing across lint-rules, db, api, and web**.
- Full workspace typecheck: **0 errors**.
