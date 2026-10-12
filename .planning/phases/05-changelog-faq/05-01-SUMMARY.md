---
phase: 05-changelog-faq
plan: 01
subsystem: database-and-contracts
tags: [schema, drizzle, migrations, tiptap, rich-text, contracts, zod]

# Dependency graph
requires: []
provides:
  - "@tiptap/* v3.31.4 packages installed in apps/web without peer conflict"
  - "Database tables changelog_entries, changelog_tags, changelog_entry_tags, faq_categories, faq_questions"
  - "Drizzle DDL migration 0010_changelog_faq.sql"
  - "Shared ProseMirror AST validator RichTextDocSchema in @userhq/types with link and image protocol sanitization"
  - "Shared DTOs and Zod validation contracts for changelog entries, tags, FAQ categories, and questions"
  - "Phase 5 error codes added to API_ERROR_CODES"
affects: [05-02, 05-03, 05-04, 05-05]

actuals:
  tokens: 42000
  tasks: 2
  commits: 2

tech-stack:
  added:
    - "@tiptap/react@3.31.4"
    - "@tiptap/pm@3.31.4"
    - "@tiptap/starter-kit@3.31.4"
    - "@tiptap/extension-image@3.31.4"
    - "@tiptap/static-renderer@3.31.4"
  patterns:
    - "ProseMirror AST validated via Zod and stored as JSONB with zero raw HTML persistence"
    - "Composite foreign keys on (entity_id, product_id) enforcing tenant-isolation guarantees in DB"
    - "LexoRank string ranking on FAQ categories and questions for O(1) fractional reordering"
    - "Nullable published_at timestamp isolating published release notes from admin drafts"

key-files:
  created:
    - packages/db/src/schema/changelog.ts
    - packages/db/src/schema/faq.ts
    - packages/db/migrations/0010_changelog_faq.sql
    - packages/db/migrations/meta/0010_snapshot.json
    - packages/types/src/rich-text.ts
    - packages/types/src/changelog.ts
    - packages/types/src/faq.ts
    - packages/types/test/changelog-faq.test.ts
  modified:
    - apps/web/package.json
    - bun.lock
    - packages/db/src/index.ts
    - packages/db/migrations/meta/_journal.json
    - packages/types/src/index.ts

key-decisions:
  - "Stored ProseMirror JSON AST directly in PostgreSQL jsonb columns (content, answer), strictly forbidding raw HTML in persistence and transport"
  - "Enforced AST security boundary in RichTextDocSchema: links restricted to http:, https:, mailto:; images restricted to http: and https:; rejected javascript:, data:, and vbscript:"
  - "Enforced tenant boundaries in PostgreSQL using composite foreign keys (category_id, product_id) -> (id, product_id) and many-to-many tag keys (entry_id, product_id) / (tag_id, product_id)"
  - "Used nullable published_at timestamp on changelog entries to distinguish public release notes from admin drafts (CHLG-04)"
  - "Exported SEEDED_CHANGELOG_TAGS with New (#10B981), Improved (#3B82F6), and Fixed (#F59E0B)"

patterns-established:
  - "RichTextDocSchema validates recursive node trees and mark allowlists"
  - "Changelog and FAQ schemas enforce product-scoped uniqueness on slugs and category names"

requirements-completed: [CHLG-01, CHLG-02, CHLG-03, CHLG-04, FAQ-01, FAQ-02, FAQ-03]

duration: 15min
completed: 2026-10-12
---

# Plan 05-01: Changelog & FAQ Database Schema, Tiptap Gate, and Shared Contracts Summary

Implemented foundational database schemas, DDL migration `0010_changelog_faq.sql`, Tiptap 3.31.4 dependencies in `apps/web`, and shared ProseMirror/DTO contracts in `@userhq/types` for Phase 05 (Changelog & FAQ).

### 1. Tiptap Dependencies (`apps/web`)
- Installed verified React 19-compatible Tiptap packages at version `3.31.4`:
  - `@tiptap/react`
  - `@tiptap/pm`
  - `@tiptap/starter-kit`
  - `@tiptap/extension-image`
  - `@tiptap/static-renderer`

