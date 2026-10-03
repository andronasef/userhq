---
phase: 03-feedback-board-conversations
plan: 04
subsystem: web
tags: [tracer, board, permalink, vinext, rsc, redirects]

# Dependency graph
requires: ["03-02"]
provides:
  - "Board page at /{ws}/{product} with compact post rows and empty states"
  - "New post modal dialog with validation and automatic redirect to permalink"
  - "Post permalink page at /{ws}/{product}/p/{ref} with metadata and SEO canonicals"
  - "Proxy-level literal 301 canonical redirects for bare /p/{n}, stale slugs, and merged posts"
  - "Safe PlainText renderer with nofollow linkify and zero HTML injection"
  - "Author line displaying avatars, user names, admin badge, and deleted user fallback"
affects: [03-05, 03-06, 03-07, 03-08, 03-09, 03-12]

actuals:
  tokens: 45000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "proxy.ts 301 redirect interception before RSC rendering"
    - "generateMetadata returns {} without notFound/redirect to let page body handle routes"
    - "PlainText component rendering React text nodes and sanitized nofollow links"
    - "Privacy guarantee: zero author emails in rendered portal HTML"

key-files:
  created:
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx
    - apps/web/components/board/post-row.tsx
    - apps/web/components/board/vote-button.tsx
    - apps/web/components/board/post-form-dialog.tsx
    - apps/web/components/post/author-line.tsx
    - apps/web/components/plain-text.tsx
    - apps/web/components/ui/textarea.tsx
    - apps/web/lib/linkify.ts
    - apps/web/lib/linkify.test.ts
    - apps/api/test/e2e/board.e2e.test.ts
  modified:
    - apps/web/app/[ws]/[product]/page.tsx
    - apps/web/app/[ws]/[product]/layout.tsx
    - apps/web/components/portal/portal-frame.tsx
    - apps/web/proxy.ts
    - apps/web/lib/tenant.ts
    - apps/web/lib/tenant.test.ts
    - apps/web/lib/api-server.ts
    - apps/web/lib/api-errors.ts

key-decisions:
  - "User selected proxy-301: literal 301 Moved Permanently handled in apps/web/proxy.ts rather than vinext 308"
  - "Confirmed canonical slug rule: POST_SLUG_MAX=60, title-derived ASCII slug, empty slug falls back to /p/{n}"
  - "Never call permanentRedirect or notFound inside generateMetadata; handle entirely in page function"

patterns-established:
  - "RSC permalink pages delegate 301 routing to proxy.ts while keeping permanentRedirect in page body for defense-in-depth"
  - "AuthorLine safely handles soft-deleted users as 'Deleted user' with no admin badge and fallback avatar"
  - "Board empty state provides friendly call-to-action to create the first post"

requirements-completed: [POST-01, POST-06, POST-11, AUTH-04, PROD-06]

