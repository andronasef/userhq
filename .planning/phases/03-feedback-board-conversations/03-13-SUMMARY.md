---
phase: 03-feedback-board-conversations
plan: 13
subsystem: email-notifications-unsub-mute
tags: [unsubscribe, rfc-8058, mute, post-mute, origin-guard]

# Dependency graph
requires: ["03-10", "03-09", "03-12"]
provides:
  - "UnsubscribeStateSchema and MuteResultSchema in @userhq/types"
  - "Reserved workspace slug 'unsubscribe' in RESERVED_WORKSPACE_SLUGS"
  - "SkipOriginCheck decorator and OriginGuard exemption for RFC 8058 automated one-click POST requests"
  - "UnsubscribeController handling GET, POST, DELETE /api/v1/unsubscribe/:token for global and post-scoped tokens"
  - "PortalMutesController handling PUT and DELETE /api/v1/portal/:ws/:product/posts/:number/mute"
  - "UnsubscribeView and /unsubscribe/[token] page with side-effect-free GET, one-click confirmation, undo, and settings link"
  - "MuteToggle button on post page with Bell/BellOff icons and aria-pressed"
  - "Suppression of notification emails for muted posts during outbox enqueuing and email worker dispatch"
affects: [03-14]

actuals:
  tokens: 42000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "OriginGuard exemption: SkipOriginCheck metadata decorator allows RFC 8058 automated POSTs without cookies or Origin headers"
    - "Safe link scanner protection: GET requests on both web page and API endpoint never mutate user preferences or mutes"
    - "Idempotent and reversible actions: Repeated POSTs remain unsubscribed/muted; DELETE reverses the action without side-effects"
    - "Independent preference scopes: Global opt-out and per-post mute operate independently"

key-files:
  created:
    - packages/types/src/account.ts
    - apps/api/src/email/unsubscribe.controller.ts
    - apps/api/src/feedback/portal-mutes.controller.ts
    - apps/api/test/unsubscribe.test.ts
    - apps/web/app/(app)/unsubscribe/[token]/page.tsx
    - apps/web/app/(app)/unsubscribe/[token]/unsubscribe-view.tsx
    - apps/web/components/post/mute-toggle.tsx
  modified:
    - packages/types/src/index.ts
    - packages/types/src/slugs.ts
    - apps/api/src/auth/decorators.ts
    - apps/api/src/auth/guards.ts
    - apps/api/src/email/email.module.ts
    - apps/api/src/feedback/feedback.module.ts
    - apps/api/test/public-contract.test.ts
    - apps/web/lib/api-server.ts
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx

key-decisions:
  - "RFC 8058 exemption: OriginGuard exempts only POST /api/v1/unsubscribe/:token where the HMAC token is the sole credential (D-25, Pitfall 5)"
  - "GET never mutates: Opening /unsubscribe/:token (page or API) does not alter database state, preventing automated email scanner prefetches from unsubscribing users (T-03-48)"
  - "Reserved workspace slug: 'unsubscribe' is added to RESERVED_WORKSPACE_SLUGS to prevent tenant slug collisions"
  - "Mute toggle visibility: Post-page MuteToggle bell renders only when viewer is signed in, in the conversation, and has global comment emails enabled"

requirements-completed: [NOTF-02]

coverage:
  - id: D1
    description: "One-click unsubscribe via RFC 8058 POST and web landing page; side-effect free GET, idempotent POST, reversible DELETE"
    requirement: NOTF-02
    verification:
      - kind: automated
        ref: "apps/api/test/unsubscribe.test.ts (tracer test)"
        status: pass
      - kind: automated
        ref: "apps/api/test/public-contract.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-post mute via post-scoped email token and post-page bell toggle; independent of global opt-out"
    requirement: NOTF-02
    verification:
      - kind: automated
        ref: "apps/api/test/unsubscribe.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/email.test.ts"
        status: pass
    human_judgment: false
---

# Plan 03-13: Unsubscribe & Mute Summary

Plan 03-13 delivered one-click email unsubscribe (RFC 8058), the `/unsubscribe/{token}` confirmation page, and per-post muting from email tokens and the post page bell.

## Accomplishments

1. **Unsubscribe API & Web Landing Page (Task 1):**
   - Defined `UnsubscribeStateSchema` and `MuteResultSchema` in `packages/types/src/account.ts`.
   - Added `"unsubscribe"` to `RESERVED_WORKSPACE_SLUGS` in `packages/types/src/slugs.ts`.
   - Added `SKIP_ORIGIN` and `@SkipOriginCheck()` decorator in `apps/api/src/auth/decorators.ts`.
   - Updated `OriginGuard` to inject `Reflector` and exempt `@SkipOriginCheck()` routes prior to checking Origin headers.
   - Implemented `UnsubscribeController` with `@Public()` handlers for `GET`, `@SkipOriginCheck()` `@HttpCode(200)` `POST`, and `DELETE /api/v1/unsubscribe/:token`.
   - Added `getUnsubscribe` in `apps/web/lib/api-server.ts`.
   - Created `/unsubscribe/[token]` Next.js server page and `UnsubscribeView` client component rendering `StatePage` with confirmation, done, and error states per UI-SPEC.
   - Added `/unsubscribe/:token` to public API contract tests in `apps/api/test/public-contract.test.ts`.
   - Implemented tracer test in `apps/api/test/unsubscribe.test.ts` verifying GET side-effect freedom, RFC 8058 no-Origin no-cookie automated POST, and token tamper resistance.

2. **Per-Post Muting & Post Page Bell (Task 2):**
   - Created `PortalMutesController` with `PUT` and `DELETE /api/v1/portal/:ws/:product/posts/:number/mute` (throttled at 30/min, returning `MuteResult`).
   - Registered `PortalMutesController` in `FeedbackModule`.
   - Created `MuteToggle` component with Bell / BellOff icons, `aria-pressed`, `aria-label="Mute email for this post"`, and Sonner toasts.
   - Rendered `MuteToggle` in `apps/web/app/[ws]/[product]/p/[ref]/page.tsx` header when `viewer.signedIn && viewer.inConversation && viewer.commentEmailsOn`.
   - Added tests in `apps/api/test/unsubscribe.test.ts` verifying post-scoped token lifecycle, `post_unavailable` state for deleted and merged posts, global opt-out independence, and outbox/worker suppression for muted posts.

## Verification

- Automated test suites passing:
  - `apps/api/test/unsubscribe.test.ts` (5 tests covering global unsubscribe tracer, post-scoped token lifecycle, deleted/merged posts, worker mute suppression, and portal mute API)
  - `apps/api/test/email.test.ts` (9 tests)
  - `apps/api/test/public-contract.test.ts` (1 test covering public serializer contracts)
  - `apps/api/test/auth.test.ts` (14 tests)
  - `apps/api/test/workspaces.test.ts` (39 tests)
- Zero typecheck errors across all workspaces (`bun run typecheck`).
- Zero lint warnings (`oxlint -c .oxlintrc.json`).
