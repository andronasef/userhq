---
phase: 01-walking-skeleton
plan: 02
subsystem: api-db
tags: [drizzle, postgres, migrations, nestjs, docker, advisory-lock]
requires:
  - 01-01
provides:
  - Better Auth schema (user, session, account, verification) in packages/db
  - Advisory-locked migration runner (runMigrations, MIGRATION_LOCK_KEY=727001)
  - Committed first migration (0000_auth.sql, meta/_journal.json)
  - NestJS API bootstrap with GET /api/v1/health verifying DB round-trip
  - Multi-stage Dockerfile for @userhq/api on Node 24 runtime with Bun PM
  - Production-shape compose.yaml running postgres:18 and api without published host ports
affects:
  - packages/db
  - apps/api
  - compose.yaml
tech-stack:
  added:
    - postgres:18
    - drizzle-orm@0.45.3
    - pg@8.23.1
    - @nestjs/core@12.1.2
    - @nestjs/common@12.1.2
    - @nestjs/platform-express@12.1.2
  patterns:
    - Advisory lock (pg_advisory_lock 727001) wrapping Drizzle migrate() on a single pg.Client
    - Docker CMD running migrate.js before Nest bootstrap (never in Nest lifecycle)
    - Non-root node user in production Docker container
    - Prod-deps isolated stage with bun install --frozen-lockfile --production --filter '@userhq/api...'
key-files:
  created:
    - packages/db/tsconfig.json
    - packages/db/drizzle.config.ts
    - packages/db/src/schema/auth.ts
    - packages/db/src/index.ts
    - packages/db/src/migrate.ts
    - packages/db/migrations/0000_auth.sql
    - packages/db/migrations/meta/_journal.json
    - packages/db/migrations/meta/0000_snapshot.json
    - apps/api/tsconfig.json
    - apps/api/src/main.ts
    - apps/api/src/app.module.ts
    - apps/api/src/health/health.controller.ts
    - apps/api/Dockerfile
    - compose.yaml
  modified:
    - packages/db/package.json
    - packages/types/package.json
key-decisions:
  - "D-01-02-01: Used 'bun x auth generate --config ./auth-generate.tmp.ts --adapter drizzle --dialect postgresql --output ./src/schema/auth.ts --yes' to generate Better Auth core tables and took permanent hand-ownership."
  - "D-01-02-02: Multi-stage Dockerfile uses 'bun install --frozen-lockfile --production --filter @userhq/api...' in a separate prod-deps stage, copying isolated node_modules trees to the Node 24 runtime stage."
  - "D-01-02-03: Used pg_advisory_lock(727001) on a single pg.Client to guarantee idempotent, race-free migrations at container start."
requirements-completed: [OPS-01, OPS-02]
duration: 18 min
completed: 2026-10-02T02:37:07Z
coverage:
  - deliverable: "Boot-time migration applying committed SQL under advisory lock"
    verification:
      kind: command
      ref: "docker compose --env-file .env.docker logs api | grep 'migrations: up to date'"
      status: pass
    human_judgment: false
  - deliverable: "GET /api/v1/health returning 200 with DB round trip"
    verification:
      kind: command
      ref: "docker compose --env-file .env.docker exec -T api node -e '/* fetch /api/v1/health */'"
      status: pass
    human_judgment: false
  - deliverable: "Live Postgres schema verification on fresh volume"
    verification:
      kind: command
      ref: "psql -tAc 'select count(*) from drizzle.__drizzle_migrations' && psql -tAc 'select string_agg(table_name) from information_schema.tables'"
      status: pass
    human_judgment: false
  - deliverable: "Idempotent restart with zero redundant migrations"
    verification:
      kind: command
      ref: "docker compose restart api && psql -tAc 'select count(*) from drizzle.__drizzle_migrations'"
      status: pass
    human_judgment: false
  - deliverable: "Non-root node runtime user and absence of drizzle-kit"
    verification:
      kind: command
      ref: "docker compose exec api id -un && docker compose exec api node -e 'import.meta.resolve(\"drizzle-kit\")'"
      status: pass
    human_judgment: false
---

# Phase 01 Plan 02: Database Schema, Advisory-Locked Migrations, and API Container Summary

**Substantive deliverable:** Generated Better Auth Drizzle schema, advisory-locked boot-time migration runner, minimal NestJS API answering `/api/v1/health` with a live PostgreSQL round-trip, production-shape `compose.yaml`, and multi-stage Node 24 Dockerfile for `@userhq/api`.

## Accomplishments

1. **Schema & Migration Generation:**
   - Generated Better Auth schema via `bun x auth generate --config ./auth-generate.tmp.ts --adapter drizzle --dialect postgresql --output ./src/schema/auth.ts --yes`.
   - Generated initial Drizzle migration `packages/db/migrations/0000_auth.sql` and journal `meta/_journal.json` using `drizzle-kit generate`.
   - Verified clean drift state with `drizzle-kit check` and probe generation (0 changes detected).

2. **Advisory-Locked Migration Runner:**
   - Implemented `packages/db/src/migrate.ts` and `runMigrations` in `packages/db/src/index.ts`.
   - Uses `SELECT pg_advisory_lock(727001)` on a single `pg.Client` ensuring concurrent container instances never race on migrations.

3. **NestJS Bootstrap & Health Check:**
   - Implemented `AppModule` providing the `DB` injection token and clean graceful shutdown of connection pools via `OnApplicationShutdown`.
   - Created `GET /api/v1/health` executing `select 1` against PostgreSQL and returning `{"status":"ok","db":"up"}` (or 503 if unreachable).

4. **Multi-Stage Docker Image & Compose Stack:**
   - Authored `apps/api/Dockerfile` using multi-stage build (base, deps, build, prod-deps, runtime).
   - Produced a lean production image running as non-root `node` user with content size of 263MB (no `drizzle-kit` present).
   - Authored `compose.yaml` with `postgres:18` (volume mounted at `/var/lib/postgresql`) and `api` service with zero published host ports.

## Live-Schema Evidence (Verbatim Task 2 Outputs)

- **Query (a):** `select count(*) from drizzle.__drizzle_migrations`
  ```text
  1
  ```
- **Query (b):** `select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='public'`
  ```text
  account,session,user,verification
  ```
- **Restart Check (Query a after `docker compose restart api`):**
  ```text
  1
  ```
- **API Logs (both boots):**
  ```text
  migrations: waiting for advisory lock 727001
  migrations: up to date (1 applied in total)
  api: listening on :4000
  ```
- **Image Hygiene:**
  ```text
  User: node
  drizzle-kit resolve: ERR_MODULE_NOT_FOUND (absent from runtime container)
  ```

## Key Technical Metrics
- **Auth CLI Invocation:** `bun x auth generate --config ./auth-generate.tmp.ts --adapter drizzle --dialect postgresql --output ./src/schema/auth.ts --yes`
- **Prod-deps Strategy:** Separate stage in Dockerfile: `bun install --frozen-lockfile --production --filter '@userhq/api...'` copying isolated `node_modules` trees into the final runtime stage.
- **API Image Size:** 263MB content size.

## Self-Check: PASSED
- `drizzle-kit check`: PASSED (0 drift)
- Live database migrations count: 1
- Public tables created: `account,session,user,verification`
- Idempotent restart: PASSED
- Non-root user: `node`
- `drizzle-kit` absent in production image: VERIFIED
