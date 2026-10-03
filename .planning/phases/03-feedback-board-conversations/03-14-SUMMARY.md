---
phase: 03-feedback-board-conversations
plan: 14
subsystem: account-settings-preferences-responsive
tags: [account-settings, preferences, user-menu, playwright, responsive]

# Dependency graph
requires: ["03-13"]
provides:
  - "AccountSchema and UpdatePreferencesInputSchema in @userhq/types"
  - "AccountController and AccountModule in apps/api/src/account with GET /api/v1/account and PATCH /api/v1/account/preferences"
  - "Account page at /account and EmailPreferences toggle component"
  - "UserMenu Account settings entry linking to /account"
  - "Proxy matcher protection for /account"
  - "320px responsive layout check and Playwright backstop test in portal-320.spec.ts"
affects: [03-15]

actuals:
  tokens: 48000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "No-email account response: GET /api/v1/account selects only name, image, commentEmails, and calculates isPlatformOwner without exposing email (T-03-49)"
    - "User-scoped preference patch: PATCH /api/v1/account/preferences modifies only the authenticated user (@CurrentUser) with UserThrottlerGuard"
    - "Responsive flex wrapping on mobile: flex-col sm:flex-row on post page header to prevent horizontal overflow at 320px screen width"

key-files:
  created:
    - apps/api/src/account/account.controller.ts
    - apps/api/src/account/account.module.ts
    - apps/api/test/account.test.ts
    - apps/api/test/browser/portal-320.spec.ts
    - apps/web/app/(app)/account/page.tsx
    - apps/web/app/(app)/account/email-preferences.tsx
  modified:
    - packages/types/src/account.ts
    - packages/types/src/index.ts
    - apps/api/src/app.module.ts
    - apps/web/components/user-menu.tsx
    - apps/web/proxy.ts
    - apps/web/lib/api-server.ts
    - apps/web/app/[ws]/[product]/p/[ref]/page.tsx

key-decisions:
  - "No email field in AccountSchema: /api/v1/account never returns email to prevent client-side email exposure"
  - "Immediate preference toggle: Checkbox disabled during PATCH request; toasts immediate feedback; reverts state and displays alert on error"
  - "Post header 320px wrapping: Changed header title & action buttons container to 'flex-col sm:flex-row' so Mute and Admin action buttons stack neatly beneath the title on viewports under 640px"

requirements-completed: [NOTF-02]

coverage:
  - id: D1
    description: "Account settings with comment-email toggle, user menu navigation, and proxy authentication protection"
    requirement: NOTF-02
    verification:
      - kind: automated
        ref: "apps/api/test/account.test.ts (tracer test)"
        status: pass
      - kind: automated
        ref: "apps/api/test/unsubscribe.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "320px mobile viewport backstop ensuring board rows and post headers fit without horizontal scroll"
    requirement: NOTF-02
    verification:
      - kind: automated
        ref: "apps/api/test/browser/portal-320.spec.ts"
        status: pass
    human_judgment: false
---

# Plan 03-14: Account Settings & 320px Layout Backstop Summary

Plan 03-14 implemented the account settings page with the global comment email preference toggle, added the account settings entry to the user menu, and verified 320px responsive compatibility with Playwright.

## Accomplishments

1. **Account Settings & Preferences Toggle (Task 1):**
   - Defined `AccountSchema` and `UpdatePreferencesInputSchema` in `packages/types/src/account.ts`.
   - Created `AccountController` and `AccountModule` in `apps/api/src/account` exposing:
     - `GET /api/v1/account`: returns `{ name, image, commentEmails, isPlatformOwner }` without leaking `email`.
     - `PATCH /api/v1/account/preferences`: throttled at 30/min, toggles `commentEmails` for the authenticated caller.
   - Imported `AccountModule` in `apps/api/src/app.module.ts`.
   - Added `"/account"` to the proxy middleware matcher in `apps/web/proxy.ts` to redirect unauthenticated visitors to `/login?next=/account`.
   - Added `Account settings` item with `UserCog` icon in `apps/web/components/user-menu.tsx`.
   - Implemented `getAccount` in `apps/web/lib/api-server.ts`.
   - Built `/account` page with `EmailPreferences` component:
     - Native checkbox `Email me about new comments on posts I'm part of` with helper copy.
     - Immediate PATCH on change with disabled state during pending save.
     - Sonner toasts and fallback Alert on network or validation failures.
     - Layout slot prepared for Plan 03-15 Danger zone.
   - Verified tracer tests in `apps/api/test/account.test.ts` covering preference updates, pending batch cancellation on turn-off, and absence of email in the GET payload.

2. **320px Responsive Layout Backstop (Task 2):**
   - Created `apps/api/test/browser/portal-320.spec.ts` using Playwright at 320×640 viewport.
   - Identified and resolved layout overflow on the post detail header where the post title, Mute button, and Admin menu trigger competed for horizontal space.
   - Updated `apps/web/app/[ws]/[product]/p/[ref]/page.tsx` header container to use `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4` and `shrink-0` on action buttons.
   - Verified that both the board row (with 120-character post title) and the post header (with Admin menu open and Mute toggled) fit cleanly at 320px with `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

## Verification

- Automated test suites passing:
  - `apps/api/test/account.test.ts` (tracer test and auth guards)
  - `apps/api/test/unsubscribe.test.ts` (5 tests)
  - `apps/api/test/browser/portal-320.spec.ts` (1.9s Playwright test verifying 320px responsiveness)
- Zero typecheck errors across all workspaces (`bun run typecheck`).
- Zero lint warnings (`oxlint -c .oxlintrc.json`).
