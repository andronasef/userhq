---
phase: 03-feedback-board-conversations
plan: 10
subsystem: api-email
tags: [email, outbox, smtp, nodemailer, mailpit, worker, batching]

# Dependency graph
requires: ["03-08", "03-09"]
provides:
  - "enqueueCommentEmail inside createComment transaction inserting transactional outbox intent with 24-hour batch window"
  - "createSmtpTransport shared by EmailWorker and smtp-check CLI probe"
  - "EmailWorker claiming due batches with FOR UPDATE SKIP LOCKED, retry backoff (5m, 30m, 2h, 6h), at-least-once delivery, and secret redaction"
  - "renderCommentEmail producing HTML and text parts with escaped HTML, post sections, up to 3 comments, +N more comments, and unsubscribe/mute links"
  - "signToken and verifyToken implementing HMAC-SHA256 with HKDF userhq-unsubscribe-v1 key and timingSafeEqual"
affects: [03-13]

actuals:
  tokens: 42000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Transactional outbox: comment email batch and items created in the same database transaction as the comment insert"
    - "Partial unique index ON CONFLICT (user_id, workspace_id) WHERE status = 'pending' coalescing comments into a single 24-hour batch"
    - "SKIP LOCKED batch claiming: SELECT FOR UPDATE SKIP LOCKED LIMIT 20 preventing duplicate worker processing"
    - "At-least-once delivery: documented with // ponytail: at-least-once comment"
    - "Credential redaction: SMTP_PASS and SMTP_USER sanitized as [REDACTED] in stored errors and logs"
    - "HKDF-derived HMAC tokens: signToken and verifyToken using userhq-unsubscribe-v1 info and timingSafeEqual"

key-files:
  created:
    - apps/api/src/email/transport.ts
    - apps/api/src/email/outbox.ts
    - apps/api/src/email/worker.ts
    - apps/api/src/email/render.ts
    - apps/api/src/email/tokens.ts
    - apps/api/src/email/email.module.ts
    - apps/api/test/email.test.ts
    - apps/api/test/email-render.test.ts
  modified:
    - apps/api/src/env.ts
    - apps/api/src/app.module.ts
    - apps/api/src/scripts/smtp-check.ts
    - apps/api/src/feedback/comments.service.ts

key-decisions:
  - "Email intent is committed synchronously with comments; failure or missing SMTP configuration never blocks comment creation (NOTF-03)"
  - "Batches are coalesced strictly per recipient per workspace over a 24-hour window from the first qualifying comment (D-21)"
  - "Send-time validation re-verifies recipient opt-out, deletion, and bans, workspace suspension/deletion, and drops deleted comments or muted posts (D-22, D-23, D-24)"
  - "Worker uses exponential-like retry backoff [5m, 30m, 2h, 6h] up to 5 attempts before permanently failing and redacts SMTP secrets (NOTF-03)"
  - "List-Unsubscribe and List-Unsubscribe-Post: List-Unsubscribe=One-Click headers are included on all outgoing notification emails"

requirements-completed: [NOTF-01, NOTF-03, OPS-03]

coverage:
  - id: D1
    description: "User B comments on User A's post, producing a transactional outbox batch delivered to Mailpit after the 24-hour window"
    requirement: NOTF-01, OPS-03
    verification:
      - kind: automated
        ref: "apps/api/test/email.test.ts (tracer test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Batching follows per-recipient, per-workspace rules, excludes opted-out, muted, deleted, or banned users at enqueue and send time, and retries with backoff"
    requirement: NOTF-03, OPS-03
    verification:
      - kind: automated
        ref: "apps/api/test/email.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Email rendering includes HTML escaping, max 3 comment snippets per post, +N more comments, unsubscribe headers, and signed tokens"
    requirement: NOTF-01, OPS-03
    verification:
      - kind: automated
        ref: "apps/api/test/email-render.test.ts"
        status: pass
      - kind: automated
        ref: "apps/api/test/email.test.ts"
        status: pass
    human_judgment: false
