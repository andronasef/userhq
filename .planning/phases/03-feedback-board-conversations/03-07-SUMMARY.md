---
phase: 03-feedback-board-conversations
plan: 07
subsystem: api-web
tags: [board, nuqs, full-text-search, pagination, vinext, playwright]

# Dependency graph
requires: ["03-01", "03-06"]
provides:
  - "nuqs URL state management for sort, search (q), category, and status filters with shallow: false"
  - "RSC refetch under vinext verified via Playwright browser test (Pitfall 12 resolved)"
  - "Search with Unicode letter/digit extraction and prefix tsquery matching (D-29)"
  - "Category filtering and status filtering (default Open excluding completed/closed, All, or status ID)"
  - "Opaque base64url offset cursor pagination (encodeBoardCursor/decodeBoardCursor) with 10k max limit"
  - "PostList client component with useInfiniteQuery, de-duplication by number, Load more button, and aria-live announcements"
  - "PublicPortalProductSchema and GET /portal/:ws/:product returning statuses ordered by position"
  - "Mobile collapsible filters panel (<640px) with active filters count badge and ARIA attributes"
affects: [03-08, 03-09, 03-11, 03-12]

actuals:
  tokens: 45000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "NuqsAdapter wrapping RootLayout body with useQueryStates shallow: false"
    - "PostgreSQL tsvector full-text search with setweight ('A' on title, 'B' on description) and ts_rank ordering"
    - "prefixTsQuery regex Unicode letter/digit runs extraction with case folding and parameter binding"
    - "Opaque offset cursor base64url JSON serialization bounded to 0..10,000 offsets"
    - "TanStack useInfiniteQuery with initialData seeded from Server Component first page"
    - "Mobile responsive filters drawer with aria-expanded, aria-controls, and badge counter"

key-files:
  created:
    - apps/api/src/feedback/search.ts
    - apps/api/src/feedback/cursor.ts
    - apps/api/test/board.test.ts
    - apps/api/test/browser/board-filters.spec.ts
    - apps/web/components/board/board-toolbar.tsx
    - apps/web/components/board/post-list.tsx
  modified:
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/portal-posts.controller.ts
    - apps/api/src/portal/portal.controller.ts
    - apps/api/test/portal.test.ts
    - apps/web/app/layout.tsx
    - apps/web/app/[ws]/[product]/page.tsx
    - packages/types/src/feedback.ts
    - packages/types/src/tenancy.ts

key-decisions:
  - "nuqs shallow: false triggers native RSC refetching cleanly under vinext 1.0.0; no router.push fallback required"
  - "FTS prefix matching extracts only [\\p{L}\\p{N}]+ tokens to completely prevent tsquery syntax errors from user input"
  - "Default sort when q is active is Best match (ts_rank DESC, vote_count DESC, id DESC); clearing search returns to Top voted"
  - "Title matches automatically outrank description matches due to 'A' vs 'B' weights in generated search tsvector"
  - "Status defaults to Open (excluding completed and closed type statuses) unless status=all or a specific status UUID is supplied"
  - "Cursor is opaque base64url offset; client never writes cursor to URL so reloads always fetch fresh page 1"

requirements-completed: [POST-07, POST-08, POST-09, POST-10]

coverage:
  - id: D1
    description: "Visitor changes sort to Newest: URL gains ?sort=new, server list re-renders newest-first, and browser Back restores order"
    requirement: POST-07
    verification:
      - kind: automated
        ref: "apps/api/test/browser/board-filters.spec.ts (tracer test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Search matches title and description with prefix matching (q=dar finds Dark mode, q=exporting csv finds Export to CSV)"
    requirement: POST-10
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sort Best match ranks title matches higher than description-only matches even if description match has more votes"
    requirement: POST-10
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Status filter hides completed/closed posts by default; status=all shows them; status={id} isolates that status"
    requirement: POST-08, POST-09
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Category filter isolates posts belonging to that category; toolbar hides category filter when product has no categories"
    requirement: POST-08
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "45 posts paginate through 3 pages (20, 20, 5) with opaque cursor without duplicates or missing rows"
    requirement: POST-07
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Load more button appends next page in browser, announces Loaded {n} more posts via aria-live, and hides when nextCursor is null"
    requirement: POST-07
    verification:
      - kind: automated
        ref: "apps/api/test/browser/board-filters.spec.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "Invalid cursors (garbage, negative offset, non-integer, offset > 10,000) return 400 validation_failed"
    requirement: POST-07
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
  - id: D9
    description: "Empty board returns { posts: [], nextCursor: null }; filtered empty board renders No posts match with Clear filters link"
    requirement: POST-07, POST-10
    verification:
      - kind: automated
        ref: "apps/api/test/board.test.ts"
        status: pass
    human_judgment: false
---

# Plan 03-07: Board Browse Summary

Plan 03-07 delivered the complete board browsing, search, filtering, and cursor-based infinite pagination feature set (POST-07, POST-08, POST-09, POST-10).

## Highlights & Verified Deliverables

1. **nuqs URL State & RSC Refetching Proof (Pitfall 12 Resolved):**
   - Wrapped `app/layout.tsx` with `<NuqsAdapter>` from `nuqs/adapters/next/app`.
   - Created `BoardToolbar` using `useQueryStates` with `{ shallow: false, history: "push" }`.
   - Proved in real Playwright browser tests on the live Docker stack that changing sort from default to `Newest` sets `?sort=new`, re-renders the RSC list newest-first, and browser Back navigation restores the previous list and URL.

2. **Full-Text Prefix Search & Relevance Ranking (D-29):**
   - Created `prefixTsQuery` in `apps/api/src/feedback/search.ts` which extracts Unicode word runs (`[\p{L}\p{N}]+`), joins stems with `&`, and appends `:*` to the final term.
   - Bound search terms as parameters to `to_tsquery('english', $1)`.
   - Ordered by `ts_rank(posts.search, query) DESC, vote_count DESC, id DESC` under "match" sort.
   - Leveraged weighted tsvector (`setweight('A')` on title, `'B'` on description) so title hits outrank description hits.

3. **Category & Status Filtering:**
   - Default status filter hides `completed` and `closed` types (Open view).
   - `status=all` includes all statuses, and `status={uuid}` filters to that specific status.
   - Category filter limits posts to the selected category.
   - Updated `PublicPortalProductSchema` and `portal.controller.ts` to return product statuses ordered by position.
   - Empty filtered state renders `"No posts match"` with a `"Clear filters"` link.

4. **Opaque Offset Cursor & Infinite Pagination (D-09):**
   - Implemented `encodeBoardCursor` and `decodeBoardCursor` in `apps/api/src/feedback/cursor.ts`, encoding offset as base64url JSON and validating integers between 0 and 10,000.
   - Implemented `PostList` client component using `@tanstack/react-query` `useInfiniteQuery` seeded by the server component's initial page.
   - De-duplicated posts by number across pages.
   - Added `Load more` button with disabled loading spinner and polite `aria-live` screen-reader announcement (`Loaded {n} more posts`).
   - Verified 45-post pagination across 3 pages in unit tests and 25-post Load more in Playwright browser tests.

## Verification Run

- **Unit/Integration Tests:** 246 passed across 18 test files (`apps/api/test/board.test.ts`, `portal.test.ts`, `posts.test.ts`, etc.).
- **Browser Specs:** 10/10 passed in Playwright (`board-filters.spec.ts`, `votes.spec.ts`, etc.).
- **Static Checks:** `tsc --noEmit` clean on all packages, `oxlint` 0 warnings, 0 errors.
