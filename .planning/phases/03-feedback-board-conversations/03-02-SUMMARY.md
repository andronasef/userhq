---
phase: 03-feedback-board-conversations
plan: 02
subsystem: database
tags: [schema, contracts, drizzle, migration, public-dto, tenant-isolation]

# Dependency graph
requires:
  - phase: 03-feedback-board-conversations
    provides: "Approved dependencies (@nestjs/throttler, nuqs) and pinned lockfile"
provides:
  - "Phase 3 schema: categories, posts, votes, comments, activity, mutes, email batches (migration 0007_feedback)"
  - "Shared TypeScript contracts, limits, error codes, and Zod schemas in @userhq/types"
  - "PostsService and PortalPostsController serving public board and post endpoints"
  - "Automated tests covering 20-user numbering concurrency, Zod validations, merged redirects, canary leak checks, and portal tenant isolation"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12]

actuals:
  tokens: 85000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Generated stored tsvector column with English dictionary weighting"
    - "Per-product sequential post numbers via products.next_post_number update row lock"
    - "Composite FKs on (status_id, product_id) and (parent_id, post_id)"
    - "Discriminator union on PublicPostPage (post vs redirect)"
    - "Strict privacy guarantee: author DTO excludes email and internal IDs"

key-files:
  created:
    - packages/db/src/schema/feedback.ts
    - packages/db/migrations/0007_feedback.sql
    - packages/types/src/feedback.ts
    - apps/api/src/feedback/membership.ts
    - apps/api/src/feedback/posts.service.ts
    - apps/api/src/feedback/portal-posts.controller.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/api/test/posts.test.ts
    - apps/api/test/portal-isolation.test.ts
  modified:
    - packages/db/src/schema/auth.ts
    - packages/db/src/schema/tenancy.ts
    - packages/db/src/index.ts
    - packages/types/src/slugs.ts
    - packages/types/src/index.ts
    - apps/api/src/auth/auth.ts
    - apps/api/src/app.module.ts
    - apps/api/test/cross-tenant.test.ts
    - apps/api/test/public-contract.test.ts
    - apps/api/test/support/seed.ts

key-decisions:
  - "Added per-product post number beside UUID primary key so permalinks remain short, stable, and readable"
  - "Shipped entire Phase 3 data model in migration 0007_feedback to prevent journal conflicts in subsequent plans"
  - "Generalized slugify with max length parameter defaulting to 32 while post slugs support up to 60 chars"
  - "Enforced server-side resolution of authorIsAdmin snapshot from workspace membership"

patterns-established:
  - "Portal routes scoped to portal/:ws/:product use PortalGuard and StandardSchemaSerializerInterceptor"
  - "engagedSql helper computes thread lock condition based on non-author votes and comments"

requirements-completed: [POST-01, POST-06, POST-11, AUTH-04]

coverage:
  - id: D1
    description: "Public post creation, retrieval, and board listing through portal API with sequential numbering and auto-vote"
    requirement: POST-01
    verification:
      - kind: integration
        ref: "apps/api/test/posts.test.ts#tracer: a signed-in user creates a post and reads it back"
        status: pass
    human_judgment: false
  - id: D2
    description: "Derived URL slug generation and canonical post permalink resolution"
    requirement: POST-06
    verification:
      - kind: integration
        ref: "apps/api/test/posts.test.ts#submitting the same title twice creates two posts with distinct numbers"
        status: pass
    human_judgment: false
  - id: D3
    description: "Default status assignment on new posts and status DTO inclusion"
    requirement: POST-11
    verification:
      - kind: integration
        ref: "apps/api/test/posts.test.ts#tracer: a signed-in user creates a post and reads it back"
        status: pass
    human_judgment: false
  - id: D4
    description: "Author DTO serialization excluding email and internal IDs with canary leak verification"
    requirement: AUTH-04
    verification:
      - kind: integration
        ref: "apps/api/test/posts.test.ts#never leaks author email or user id (canary test), and handles deleted authors and unicode names"
        status: pass
    human_judgment: false
  - id: D5
    description: "Migration 0007_feedback applied on live Docker stack at boot"
    requirement: POST-01
    verification:
      - kind: unit
        ref: "docker compose --env-file .env.docker exec -T postgres psql migration count equality"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-03
status: complete
---

# Phase 03: Plan 02 Summary

