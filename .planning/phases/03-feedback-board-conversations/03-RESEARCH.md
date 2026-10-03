# Phase 3: Feedback Board & Conversations - Research

**Researched:** 2026-10-03
**Domain:** Postgres-backed feedback board (Drizzle 0.45.3 + NestJS 12 + vinext RSC): posts, idempotent votes, FTS, threaded comments, moderation and merge, a transactional email outbox with daily batching, RFC 8058 unsubscribe, account deletion
**Confidence:** HIGH for data-layer patterns (probed on the project's Postgres 18.6), MEDIUM for nuqs-under-vinext client navigation and the Brevo delivery details

## Summary

Phase 3 adds two new dependencies: `nuqs@2.10.1` (web) and `@nestjs/throttler@6.7.1` (api). The rest is built from what the repo already has: Drizzle, `pg`, Nest 12 Standard Schema validation, the `TenantGuard`/`PortalGuard`/`SessionGuard` trio, TanStack Query, Radix dialogs, and `nodemailer@10.0.13`. The hard parts are correctness and privacy, not libraries. They are:
- per-product sequential post numbers
- a vote counter that can't drift
- a merge that dedupes votes and keeps comment threads intact
- optimistic concurrency that survives JSON round-trips
- a per-recipient, per-workspace 24-hour email batch that never blocks a comment
- an unsubscribe POST that works without cookies and without an `Origin` header
- account deletion that keeps content but removes identity

Every one of these is a short SQL pattern inside one `db.transaction`. All of them were probed against the running Postgres 18.6 this session.

Three findings change the plan:
1. **The Brevo port was never recorded.** Plan 01-11 required `smtp-relay.brevo.com:<port>` in `docs/deploy.md` and `SMTP_PORT` in `.env.example`. Neither exists, because SSH to the VPS was deferred. `compose.yaml` also passes no `SMTP_*` variables to the api container. The planner needs a `checkpoint:human-action` to run `smtp-check` inside the prod api container and record the port.
2. **Two existing global behaviours break Phase 3 routes unless they are changed:**
   - `OriginGuard` rejects every non-GET without a matching `Origin`, so the RFC 8058 one-click POST from a mail provider would get a 403.
   - `ApiErrorFilter` maps a 429 to `internal_error`, so the UI could never show `rate_limited`.
3. **The cross-tenant suite discovers every non-public route containing `:ws`.** Signed-in portal writes (vote, comment) are legitimately cross-workspace, so the suite's discovery must be scoped to `/workspaces/:ws` admin routes.

**Primary recommendation:** Put posts, votes, comments, categories, activity, mutes, and the email outbox in one new `packages/db/src/schema/feedback.ts`. Every multi-row write is one `db.transaction` that first locks the post row `FOR UPDATE`. Public reads use explicit `select()` field maps into hand-written `Public*` Zod schemas. Email is a DB outbox drained by a `setInterval` worker using `FOR UPDATE SKIP LOCKED`, with no new infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Admin moderation surface
- **D-01:** Admins moderate from **both** places:
  - **Dashboard:** a new page at `/dashboard/{ws}/{product}/board`, with a post table and a post detail view.
  - **Portal:** an inline "⋯ Admin" menu on posts and comments, rendered only when the viewer is an admin of the workspace.

  **This amends Phase 2 D-01** ("the public portal contains no admin UI"). The server still decides every admin action and the Admin badge. The portal only shows or hides the menu based on `/me` membership. — **Reversibility:** costly — admin affordances spread into the portal post and comment components.
- **D-02:** Admins can write comments from the dashboard post view as well as on the portal. Both use the same endpoint, and the comment appears publicly with the server-decided Admin badge (CMNT-02).
- **D-03:** There are two ways to merge:
  - from the duplicate, "Merge into…" opens a dialog that searches posts in the **same product** (reusing board FTS), then a confirm step showing vote counts
  - on the dashboard table, the admin bulk-selects 2+ posts and picks the post that survives

  Votes move without double-counting, and comments move with their original authors and timestamps (MOD-05).
- **D-04:** A merged duplicate's URL issues a **silent 301** to the target. The target shows no "merged from" trace.
- **D-05:** A status change's optional public note appears as an **activity entry in the post's timeline**, interleaved with comments, e.g. "Status changed to Planned by {admin name}" plus the note. This is the same activity log Phase 4 reads.
- **D-06:** The dashboard board has a **"Deleted" filter with a Restore action** for posts and comments. A soft-deleted item disappears from the portal (MOD-02), and restoring it brings it back unchanged. A restored post's votes still count.

#### Board & post page layout
- **D-07:** The board is a list of **compact rows**, each with:
  - an accent-colored vote box on the left (▲ and count), themed by the product accent (Phase 2 D-08)
  - the title and a 2-line description excerpt
  - a status pill, the category, and a comment count
- **D-08:** **New post** opens a Radix Dialog over the board with title, plain-text description, and category. On success it navigates to the new post's page. A signed-out user who clicks it goes to login and comes back with the dialog reopened (PROD-06), for example with `?new=1` in `next`.
- **D-09:** Pagination is a **"Load more" button**. The server renders the first ~20 posts, and the next pages use a cursor.
- **D-10:** The author **automatically upvotes** their own new post (it starts at 1), and can remove that vote.
- **D-11:** Filters, sort, and search sit in a **toolbar above the list** (search, Sort, Category, Status) that collapses on mobile. Their state lives in URL query params, so a filtered view is shareable and works with the back button.
- **D-12:** The permalink is **`/{ws}/{product}/p/{number}-{slug}`**, e.g. `/acme/app/p/42-dark-mode`:
  - the number is sequential per product and canonical
  - if the slug part is wrong or stale, the URL 301-redirects to the current one
  - merged posts redirect as in D-04

  — **Reversibility:** one-way — permalinks are a published contract (POST-06) and get shared externally. The per-product counter needs a column and allocation logic.
- **D-13:** An author can edit their post **only until someone else engages**: another user votes or anyone else comments. The author's own auto-vote and own comments don't count. Admins can always edit (MOD-01).
- **D-14:** An author can **delete their own post** under the same rule: only while no one else has voted or commented. It's a soft delete, like an admin delete. Admins can always delete (MOD-02). This is new beyond the requirements, which only list comment self-delete.
- **D-15:** Posts and comments show a small muted **"edited"** marker after any edit, whether by the author or an admin.

#### Comment structure
- **D-16:** Comments are threaded **one level deep**:
  - top-level comments can have replies
  - replies can't have replies
  - in the UI, replying to a reply attaches the new comment to the same parent
- **D-17:** Comment text is **plain text**. Line breaks are kept, and http(s) URLs are auto-linked with `rel="nofollow noopener noreferrer"`. No markdown, and no HTML rendering.
- **D-18:** A deleted comment:
  - leaves a **"[Comment deleted]" stub only when it has visible replies**; otherwise it vanishes
  - deleted replies always vanish
  - a stub disappears once all its replies are deleted
  - the stub hides the comment's text and author
- **D-19:** Ordering:
  - top-level comments run oldest first, interleaved with status activity entries (D-05)
  - replies run oldest first under their parent
- **D-20:** After a user deletes their account (WORK-07), their posts and comments stay up as "Deleted user" with no avatar. They stop receiving email.

#### Comment email behavior
- **D-21:** Email is a **daily batch per recipient per workspace (company)**:
  - the first qualifying comment queues a send **24 hours later**
  - every further qualifying comment on any product in that workspace, arriving before the send, joins the same email
  - the email groups items by post

  A user gets at most one comment email per company per 24 hours. Email failures never block the comment (NOTF-03), and the outbox retries. This is still the single "someone commented" email type. It refines PROJECT.md's "digest emails are out" (meaning no new email types), so it doesn't conflict. — **Reversibility:** costly — the outbox needs scheduled per-recipient, per-workspace batch rows rather than one row per comment.
- **D-22:** Recipients are **everyone in the post's conversation**: the post author plus anyone who commented or replied anywhere on the post. Excluded are:
  - the person who wrote the new comment
  - users who muted the post or turned off comment emails
  - deleted and banned users
- **D-23:** Workspace admins get **no extra alerts**. They are notified under the same rules as everyone else, and product-wide admin alerts are not added.
- **D-24:** Email content, per post section:
  - the post title and a "View post" link
  - the latest ~3 new comments, each with the commenter's name and a **~200-character snippet** cut at a word boundary with "…"
  - "+N more" when there are more

  Rendered as plain text plus a simple HTML version, with HTML escaping.
- **D-25:** Opt-out has **two levels**:
  - **Global:** turn off all comment emails, from account settings (NOTF-02) or the unsubscribe page
  - **Per post:** mute a single post, from a "Mute this post" link in the email body (one per post section) or a bell toggle on the post page, shown to signed-in users who are in the conversation

  The one-click `List-Unsubscribe` / `List-Unsubscribe-Post` header (RFC 8058) turns off **all** comment emails. — **Reversibility:** costly — adds a per-post mute table and signed, tokenized unsubscribe URLs.

#### Decisions from UI-SPEC review (2026-10-03)
- **D-26:** A workspace owner **can delete their account** (WORK-07). The delete flow first lists every workspace they own, and for each one they choose:
  - **transfer ownership** to another member of that workspace, or
  - **delete the workspace**, a soft delete of its products, portals, posts, and comments, which extends Phase 2 D-18 to workspaces

  Transfer is not available when they are the only member. The server applies every choice and the account deletion in one transaction, and rejects the request if any owned workspace has no choice. The platform owner's account can't be deleted from the UI. — **Reversibility:** costly — this introduces ownership transfer and workspace soft delete, which later role and owner features build on.
- **D-27:** Edits to posts and comments, and status changes, use **optimistic concurrency**. Each save carries the version that was loaded, and a stale save returns `edit_conflict` ("Someone else changed this… Reload"), keeping the user's input. A delete or merge that loses the race returns `post_not_found`.
- **D-28:** There are **no live updates** in v1: no websockets and no polling. Other viewers see new comments and votes after a refresh or navigation.

### Claude's Discretion
- The batch outbox mechanics: the scheduler, how the 24h window is implemented, and the retry/backoff policy.
- The exact page size, how the cursor is encoded, and the slug length rules for permalinks.
- How the search ranks results (FTS ranking vs Top Voted when search and sort are combined).
- The design of the dashboard board table and post detail view, and the empty states.
- The category editor UX for POST-02 (follow the Phase 2 status editor pattern).
- Rate-limit thresholds for posts, comments, and votes.
- How the voter list (MOD-04) looks on the dashboard and in the inline menu.

### Deferred Ideas (OUT OF SCOPE)
- Product-wide admin email alerts for new posts and comments. This would be a new email type, which PROJECT.md excludes from scope.
- A per-user digest timezone or send-hour preference.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-04 | OAuth name and avatar on posts and comments; email never public | Pattern 13 (author DTO with no email or id), public-contract canary test (Security) |
| WORK-07 | Delete own account; content stays as "Deleted user" | Pattern 12 (scrub-in-place user row, session and account deletion, D-26 workspace choices) |
| PROD-06 | Signed-out post/vote/comment goes to sign-in and back | Pattern 14 (`/login?next=` built from path, query and hash; `?new=1`; `safeNext` keeps the hash, as verified in `safe-next.ts:31`) |
| POST-01 | Submit post (title, plain-text description, category) | Patterns 1, 2 (number allocation and auto-vote in one transaction) |
| POST-02 | Category CRUD; Bug and Feature Request seeded | Pattern 1 (categories table), seeding in the product-create transaction plus a backfill migration (Pitfall 9) |
| POST-03 | Upvote once, idempotent | Pattern 3 |
| POST-04 | Remove own vote | Pattern 3 |
| POST-05 | Edit own post | Patterns 5 (lock rule D-13) and 6 (version column) |
| POST-06 | Permanent link page | Pattern 14 (permalink parse, `permanentRedirect` = 308, page-level only) |
| POST-07 | Sort Top Voted / Newest | Pattern 4 |
| POST-08 | Filter by category | Pattern 4 |
| POST-09 | Filter by status; Completed and Closed hidden by default | Pattern 4 (`statuses.type NOT IN ('completed','closed')`) |
| POST-10 | Search title and description | Pattern 4 (generated weighted `tsvector`, GIN, `websearch_to_tsquery`) |
| POST-11 | Every post shows its current status | Pattern 1 (composite FK `(status_id, product_id)`), Pattern 7 |
| CMNT-01 | Users and admins comment | Pattern 8 |
| CMNT-02 | Server-decided Admin badge | Pattern 8 (`is_admin` snapshot taken from membership at write time) |
| CMNT-03 | Edit own comment | Patterns 6, 8 |
| CMNT-04 | Delete own comment | Patterns 8, 10 (stub rules D-18) |
| MOD-01 | Admin edits any post or comment | Pattern 5 (`canEdit = isAuthor && !engaged \|\| isAdmin`, decided by the server) |
| MOD-02 | Admin soft delete, kept in the DB | Pattern 10 |
| MOD-03 | Admin status change with public note | Pattern 7 |
| MOD-04 | Admin voter list; public sees the count only | Pattern 3 (voters endpoint under TenantGuard; names only, no email) |
| MOD-05 | Merge: dedupe votes, move comments, redirect | Pattern 9 |
| NOTF-01 | Email on others' comments | Pattern 11 (recipient query, batch upsert) |
| NOTF-02 | Account toggle plus one-click unsubscribe | Pattern 11 (tokens, RFC 8058 endpoint, OriginGuard exemption) |
| NOTF-03 | Comment saved even if email fails; retries | Pattern 11 (transactional outbox, worker with backoff) |
| OPS-03 | Env-configured SMTP; Mailpit in dev | Pattern 11 (env keys, transport factory), Environment Availability, Open Question 1 (Brevo port gap) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Treat these with the authority of locked decisions:

- Web: Next.js 16 API on **vinext**, Tailwind v4 via `postcss.config.mjs`, **individual `@radix-ui/react-*` packages only** (the `radix-ui` barrel is lint-banned).
- API: NestJS 12, Express platform, Better Auth inside Nest (`bodyParser: false`), a global default-deny `SessionGuard`, Standard Schema (Zod) validation and serialization. **Not** `class-validator` or `nestjs-zod`.
- DB: PostgreSQL 18 via **Drizzle 0.45.3 / drizzle-kit 0.31.11 / `pg`**. Migrations are generated at dev time and committed under `packages/db/migrations/`, and applied at API boot under an advisory lock.
- Bun is the package manager. Node 24 runs both containers. **Never `bun test` or `bun --bun` for Nest code** (decorator metadata, bun#44120). Tests run under Vitest on Node.
- `apps/web` must not import `@userhq/db`, `drizzle-orm`, `pg`, `sharp`, `next/image`, `next/font/google`, `vinext`, or `import.meta.env`. These are enforced by `.oxlintrc.json` and `tools/oxlint-userhq.mjs`.
- **No exclusion-mode column selection** (`columns: { x: false }`). This is lint-enforced. Public reads use explicit `select({...})` maps plus hand-written `Public*` Zod schemas. **Never derive public DTOs with `drizzle-zod`.**
- No `dangerouslySetInnerHTML`. No Server Actions for mutations (use TanStack Query to Nest). No `next/image` for uploads.
- **Privacy:** internal fields must never be reachable from public endpoints. **Tenant isolation:** every query is scoped by product or workspace, and the cross-tenant suite grows with each feature.
- Email: SMTP is configured entirely by env. Brevo runs in production (300/day free tier), Mailpit in development. Email goes through an outbox with retries, so a provider failure never blocks a user action.
- GSD workflow: edits happen through GSD commands (planning artifacts in sync).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board list, search, filters, cursor | API / Backend | Frontend Server (RSC first page) | FTS and ranking need SQL. The RSC renders page 1, and the client fetches later pages through TanStack |
| URL filter state (q/sort/category/status/new) | Browser / Client (nuqs) | Frontend Server (reads `searchParams`) | D-11 shareable URLs. `shallow:false` makes the RSC refetch |
| Vote toggle (optimistic) | Browser / Client | API (idempotent PUT/DELETE, atomic count) | UI-SPEC: only votes are optimistic. The API is the source of truth |
| Post number allocation, slug canonicalization | API / Backend | Frontend Server (308 redirect) | The counter lives in Postgres. The redirect must come from page-level RSC (Pitfall 4) |
| Admin badge, canEdit/canDelete, lock rule | API / Backend | — | Server-decided (CMNT-02, D-13). The client only renders flags |
| Inline admin menu visibility | Browser / Client | API (`/me.workspaces`) | Cosmetic only. Every admin call is re-authorized by `TenantGuard` |
| Merge, status change, restore, voters | API / Backend | — | Multi-row transactions under `TenantGuard` |
| Email batching, retries, sending | API / Backend (in-process worker) | Database (outbox tables) | Transactional outbox: the enqueue happens in the comment's own transaction |
| Unsubscribe confirm page | Frontend Server | API (token verify and mutate) | GET never mutates. The page POSTs to the API |
| One-click unsubscribe (RFC 8058) | API / Backend | — | Mail providers POST directly to the API URL in the header |
| Account deletion, ownership transfer, workspace soft delete | API / Backend | Database | One transaction (D-26) |
| Plain-text rendering and autolinks | Browser / Client (`PlainText` component) | — | React text nodes. No HTML from the server |

## Standard Stack

### Core (already installed; versions read from package.json this session)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.3 | Schema, transactions, `.for("update", { skipLocked })`, `onConflictDoUpdate({ targetWhere })` | Locked. `LockStrength = 'update' \| 'no key update' \| 'share' \| 'key share'` and `PgInsertOnConflictDoUpdateConfig { target; targetWhere?; setWhere?; set }` were verified in the installed `.d.ts` |
| drizzle-kit | 0.31.11 | `db:generate` / `db:check`, plus `generate --custom` for the backfill migration | Locked |
| pg | 8.23.1 | Driver | Locked |
| @nestjs/common/core/platform-express | 12.1.2 | Controllers, guards, `@Body/@Query({ schema })`, `StandardSchemaSerializerInterceptor` | Locked. `@Query({ schema })` is already used in `platform.controller.ts:98` |
| better-auth | 1.7.7 | Sessions (DB-backed, no cookie cache), `signOut` clears the cookie even if the session row is gone | Verified in `dist/api/routes/sign-out.mjs` this session |
| nodemailer | 10.0.13 | SMTP transport (already in `apps/api`) | Reuse the `smtp-check.ts` transport options |
| zod | 4.6.5 | Shared contracts in `packages/types` | Locked |
| @tanstack/react-query | 5.104.0 | `useInfiniteQuery` (Load more), vote and comment mutations | Locked |
| react-hook-form + @hookform/resolvers | 7.88.0 / 5.9.1 | Post, category, and status dialogs | Locked |

### New this phase
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/throttler` | 6.7.1 `[WARNING: flagged as suspicious — verify before using.]` | Rate-limit post, comment, vote, mute, and unsubscribe writes | Per-route `@UseGuards(UserThrottlerGuard)` + `@Throttle(...)`. 6.6.0 was the first release to peer `@nestjs/common ^12` |
| `nuqs` | 2.10.1 | Board toolbar URL state (D-11) | `NuqsAdapter` from `nuqs/adapters/next/app`, as vinext's own ecosystem fixture does |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setInterval` worker | `@nestjs/schedule`, pg-boss, BullMQ | The extra deps or Redis add nothing at one replica and ~300 mails/day. `SKIP LOCKED` already makes multiple replicas safe |
| Offset-encoded opaque cursor | Keyset `(vote_count, created_at, id)` | Keyset on a mutable `vote_count`, or on a float `ts_rank`, still skips or duplicates rows. Offset is one code path for all three sorts, and the client dedupes by id |
| Scrubbing the `user` row in place | Better Auth `deleteUser` (hard delete) | A hard delete cascades votes (counts drop) and breaks author FKs. Scrubbing keeps the FKs and the votes |
| nuqs | A native `<form method="get">` + `router.push` | Locked by UI-SPEC and CLAUDE.md. Keep the native form as the fallback if Pitfall 12 bites |

**Installation (behind a human-verify checkpoint, matching Phase 2's lockfile review):**
```bash
bun add --cwd apps/api @nestjs/throttler@6.7.1 --exact
bun add --cwd apps/web nuqs@2.10.1 --exact
bun pm untrusted   # neither declares a postinstall (verified: postinstall null)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @nestjs/throttler | npm | 6.7.1 published 2026-09-24 (9 days old); package itself is years old | 5.44M/wk | github.com/nestjs/throttler | [SUS] (reason: `too-new`, release age only) | Flagged. The planner adds `checkpoint:human-verify` before install. Official `nestjs` org, no postinstall, peers `@nestjs/common ^7…\|\|^12.0.0` |
| nuqs | npm | 2.10.1 published 2026-08-25 | 6.22M/wk | github.com/47ng/nuqs | [OK] | Approved. `next` peer is optional (`peerDependenciesMeta.next.optional: true`), and the repo already has `next@16.3.8` as a devDependency |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@nestjs/throttler@6.7.1`. Only release age triggered the flag. Every Nest-12-compatible release (6.6.0, 6.7.0, 6.7.1) is from September 2026, so no older compatible version exists.

## Architecture Patterns

### System Architecture Diagram

```
Browser ──GET /{ws}/{product}?q&sort…──▶ vinext RSC page ──apiServer (cookie fwd)──▶ GET /api/v1/portal/:ws/:product/posts
   │                                         │                                            │ PortalGuard → explicit select → Public* Zod
   │  nuqs setQueryStates (shallow:false) ───┘ (RSC refetch, new history entry)           ▼
   │                                                                                 Postgres (posts + GIN tsvector)
   ├─ Load more ──TanStack useInfiniteQuery──▶ same endpoint ?cursor=opaque
   ├─ Vote ──optimistic──PUT/DELETE /api/v1/portal/:ws/:product/posts/:n/vote──▶ tx: lock post FOR UPDATE → insert/delete vote → ±1 count
   ├─ Comment ──POST …/posts/:n/comments──▶ tx: lock post → insert comment → recipients query → upsert pending batch per (user, ws) → items
   │                                                          (commit) ──▶ 201 (email never on the request path)
   │
   │            Email worker (setInterval 60s, in api process)
   │              claim: batches WHERE status IN (pending,retrying) AND send_after <= now FOR UPDATE SKIP LOCKED → status=sending
   │              render at send time (drop deleted/muted/opted-out) → nodemailer SMTP (Mailpit dev / Brevo prod)
   │              ok → sent | fail → retrying + backoff | 5 fails → failed
   │
   ├─ Admin (portal "⋯ Admin" or dashboard) ──/api/v1/workspaces/:ws/products/:product/…──▶ TenantGuard → status / merge / voters / restore tx
   │
   ├─ Email link "Mute this post" ──GET /unsubscribe/{token} (web page, no mutation)──▶ button ──POST /api/v1/unsubscribe/:token
   └─ Mail provider one-click ──POST /api/v1/unsubscribe/:allToken (no cookie, no Origin)──▶ HMAC verify → comment_emails=false → 200
```

### Recommended Project Structure
```
packages/db/src/schema/feedback.ts      # categories, posts, votes, comments, post_activity, post_mutes,
                                        # comment_email_batches, comment_email_items (+ relations)
packages/db/src/schema/{auth,tenancy}.ts# +user.deletedAt, +user.commentEmails, +workspaces.deletedAt, +products.nextPostNumber
packages/db/migrations/0007_feedback.sql   # generated
packages/db/migrations/0008_backfill_categories.sql  # drizzle-kit generate --custom (hand-written INSERT…SELECT)
packages/types/src/feedback.ts          # Public*/Admin* DTOs, inputs, BoardQuery, postSlug(), cursor helpers
apps/api/src/feedback/                  # one module
  portal-posts.controller.ts            # GET (@Public) board/post; POST/PATCH/DELETE post, vote, mute (signed in)
  portal-comments.controller.ts         # POST/PATCH/DELETE comments (signed in)
  admin-posts.controller.ts             # /workspaces/:ws/products/:product/posts… (TenantGuard)
  categories.controller.ts              # /workspaces/:ws/products/:product/categories (TenantGuard)
  feedback.service.ts                   # vote, merge, status, lock rule, timeline shaping
  throttle.ts                           # UserThrottlerGuard
apps/api/src/email/                     # outbox enqueue, worker, transport, tokens, unsubscribe controller, templates
apps/api/src/account/account.controller.ts   # GET /account, PATCH /account/preferences, POST /account/delete
apps/web/app/[ws]/[product]/page.tsx              # board (replaces coming-soon)
apps/web/app/[ws]/[product]/p/[ref]/page.tsx      # permalink
apps/web/app/dashboard/[ws]/[product]/{board,board/[number],categories}/page.tsx
apps/web/app/(app)/{account,unsubscribe/[token]}/page.tsx
apps/web/components/{board,post}/*      # per UI-SPEC component table
```

### API surface (recommended)

| Route | Guard | Notes |
|-------|-------|-------|
| `GET /portal/:ws/:product` | `@Public` PortalGuard | **Extend** `PublicPortalProduct` with `statuses[]` (id, name, color, type) and `categories[]` (id, name). This is one cached fetch shared by the layout and the page |
| `GET /portal/:ws/:product/posts` | `@Public` PortalGuard | `?q&sort&category&status&cursor` → `{ posts, nextCursor }` |
| `GET /portal/:ws/:product/posts/:number` | `@Public` PortalGuard | `{ kind: "post", post, timeline, viewer }` or `{ kind: "redirect", number, slug }` (merged) |
| `POST /portal/:ws/:product/posts` | signed in, PortalGuard, throttled | Create, auto-vote, allocate number |
| `PATCH` / `DELETE /portal/:ws/:product/posts/:number` | signed in | Author (when not engaged) **or** admin. Edit carries `version` |
| `PUT` / `DELETE /portal/:ws/:product/posts/:number/vote` | signed in, throttled | Idempotent, returns `{ voted, voteCount }` |
| `PUT` / `DELETE /portal/:ws/:product/posts/:number/mute` | signed in | D-25 bell |
| `POST /portal/:ws/:product/posts/:number/comments` | signed in, throttled | `{ body, parentId? }` |
| `PATCH` / `DELETE /portal/:ws/:product/comments/:id` | signed in | Author or admin. Edit carries `version` |
| `GET /workspaces/:ws/products/:product/posts` (+`?view=deleted`) | TenantGuard | Dashboard table, 50/page |
| `GET …/posts/:number`, `PUT …/posts/:number/status`, `GET …/posts/:number/voters`, `POST …/posts/:number/merge`, `POST …/posts/merge`, `POST …/posts/:number/restore`, `GET …/comments/deleted`, `POST …/comments/:id/restore` | TenantGuard | Admin |
| `GET/POST …/categories`, `PATCH/DELETE …/categories/:id` | TenantGuard | POST-02 |
| `GET /account`, `PATCH /account/preferences`, `POST /account/delete` | signed in | NOTF-02, WORK-07, D-26 |
| `GET` / `POST` / `DELETE /unsubscribe/:token` | `@Public`. **POST is Origin-exempt** | D-25 / RFC 8058 |

Using the per-product **number** in every portal route (never the post UUID) makes cross-product mixups impossible by construction: every lookup is `(product_id, number)`.

### Pattern 1: Schema (`packages/db/src/schema/feedback.ts`)

**What:** New tables follow the existing conventions verbatim:
- `uuid().defaultRandom()` PKs
- `text` user FKs
- snake_case column names
- `timestamp(..., { withTimezone: true })`
- `.js` relative imports

Existing values this pattern builds on:
- `statuses` already carries the composite-FK target `unique("statuses_id_product_unique").on(table.id, table.productId)` [VERIFIED: packages/db/src/schema/tenancy.ts:90].
- The status type enum is `pgEnum("status_type", ["review", "planned", "active", "completed", "closed"])` [VERIFIED: packages/db/src/schema/tenancy.ts:65-71].

```typescript
// Source: Drizzle FTS guide (orm.drizzle.team/docs/guides/full-text-search-with-generated-columns) + repo conventions
import { relations, sql, type SQL } from "drizzle-orm";
import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, customType,
  unique, uniqueIndex, index, primaryKey, foreignKey, check } from "drizzle-orm/pg-core";
import { user } from "./auth.js";
import { products, statuses, workspaces } from "./tenancy.js";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("categories_id_product_unique").on(t.id, t.productId),
  uniqueIndex("categories_product_name_ci").on(t.productId, sql`lower(${t.name})`),
]);

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),                       // null when empty
  statusId: uuid("status_id").notNull(),
  categoryId: uuid("category_id"),
  authorId: text("author_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  authorIsAdmin: boolean("author_is_admin").notNull().default(false),  // snapshot, server-decided
  voteCount: integer("vote_count").notNull().default(0),
  version: integer("version").notNull().default(1),        // D-27
  editedAt: timestamp("edited_at", { withTimezone: true }),  // D-15
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedById: text("deleted_by_id").references(() => user.id, { onDelete: "set null" }),
  mergedIntoId: uuid("merged_into_id"),                    // self-ref, set on merge (D-04)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  search: tsvector("search").notNull().generatedAlwaysAs((): SQL =>
    sql`setweight(to_tsvector('english', ${posts.title}), 'A') || setweight(to_tsvector('english', coalesce(${posts.description}, '')), 'B')`),
}, (t) => [
  uniqueIndex("posts_product_number").on(t.productId, t.number),
  unique("posts_id_product_unique").on(t.id, t.productId),
  foreignKey({ name: "posts_status_fk", columns: [t.statusId, t.productId],
    foreignColumns: [statuses.id, statuses.productId] }).onDelete("restrict"),
  foreignKey({ name: "posts_category_fk", columns: [t.categoryId, t.productId],
    foreignColumns: [categories.id, categories.productId] }),   // NO ACTION; category delete nulls explicitly first
  foreignKey({ name: "posts_merged_into_fk", columns: [t.mergedIntoId, t.productId],
    foreignColumns: [t.id, t.productId] }),
  index("posts_board_top").on(t.productId, t.voteCount.desc(), t.createdAt.desc())
    .where(sql`${t.deletedAt} IS NULL AND ${t.mergedIntoId} IS NULL`),
  index("posts_board_new").on(t.productId, t.createdAt.desc())
    .where(sql`${t.deletedAt} IS NULL AND ${t.mergedIntoId} IS NULL`),
  index("posts_search_gin").using("gin", t.search),
  check("posts_no_self_merge", sql`${t.mergedIntoId} IS NULL OR ${t.mergedIntoId} <> ${t.id}`),
]);

export const votes = pgTable("votes", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] }), index("votes_user_idx").on(t.userId)]);

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  authorId: text("author_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  isAdmin: boolean("is_admin").notNull().default(false),   // CMNT-02 snapshot
  body: text("body").notNull(),
  version: integer("version").notNull().default(1),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedById: text("deleted_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("comments_id_post_unique").on(t.id, t.postId),
  // NO ACTION (default) is required, so merge's single UPDATE of post_id passes (probed, Pitfall 7)
  foreignKey({ name: "comments_parent_fk", columns: [t.parentId, t.postId], foreignColumns: [t.id, t.postId] }),
  index("comments_post_created").on(t.postId, t.createdAt),
  index("comments_author_idx").on(t.authorId),
]);

export const postActivityKind = pgEnum("post_activity_kind", ["status_changed"]);
export const postActivity = pgTable("post_activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  kind: postActivityKind("kind").notNull(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  toStatusId: uuid("to_status_id"),          // no FK: the snapshot must outlive status deletes
  statusName: text("status_name").notNull(), // snapshot (UI-SPEC ActivityItem)
  statusColor: text("status_color").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("post_activity_post_created").on(t.postId, t.createdAt)]);

export const postMutes = pgTable("post_mutes", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.postId] })]);

export const emailBatchStatus = pgEnum("email_batch_status",
  ["pending", "sending", "retrying", "sent", "failed", "cancelled"]);
export const commentEmailBatches = pgTable("comment_email_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  status: emailBatchStatus("status").notNull().default("pending"),
  sendAfter: timestamp("send_after", { withTimezone: true }).notNull(),  // also "next attempt at"
  attempts: integer("attempts").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("comment_email_batches_one_pending").on(t.userId, t.workspaceId).where(sql`${t.status} = 'pending'`),
  index("comment_email_batches_due").on(t.status, t.sendAfter),
]);
export const commentEmailItems = pgTable("comment_email_items", {
  batchId: uuid("batch_id").notNull().references(() => commentEmailBatches.id, { onDelete: "cascade" }),
  commentId: uuid("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.batchId, t.commentId] })]);
```

Additions to existing tables:
- `user.deletedAt` (timestamptz), plus `deletedAt` declared in Better Auth `additionalFields` next to `bannedAt`
- `user.commentEmails boolean not null default true`
- `workspaces.deletedAt` (timestamptz)
- `products.nextPostNumber integer not null default 1`

Register `feedback.ts` in `packages/db/src/index.ts`, following the existing `tenancySchema` lines 9, 14 and 19.

### Pattern 2: Post creation (number allocation + D-10 auto-vote)

```typescript
// Probed on PG 18.6: RETURNING sees the post-update row, so next_post_number - 1 is the allocated number (1, then 2)
await db.transaction(async (tx) => {
  const [{ n }] = await tx.update(products)
    .set({ nextPostNumber: sql`${products.nextPostNumber} + 1` })
    .where(eq(products.id, productId))
    .returning({ n: sql<number>`${products.nextPostNumber} - 1` });   // row lock serializes per product
  const [def] = await tx.select({ id: statuses.id }).from(statuses)
    .where(and(eq(statuses.productId, productId), eq(statuses.isDefault, true)));       // STAT-05
  const [post] = await tx.insert(posts).values({ productId, number: n, title, description,
      statusId: def.id, categoryId, authorId: user.id, authorIsAdmin: isAdmin, voteCount: 1 })
    .returning({ id: posts.id, number: posts.number, title: posts.title });
  await tx.insert(votes).values({ postId: post.id, userId: user.id });                   // D-10
  return post;
});
```

When the product has ≥1 category, `categoryId` must be one of its categories. The composite FK guarantees this, but validate first so the response is `category_invalid` rather than a 500. The slug is **derived, never stored**: `postSlug(title)`. Generalize `slugify(name, max = SLUG_MAX_LENGTH)` in `packages/types/src/slugs.ts`, where it is currently capped at `SLUG_MAX_LENGTH = 32` [VERIFIED: packages/types/src/slugs.ts:5,29-39], and call it with max 60 for posts. When the slug comes out empty (an all-non-Latin title), the canonical path is `/p/{n}`.

### Pattern 3: Idempotent votes with an atomic counter (POST-03/04, MOD-04)

```typescript
async setVote(productId: string, number: number, userId: string, on: boolean) {
  return this.db.transaction(async (tx) => {
    const [p] = await tx.select({ id: posts.id }).from(posts)
      .where(and(eq(posts.productId, productId), eq(posts.number, number),
                 isNull(posts.deletedAt), isNull(posts.mergedIntoId)))
      .for("update");                                  // NOT "share": share-then-update deadlocks two voters
    if (!p) throw new ApiException("post_not_found", 404, "Not found.");
    const changed = on
      ? await tx.insert(votes).values({ postId: p.id, userId }).onConflictDoNothing().returning({ u: votes.userId })
      : await tx.delete(votes).where(and(eq(votes.postId, p.id), eq(votes.userId, userId))).returning({ u: votes.userId });
    const [row] = await tx.update(posts)
      .set({ voteCount: sql`${posts.voteCount} + ${changed.length ? (on ? 1 : -1) : 0}` })  // version NOT bumped
      .where(eq(posts.id, p.id)).returning({ voteCount: posts.voteCount });
    return { voted: on, voteCount: row.voteCount };
  });
}
```

Voters list (MOD-04): `TenantGuard`, `votes JOIN user`, newest first, 50 per page. Each row is `{ name, image, votedAt, deleted }`. **Never email**, for admins too (UI-SPEC choice). A deleted user's row comes back as `name: null, deleted: true`.

### Pattern 4: Board query: FTS, filters, sort, cursor (POST-07..10, D-09)

- **Search vector:** a stored generated `tsvector`, `title` weighted A and `description` weighted B, using the `'english'` regconfig. The two-arg form is required, and `coalesce(description,'')` is required (both probed, Pitfall 1).
- **Query parsing:** `websearch_to_tsquery('english', $q)` never throws on odd input (probed: `'"unterminated - OR ) ( :* & |'` → `'untermin'`). Stop-word-only input yields an empty query that matches nothing.
- **Stemming works, prefixes do not:** `exporting csv` matches `Export to CSV`, but `dar` does not match `dark` (probed). For the merge dialog's type-ahead this is acceptable in v1. See Open Question 4.
- **Sort:**
  - `top`: `vote_count DESC, created_at DESC, id DESC`
  - `new`: `created_at DESC, id DESC`
  - `match`: `ts_rank(search, q) DESC, vote_count DESC, id DESC` (the default while `q` is set)
- **Status filter:**
  - default `open`: `statuses.type NOT IN ('completed','closed')`
  - `all`: no filter
  - a uuid: that status
- **Cursor:** opaque `base64url(JSON.stringify({ o: offset }))`. Fetch `limit + 1` to compute `nextCursor`. Reject an offset that is non-integer or above 10 000 with `validation_failed`. The client dedupes appended rows by `id` (votes can shift rows between pages). Mark it `// ponytail: offset cursor; switch "new" to keyset if a product passes ~10k posts`.
- **Per-row extras in the same query** (no N+1):
  - comment count: `(SELECT count(*)::int FROM comments c WHERE c.post_id = posts.id AND c.deleted_at IS NULL)`
  - `voted`: `EXISTS(SELECT 1 FROM votes v WHERE v.post_id = posts.id AND v.user_id = $viewer)`
  - the status name, color and type, and the category name, via joins

```typescript
const q = query.q ? sql`websearch_to_tsquery('english', ${query.q})` : null;
const rows = await db.select({
    number: posts.number, title: posts.title, description: posts.description, voteCount: posts.voteCount,
    createdAt: posts.createdAt, statusName: statuses.name, statusColor: statuses.color, statusType: statuses.type,
    categoryName: categories.name,
    commentCount: sql<number>`(SELECT count(*)::int FROM ${comments} c WHERE c.post_id = ${posts.id} AND c.deleted_at IS NULL)`,
    voted: viewerId ? sql<boolean>`EXISTS (SELECT 1 FROM ${votes} v WHERE v.post_id = ${posts.id} AND v.user_id = ${viewerId})` : sql<boolean>`false`,
  })
  .from(posts)
  .innerJoin(statuses, eq(posts.statusId, statuses.id))
  .leftJoin(categories, eq(posts.categoryId, categories.id))
  .where(and(eq(posts.productId, productId), isNull(posts.deletedAt), isNull(posts.mergedIntoId),
    q ? sql`${posts.search} @@ ${q}` : undefined,
    query.category ? eq(posts.categoryId, query.category) : undefined,
    statusFilter(query.status)))
  .orderBy(...orderFor(query.sort, q))
  .limit(pageSize + 1).offset(offset);
```

Probe evidence for the ranking: for the query `dark`, the title hit ranked 0.608 and the description hit ranked 0.243.

### Pattern 5: Lock rule (D-13/D-14), decided by the server

`engaged` = another user has voted, or another user has a non-deleted comment:

```sql
EXISTS (SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.user_id <> p.author_id)
OR EXISTS (SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id <> p.author_id AND c.deleted_at IS NULL)
```

- `canEdit` = `canDelete` = `isAdmin || (isAuthor && !engaged)`. Both are returned in `viewer`, so the UI never computes the lock.
- Re-check `engaged` **inside** the edit and delete transactions after `SELECT … FOR UPDATE` on the post. A violation raises `post_locked` (403).
- Votes and comments also lock the post row first (Patterns 3 and 8), so "engage" and "edit" are serialized.
- Admin check: `isWorkspaceAdmin(db, userId, workspaceId)`, which is a `workspace_members` lookup (roles `owner` | `admin`). Make it one helper shared by the portal controllers.

### Pattern 6: Optimistic concurrency (D-27) with an integer `version`

```typescript
const [row] = await tx.update(posts)
  .set({ title, description, categoryId, version: sql`${posts.version} + 1`, editedAt: sql`now()` })
  .where(and(eq(posts.id, id), eq(posts.version, input.version), isNull(posts.deletedAt), isNull(posts.mergedIntoId)))
  .returning({ number: posts.number, title: posts.title, version: posts.version });
if (!row) {
  const [still] = await tx.select({ id: posts.id }).from(posts)
    .where(and(eq(posts.id, id), isNull(posts.deletedAt), isNull(posts.mergedIntoId)));
  throw still ? new ApiException("edit_conflict", 409, "…") : new ApiException("post_not_found", 404, "…");
}
```

**Use an integer, not `updated_at`:** Postgres keeps microseconds (probed: `10:09:03.735217+00`) and a JS `Date` keeps milliseconds, so a timestamp precondition never matches after a JSON round-trip.
- Bump `version` on edit and on status change.
- Never bump it on vote, comment, or merge. Otherwise every vote causes an `edit_conflict`.
- The same pattern applies to comments.

### Pattern 7: Status change and activity (MOD-03, D-05) and the status-delete extension

- Status change: `PUT …/posts/:number/status { statusId, note?, version }` under TenantGuard. In one transaction:
  1. lock the post
  2. check the version
  3. verify the status belongs to this product
  4. update `status_id`, `version+1`
  5. insert `post_activity { kind: 'status_changed', actorId, toStatusId, statusName, statusColor, note }`, with the name and color snapshotted at change time
- No email (UI-SPEC). Leave a comment: `// Phase 4: reject when the post is linked to a roadmap item (ROAD-07)`.
- `deleteStatus` (`apps/api/src/products/statuses.controller.ts`) already reserves the line `// Phase 3: UPDATE posts SET status_id = moveTo WHERE status_id = id AND product_id = tenant.productId` [VERIFIED: apps/api/src/products/statuses.controller.ts:348]. Replace it with `await tx.update(posts).set({ statusId: moveTo }).where(and(eq(posts.statusId, statusId), eq(posts.productId, tenant.productId!)))`.
- The composite FK `ON DELETE RESTRICT` makes a missed reassignment fail loudly instead of orphaning posts.

### Pattern 8: Comments, one-level threads, Admin badge (CMNT-01..04, D-16..19)

- **Create** (one transaction):
  1. lock the post (visible and unmerged)
  2. if `parentId` is set, load the parent within the same post. If the parent itself has a `parent_id`, use the **parent's parent** (D-16, normalized on the server too). A missing or foreign parent returns `comment_not_found`.
  3. `isAdmin` = the author is a member of the post's workspace (snapshot)
  4. insert the comment
  5. **enqueue email (Pattern 11)**
  6. commit
- **Timeline read:** load every comment for the post, including deleted top-level comments, plus every `post_activity` row. Then shape on the server:
  - drop deleted replies
  - a deleted top-level comment becomes `{ kind: "stub", id, replies }` **only if** it still has ≥1 visible reply, otherwise it is dropped. **The stub never carries body or author.**
  - merge top-level comments and activity by `created_at` (oldest first). Replies sort oldest first.
  - each comment carries `canEdit/canDelete` for the viewer
- Comments are not paginated in v1 (UI-SPEC).

### Pattern 9: Merge (MOD-05, D-03, D-04)

```typescript
async merge(tx, productId: string, dupId: string, targetId: string) {
  // lock both rows in id order to avoid deadlock with a concurrent reverse merge
  const locked = await tx.select({ id: posts.id }).from(posts)
    .where(and(eq(posts.productId, productId), inArray(posts.id, [dupId, targetId]),
               isNull(posts.deletedAt), isNull(posts.mergedIntoId)))
    .orderBy(asc(posts.id)).for("update");
  if (dupId === targetId || locked.length !== 2) throw new ApiException("merge_target_invalid", 400, "…");
  await tx.execute(sql`INSERT INTO votes (post_id, user_id, created_at)
    SELECT ${targetId}, user_id, created_at FROM votes WHERE post_id = ${dupId} ON CONFLICT DO NOTHING`);
  await tx.delete(votes).where(eq(votes.postId, dupId));
  await tx.update(comments).set({ postId: targetId }).where(eq(comments.postId, dupId));   // threads move intact
  await tx.execute(sql`INSERT INTO post_mutes (user_id, post_id, created_at)
    SELECT user_id, ${targetId}, created_at FROM post_mutes WHERE post_id = ${dupId} ON CONFLICT DO NOTHING`);
  await tx.update(posts).set({ mergedIntoId: targetId }).where(eq(posts.mergedIntoId, dupId)); // flatten chains
  await tx.update(posts).set({ mergedIntoId: targetId, voteCount: 0 }).where(eq(posts.id, dupId));
  await tx.update(posts).set({ voteCount: sql`(SELECT count(*)::int FROM votes WHERE post_id = ${targetId})` })
    .where(eq(posts.id, targetId));
}
```

- Activity rows stay on the duplicate (D-04: no trace on the target).
- Bulk merge runs the same function for each non-kept post inside one transaction.
- A losing race (one post already merged or deleted) returns `post_not_found` (D-27).
- **Phase 4 note:** merge must later respect "a post links to at most one roadmap item".

### Pattern 10: Soft delete and restore (MOD-02, D-06, D-14, CMNT-04)

- Deleting sets `deleted_at = now(), deleted_by_id = actor`. Votes stay, so a restored post's `vote_count` is already correct.
- Public reads always filter `deleted_at IS NULL AND merged_into_id IS NULL`. The dashboard `?view=deleted` lists both kinds.
- Restoring a comment whose post is deleted is rejected (UI-SPEC "Restore the post first").
- An unknown, deleted, or cross-product post renders the normal not-found page. Only merged posts redirect.

### Pattern 11: Email outbox, daily per-recipient per-workspace batch (NOTF-01..03, OPS-03, D-21..25)

**Enqueue, inside the comment transaction (transactional outbox: the comment and its email intent commit together, so a send failure can never lose or block the comment):**

```sql
-- recipients (D-22): author + everyone with a non-deleted comment on the post, minus actor/opted-out/muted/deleted/banned
WITH r AS (
  SELECT DISTINCT u.id FROM (
    SELECT author_id AS uid FROM posts WHERE id = $post
    UNION SELECT author_id FROM comments WHERE post_id = $post AND deleted_at IS NULL
  ) c JOIN "user" u ON u.id = c.uid
  WHERE u.id <> $actor AND u.comment_emails AND u.deleted_at IS NULL AND u.banned_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM post_mutes m WHERE m.user_id = u.id AND m.post_id = $post)
), b AS (
  INSERT INTO comment_email_batches (user_id, workspace_id, send_after)
  SELECT id, $ws, now() + interval '24 hours' FROM r
  ON CONFLICT (user_id, workspace_id) WHERE status = 'pending'   -- the partial-index predicate is REQUIRED (probed)
  DO UPDATE SET user_id = EXCLUDED.user_id                        -- no-op so RETURNING yields the existing row
  RETURNING id
)
INSERT INTO comment_email_items (batch_id, comment_id) SELECT id, $comment FROM b;
```

- `send_after` is set only when the batch is created, so the 24 h window counts from the **first** qualifying comment (D-21).
- Once the worker moves a batch to `sending`, the partial unique index no longer covers it. The next comment opens a fresh pending batch, 24 h out (probed: a new id is returned after `UPDATE … SET status='sending'`).

**Worker** (`EmailWorker implements OnApplicationBootstrap, OnApplicationShutdown`): `setInterval(() => this.runOnce(new Date()), 60_000)`, started only when `SMTP_HOST` is set. Clear it on shutdown.

```sql
UPDATE comment_email_batches SET status = 'sending', claimed_at = now()
WHERE id IN (
  SELECT id FROM comment_email_batches
  WHERE (status IN ('pending','retrying') AND send_after <= $now)
     OR (status = 'sending' AND claimed_at < $now - interval '10 minutes')     -- crash recovery
  ORDER BY send_after LIMIT 20 FOR UPDATE SKIP LOCKED)
RETURNING id, user_id, workspace_id, attempts;
```

- For each claimed batch, render **at send time**:
  - re-check `user.comment_emails`, deleted and banned users, and the workspace's `deleted_at`/`suspended_at`. A failed check sets `cancelled`.
  - join items to comments with `deleted_at IS NULL` and their **current** `post_id` (so merges resolve to the target), plus posts that are visible, in a live product, and not muted by the recipient
  - group by post, sections ordered by the newest comment
  - take the last 3 per section (oldest to newest), plus `+N more`
  - no sections means `cancelled`
- Send result:
  - success: `sent`, `sent_at`
  - failure: `attempts+1`, `status='retrying'`, `send_after = now + BACKOFF[attempts]` with `BACKOFF = [5m, 30m, 2h, 6h]`. After 5 attempts, `failed` and log.
- Delivery is at-least-once: a crash after SMTP accepted the message but before the row was marked `sent` resends once. Document this with a `ponytail:` comment.
- `runOnce(now)` takes `now` so tests can jump 24 h without sleeping.

**Transport** (env per OPS-03). Extract the options from `smtp-check.ts:41-50` (`secure: port === 465`, `requireTLS: !isTls && requireTls`) into one `createSmtpTransport(env)` that both the probe and the worker use:

| Env key | Dev (Mailpit) | Prod (Brevo) |
|---------|---------------|--------------|
| `SMTP_HOST` | `127.0.0.1` (native) / `mailpit` (staging profile) | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `1025` | **unrecorded: see Open Question 1** (587 expected) |
| `SMTP_REQUIRE_TLS` | `false` | `true` |
| `SMTP_USER` / `SMTP_PASS` | any / any | Brevo SMTP login / key |
| `SMTP_FROM` | `notifications@userhq.test` | a Brevo-verified sender address |

- All five are optional in `EnvSchema`. When `SMTP_HOST` is unset, the worker doesn't start and batches wait. This is safe for tests and local runs.
- `compose.yaml`'s `api.environment` currently passes **no** `SMTP_*` keys. Add `SMTP_HOST: ${SMTP_HOST:-}` and the others.
- Mailpit is already defined in `compose.dev.yaml` (ports `127.0.0.1:1025`, `127.0.0.1:8025`) and in `compose.yaml` under `profiles: - mail` [VERIFIED: compose.dev.yaml:21-29, compose.yaml:52-60].

**Message:**
```typescript
await transport.sendMail({
  from: { name: `${workspaceName} via UserHQ`, address: env.SMTP_FROM },   // nodemailer encodes/quotes the display name
  to: recipientEmail,
  subject, text, html,
  headers: {
    "List-Unsubscribe": `<${env.PUBLIC_URL}/api/v1/unsubscribe/${allToken}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  },
});
```

Nodemailer's `list` option maps keys to `List-<key>` (help, unsubscribe, subscribe, post, owner, archive, id). It has no one-click key, and `list.post` emits `List-Post`, which is a different header. So set both headers explicitly [VERIFIED: nodemailer 10.0.13 `dist/esm/mail-composer/index.d.ts:68-70`].

**Tokens:** stdlib HMAC with no expiry (D-25 says "non-expiring").

```typescript
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
const key = Buffer.from(hkdfSync("sha256", env.BETTER_AUTH_SECRET, "", "userhq-unsubscribe-v1", 32));
export function signToken(userId: string, scope: "all" | `p:${string}`): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, s: scope })).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}
export function verifyToken(token: string): { u: string; s: string } | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", key).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
}
```

Rotating `BETTER_AUTH_SECRET` invalidates old links, which then show the "invalid token" page that points to account settings. That is acceptable. Note it in docs/deploy.md.

**Unsubscribe endpoints** (`@Public`, each with `@SerializeOptions({ schema: UnsubscribeStateSchema })` because `public-contract.test.ts` enforces it):
- `GET /unsubscribe/:token`: returns `{ scope: "all" | "post", state, postTitle? }`. It **never mutates**, because scanners prefetch.
- `POST /unsubscribe/:token`: scope `all` sets `comment_emails = false`, and scope `post` inserts the mute. It **must be exempt from `OriginGuard`**. RFC 8058: the POST "MUST NOT include cookies, HTTP authorization, or any other context information", and the sender "MUST NOT return an HTTPS redirect". The handler ignores the body (`List-Unsubscribe=One-Click`, form-encoded or multipart), so no urlencoded parser is needed. Respond 200 JSON.
- `DELETE /unsubscribe/:token`: undo (turn back on, or unmute). The browser sends `Origin`, so no exemption is needed.

The existing guard blocks the POST [VERIFIED: apps/api/src/auth/guards.ts:26-41]:
```typescript
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return true;
    }
    ...
    if (!origin || origin !== expectedOrigin) {
      throw new ApiException(
        "forbidden",
```

Add a `SkipOriginCheck()` metadata decorator, read by `OriginGuard` through `Reflector`, and apply it only to the unsubscribe POST. The HMAC token is the authorization, so CSRF can't forge it.

### Pattern 12: Account deletion + D-26 workspace choices (WORK-07, D-20, D-26)

`POST /account/delete { workspaces: [{ slug, action: "transfer" | "delete", toUserId? }] }`. One transaction:
1. Reject the platform owner (`isPlatformOwner(user, env.PLATFORM_OWNER_EMAIL)`) with `platform_owner_account`.
2. `SELECT … FROM workspace_members WHERE user_id = $me AND role = 'owner' FOR UPDATE`. The input slugs must equal this set exactly, otherwise `owned_workspaces_unresolved`.
3. For a transfer, the target must be a current member of that workspace and not the caller (`transfer_target_invalid`). **Delete the caller's membership first, then promote the target.** The partial unique index `workspace_members_one_owner … where role = 'owner'` [VERIFIED: packages/db/src/schema/tenancy.ts:119-121] is checked per statement.
4. For a delete: `UPDATE workspaces SET deleted_at = now()`. The slug stays reserved by the existing unique constraint, which prevents link hijacking.
5. `DELETE FROM workspace_members WHERE user_id = $me`, `DELETE FROM post_mutes WHERE user_id = $me`, and `UPDATE comment_email_batches SET status='cancelled' WHERE user_id = $me AND status IN ('pending','retrying')`.
6. Scrub in place: `name = ''`, `image = NULL`, `email = 'deleted-' || id || '@deleted.invalid'` (email is `NOT NULL UNIQUE`), `email_verified = false`, `comment_emails = false`, `deleted_at = now()`.
7. `DELETE FROM session WHERE user_id = $me` and `DELETE FROM account WHERE user_id = $me`.
   - Sessions are DB-only, because `cookieCache` is not configured (`session: { expiresIn, updateAge }` only [VERIFIED: apps/api/src/auth/auth.ts:56-59]) and Better Auth checks `cookieCache?.enabled === true`. So revocation is immediate.
   - With the account rows gone and the email scrubbed, a later OAuth sign-in creates a fresh user.

After the 204, the client calls `authClient.signOut()`, which deletes the session cookie even when the row is gone [VERIFIED: better-auth 1.7.7 dist/api/routes/sign-out.mjs]. It then stores `flash(...)` and runs `window.location.assign("/")`. Votes remain, so counts are unchanged (UI-SPEC). Posts and comments render as "Deleted user" from `user.deleted_at`.

**Workspace soft delete must be honoured everywhere a workspace is resolved.** Add `isNull(workspaces.deletedAt)` to:
- `PortalGuard` (`portal.guard.ts:24-31`)
- `TenantGuard` (`tenant.guard.ts:40-55`)
- the `/me` membership query (`me.controller.ts:43-54`, which drives D-01 admin detection)
- invite lookup and accept (`invites.service.ts`)
- the email worker

Also extend `SessionGuard` line 66 to null out `deletedAt` users, as it does for `bannedAt`.

### Pattern 13: Public DTO allowlists (AUTH-04, privacy)

```typescript
export const PublicAuthorSchema = z.object({
  name: z.string().nullable(),      // null when deleted → UI "Deleted user"
  image: z.string().nullable(),
  isAdmin: z.boolean(),             // false when deleted
  deleted: z.boolean(),
});
```

Never put an email or user id in a `Public*` schema. Map from explicit `select()` columns (`user.name`, `user.image`, `user.deletedAt`, `posts.authorIsAdmin`). Every `@Public` handler keeps `@SerializeOptions({ schema })`. `z.object` strips unknown keys, which is the second safety net. Viewer flags (`voted`, `isAuthor`, `inConversation`, `muted`, `canEdit`, `canDelete`, `commentEmailsOn`) are computed on the server per request.

### Pattern 14: Web: board URL state, permalink redirect, PROD-06, admin detection

- **nuqs:**
  - Wrap the root `app/layout.tsx` body in `<NuqsAdapter>` from `nuqs/adapters/next/app`, the exact import vinext's fixture uses.
  - The toolbar uses `useQueryStates({ q, sort, category, status, new }, { shallow: false, history: "push" })`. Defaults are omitted from the URL via `.withDefault(...)` plus `clearOnDefault` (nuqs v2 default).
  - Search commits on Enter: keep a local input state, then set `q`.
  - The page RSC reads `searchParams` and fetches.
- **Permalink** `app/[ws]/[product]/p/[ref]/page.tsx`:
  1. parse `^(\d+)(?:-|$)`
  2. fetch, sharing one `cache()` reader with `generateMetadata`
  3. on `kind === "redirect"`, call `permanentRedirect(canonical)`
  4. if `ref !== canonicalRef`, call `permanentRedirect(canonical)`

  **Call these only from the page component, never from `generateMetadata`** (Pitfall 4). vinext's `permanentRedirect` emits **308** (`NEXT_REDIRECT;${type};${url};308`) [VERIFIED: vinext 1.0.0 dist/shims/navigation-errors.js:42-44]. The UI-SPEC "301" backstop e2e must assert `308` and `Location`. The two codes are equivalent for GET and SEO.
- **Signed-out actions:**
  - vote, Reply, and New post link to `/login?next=${encodeURIComponent(pathname + search + hash)}`
  - New post sets `new=1`
  - the comment prompt adds `#comment`

  `safeNext` returns `u.pathname + u.search + u.hash` [VERIFIED: apps/web/lib/safe-next.ts:31].
- **Admin menu (D-01):** `me.workspaces.some(w => w.slug === ws)`. `MeWorkspaceSchema` is `{ slug, name, logoUrl, role: MemberRoleSchema }` [VERIFIED: packages/types/src/tenancy.ts:105-110].
- **`/account`:** add `"/account"` to the `proxy.ts` matcher (currently `["/dev/:path*", "/dashboard", "/dashboard/:path*", "/invite/:path*"]` [VERIFIED: apps/web/proxy.ts:26]).
- **QueryProvider:** client islands that use TanStack must sit under `QueryProvider` (`lib/query-client.tsx`). Today each form wraps itself.

### Anti-Patterns to Avoid
- **Toggle vote endpoint** (`POST /vote` flips state): a double click unvotes. Use PUT/DELETE.
- **`voteCount + 1` computed in JS:** lost updates. Use a SQL increment inside the transaction, and only when a row actually changed.
- **Sending SMTP inside the comment request:** violates NOTF-03. Always enqueue.
- **Calling `permanentRedirect`/`notFound` from `generateMetadata`:** this gives a 200 + meta refresh in vinext, not a 308.
- **Deriving a post DTO with `drizzle-zod` or `select()` with no field map:** leaks `authorId`, `deletedById`, and the search vector.
- **Using Better Auth's `deleteUser`:** a hard delete cascades votes and conflicts with the `restrict` author FKs. Keep it disabled.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text search and ranking | LIKE scans, JS scoring | Postgres generated `tsvector` + GIN + `websearch_to_tsquery` + `ts_rank` | Stemming, safe query parsing, indexable |
| Rate limiting | Per-user counters in a Map | `@nestjs/throttler` with a `getTracker` override | Named throttlers, `@Throttle` overrides, 429 semantics |
| Job queue | Redis or a queue lib | Outbox table + `FOR UPDATE SKIP LOCKED` + `setInterval` | Zero new infrastructure, multi-replica safe |
| Signed tokens | Custom crypto, JWT libs | `node:crypto` HMAC-SHA256 + `timingSafeEqual` + `hkdfSync` | No expiry needed, so JWT adds nothing |
| Email address headers | String-concatenating `"Name" <addr>` | nodemailer `from: { name, address }` | Quoting and RFC 2047 encoding of unicode workspace names |
| URL search-param state | Manual `useSearchParams` + push plumbing | `nuqs` (locked) | History, defaults, parsers |
| One-vote rule | App-level "has voted?" check | Composite PK `(post_id, user_id)` + `ON CONFLICT DO NOTHING` | Race-proof |
| Per-product numbering | `max(number)+1` | A counter column updated with `RETURNING` (row lock) | `max+1` races into unique violations |

**Key insight:** every invariant in this phase (one vote, one pending batch, one owner, a parent in the same post, a status in the same product) is cheapest and safest as a Postgres constraint. Application code only maps the violation to a code.

## Common Pitfalls

### Pitfall 1: Generated `tsvector` errors or silently empties
**What goes wrong:** the migration fails with `generation expression is not immutable`, or posts without a description are never found.
**Why it happens:** one-arg `to_tsvector(text)` depends on `default_text_search_config`. `setweight(A) || setweight(to_tsvector(NULL))` is `NULL`.
**How to avoid:** use `to_tsvector('english', …)` and `coalesce(description, '')`. Both were probed on PG 18.6: the first error reproduced, and `search IS NULL` was `t` without coalesce.
**Warning signs:** a search test with a title-only post returns nothing.

### Pitfall 2: Partial-index upsert without its predicate
**What goes wrong:** `ON CONFLICT (user_id, workspace_id) DO UPDATE` fails with `there is no unique or exclusion constraint matching the ON CONFLICT specification` (probed).
**How to avoid:** `ON CONFLICT (user_id, workspace_id) WHERE status = 'pending'`. In Drizzle, use `onConflictDoUpdate({ target: [...], targetWhere: sql\`status = 'pending'\`, set })`.

### Pitfall 3: 429 surfaces as `internal_error`
**What goes wrong:** the UI can't show `rate_limited`.
**Why it happens:** `ApiErrorFilter`'s default branch maps every unlisted 4xx to `code = "internal_error"` [VERIFIED: apps/api/src/common/api-error.filter.ts:70-77].
**How to avoid:** add `case HttpStatus.TOO_MANY_REQUESTS: code = "rate_limited"` in **both** switch blocks (lines 49 and 88), and add `rate_limited` to `API_ERROR_CODES`.

### Pitfall 4: Permalink redirect returns 200 instead of 308
**What goes wrong:** a stale slug or a merged URL renders a meta-refresh page with status 200.
**Why it happens:** vinext source says a redirect from `generateMetadata` "is not emitted as a plain HTTP-level 307 … Streaming-capable document requests get a 200 HTML response carrying a refresh meta tag". Page-level redirects keep the HTTP status [VERIFIED: vinext 1.0.0 dist/server/app-page-execution.js:12-27].
**How to avoid:** `generateMetadata` returns `{}` for redirect results. Only the page calls `permanentRedirect`.

### Pitfall 5: One-click unsubscribe silently 403s
**What goes wrong:** Gmail and Yahoo one-click fails, so the user keeps getting mail and marks it as spam.
**Why it happens:** `OriginGuard` rejects POSTs without `Origin` (see Pattern 11). Also, RFC 8058 requires a DKIM signature that covers both List headers.
**How to avoid:** add a `SkipOriginCheck` decorator on that one route. Add an integration test that POSTs with no `Origin` and no cookie, with body `List-Unsubscribe=One-Click` as `application/x-www-form-urlencoded`, and expects 200 and `comment_emails = false`. Verify Brevo domain authentication (Open Question 2).

### Pitfall 6: Cross-tenant suite turns red on portal writes
**What goes wrong:** the discovery at `cross-tenant.test.ts:119` (`if (fullPath.includes(":ws"))`) picks up `POST /portal/:ws/:product/posts/:number/vote`, which is non-public and contains `:ws`. Then it expects a 404 for workspace A's user voting on B's portal, which is legitimate.
**How to avoid:** scope discovery to `fullPath.startsWith("/workspaces/:ws")`. Add every new admin route to `CROSS_TENANT_ROUTES`, and seed a post, a comment and a category in B. Add a separate portal-isolation test covering A's product slug with B's post number, and B's comment id under A's product: both must 404.

### Pitfall 7: Merge breaks on the comment-parent FK
**What goes wrong:** moving comments to the target fails mid-transaction.
**Why it happens:** the composite self-FK `(parent_id, post_id) → (id, post_id)` declared `ON UPDATE/DELETE RESTRICT` checks immediately.
**How to avoid:** keep it as the default NO ACTION, which is checked at end of statement, and move all of a post's comments in **one** `UPDATE` (probed: 3 rows moved, parents intact).

### Pitfall 8: Optimistic-concurrency false conflicts
**What goes wrong:** every save returns `edit_conflict`, or every vote invalidates an open edit dialog.
**How to avoid:** use an integer `version` (not timestamps: microsecond loss), and never bump it on vote or comment (Pattern 6).

### Pitfall 9: Existing products have no categories or post counter
**What goes wrong:** prod (live since Phase 1) has products with zero categories, so POST-02's "seeded with Bug and Feature Request" is false for them.
**How to avoid:**
- Add `nextPostNumber` with `default 1` (an additive, safe migration).
- Seed new products in `createProduct`'s transaction right after the statuses insert (`products.controller.ts:95-104`).
- Backfill existing ones with a `drizzle-kit generate --custom` migration: `INSERT INTO categories (product_id, name, created_at) SELECT id, 'Feature Request', now() FROM products; … 'Bug', now() + interval '1 millisecond'`. The order comes from `created_at` (UI-SPEC: Feature Request first). Add `// ponytail: creation order via created_at offset; add position if reorder ever ships`.

### Pitfall 10: Vote deadlock under concurrency
**What goes wrong:** two concurrent voters on one post deadlock.
**Why it happens:** both take `FOR SHARE`, then both try to `UPDATE` the same row. This is the classic lock upgrade. `[ASSUMED]` from Postgres locking semantics; it was not reproduced this session.
**How to avoid:** lock with `.for("update")` from the start (Pattern 3). Add a concurrency test: 50 parallel `PUT` from one user leave 1 row with `vote_count = 1`, and 20 parallel users give `vote_count = 20 = COUNT(*)`.

### Pitfall 11: Throttler tracks the proxy, or runs before the session
**What goes wrong:** all users share one bucket (Caddy's IP), or `req.user` is undefined in `getTracker`.
**How to avoid:**
- `trust proxy` is already set (`app.set("trust proxy", 1)`, `app.module.ts:109`).
- Apply `UserThrottlerGuard` per handler with `@UseGuards`. Route-level guards run after the global `OriginGuard`/`SessionGuard` `[CITED: docs.nestjs.com/guards]`.
- Override `getTracker(req) => req.user?.id ?? req.ip`.

### Pitfall 12: nuqs `shallow:false` under vinext is untested upstream
**What goes wrong:** filters update the URL but the RSC list doesn't refetch.
**Why it happens:** vinext's nuqs fixture checks SSR HTML and the shim-resolved prebundle only. No client navigation is exercised `[VERIFIED: gh api cloudflare/vinext tests/ecosystem.test.ts:110-166]`.
**How to avoid:** put a Playwright check early in the plan: change Sort, assert the list order changed and `?sort=new` is in the URL, press Back, assert the original order. Fallback: a ~20-line `URLSearchParams` + `router.push` helper.

### Pitfall 13: The Brevo port and SMTP env were never wired
**What goes wrong:** prod comments queue forever, or the worker throws on every tick.
**Why it happens:** `docs/deploy.md` has no `smtp-relay.brevo.com:<port>` line and no file has `SMTP_PORT` (grep rc=1 this session). 01-11-SUMMARY says SSH was deferred. `compose.yaml` passes no `SMTP_*` keys to `api`.
**How to avoid:** a `checkpoint:human-action` (see Open Question 1). The worker is disabled when `SMTP_HOST` is unset, so nothing crashes meanwhile.

## Code Examples

### UserThrottlerGuard
```typescript
// Source: github.com/nestjs/throttler README (getTracker override; ThrottlerModule is global)
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? req.ip;
  }
}
// app.module.ts imports: ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 60 }])
// handlers: @UseGuards(UserThrottlerGuard) @Throttle({ default: { limit: 5, ttl: 60_000 } })   // posts
```

Recommended limits (Claude's discretion):

| Route | Limit (per user, or per IP when signed out) |
|-------|---------------------------------------------|
| Post create | 5/min |
| Comment create | 10/min |
| Vote PUT/DELETE | 60/min |
| Mute, preferences | 30/min |
| Unsubscribe POST/DELETE | 20/min per IP |

Tests that hammer one endpoint use fresh users. The 50-parallel-vote test stays under 60.

### Snippet helper (D-24, with its unit test)
```typescript
export function snippet(text: string, max = 200): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut) + "…";   // single 250-char word → hard cut at 200
}
```

### HTML escape for the email HTML part
```typescript
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
```
This escapes text into HTML only. Never pass user HTML through. The UI-SPEC backstop asserts that `<b>&` arrives escaped in Mailpit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `List-Unsubscribe: <mailto:>` only | HTTPS + `List-Unsubscribe-Post` one-click (RFC 8058), required by Gmail and Yahoo for bulk senders | RFC 2017; mailbox-provider enforcement from 2024 `[ASSUMED]` | Needs the Origin-exempt POST and DKIM coverage |
| Throttler `ttl` in seconds | `ttl` in milliseconds, named throttler arrays (v5+) | @nestjs/throttler 5 | `ttl: 60_000`, not `60` |
| `onConflictDoUpdate({ where })` | `targetWhere` / `setWhere` (`where` deprecated) | Drizzle 0.3x | Use `targetWhere` for the partial index |

**Deprecated/outdated:** `PgInsertOnConflictDoUpdateConfig.where` is marked `@deprecated use either targetWhere or setWhere` in the installed Drizzle 0.45.3 typings.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brevo's submission port from the Oracle VPS is 587 (STARTTLS) | Pattern 11, Open Q1 | Mail fails until the port is changed via env. No code risk |
| A2 | Brevo's DKIM signature (with an authenticated sender domain) covers custom `List-Unsubscribe*` headers | Pitfall 5, Open Q2 | One-click unsubscribe is ignored by Gmail and Yahoo. The footer link still works |
| A3 | Postgres `FOR SHARE` then `UPDATE` by two transactions deadlocks (lock upgrade) | Pitfall 10 | None: the recommendation (`FOR UPDATE`) is safe either way |
| A4 | Route-level `@UseGuards` run after global `APP_GUARD`s (Nest guard order) | Pitfall 11 | `req.user` undefined in the tracker, falling back to per-IP limits |
| A5 | nuqs `shallow:false` triggers an RSC refetch under vinext | Pattern 14, Pitfall 12 | The board doesn't refresh on filter change. The fallback helper is ready |
| A6 | Better Auth `deleteUser` endpoint is disabled by default in 1.7.7 | Anti-Patterns | A user could hard-delete via `/api/auth/delete-user`. The `restrict` author FK then makes it fail, so there is still no data loss |
| A7 | Gmail and Yahoo enforce one-click unsubscribe for bulk senders | State of the Art | Low at 300 mails/day. Mostly a deliverability nicety |
| A8 | `'english'` text-search config is acceptable for v1 portals | Pattern 4 | Weak stemming on non-English boards. Switching to `'simple'` is a one-migration change |

## Open Questions (RESOLVED)

1. **Which Brevo port works from the prod VPS? (blocks real email, not the build)** — RESOLVED: handled by plan 03-03's `checkpoint:human-action` (probe run in the prod API container, port recorded in `docs/deploy.md`, `SMTP_*` pass-through added to `compose.yaml`).
   - What we know: the probe tool exists (`node apps/api/dist/scripts/smtp-check.js`, defaults `587,2525,465`). The deploy doc lists `SMTP_HOST/USER/PASS` as prod env, but no port was ever recorded.
   - Recommendation: a `checkpoint:human-action` early in the phase. Run the probe through the Dokploy container terminal, then record `smtp-relay.brevo.com:<port>` in `docs/deploy.md` and `SMTP_PORT=<port>` in `.env.example`, and set `SMTP_FROM`. In parallel, add the `SMTP_*` pass-through to `compose.yaml`.
2. **Is the Brevo sender domain authenticated (DKIM/SPF) for `SMTP_FROM`?** — RESOLVED: confirmed in the Brevo dashboard by the same 03-03 checkpoint; the DKIM status is recorded in `docs/deploy.md`.
   - Recommendation: the same checkpoint confirms it in the Brevo dashboard. RFC 8058 one-click depends on it.
3. **Should the platform console list soft-deleted workspaces and scrubbed users?** — RESOLVED: superseded by CONTEXT D-30 — soft-deleted workspaces stay listed with a "Deleted" badge (the recommendation below to exclude them no longer applies); the zero-count placeholders are replaced with real counts in plan 03-16.
   - Recommendation: exclude `deleted_at IS NOT NULL` workspaces from `/platform` lists in v1 (minimal). Show deleted users as-is (their email is already scrubbed). Also replace the four `postCount: 0` / `voteCount: 0` placeholders (`platform.controller.ts:140-143, 210-223, 318-321`, each commented `// ponytail: Phase 3 replaces these zeros with posts/votes counts`) with `count(*)` subqueries over non-deleted, unmerged posts and their votes.
4. **Prefix matching for the merge dialog type-ahead.** — RESOLVED: superseded by CONTEXT D-29 — the last search term matches as a prefix (`to_tsquery` with `:*` on the last lexeme) on the board and in the merge dialog (plans 03-07 and 03-12); the ILIKE fallback below is not used.
   - `websearch_to_tsquery` does not match partial words (`dar` ≠ `dark`, probed).
   - Recommendation: accept this in v1 (the dialog shows the top 8 by votes on an empty query). If it's a problem, add `OR posts.title ILIKE '%' || $q || '%'` (escaped with the existing `escapeLike`) for the merge search only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + Compose | Postgres, Mailpit, local stack | ✓ | 29.8.2 / 5.6.0 | — |
| Postgres (dev, :5432) | Integration tests (`TEST_DATABASE_ADMIN_URL`) | ✓ (container `userhq-dev-postgres-1`) | 18.6 | — |
| Postgres (local stack, :5433) | e2e / Playwright | ✓ (`userhq-postgres-1`) | 18 | — |
| Mailpit (:1025 SMTP, :8025 API) | Email integration tests, dev mail | ✓ (`userhq-dev-mailpit-1`, API returned 200). CI also runs it, with `MAILPIT_HOST` | v1.31.3 | — |
| Bun | Installs, scripts | ✓ | 1.4.2 | — |
| Node | Vitest, Nest CLI | ✓ | v26.10.0 locally (containers use 24) | — |
| Brevo SMTP from the VPS | Prod email (OPS-03) | ✗ unverified | — | Outbox holds mail. A human checkpoint records the port |

**Missing dependencies with no fallback:** none for building and testing.
**Missing dependencies with fallback:** Brevo reachability (mail queues until it is configured).

## Verification Commands (reused from Phase 2)

| Purpose | Command |
|---------|---------|
| Dev DB + Mailpit up | `docker compose -f compose.dev.yaml up -d --wait` |
| Shared packages built (API tests import dist) | `bun run build:packages` |
| Migration generated and schema check | `bun run --filter @userhq/db db:generate && bun run --filter @userhq/db db:check` |
| API unit/integration (fresh DB per file) | `bun run --filter @userhq/api test` (one file: `cd apps/api && npx vitest run test/votes.test.ts`) |
| Web unit tests (`PlainText`, slug, cursor) | `bun run --filter @userhq/web test` |
| Lint guards | `bun run lint && bun run test:lint-rules` |
| Full CI chain | `bun run ci:check` |
| Docker stack e2e + Playwright | `bun run stack:up` then `bun run --filter @userhq/api test:e2e` / `test:browser` |

Integration tests that send email should set `SMTP_HOST=127.0.0.1, SMTP_PORT=1025, SMTP_REQUIRE_TLS=false` through `createTestApp` overrides, call `worker.runOnce(new Date(Date.now() + 25 * 3600_000))`, and read Mailpit at `http://$MAILPIT_HOST:8025/api/v1/messages`. Filter by a per-test unique recipient address, because test files share one Mailpit. `smtp-check.test.ts` already uses this API.

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (account deletion, session revocation) | Better Auth DB sessions. Delete `session` and `account` rows in the deletion transaction. `SessionGuard` nulls `deletedAt` users |
| V3 Session Management | yes | Immediate revocation (no cookie cache). The client `signOut()` clears the cookie |
| V4 Access Control | yes | `TenantGuard` (admin), `PortalGuard` (product scope), server-decided `canEdit/canDelete/isAdmin`, lookups by `(product_id, number)`, growth of the cross-tenant suite (Pitfall 6) |
| V5 Input Validation | yes | Zod schemas in `packages/types` through the global `StandardSchemaValidationPipe`. Length caps: title 3–120, body ≤5000, note ≤1000, category ≤30, q ≤100 |
| V6 Cryptography | yes (unsubscribe tokens) | `node:crypto` HMAC-SHA256, HKDF-derived key, `timingSafeEqual`. No custom primitives |
| V7 Error/Logging | yes | Closed `API_ERROR_CODES`. Never log SMTP credentials (reuse the `smtp-check` redaction) |
| V13 API | yes | Throttled writes. The Origin check stays on everywhere except the HMAC-authorized unsubscribe POST |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS in posts and comments | Tampering | Plain text only. `PlainText` renders React text nodes and linkifies only `https?://` with `rel="nofollow noopener noreferrer"`. Email HTML escapes every user string |
| Forged Admin badge | Spoofing | `is_admin` / `author_is_admin` set by the server from membership. Never accepted from input |
| Email or PII leak on public endpoints | Information disclosure | Explicit `select` maps + `Public*` `z.object` schemas. A canary test plants a unique email on an author and asserts it's absent from board and post JSON **and** the rendered portal HTML |
| Voter enumeration across tenants | Information disclosure | Voters endpoint only under `TenantGuard`. Names only |
| Vote stuffing and comment spam | Denial of service / abuse | Composite PK, throttler per user and IP, admin delete |
| Unsubscribe link forgery or scanner prefetch | Tampering | HMAC tokens. GET never mutates |
| CSRF on mutations | Tampering | Existing `OriginGuard`. The unsubscribe POST's exemption is safe because the token is the credential |
| Cross-tenant IDOR via comment ids | Elevation | Comment lookups join `posts.product_id = req.portal.productId`. Portal-isolation tests (Pitfall 6) |
| Slug hijack after workspace deletion | Spoofing | A soft delete keeps the slug under the existing unique constraint |

## Sources

### Primary (HIGH confidence)
- Repo source read this session: `packages/db/src/schema/{tenancy,auth}.ts`, `packages/db/src/index.ts`, `apps/api/src/{auth,portal,tenancy,products,common,scripts}/*`, `apps/api/test/{cross-tenant,public-contract}.test.ts`, `test/support/*`, `packages/types/src/*`, `apps/web/{proxy.ts,lib/*,app/[ws]/[product]/*}`, `compose*.yaml`, `.env.example`, `docs/deploy.md`, `.github/workflows/ci.yml`
- Installed package source: vinext 1.0.0 `dist/shims/navigation-errors.js`, `dist/server/app-page-execution.js`; better-auth 1.7.7 `dist/api/routes/sign-out.mjs`, cookie-cache checks; drizzle-orm 0.45.3 `pg-core` typings; nodemailer 10.0.13 `mail-composer/index.d.ts`
- Postgres 18.6 probes (dev container): generated-column immutability, NULL description, `websearch_to_tsquery` robustness, stemming vs prefix, partial-index `ON CONFLICT`, composite self-FK on bulk update, counter `RETURNING`, timestamp precision, `ts_rank` weighting
- npm registry (via `curl registry.npmjs.org`) + `gsd-tools package-legitimacy`: @nestjs/throttler 6.7.1, nuqs 2.10.1
- RFC 8058 (rfc-editor.org/rfc/rfc8058.html)
- cloudflare/vinext repo via `gh api`: `tests/fixtures/ecosystem/nuqs/*`, `tests/ecosystem.test.ts`, `packages/vinext/src/check.ts`

### Secondary (MEDIUM confidence)
- Drizzle guide: full-text search with generated columns (orm.drizzle.team)
- nestjs/throttler README (GitHub)
- vinext compatibility reference (nuqs "tested and working")

### Tertiary (LOW confidence)
- Brevo DKIM coverage of custom headers, and mailbox-provider one-click enforcement (training knowledge, see A2 and A7)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Two new packages verified on the registry. Everything else is already installed and pinned.
- Architecture and data patterns: HIGH. Each SQL pattern was probed on the target Postgres version.
- Web integration (nuqs `shallow:false`, redirects): MEDIUM/HIGH. The redirect behaviour comes from vinext source, but nuqs client navigation is untested upstream.
- Email delivery: MEDIUM. Code paths are certain. The Brevo port and DKIM are unverified (human checkpoint).

**Research date:** 2026-10-03
**Valid until:** 2026-11-02 (30 days; vinext and throttler releases are recent, so re-check if either bumps)
