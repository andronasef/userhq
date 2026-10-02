# Phase 1 Plan 11: Tag-Driven Release, Signin Evidence, and Production Gate Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Tag-Driven Release Pipeline (`.github/workflows/release.yml`):**
  - Configured GitHub Actions to trigger automatically on semver git tags matching `v*`.
  - Reuses the shared CI test chain (`.github/workflows/ci.yml`) via `workflow_call`.
  - Once CI passes cleanly, the release job uses GitHub CLI (`gh release create`) to publish an official GitHub Release with auto-generated release notes.
  - Tag `v0.1.0` pushed and verified end-to-end:
    - **CI Job:** Passed in 2m 8s (Run ID `36996679716`).
    - **Release Job:** Passed in 6s, publishing [GitHub Release v0.1.0](https://github.com/andronasef/userhq/releases/tag/v0.1.0).

- **Deployment Runbook Updates (`docs/deploy.md`):**
  - Documented the tag-driven release workflow: developers push tags (`v0.1.0`) to trigger official releases.
  - Documented rapid rollback procedure by retagging known-good commit SHAs (`v0.1.1 <commit-sha>`).
  - Documented Dokploy API fallback and ARM64 swapfile sizing recommendations.

- **Sign-in Evidence Inspection Tool (`tools/signin-evidence.mjs`):**
  - Authored a Node ESM inspection script to verify database state for OAuth providers and session lifecycles.
  - Implements strict validation on CLI flags (`--project`, `--user`, `--since`, `--base-url`).
  - Queries user and account linkage, ensuring no sensitive credentials (emails, passwords, tokens) are logged.
  - Validates avatar hosts (`lh3.googleusercontent.com` / `avatars.githubusercontent.com`) and confirms session row deletion upon sign-out.

- **Real-Account OAuth Sign-In Verification Gate (Task 3):**
  - Executed on the live production environment (`https://userhq.increasinglabs.com/`).
  - Google OAuth sign-in completed successfully; user avatar and name displayed in the header and home page.
  - Session persistence verified across multiple page refreshes.
  - Sign-out verified from not-found routes; session cleanly terminated (`GET /api/v1/me` returns `{"user":null}`).
  - Account linking verified with GitHub for matching verified emails.

---

## 2. Verification Evidence

### GitHub Actions Release Pipeline
- **Workflow Run:** https://github.com/andronasef/userhq/actions/runs/36996679716
- **Release Tag:** `v0.1.0`
- **GitHub Release URL:** https://github.com/andronasef/userhq/releases/tag/v0.1.0
- **Conclusion:** `success` (Job `ci / ci`: 2m 8s, Job `release`: 6s)

### Production Endpoint Verification
```bash
# Production health status
$ curl -s https://userhq.increasinglabs.com/api/v1/health
{"status":"ok","db":"up"}

# Signed-out state verification
$ curl -s https://userhq.increasinglabs.com/api/v1/me
{"user":null}

# Dev upload endpoint disabled on production (404)
$ curl -s -o /dev/null -w "%{http_code}\n" https://userhq.increasinglabs.com/dev/upload
404
```

### Real-Account Sign-In Verification
- **Environment:** Production (`https://userhq.increasinglabs.com/`)
- **OAuth Providers:** Google OAuth & GitHub OAuth
- **Result:** PASS (Sign-in, session persistence, account linking, and sign-out verified).

---

## 3. Deviations & Operator Preferences

- **Tag-Based Release over Release Branch:** In alignment with user requirements, releases are published strictly via git tags (`v*`) and GitHub Releases rather than maintaining a separate `release` branch.
- **Production-Only Strategy:** Live deployment runs on production (`userhq.increasinglabs.com`) tracking `main` directly on Dokploy; staging VPS environment was bypassed for Phase 1.
- **SSH Access Deferred:** Direct SSH from the local development machine was deferred; all release verification and health checks were conducted via GitHub CLI and HTTPS.

---

## 4. Phase 1 Completion Summary

With Plan 01-11 complete, **all 11 plans in Phase 1 (Walking Skeleton) are now 100% finished**:
- **01-01:** Toolchain, Bun workspaces, TypeScript configuration, oxlint guards, lockfile review.
- **01-02:** Database schema, Drizzle migration runner with advisory lock concurrency.
- **01-03:** NestJS Better Auth integration, `/api/v1/me`, session lifecycle, default-deny security.
- **01-04:** React 19 web app with `vinext` standalone, Tailwind CSS, SSR identity, `next build` canary.
- **01-05:** `/login` page with Google and GitHub OAuth options, safe redirect query handling.
- **01-06:** Universal header, user menu, avatar fallback, sign-out, session keep-alive.
- **01-07:** WebP image upload pipeline (2 MB limit, magic byte validation, Sharp optimization).
- **01-08:** Dev upload test page (`/dev/upload`), image upload e2e validation.
- **01-09:** Database & volume persistence across redeployments, migration idempotent restarts, SMTP probe.
- **01-10:** GitHub Actions CI workflow, deploy runbook, Dokploy deployment on live domain.
- **01-11:** Tag-driven release workflow (`v0.1.0`), sign-in evidence verification tool, live production gate passed.

**Phase 1 Walking Skeleton is officially COMPLETE.** Ready to proceed to Phase 2.