coverage:
  - id: D1
    description: "A signed-in customer creates a post, lands on /p/{n}-{slug}, and post appears on board with vote count 1"
    requirement: POST-01, POST-06, POST-11
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts (tracer test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bare /p/{n} and stale /p/{n}-wrong-slug return literal 301 redirect with Location to canonical path"
    requirement: POST-06
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts (canonical 301 test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Merged post permalink returns literal 301 to target post's canonical URL"
    requirement: POST-06
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts (merged post test)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Non-numeric ref, unknown post number, and soft-deleted post return 404 Page not found"
    requirement: POST-06
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts (404 test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "PlainText sanitizes HTML, script tags, javascript: links, and applies rel nofollow noopener noreferrer"
    requirement: POST-01
    verification:
      - kind: automated
        ref: "apps/web/lib/linkify.test.ts & apps/api/test/e2e/board.e2e.test.ts (safety test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Privacy canary: author email never appears in board or permalink HTML, and deleted user renders 'Deleted user'"
    requirement: AUTH-04
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts (privacy canary test)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Signed-out visitor sees New post link pointing to /login?next=/{ws}/{product}?new=1"
    requirement: PROD-06
    verification:
      - kind: automated
        ref: "apps/api/test/e2e/board.e2e.test.ts (signed-out link test)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-10-03
status: complete
---

# Phase 03: Plan 04 Summary

**Board view, New post dialog, permalink page & canonical 301 redirects**

## Performance

- **Duration:** 35 min
- **Started:** 2026-10-03T18:00:00Z
- **Completed:** 2026-10-03T18:35:00Z
- **Tasks:** 3
- **Commits:** 2

## Accomplishments

- Built the Customer Portal feedback board (`apps/web/app/[ws]/[product]/page.tsx`) with compact post rows (`PostRow`), accent-colored vote button (`VoteButton`), status badge, category badge, and empty state.
- Implemented `PostFormDialog` and `NewPostButton` supporting dialog creation, react-hook-form + zod validation, field error mapping, and submission idempotency.
- Created the post permalink page (`apps/web/app/[ws]/[product]/p/[ref]/page.tsx`) with dynamic metadata, OpenGraph tags, canonical link headers, `AuthorLine`, and `PlainText` renderer.
- Intercepted permalink requests in `apps/web/proxy.ts` to issue literal `301 Moved Permanently` redirects for bare `/p/{n}` paths, stale slugs `/p/{n}-wrong-slug`, and merged posts, while maintaining public access.
- Confirmed strict privacy protections: zero author emails exposed anywhere in portal HTML; soft-deleted accounts render as `"Deleted user"`.
- Built end-to-end integration test suite (`apps/api/test/e2e/board.e2e.test.ts`) covering tracer post creation, 301 redirects with `redirect: "manual"`, merged posts, 404 handling, plain text safety, privacy canary, signed-out redirect URLs, and empty board states.

## Task Commits

1. **Task 1: Tracer - Board view, new post dialog, and permalink tracer** - `079cf6c` (`feat(03-04): board view, new post dialog, and permalink tracer`)
2. **Task 2: Decision Checkpoint - Redirect contract & slug rule** - Confirmed: user selected `proxy-301` with 60-character slug rule (`POST_SLUG_MAX=60`).
3. **Task 3: Permalinks canonicalize and merged posts redirect with 301, 404s, metadata, and privacy** - `8e0e709` (`feat(03-04): permalink 301 canonical redirects, metadata, and empty states`)

## Key Decisions Made

- **`proxy-301` vs `page-308`**: User explicitly confirmed `proxy-301`. Handled directly in `apps/web/proxy.ts` so browsers and crawlers receive an immutable `301 Moved Permanently` without relying on vinext's internal 308 translation.
- **Slug Normalization**: Derived directly from the title, truncated to 60 characters with non-alphanumerics collapsed to single hyphens. Posts with empty slugs fallback to `/p/{n}`.
- **`generateMetadata` safety**: Never calls `notFound()` or `permanentRedirect()` inside Next.js/vinext `generateMetadata` (avoiding unhandled framework errors); returns `{}` and lets the page body or proxy handle route lifecycle.

## Files Created/Modified

- `apps/web/app/[ws]/[product]/page.tsx` - Feedback board page with post list and EmptyState.
- `apps/web/app/[ws]/[product]/p/[ref]/page.tsx` - Post permalink page with canonical metadata and redirect fallback.
- `apps/web/app/[ws]/[product]/layout.tsx` - Feedback tab navigation and `AppToaster`.
- `apps/web/components/portal/portal-frame.tsx` - Added optional `tabs` slot.
- `apps/web/proxy.ts` - 301 canonical redirect handler for `/:ws/:product/p/:ref*`.
- `apps/web/components/board/post-row.tsx` - Compact post row component.
- `apps/web/components/board/vote-button.tsx` - Vote count button.
- `apps/web/components/board/post-form-dialog.tsx` - Post create modal and button.
- `apps/web/components/post/author-line.tsx` - Author name, avatar, date, and admin badge.
- `apps/web/components/plain-text.tsx` - Safe text renderer with `rel="nofollow noopener noreferrer"`.
- `apps/web/components/ui/textarea.tsx` - Accessible textarea component.
- `apps/web/lib/linkify.ts` & `linkify.test.ts` - URL parser and unit tests.
- `apps/web/lib/tenant.ts` & `tenant.test.ts` - `postHref` and `parsePostRef` utilities.
- `apps/web/lib/api-server.ts` - `getBoard` and `getPost` data fetchers.
- `apps/web/lib/api-errors.ts` - Phase 3 error codes and field mappings.
- `apps/api/test/e2e/board.e2e.test.ts` - 9 E2E test cases validating board and permalinks against live Docker stack.

## Deviations from Plan

- Implemented `proxy-301` in `apps/web/proxy.ts` as explicitly chosen by the user in Task 2.

## Verification

- Automated test run:
  - `bun run build:packages` passed
  - `apps/web` unit test suite: 8 test files, 62 tests passed
  - TypeScript typecheck: all packages clean
  - Oxlint: 0 warnings, 0 errors
  - `apps/api` E2E suite (`board.e2e.test.ts` and `portal.e2e.test.ts`): 18 tests passed

---
*Phase: 03-feedback-board-conversations*
*Completed: 2026-10-03*
