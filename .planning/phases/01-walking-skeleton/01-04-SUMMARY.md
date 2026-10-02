# Phase 1 Plan 04: Web Shell, Next.js / Vinext, Tailwind v4 Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Vinext & Tailwind v4 Web Application (`apps/web`):**
  - Configured `apps/web/vite.config.ts` importing `vinext/vite/plugin` and `@vitejs/plugin-react`.
  - Configured `apps/web/next.config.ts` with `output: "standalone"` to satisfy both the production Vinext build and the dual-build Next.js canary.
  - Configured Tailwind v4 PostCSS integration in `apps/web/postcss.config.mjs` using `@tailwindcss/postcss`. No obsolete `tailwind.config.*` files exist.
  - Implemented Design Tokens in `apps/web/app/globals.css` with `@import "tailwindcss"`, `@theme inline` mapping to standard UI-SPEC oklch tokens (`--background`, `--foreground`, `--primary`, `--border`, etc.), and strict light-mode defaults (no `.dark` classes).
  - Configured semantic frame in `apps/web/app/layout.tsx` using Inter Variable font and metadata.
  - Built Server Component identity seam in `apps/web/app/page.tsx` rendering server-fetched user identity.
- **Server-Only API Client (`apps/web/lib/api-server.ts`):**
  - Built `apiServer` helper with `server-only` import.
  - Forwards solely the `Cookie` header across internal container boundary to `API_INTERNAL_URL` (`http://api:4000`), never leaking internal headers, hosts, or tokens.
  - Wrapped `getMe` in React `cache()`, catching network errors and returning `{ user: null }` gracefully when API is unreachable.
- **Production Containerization (`apps/web/Dockerfile`, `compose.yaml`):**
  - Built multi-stage Dockerfile: Bun build stage compiles standalone server (`vinext build`), Node 24 runtime stage executes `node server.js` as unprivileged `node` user.
  - Verified user inside container: `id -un` reports `node`.
  - Added `web` service to `compose.yaml` with internal network connectivity and zero published host ports.
- **Reverse Proxy Routing (`compose.local.yaml`, `docker/Caddyfile.local`):**
  - Created Caddy reverse proxy routing `/api/*` and `/uploads/*` to `api:4000` and all other traffic to `web:3000`.
  - Published only port `8080` to `127.0.0.1` locally, establishing the sole browser entrypoint.
- **Dual Build Canary & Escape Hatch:**
  - Ran `bun run --filter '@userhq/web' build:next` verifying the exact same app code compiles cleanly under Next.js 16 (Turbopack) as well as Vinext (ROADMAP success criterion 5).

---

## 2. Plan Verification & Key Metrics

### Exact Scaffold / Adopted Files
- `apps/web/vite.config.ts` (configured with `vinext/vite/plugin`)
- `apps/web/next.config.ts` (`output: "standalone"`)
- `apps/web/postcss.config.mjs` (`@tailwindcss/postcss`)
- `apps/web/app/globals.css` (Tailwind v4 with UI-SPEC oklch tokens)
- `apps/web/app/layout.tsx` (root layout with Inter font)
- `apps/web/app/page.tsx` (RSC home page)
- `apps/web/lib/api-server.ts` (RSC client with cookie forwarding)
- `apps/web/Dockerfile` (multi-stage standalone image)
- `docker/Caddyfile.local` (local reverse proxy)
- `compose.local.yaml` (local Caddy and DB exposure overlay)

### Single React Copy Verification
- Inside the running `userhq-web-1` container, scanned all `node_modules` for `react` and `react-dom` versions:
  - `react`: `Set { '19.3.0' }`
  - `react-dom`: `Set { '19.3.0' }`
- Verified: exactly one React copy (19.3.0) across all dependencies.

### Runtime Environment Verification (Pitfall 12)
- Recreated web container without image rebuild with `API_INTERNAL_URL=http://api:4999`.
- Verified `GET http://localhost:8080/` returned HTTP 200 with the signed-out fallback text ("You're not signed in").
- Web container log captured expected runtime failure line:
  ```
  getMe failed: fetch failed
  ```
- Restored `API_INTERNAL_URL=http://api:4000`; verified `GET /api/v1/me` returned `{"user":null}` and home page returned HTTP 200.

### Client Asset Hygiene
- Scanned all client assets (`.js`, `.mjs`, `.css`, `.html`) under the standalone client build directory inside the web container.
- Matches for `API_INTERNAL_URL` or `api:4000`: **0 hits**. Internal network URLs are never leaked to client bundles.

### TypeScript Config Adjustments
- `next build` canary automatically updated `apps/web/tsconfig.json`:
  - Added `"plugins": [{ "name": "next" }]`
  - Added `".next/dev/types/**/*.ts"` to `"include"`
  - Updated `"jsx": "react-jsx"`
- Committed into git (`cc846ff`) to maintain a clean git tree on subsequent builds.

---

## 3. Verification Summary

| Check | Command / Assertion | Result |
|-------|---------------------|--------|
| Shell verification | `bun run stack:up && node -e ...` | `shell-ok 200 true` |
| Next build canary | `bun run --filter '@userhq/web' build:next` | Succeeded in 3.57s |
| Git cleanliness | `git status --porcelain -- apps/web/tsconfig.json` | Clean (no uncommitted diffs) |
| Runtime React versions | In-container scan of `package.json` | `react`: `19.3.0`, `react-dom`: `19.3.0` |
| Client bundle leak scan | In-container scan for internal URLs | 0 hits |
| Runtime env switch | Recreated with bad URL without rebuild | HTTP 200, logged `getMe failed: fetch failed` |
| Web container non-root | `exec -T web id -un` | `node` |
| Linter | `bun run lint` | 0 errors, 0 warnings (25 files, 99 rules) |

---

## 4. Next Step

Proceed with Wave 4 parallel track:
- **Plan 01-07:** Dev-Only Local Upload Spike & Pipeline (Sharp WebP transcoding, Multer, persistent volume).
