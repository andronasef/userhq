# Phase 1 Plan 06: Shell Components, User Menu, Sign-Out, Session Keep-Alive, Global Pages, and E2E Flow Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Header Component (`apps/web/components/header.tsx`):**
  - Implemented RSC header mounted above `<main>` across all pages in `apps/web/app/layout.tsx`.
  - Server-rendered identity via `getMe()` (React `cache()`); renders wordmark link to `/`, signed-in `UserMenu` + `SessionKeepAlive`, and signed-out `SignInButton` within `<Suspense>` boundary.
  - Height `h-14`, border-b `border-border`, max width `5xl`.
- **UserMenu & Sign-Out Flow (`apps/web/components/user-menu.tsx`):**
  - "use client" menu triggered by a 40px `ghost` `icon` button with `aria-label="Open account menu"` wrapping a 32px (`size="sm"`) `Avatar`.
  - Renders user's display name (`truncate max-w-48`), separator, optional `Upload test` link to `/dev/upload` when `DEV_UPLOAD_PAGE === "true"`, and `Sign out` item.
  - Sign-out prevents default dropdown dismiss (`event.preventDefault()`), shows a spinning `LoaderCircle` and "Signing out…", executes `authClient.signOut()`, and navigates via `window.location.assign("/")` to ensure complete RSC session invalidation across all open tabs.
  - Inline error handling on failure: displays `role="alert"` destructive notice inside open menu without closing.
- **SignInButton (`apps/web/components/user-menu.tsx`):**
  - Client component reading `usePathname()` and `useSearchParams()`.
  - Automatically hidden on `/login`.
  - On all other routes, renders outline button linking to `/login?next=...` with re-encoded return path.
- **Avatar & Radix Primitives (`apps/web/components/ui/avatar.tsx`, `apps/web/components/ui/dropdown-menu.tsx`):**
  - `Avatar` built on individual package `@radix-ui/react-avatar` with `referrerPolicy="no-referrer"`, `alt=""`, 300 ms fallback delay, and `initials()` letter generator (fallback to Lucide `User` icon).
  - `DropdownMenu` built on individual package `@radix-ui/react-dropdown-menu` with styled `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, and `DropdownMenuSeparator`.
- **Initials Utility (`apps/web/lib/initials.ts`):**
  - Extracts the uppercase first letter of the first two whitespace-separated words using Unicode `\p{L}` matching. Returns empty string if no letters are present.
  - Never references email.
  - Unit tests: 7/7 passing in `apps/web/lib/initials.test.ts`.
- **Session Keep-Alive (`apps/web/components/session-keepalive.tsx`):**
  - Client component calling `authClient.getSession()` on mount and on document `visibilitychange` (when tab returns to visible state).
  - Throttled to at most once per 10 minutes to avoid redundant traffic while ensuring Better Auth's sliding session cookie refresh reaches the browser.
- **Global Error and 404 Pages (`apps/web/app/not-found.tsx`, `apps/web/app/error.tsx`):**
  - `not-found.tsx`: RSC with metadata "Page not found · UserHQ", h1 "Page not found", description, and "Go to home" outline link.
  - `error.tsx`: "use client" boundary with document.title "Error · UserHQ", logging digest to console without leaking details, and "Try again" reset button.
- **Home Page Update (`apps/web/app/page.tsx`):**
  - Signed-in state: 64px (`size="lg"`) Avatar, h1 "Signed in as {name}" with `break-words`, 14-day sliding session notice, and conditional `Test image uploads →` link.
  - Signed-out state: "You're not signed in" copy and "Sign in" button.
- **E2E Integration Test Suite (`apps/api/test/e2e/session-flow.e2e.test.ts`, `apps/api/vitest.e2e.config.ts`):**
  - Configured standalone Vitest config targeting running Docker stack at `http://localhost:8080` and PostgreSQL overlay at `127.0.0.1:5433`.
  - Mints real sessions via Better Auth test plugin sharing stack database and secret.
  - 6/6 test cases passing:
    1. Two consecutive requests to `/` with session cookie return HTTP 200 with server-rendered identity and menu trigger.
    2. Non-existent page returns HTTP 404 with menu trigger still rendered in header.
    3. `/login?next=%2F` with active session redirects (HTTP 3xx) to safe return path.
    4. User email never appears in any rendered HTML across all responses.
    5. Sign-out via `/api/auth/sign-out` revokes session; subsequent `/api/v1/me` returns `null` and `/` renders signed-out state.
    6. Signed-out request to `/` renders "not signed in" and `/login` link.

---

## 2. Verification Summary

| Check | Command / Assertion | Result |
|-------|---------------------|--------|
| Web Unit Tests | `(cd apps/web && bun run test)` | 27 passed (initials, loginErrors, safeNext) |
| E2E Session Flow Suite | `(cd apps/api && bun run test:e2e test/e2e/session-flow.e2e.test.ts)` | 6 passed (all cases green in ~1s) |
| Full Repo Tests | `bun run test` | 76 unit/integration tests passed |
| Linter | `bun run lint` | 0 errors, 0 warnings (56 files) |
| Typecheck | `bun run typecheck` | 0 errors across all 4 packages |
| Non-leak email check | E2E assertion across all HTML pages | Verified: 0 occurrences of user email in HTML |

---

## 3. Deviations & Observations

- **E2E Mint Helper Pattern:** The E2E test instantiates `createAuth(db, env, [testUtils()])` against `E2E_DATABASE_URL` (127.0.0.1:5433) using the `BETTER_AUTH_SECRET` from `.env.docker`. Minted users are created using `ctx.test.createUser` and `ctx.test.saveUser`, and session cookies are generated using `ctx.test.getCookies({ userId, domain: "localhost" })`. Cleanup targets `schema.user` on test teardown. This pattern is reusable for Plan 01-08 (`/dev/upload` e2e).
- **Radix Avatar SSR:** Radix's `Avatar.Root` server-renders cleanly with fallback markup inside the initial HTML snapshot, while `Avatar.Image` mounts and hydrates client-side without hydration mismatches or layout shifts.

---

## 4. Next Step

Advance to **Wave 7 — Plan 01-08**:
- Dev-only `/dev/upload` page with runtime flag gating (`DEV_UPLOAD_PAGE`), interactive file input, TanStack Mutation upload pipeline, format/dimensions/size readout, copy button, and error mapping.
- Routed upload e2e test tying web and API tracks together.