**Phase 3 schema, shared contracts, public portal post endpoints, and concurrency/tenant-isolation hardening**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-03T17:15:00Z
- **Completed:** 2026-10-03T17:30:00Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Designed and generated migration `0007_feedback.sql` with all Phase 3 tables: `categories`, `posts` (with stored generated FTS tsvector and GIN index), `votes`, `comments`, `post_activity`, `post_mutes`, `comment_email_batches`, and `comment_email_items`.
- Added `user.deleted_at`, `user.comment_emails`, `workspaces.deleted_at`, and `products.next_post_number`.
- Implemented shared TypeScript types, constants, Zod schemas, and 21 Phase 3 API error codes in `@userhq/types`.
- Created `PostsService` and `PortalPostsController` supporting `GET/POST /portal/:ws/:product/posts` and `GET /portal/:ws/:product/posts/:number`.
- Validated atomic sequential post numbering under 20-user concurrency without duplicates or gaps.
- Confirmed privacy canary: author emails and user IDs never leak in board or post JSON; soft-deleted authors properly anonymized; Unicode/emoji names preserved byte-identically.
- Verified live migration application on Docker stack via `bun run stack:up` and `drizzle-kit check`.

## Task Commits

1. **Task 1: A signed-in client creates a post through the portal API and reads it back from the public post and board endpoints, on a schema that migrated itself at boot** - `b7afd89` (`feat(03-02): ship Phase 3 schema, feedback contracts, and public post endpoints tracer`)
2. **Task 2: The post contract holds under concurrency, bad input, merges, deletions, and cross-tenant probing, and never leaks an author's email** - `51e2a4f` (`test(03-02): post contract concurrency, validation, merge, canary, and tenant isolation`)

## Files Created/Modified

- `packages/db/src/schema/feedback.ts` - Tables, enums, indexes, and relations for Phase 3 feedback system.
- `packages/db/src/schema/auth.ts` - Added `deletedAt` and `commentEmails`.
- `packages/db/src/schema/tenancy.ts` - Added `workspaces.deletedAt` and `products.nextPostNumber`.
- `packages/db/migrations/0007_feedback.sql` - Generated migration applying Phase 3 tables and columns.
- `packages/types/src/feedback.ts` - Zod schemas and TypeScript types for public posts, board, and viewer contracts.
- `packages/types/src/slugs.ts` - Generalized `slugify` with optional max length.
- `packages/types/src/index.ts` - Exported feedback types and registered 21 Phase 3 error codes.
- `apps/api/src/feedback/membership.ts` - `isWorkspaceAdmin` helper checking active workspace membership.
- `apps/api/src/feedback/posts.service.ts` - Post creation with row-locked sequential numbering, board listing, and post detail.
- `apps/api/src/feedback/portal-posts.controller.ts` - Portal endpoints under `portal/:ws/:product`.
- `apps/api/src/feedback/feedback.module.ts` - NestJS module providing feedback controllers and services.
- `apps/api/src/app.module.ts` - Registered `FeedbackModule`.
- `apps/api/test/posts.test.ts` - Full test suite for public post contracts, concurrency, validation, and privacy.
- `apps/api/test/portal-isolation.test.ts` - Tenant isolation verification across workspace portal routes.
- `apps/api/test/cross-tenant.test.ts` - Scoped route discovery to `/workspaces/:ws`.
- `apps/api/test/public-contract.test.ts` - Added portal posts routes to public serialization schema assertions.
- `apps/api/test/support/seed.ts` - Seeded post for tenant B and exposed `postNumber`.

## Decisions Made

- Kept UUID as internal primary key for foreign keys and joined lookups while exposing per-product sequential number for URLs.
- Filtered open posts by default (`statuses.type NOT IN ('completed', 'closed')`) in board listing.
- Exported `engagedSql` as reusable SQL fragment for edit/delete lock checks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial vitest run failed with `TypeError: app.address is not a function` because `testApp.test` (better-auth helper) was passed to `supertest` instead of `testApp.http`. Corrected to `request(testApp.http)`.
- Initial POST request test returned 403 due to `OriginGuard` expecting `testApp.env.PUBLIC_URL`. Corrected origin headers in tests to `testApp.env.PUBLIC_URL`.

## Next Phase Readiness

- Plan 03-03 (SMTP compose pass-through and Brevo probe) can now run.
- Plan 03-04 can wire Next.js portal web pages to these API contracts.

---
*Phase: 03-feedback-board-conversations*
*Completed: 2026-10-03*