### 2. Database Schema & Migration (`packages/db`)
- Created `packages/db/src/schema/changelog.ts`:
  - `changelog_entries`: contains `id`, `productId`, `title`, `slug`, `summary`, `content` (`jsonb`), `publishedAt` (nullable timestamp for drafts), `createdAt`, `updatedAt`, with unique constraints on `(id, productId)` and `(productId, slug)` and index on `(productId, publishedAt)`.
  - `changelog_tags`: contains `id`, `productId`, `name`, `color`, `createdAt`, with unique constraint on `(id, productId)` and case-insensitive unique index on `(productId, lower(name))`.
  - `changelog_entry_tags`: many-to-many join table with primary key `(entryId, tagId)` and composite foreign keys cascading on delete.
- Created `packages/db/src/schema/faq.ts`:
  - `faq_categories`: contains `id`, `productId`, `name`, `rank` (LexoRank), `createdAt`, `updatedAt`, with unique constraint on `(id, productId)` and case-insensitive unique index on `(productId, lower(name))`.
  - `faq_questions`: contains `id`, `productId`, `categoryId`, `question`, `answer` (`jsonb`), `rank` (LexoRank), `createdAt`, `updatedAt`, with composite foreign key on `(categoryId, productId)`.
- Updated `packages/db/src/index.ts` to register and export changelog and FAQ schemas.
- Generated migration `packages/db/migrations/0010_changelog_faq.sql` and verified with `drizzle-kit check`.

### 3. Shared Contracts & ProseMirror AST Security (`packages/types`)
- Created `packages/types/src/rich-text.ts`:
  - `RichTextDocSchema` and `RichTextNodeSchema` strictly validating ProseMirror AST structures.
  - Allowed node types: `doc`, `paragraph`, `heading` (levels 1-3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `horizontalRule`, `image`, `text`, `hardBreak`.
  - Protocol safety: rejects `javascript:`, `data:`, and `vbscript:` protocols. Links are restricted to `http:`, `https:`, and `mailto:`. Images require absolute `http:` or `https:` URLs (D-06).
- Created `packages/types/src/changelog.ts`:
  - `ChangelogTitleSchema` (3-150 chars), `ChangelogSlugSchema` (lowercase alphanumeric with hyphens), `ChangelogTagSchema`, `ChangelogTagInputSchema`.
  - Shared DTOs: `AdminChangelogEntrySchema`, `AdminChangelogListResponseSchema`, `PublicChangelogEntrySchema`, `PublicChangelogFeedResponseSchema`, `CreateChangelogEntryInputSchema`, `UpdateChangelogEntryInputSchema`, `PublishChangelogEntryInputSchema`.
  - `SEEDED_CHANGELOG_TAGS` default tags ("New", "Improved", "Fixed").
- Created `packages/types/src/faq.ts`:
  - `FaqCategoryInputSchema` (2-50 chars), `MoveFaqCategoryInputSchema`.
  - `FaqQuestionInputSchema` (5-200 chars), `UpdateFaqQuestionInputSchema`, `MoveFaqQuestionInputSchema`.
  - DTOs: `AdminFaqQuestionSchema`, `AdminFaqCategorySchema`, `AdminFaqResponseSchema`, `PublicFaqQuestionSchema`, `PublicFaqCategorySchema`, `PublicFaqResponseSchema`.
- Updated `packages/types/src/index.ts` with Phase 5 error codes in `API_ERROR_CODES` (`title_length`, `slug_required`, `slug_format`, `slug_conflict`, `content_required`, `invalid_image_url`, `category_name_required`, `category_not_found`, `reorder_failed`).
- Authored automated unit test suite in `packages/types/test/changelog-faq.test.ts` (18 tests passing, covering protocol injection attacks, image validation, title/slug trimming, and DTO parsing).

### Verification
- `bun run build:packages`: `@userhq/types` and `@userhq/db` compiled cleanly.
- `bun run --filter '@userhq/db' db:check`: Passed (`Everything's fine 🐶🔥`).
- `bun run --filter '@userhq/types' test`: 30 unit tests passed.
- `bun run lint && bun run typecheck`: 0 warnings, 0 errors across all workspaces.
- `bun run test`: All 26 lint tests, 4 db tests, 379 api tests, 62 web tests, and 30 types tests passed with 0 regressions.
