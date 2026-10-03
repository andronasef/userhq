---
phase: 03-feedback-board-conversations
plan: 06
subsystem: api-web
tags: [votes, throttler, optimistic-ui, concurrency, playwright]

# Dependency graph
requires: ["03-01", "03-05"]
provides:
  - "Atomic idempotent voting endpoints (PUT/DELETE) at /api/v1/portal/:ws/:product/posts/:number/vote"
  - "VotesService with row-locking FOR UPDATE and version-preserving voteCount increment"
  - "Per-user and per-IP throttling infrastructure with UserThrottlerGuard and 429 rate_limited mapping"
  - "Interactive optimistic VoteButton component with queued in-flight state handling and login redirects"
  - "Concurrency test coverage proving zero race drift under 50-parallel and 20-voter loads"
  - "Browser backstop tests for rapid multi-click idempotence and accent contrast"
affects: [03-07, 03-08, 03-09, 03-12]

actuals:
  tokens: 42000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Drizzle FOR UPDATE row locking on post with ON CONFLICT DO NOTHING vote insert"
    - "Atomic vote_count delta updates leaving posts.version untouched"
    - "UserThrottlerGuard tracking user ID or IP, decorated with @Throttle"
    - "HttpStatus.TOO_MANY_REQUESTS mapped to rate_limited across global ApiErrorFilter"
    - "useMutation optimistic toggling with queued desired state for rapid clicks in VoteButton"

key-files:
  created:
    - apps/api/src/feedback/votes.service.ts
    - apps/api/src/feedback/portal-votes.controller.ts
    - apps/api/src/feedback/throttle.ts
    - apps/api/test/votes.test.ts
    - apps/api/test/browser/votes.spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/common/api-error.filter.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/web/components/board/vote-button.tsx

key-decisions:
  - "Select post FOR UPDATE in setVote transaction to prevent lock upgrade deadlocks between concurrent voters"
  - "Never bump posts.version on vote mutations so content edits remain cleanly versioned"
  - "Map 429 errors in ApiErrorFilter explicitly to rate_limited rather than falling into internal_error"
  - "Queue clicks in desiredVotedRef during in-flight mutations so multi-clicks settle on the exact intended state"
  - "Redirect signed-out voters directly to /login?next=… without an automated vote on return (PROD-06)"

requirements-completed: [POST-03, POST-04, PROD-06]

coverage:
  - id: D1
    description: "A signed-in user can vote via PUT and unvote via DELETE with exact vote counts"
    requirement: POST-03, POST-04
    verification:
      - kind: automated
        ref: "apps/api/test/votes.test.ts (tracer test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Voting is idempotent (repeat PUT keeps true and count; repeat DELETE keeps false and count)"
    requirement: POST-04
    verification:
      - kind: automated
        ref: "apps/api/test/votes.test.ts (idempotency test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "50 parallel PUTs by one user leave 1 vote row; 20 parallel users leave count 21 matching COUNT(*)"
    requirement: POST-04
    verification:
      - kind: automated
        ref: "apps/api/test/votes.test.ts (concurrency tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Voting on deleted, merged, unknown, or foreign posts returns 404 post_not_found"
    requirement: POST-04
    verification:
      - kind: automated
        ref: "apps/api/test/votes.test.ts (404 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "UserThrottlerGuard limits voting to 60/min and returns 429 rate_limited on 61st request"
    requirement: POST-04
    verification:
      - kind: automated
        ref: "apps/api/test/votes.test.ts (throttling test)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Playwright browser test proves rapid triple-clicks leave exact count surviving reloads"
    requirement: POST-04
    verification:
      - kind: automated
        ref: "apps/api/test/browser/votes.spec.ts (rapid clicks test)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Playwright browser test validates accent contrast rules for #2563EB (white) and #FACC15 (dark)"
    requirement: POST-03
    verification:
      - kind: automated
        ref: "apps/api/test/browser/votes.spec.ts (accent contrast test)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-10-03
status: complete
---

# Phase 03: Plan 06 Summary

**Votes: optimistic idempotent PUT/DELETE, atomic counter, per-user throttling, 429 rate_limited**

## Accomplishments

- Implemented `VotesService` with atomic transaction, `.for("update")` row lock on `posts`, and `onConflictDoNothing` insert/delete logic that adjusts `posts.vote_count` by `±1` only when a row is actually added or removed, without touching `posts.version`.
- Created `PortalVotesController` handling authenticated `PUT` and `DELETE` requests to `/api/v1/portal/:ws/:product/posts/:number/vote`, returning strongly typed `VoteResult` objects.
- Introduced `UserThrottlerGuard` tracking `req.user?.id ?? req.ip`, registered `ThrottlerModule.forRoot` in `AppModule`, and decorated both vote endpoints with 60 requests/minute limits.
- Configured global `ApiErrorFilter` to translate `HttpStatus.TOO_MANY_REQUESTS` into `{ code: "rate_limited", message: "Too many requests" }`.
- Upgraded `VoteButton` to an interactive client component wrapped in `QueryProvider`, executing optimistic updates with in-flight queueing (`desiredVotedRef`) and signed-out login redirection (`/login?next=...`).
- Built comprehensive concurrency and error tests in `apps/api/test/votes.test.ts` verifying 50 parallel requests from one user, 20 concurrent users, version invariance, and 429 rate limiting.
- Implemented Playwright browser backstops in `apps/api/test/browser/votes.spec.ts` verifying rapid multi-clicks against the live stack and testing computed contrast styles for `#2563EB` and `#FACC15`.

## Task Commits

1. **Task 1: Tracer - Votes service, portal votes controller, and interactive vote button tracer** - `92246dc`
2. **Task 2: Votes concurrency safety, throttling with 429 rate_limited, and auth enforcement** - `d8f3767`
3. **Task 3: Browser backstops for vote idempotency and accent contrast** - `0312f00`

## Verification

- `bun run build:packages`: Types and DB packages compiled cleanly.
- `apps/api` test suite:
  - `votes.test.ts` (8 tests passing)
  - `posts.test.ts` (8 tests passing)
  - `auth.test.ts` (14 tests passing)
  - `categories.test.ts` (6 tests passing)
  - `cross-tenant.test.ts` (26 tests passing)
  - `products.test.ts` (13 tests passing)
- `apps/api/test/browser/votes.spec.ts`: 2/2 tests passed in Playwright against Docker stack.
- `bun run typecheck`: 0 errors across all workspaces.
- `bun run lint`: 0 errors, 0 warnings across 220 files.

---
*Phase: 03-feedback-board-conversations*
*Completed: 2026-10-03*
