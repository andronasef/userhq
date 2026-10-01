---
phase: 01-walking-skeleton
plan: 01
subsystem: toolchain
tags: [bun, workspaces, oxlint, supply-chain, contracts, types]
requires: []
provides:
  - Bun workspace monorepo layout (root, apps/api, apps/web, packages/db, packages/types)
  - Pinned exact catalog dependencies (React 19.3.0, Zod 4.6.5, TypeScript 6.0.3)
  - Human-reviewed text lockfile (bun.lock) with @swc/core trusted
  - Shared contracts package (@userhq/types) with tsdown build
  - Oxlint configuration with custom AST plugin (userhq/no-import-meta-env, userhq/no-exclusion-columns) and restricted web imports
affects:
  - packages/types
  - packages/db
  - apps/api
  - apps/web
tech-stack:
  added:
    - bun@1.4.2
    - typescript@6.0.3
    - zod@4.6.5
    - react@19.3.0
    - react-dom@19.3.0
    - react-server-dom-webpack@19.3.0
    - oxlint@1.86.0
    - prettier@3.9.9
    - tsdown@0.23.0
    - colima (Docker 29.5.2)
  patterns:
    - Isolated linker in bunfig.toml
    - Bun workspaces catalog for shared versions
    - AST-based lint rules via oxlint jsPlugins
    - Exact version pins across all package manifests
key-files:
  created:
    - package.json
    - bunfig.toml
    - bun.lock
    - .dockerignore
    - .oxlintrc.json
    - tools/oxlint-userhq.mjs
    - tools/lint-rules.test.mjs
    - packages/types/package.json
    - packages/types/tsconfig.json
    - packages/types/src/index.ts
    - packages/db/package.json
    - apps/api/package.json
    - apps/web/package.json
  modified:
    - .gitignore
key-decisions:
  - "D-01-01-01: Pinned exact package versions without range operators across all 5 package manifests, resolving helmet@8.3.0, postcss@8.5.28, prettier@3.9.9, and using root catalog for React, Zod, and TypeScript."
  - "D-01-01-02: Trusted @swc/core in root package.json trustedDependencies per human approval in Task 2 review."
  - "D-01-01-03: Adopted native oxlint jsPlugins for AST-based lint enforcement of userhq/no-import-meta-env and userhq/no-exclusion-columns, proven by 26 passing node:test fixture cases."
  - "D-01-01-04: Started Colima 0.10.3 to provide Docker engine 29.5.2 on macOS (Darwin arm64) to satisfy preflight requirements for local containerized tests."
requirements-completed: [AUTH-01, AUTH-02, UPLD-01]
duration: 15 min
completed: 2026-10-02T02:22:46Z
coverage:
  - deliverable: "Preflight verification of Bun 1.4.2 and running Docker engine"
    verification:
      kind: command
      ref: "bun --version && docker info --format '{{.ServerVersion}}'"
      status: pass
    human_judgment: false
  - deliverable: "Pinned root Bun monorepo workspace and manifests with exact dependency versions"
    verification:
      kind: command
      ref: "node -e '/* check no range operators in manifests */'"
      status: pass
    human_judgment: false
  - deliverable: "Human supply-chain review and committed bun.lock"
    verification:
      kind: command
      ref: "git ls-files --error-unmatch bun.lock && bun install --frozen-lockfile"
      status: pass
    human_judgment: false
  - deliverable: "Shared @userhq/types contracts built with tsdown and importable by apps/api"
    verification:
      kind: command
      ref: "bun run --filter '@userhq/types' build && cd apps/api && node -e \"import('@userhq/types')\""
      status: pass
    human_judgment: false
  - deliverable: "Oxlint rules enforcing web import boundaries, no-import-meta-env, and no-exclusion-columns"
    verification:
      kind: command
      ref: "bun run test:lint-rules"
      status: pass
    human_judgment: false
---

# Phase 01 Plan 01: Toolchain, Workspaces, Contracts, and Lint Rules Summary

