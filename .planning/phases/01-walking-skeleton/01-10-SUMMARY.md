# Phase 1 Plan 10: GitHub Actions CI, Deploy Runbook, and Live VPS Deployment Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **GitHub Actions CI Pipeline (`.github/workflows/ci.yml`):**
  - Triggers on `pull_request`, `push` to `main`, and `workflow_call` (for reuse in tag release workflow).
  - Pinned all actions to full commit SHAs (`actions/checkout@11bd719`, `oven-sh/setup-bun@0c5077e`, `actions/setup-node@1d0ff46`).
  - Integrated PostgreSQL 18 and Mailpit service containers for automated testing.
  - Full CI verification pipeline passed in **1m 49s** with zero errors:
    - `bun install --frozen-lockfile`
    - `oxlint -c .oxlintrc.json` (0 warnings, 0 errors across 68 files)
    - `typecheck` across all 4 workspaces
    - `build:packages`
    - `@userhq/api build`
    - Automated unit and integration test suites (53 tests across db, api, and web)
    - `@userhq/web build` (`vinext build`)
    - `@userhq/web build:next` (`next build` escape hatch canary)
    - `@userhq/db db:check` (`drizzle-kit check`)
    - `docker compose build` verification with non-secret environment variables.
  - CI Run: https://github.com/andronasef/userhq/actions/runs/36953037557 (Conclusion: **success**).

- **Deployment Runbook (`docs/deploy.md`):**
  - Full environment matrix and operational guidelines.
  - Dokploy settings documented: Isolated Deployments requirement, compose paths, Traefik domain path routing (`/`, `/api`, `/uploads`), port mappings, and Let's Encrypt SSL/TLS.
  - Environment variable specifications with distinct credentials per environment.
  - OAuth callback requirements for Google Cloud Console and GitHub Developer Settings.

- **Linux Container CI Dry-Run:**
  - Built `userhq-ci-base` image from `apps/api/Dockerfile` stage `base` (Node 24 + Bun 1.4.2).
  - Clean export of committed tree tested inside Linux container against Compose service containers.
  - Verified lockfile reproducibility (`606 packages installed`).
  - Fixed TypeScript monorepo source type export bootstrap: updated `packages/types` and `packages/db` to export `"./src/index.ts"` for types so `typecheck` runs successfully on clean checkouts before `dist` is generated.
  - Fixed relative imports in `apps/web` to use standard extensionless imports, enabling both `vinext build` and `next build` (canary) to compile without module resolution errors.

- **Live Stack Deployment & HTTPS Verification (`https://userhq.increasinglabs.com/`):**
  - Live production stack verified over public HTTPS:
    - `GET /api/v1/health` → HTTP/2 200 `{"status":"ok","db":"up"}` (PostgreSQL and NestJS healthy).
    - `GET /` → HTTP/2 200 (Server-rendered signed-out home page).
    - `GET /api/v1/me` → HTTP/2 200 `{"user":null}` (API router path `/api` working properly).
    - `GET /uploads/does-not-exist.webp` → HTTP/2 404 from NestJS (`stat '/data/uploads/...'` confirming Traefik `/uploads` path routing to API container).
    - `GET /login` → HTTP/2 200 (SSR login page with Google and GitHub OAuth providers).

---

## 2. Verification Evidence

### GitHub Actions CI
- **Run URL:** https://github.com/andronasef/userhq/actions/runs/36953037557
- **Conclusion:** `success`
- **Duration:** 1m 49s
- **Commit:** `24867e1`

### Live Domain Verification Output
```bash
# Health check
$ curl -s https://userhq.increasinglabs.com/api/v1/health
{"status":"ok","db":"up"}

# Current user session
$ curl -s https://userhq.increasinglabs.com/api/v1/me
{"user":null}

# Traefik /uploads routing to NestJS
$ curl -s https://userhq.increasinglabs.com/uploads/does-not-exist.webp
{"code":"not_found","message":"ENOENT: no such file or directory, stat '/data/uploads/does-not-exist.webp'"}
```

---

## 3. Deviations & Operator Preferences

- **Single Live Environment:** The operator configured the live production stack directly on `https://userhq.increasinglabs.com/` deploying from `main`, electing to test changes locally rather than maintaining a separate staging stack for Phase 1.
- **SSH Access Deferred:** Direct remote SSH access from the dev box was deferred per operator instruction; all verification was completed via GitHub API, GitHub Actions CLI (`gh`), and public HTTPS endpoint validation.

---

## 4. Next Step

Advance to **Wave 10 — Plan 01-11**:
- Tag-driven release workflow (`.github/workflows/release.yml`).
- Brevo SMTP reachability verification.
- Final Phase 1 milestone verification and sign-in gate.
