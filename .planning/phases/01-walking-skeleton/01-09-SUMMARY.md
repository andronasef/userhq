# Phase 1 Plan 09: Durability, Migration Runner Properties, Redeploy Persistence, SMTP Reachability Probe, and Mailpit Staging Profile Summary

**Executed Date:** 2026-10-02  
**Status:** Completed & Verified  

---

## 1. Accomplishments

- **Redeploy Persistence E2E (`apps/api/test/e2e/persistence.e2e.test.ts`):**
  - Mints an authenticated session via Better Auth on the local prod-shape stack.
  - Uploads a generated PNG image to `/api/v1/uploads`.
  - Captures and records the returned URL (`/data/uploads/2026/10/<uuid>.webp`), the downloaded WebP payload sha256, user ID, storage key, and database migration count (`select count(*) from drizzle.__drizzle_migrations`).
  - Closes database connection pools.
  - Simulates a zero-data-loss redeploy via `child_process.execSync`:
    - `docker compose -f compose.yaml -f compose.local.yaml --env-file .env.docker down` (asserting `--volumes` and `-v ` are never used).
    - `docker compose -f compose.yaml -f compose.local.yaml --env-file .env.docker up -d --build --force-recreate --wait`.
  - Reconnects and asserts post-redeploy state:
    - GET on the upload URL returns HTTP 200 with `content-type: image/webp` and identical sha256.
    - Database row for upload storage key and user account still exist.
    - Migration count is identical (`count = 2`).
    - `/api/v1/health` reports status `ok` and `db: up`.
  - Passed in 23.09s.

- **Migration Runner Properties (`packages/db/test/migrate.test.ts`):**
  - Created isolated Vitest configuration `packages/db/vitest.config.ts`.
  - Tested 4 core properties against dynamic, isolated PostgreSQL databases:
    1. **Concurrent start:** Two `node dist/migrate.js` child processes launched concurrently serialize via `pg_advisory_lock(727001)`. Both exit 0, exactly 2 migrations applied, 2 distinct hashes, zero duplicate rows or crashes (~512ms).
    2. **Idempotent restart:** A third sequential run reports "migrations: up to date (2 applied in total)" and migration row count remains 2.
    3. **New migration applied:** Using a temporary journal with only migration 0000 applies 1 migration; running against the full folder with migration 0001 applies only 0001 and reaches total count 2. Committed migrations journal was never altered.
    4. **Failure exit without credential leakage:** Executing against a non-existent database exits with code 1, prints "migrations: failed", and sanitizes output such that the database password never appears.

- **SMTP Reachability Probe (`apps/api/src/scripts/smtp-check.ts`):**
  - Exports `runSmtpCheck(opts: RunSmtpCheckOptions): Promise<SmtpProbeResult[]>`.
  - Probes candidate SMTP ports (defaulting to 587, 2525, 465) using `nodemailer.createTransport().verify()`.
  - Uses `mode: "tls"` (secure: true) for port 465; `mode: "starttls"` (requireTLS: true) for submission ports; `mode: "plain"` when `requireTls: false` (local testing).
  - Explicitly never calls `sendMail` (zero messages sent, zero Brevo quota consumed).
  - Sanitizes user/password from error output details to prevent credential leaks.
  - Direct execution CLI reads `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PROBE_PORTS`, `SMTP_REQUIRE_TLS`, `SMTP_TIMEOUT_MS`.
  - Formats aligned status table, prints `smtp-check: working port <n>` (exit 0) or `smtp-check: no working port` (exit 1).
  - Compiles into `apps/api/dist/scripts/smtp-check.js` as part of the container image for remote execution via `docker exec`.

- **Probe Unit/Integration Tests (`apps/api/test/smtp-check.test.ts`):**
  - Verified programmatic and CLI probe against Mailpit on port 1025 (`ok: true`, exit 0).
  - Verified closed port fail on port 1 with ECONNREFUSED (`ok: false`, exit 1).
  - Verified credentials (`SMTP_PASS`) are never exposed in CLI stdout/stderr.
  - Verified Mailpit message API (`http://127.0.0.1:8025/api/v1/messages`) total count is unchanged (0 messages).

- **Staging-Only Mailpit Profile (`compose.yaml`):**
  - Declared `mailpit` service using image `axllent/mailpit:v1.31.3` with `profiles: ["mail"]`.
  - Explicitly declared no published ports (staging UI accessed strictly via SSH tunnel).
  - Verified: with `COMPOSE_PROFILES` unset, `mailpit` is not started; with `COMPOSE_PROFILES=mail`, `mailpit` is included in compose services.

---

## 2. Verification Evidence

### Persistence Evidence
- **Uploaded URL:** `/data/uploads/2026/10/72886c50-c632-4464-9b5f-5ff01258d4bb.webp`
- **Before Redeploy sha256:** `9ea7dc96e95b0fe22f18ec7e875691ea4ef338b556b6c2ba657a8286a2ecb123`
- **After Redeploy sha256:** `9ea7dc96e95b0fe22f18ec7e875691ea4ef338b556b6c2ba657a8286a2ecb123`
- **Migration Count Before/After:** 2 / 2
- **Command flags verified:** zero instances of `--volumes` or `-v ` during `down` / `up`.

### Concurrent-Start Timing
- Racing start of two `node dist/migrate.js` processes on fresh database completed and exited with code 0 in **512ms**.
- Both processes completed safely; migration journal rows: 2; unique hashes: 2.

### Local SMTP Probe Output Table
```
1025   plain      PASS   ok
smtp-check: working port 1025
```
Closed port probe output table:
```
1      starttls   FAIL   ESOCKET: connect ECONNREFUSED 127.0.0.1:1
smtp-check: no working port
```

### Compose Profile Evidence
```bash
$ test -z "$(docker compose --env-file .env.docker config --services | grep -x mailpit)"
# => Exited 0 (mailpit absent in default profile)

$ COMPOSE_PROFILES=mail docker compose --env-file .env.docker config --services | grep -x mailpit
# => mailpit (mailpit present when COMPOSE_PROFILES=mail)
```

---

## 3. Deviations & Observations

- **Node.js undici TCP Connection Reset:** During persistence testing, when `docker compose down` destroys containers while the Node test process remains alive, undici's connection pool holds stale sockets to port 8080. Added an explicit `Connection: close` healthcheck retry loop before making assertions against the recreated stack.
- **Nodemailer Type Resolution:** Resolved `nodemailer.TransportOptions` namespace resolution by importing `type SMTPTransport from "nodemailer/lib/smtp-transport"` to ensure clean compilation under `@nestjs/cli`.

---

## 4. Next Step

Advance to **Wave 9 — Plan 01-10**:
- CI workflow in `.github/workflows/ci.yml`.
- `.github/workflows/human-action.yml` for manual dispatch and secrets setup guidance.
- Staging auto-deploy integration.