**Substantive deliverable:** Stand up the Bun-workspace monorepo toolchain with exact dependency pins, human-reviewed `bun.lock`, shared `@userhq/types` Zod/TypeScript contracts built via `tsdown`, and Oxlint boundary and AST-based privacy/escape-hatch lint guards verified by test fixtures.

## Accomplishments

1. **Preflight Environment Verified:**
   - Bun: `1.4.2`
   - Docker Engine: `29.5.2` (running via Colima on Darwin arm64)

2. **Monorepo Workspaces & Exact Pins:**
   - Configured root `package.json` with `workspaces: ["apps/*", "packages/*"]` and a shared `catalog` pinning `react@19.3.0`, `react-dom@19.3.0`, `react-server-dom-webpack@19.3.0`, `zod@4.6.5`, and `typescript@6.0.3`.
   - Pinned exact versions across all 5 manifests (`package.json`, `packages/types/package.json`, `packages/db/package.json`, `apps/api/package.json`, `apps/web/package.json`). Zero range operators (`^`, `~`, `*`) used.
   - Pinned range packages: `helmet@8.3.0`, `postcss@8.5.28`, `prettier@3.9.9`.

3. **Supply-Chain Verification:**
   - Completed human-action checkpoint for supply-chain review.
   - Configured `"trustedDependencies": ["@swc/core"]` per user approval.
   - Verified that `bun install --frozen-lockfile` executes cleanly from scratch and reproduces `bun.lock` with zero diff.

4. **Shared Contracts Package (`@userhq/types`):**
   - Created `packages/types/src/index.ts` exporting `PublicUserSchema`, `PublicUser`, `MeResponseSchema`, `MeResponse`, `API_ERROR_CODES`, `ApiErrorCode`, `ApiErrorSchema`, `ApiError`, `UPLOAD_MAX_BYTES` (2,097,152), `UPLOAD_MAX_WIDTH` (1600), `UPLOAD_MAX_INPUT_PIXELS` (40,000,000), `UPLOAD_URL_PATTERN`, `UploadResponseSchema`, and `UploadResponse`.
   - Built to ESM (`dist/index.mjs`) and TypeScript declarations (`dist/index.d.mts`) using `tsdown`.
   - Proved cross-workspace ESM import from `apps/api` under Node.

5. **Lint Rules & Security Guards:**
   - Configured `.oxlintrc.json` with `no-restricted-imports` on `apps/web/**` banning `@userhq/db`, `drizzle-orm`, `pg`, `sharp`, `next-auth`, `radix-ui`, `next/image`, `next/font/google`, `vinext`, Vite query suffixes (`*?raw`, `*?url`, `*?inline`), and unauthorized `better-auth` imports while explicitly allowing client entries (`better-auth/react`, `better-auth/cookies`, `better-auth/client`).
   - Implemented AST rules in `tools/oxlint-userhq.mjs`: `userhq/no-import-meta-env` (preserves `next build` escape hatch) and `userhq/no-exclusion-columns` (prevents fail-open column omissions in DB queries).
   - Created comprehensive `tools/lint-rules.test.mjs` test suite; verified 26/26 tests passing (`# fail 0`).

## Deviations from Plan

- **[Rule 1 - Environment] macOS Host vs Windows Specification:** The plan notes originally referenced Windows dev box specifics (launching `Docker Desktop.exe` and PowerShell scripts). The actual environment is macOS (Darwin arm64). Colima was installed and started via Homebrew to supply the Docker 29.5.2 daemon. All toolchain scripts and commands were run natively without Windows workarounds.
- **[Rule 1 - Build Output] tsdown Output Extension:** `tsdown` emitted `dist/index.mjs` and `dist/index.d.mts` instead of `.js`/`.d.ts`. `packages/types/package.json` `exports` field was updated accordingly to point to the exact emitted files.

## Self-Check: PASSED
- `bun --version`: 1.4.2
- `docker info`: Server Version 29.5.2
- `bun install --frozen-lockfile`: PASSED
- `bun run --filter '@userhq/types' build`: PASSED
- `bun run lint`: PASSED (0 warnings, 0 errors)
- `bun run test:lint-rules`: PASSED (26 passed, 0 failed)
- `git status --porcelain`: Clean for code and lockfiles
