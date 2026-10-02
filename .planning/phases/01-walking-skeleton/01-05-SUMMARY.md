# Phase 1 Plan 05: /login Page, Provider Buttons, Safe Return Path, Error Mapping, and Caddy Dev Loop Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Dedicated `/login` Route (`apps/web/app/login/page.tsx`):**
  - Implemented RSC route with metadata title "Sign in · UserHQ".
  - Awaits Next 16 `searchParams` for `next` and `error`.
  - Checks session via `getMe()`; redirects signed-in users immediately to `safeNext(next)`.
  - Server-renders UI-SPEC login card (centred, max-w-sm, rounded-lg, border-border, bg-card, p-6 sm:p-8) with h1 "Sign in to UserHQ" and copy "Use your Google or GitHub account to continue.".
- **Client Provider Buttons (`apps/web/app/login/login-buttons.tsx`):**
  - "use client" component rendering equal-weight outline buttons for Google and GitHub with brand icons.
  - Wires `authClient.signIn.social` with `callbackURL = safeNext(next)` and `errorCallbackURL = /login?next=...`.
  - Pending states: when a provider button is clicked, both buttons are disabled, and the clicked button shows a spinning `LoaderCircle` and "Redirecting to Google…" or "Redirecting to GitHub…".
  - On network failure or rejection, re-enables buttons and displays "Couldn't start sign-in" alert.
- **Open-Redirect Guard (`apps/web/lib/safe-next.ts`):**
  - Validates relative same-origin paths, strictly returning `/` on protocol-relative (`//`), backslashes (`\`), `/api/*`, `/login*`, array inputs, non-relative schemes, control characters, or unparseable URLs.
  - Accommodates query strings and hashes on valid relative targets.
  - Unit tests: 12/12 passing in `apps/web/lib/safe-next.test.ts`.
- **OAuth Error Mapping & Reflected XSS Prevention (`apps/web/lib/login-errors.ts`):**
  - Complete mapping for all UI-SPEC error codes: `access_denied`, `state_mismatch`, `state_not_found`, `state_invalid`, `please_restart_the_process`, `account_not_linked`, `unable_to_link_account`, `email_not_found`, `unable_to_get_user_info`, `invalid_code`, `no_code`, `request_failed`, and fallback `Sign-in failed`.
  - Strict regex validator `isDisplayableErrorCode` (`^[a-z0-9_]{1,64}$`) ensuring untrusted codes or injection payloads are never rendered in the "Error code: {code}" line.
  - `error_description` is NEVER read anywhere in `apps/web`.
  - In Caddy reverse proxies (`Caddyfile.local` and `Caddyfile.dev`), configured `uri query -error_description` to drop the attacker-controlled query parameter before upstream SSR serialization.
  - Unit tests: 8/8 passing in `apps/web/lib/login-errors.test.ts`.
- **UI Components (`apps/web/components/ui/`):**
  - `Button` (`components/ui/button.tsx`) with CVA variants (`default`, `outline`, `ghost`) and sizes (`default`, `lg`, `icon`), using Radix `@radix-ui/react-slot` without banned barrels.
  - `Alert` (`components/ui/alert.tsx`) with destructive (`role="alert"`) and success (`role="status"`) variants using Lucide icons.
  - `provider-icons.tsx` with SVG `GoogleIcon` and `GitHubIcon`.
- **Better Auth React Client (`apps/web/lib/auth-client.ts`):**
  - Configured `createAuthClient` from `better-auth/react` with `basePath: "/api/auth"` bound to same origin.
- **Caddy Dev Router (`docker/Caddyfile.dev`, `compose.dev.yaml`):**
  - Created Caddy dev router proxying `http://localhost`: `/api/*` and `/uploads/*` to `host.docker.internal:4000`, all other requests to `host.docker.internal:3000`.
  - Published Caddy on `127.0.0.1:80:80` in `compose.dev.yaml` with `host.docker.internal:host-gateway`.

---

## 2. Verification Summary

| Check | Command / Assertion | Result |
|-------|---------------------|--------|
| Task 1 Prod Stack Login | `node -e ...` | `login-ok 200 github.com` |
| Task 2 Unit Tests | `(cd apps/web && bun run test)` | 20 passed (12 safeNext, 8 loginErrors) |
| Task 2 Error SSR & Reflected XSS | `node -e ...` | `errors-ok` |
| Banned `error_description` check | `grep -rn "error_description" apps/web/app apps/web/lib apps/web/components` | 0 hits |
| Linter | `bun run lint` | 0 warnings, 0 errors (44 files) |
| Typecheck | `bun run typecheck` | 0 errors across all 4 packages |
| Full Repo Tests | `bun run test` | All unit and integration test suites passing |

---

## 3. Deviations & Observations

- **Caddy Query Parameter Stripping:** In Vinext SSR, all request search parameters are automatically serialized into the client hydration script (`nav.searchParams`). To guarantee defense-in-depth and prevent reflected text payloads from appearing anywhere in the HTML, `uri query -error_description` was configured in Caddy, cleanly stripping the parameter before passing to the Node/Vinext runtime.
- **React SSR Comment Boundary:** React 19 separates adjacent JSX text nodes and dynamic interpolations (`Error code: {code}`) with an HTML comment `<!-- -->`. Using a single template literal `{`Error code: ${code}`}` resolved this to render clean contiguous text `Error code: access_denied`.

---

## 4. Next Step

Advance to **Wave 6 — Plan 01-06**:
- Global Header and user menu (avatar/fallback, display name, email, role badge, DropdownMenu with sign-out).
- Browser keep-alive ping for 30-day session extension.
- Global error and not-found boundaries.
- Session e2e tests.
