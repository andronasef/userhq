---
phase: 03-feedback-board-conversations
plan: 03
subsystem: ops
tags: [ops, smtp, brevo, compose, dokploy, dkim]

# Dependency graph
requires: []
provides:
  - "SMTP_* pass-through configuration in compose.yaml for api container"
  - "Documented native development, staging (Mailpit), and production (Brevo) SMTP environment variables"
  - "Confirmed Brevo working port 587 and verified sender notifications@increasinglabs.com with DKIM/SPF"
affects: [03-10]

actuals:
  tokens: 15000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Environment-only email configuration with optional defaults in compose.yaml"
    - "Live container SMTP port probing with credentials passed at invocation"
    - "DKIM/SPF domain verification record for RFC 8058 unsubscribe compliance"

key-files:
  created: []
  modified:
    - compose.yaml
    - .env.example
    - docs/deploy.md

key-decisions:
  - "Confirmed port 587 with STARTTLS via live container probe on production VPS"
  - "Verified sending domain with DKIM and SPF authenticated in Brevo for notifications@increasinglabs.com"
  - "Documented fallback guarantee: if SMTP is misconfigured, comments still save and batches remain in outbox without data loss"

patterns-established:
  - "compose.yaml passes SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, and SMTP_REQUIRE_TLS with ${VAR:-default} fallbacks"
  - "Rotating BETTER_AUTH_SECRET notes recorded in deploy documentation"

requirements-completed: [OPS-03]

coverage:
  - id: D1
    description: "compose.yaml passes all 6 SMTP_* variables with safe defaults and .env.example documents native dev"
    requirement: OPS-03
    verification:
      - kind: automated
        ref: "docker compose -f compose.yaml --env-file .env.example config"
        status: pass
    human_judgment: false
  - id: D2
    description: "Brevo SMTP submission port probe confirmed from inside production API container on VPS"
    requirement: OPS-03
    verification:
      - kind: manual_procedural
        ref: "User executed smtp-check.js inside container; port 587 passed"
        status: pass
    human_judgment: true
    rationale: "Live probe inside production container requires operator access on VPS"
  - id: D3
    description: "Brevo domain DKIM/SPF authentication and sender verified"
    requirement: OPS-03
    verification:
      - kind: manual_procedural
        ref: "User confirmed DKIM/SPF verified for notifications@increasinglabs.com in Brevo dashboard"
        status: pass
    human_judgment: true
    rationale: "Brevo dashboard domain authentication requires operator access"

duration: 10min
completed: 2026-10-03
status: complete
---

# Phase 03: Plan 03 Summary

**SMTP pass-through configuration, Brevo port 587 probe confirmation, and sender domain DKIM/SPF verification**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-03T17:31:00Z
- **Completed:** 2026-10-03T17:54:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Configured `compose.yaml` to forward all six SMTP environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_REQUIRE_TLS`) to the `api` service with safe defaults.
- Documented native development (Mailpit at `127.0.0.1:1025`, `SMTP_REQUIRE_TLS=false`), staging (Mailpit service on port `1025`), and production (`smtp-relay.brevo.com`) settings in `.env.example` and `docs/deploy.md`.
- Confirmed working Brevo SMTP submission port `587` (STARTTLS) via live container probe executed on the production VPS container.
- Confirmed sender address `notifications@increasinglabs.com` with authenticated DKIM and SPF records in the Brevo dashboard.
- Recorded confirmed port `587`, verified sender, and key rotation guidance in `docs/deploy.md`.

## Task Commits

1. **Task 1: Pass SMTP settings through compose and document them for staging and prod** - `293d3f8` (`feat(03-03): pass SMTP settings through compose and document deploy env`)
2. **Task 2: Run the Brevo port probe inside the production API container and confirm sender-domain authentication** - Human checkpoint confirmed: Port `587` passed, `notifications@increasinglabs.com` verified with DKIM/SPF.
3. **Task 3: Record the confirmed Brevo port and DKIM status in the deploy docs** - `b257e25` (`feat(03-03): record confirmed Brevo port 587 and verified sender`)

## Probe and Domain Verification Record

- **Working Port:** `587` (STARTTLS confirmed)
- **Host:** `smtp-relay.brevo.com`
- **Sender Address (`SMTP_FROM`):** `notifications@increasinglabs.com`
- **Domain Authentication:** DKIM and SPF authenticated in Brevo dashboard
- **Recorded Entry:** `Recorded Brevo port: smtp-relay.brevo.com:587 (confirmed 2026-10-03 from the prod API container)`

## Files Created/Modified

- `compose.yaml` - Passed `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `SMTP_REQUIRE_TLS` to the `api` service.
- `.env.example` - Added Email (SMTP) section for native development and production reference.
- `docs/deploy.md` - Added staging and production SMTP variables table, updated probe command with explicit environment injection, recorded confirmed port 587, and added `BETTER_AUTH_SECRET` rotation note.

## Decisions Made

- Standardized on port 587 with `SMTP_REQUIRE_TLS=true` for production Brevo relay.
- Ensured zero credentials committed to repository: all secrets remain solely in Dokploy environment variables.
- Clarified that if SMTP connection fails in production, comments still save without disruption; emails remain queued in outbox table until delivery succeeds.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The operator initially saw `docker not found` because Docker CLI required elevated permissions / specific PATH or web console was needed. Resolved by accessing the Dokploy container web terminal directly.

## Next Phase Readiness

- Wave 1 is now fully complete! Plans 03-01, 03-02, and 03-03 are finished.
- Wave 2 (Plan 03-04: Board view, New post dialog, permalink page & canonical redirects) is unblocked.

---
*Phase: 03-feedback-board-conversations*
*Completed: 2026-10-03*