---

# Plan 03-10: Comment Email Outbox, Worker, Batching, and Rendering Summary

Plan 03-10 delivered the transactional outbox and worker pipeline for daily comment digest emails per workspace, meeting NOTF-01, NOTF-03, and OPS-03 with Mailpit integration in development and Brevo compatibility for production.

## Accomplishments

1. **Transactional Outbox & Shared Transport (Task 1):**
   - Configured `SMTP_*` environment variables in `apps/api/src/env.ts` with empty string coercion and strict `superRefine` validation requiring `SMTP_FROM` whenever `SMTP_HOST` is set.
   - Extracted shared SMTP transport logic into `apps/api/src/email/transport.ts` used by both `EmailWorker` and the `smtp-check` CLI probe.
   - Implemented `enqueueCommentEmail` executing a single SQL CTE that queries eligible recipients (post author and existing non-deleted commenters/repliers, excluding the actor, opted-out users, muted users, deleted users, and banned users), upserts the pending batch with `ON CONFLICT (user_id, workspace_id) WHERE status = 'pending'`, and inserts into `comment_email_items`.
   - Wired `enqueueCommentEmail` directly into `CommentsService.createComment` within the same database transaction.
   - Delivered tracer test verifying that a comment by B on A's post results in an email in Mailpit after the 24-hour window.

2. **Batching Rules, Send-Time Exclusions & Retry Backoff (Task 2):**
   - Verified that multiple comments across products within the same workspace coalesce into a single pending batch with multiple items, while comments in separate workspaces create separate batches.
   - Enforced that once a batch transitions to `sending`, subsequent comments open a fresh `pending` batch scheduled 24 hours out.
   - Implemented comprehensive send-time rules in `EmailWorker`:
     - Recipient re-check: opt-out (`comment_emails = false`), deletion, or banning cancels the batch.
     - Workspace re-check: soft deletion or suspension cancels the batch.
     - Item re-check: filters out deleted comments, deleted/merged posts, and muted posts; resolves merged comments to their target post; cancels the batch if no eligible items remain.
   - Implemented retry backoff with delays `[5m, 30m, 2h, 6h]` for attempts 1..4, marking the batch permanently `failed` after attempt 5.
   - Redacted `SMTP_PASS` and `SMTP_USER` as `[REDACTED]` from stored errors and logs.
   - Added crash recovery reclaiming batches stuck in `sending` for over 10 minutes.

3. **Email Rendering, One-Click Headers & Token Signing (Task 3):**
   - Implemented `snippet` cutting text cleanly at word boundaries with `…` (handling long sentences, single 250-character words, and collapsing whitespace).
   - Implemented `escapeHtml` sanitizing `&`, `<`, `>`, `"`, and `'`.
   - Implemented `signToken` and `verifyToken` using HKDF (`userhq-unsubscribe-v1`) HMAC-SHA256 with constant-time equality check (`timingSafeEqual`).
   - Implemented `renderCommentEmail` generating responsive HTML and plain text with section grouping, up to 3 comments ordered oldest to newest, `+N more comment(s)` counters, admin badges (` · Admin`), author labels (`Deleted user`), and permalinks.
   - Configured `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers and verified them via Mailpit's REST API.

## Verification

- Automated test suites passing:
  - `apps/api/test/email.test.ts` (9 integration tests covering tracer, exclusions, multi-product/cross-tenant batching, send-time rules, retries, reclaim, config, and headers)
  - `apps/api/test/email-render.test.ts` (15 unit tests covering snippet, HTML escaping, HMAC token signing/tamper detection, and email template rendering)
  - All 23 API test files (296 tests total) pass cleanly.
- Zero typecheck errors across all workspaces (`bun run typecheck`).
- Zero lint warnings across all workspaces (`oxlint -c .oxlintrc.json`).
