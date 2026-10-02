# Roadmap: UserHQ

## Overview

UserHQ ships in five vertical slices, and each one leaves something you can click through.

1. **Walking skeleton.** This phase proves the unproven stack end to end in Docker: vinext standalone, Better Auth OAuth through NestJS, Drizzle migrations at boot, WebP uploads on a named volume, and Brevo SMTP reachability from the Oracle VPS. If vinext has a blocking defect, the phase switches to `next build`.
2. **Tenancy.** The platform owner can admit companies. Each company sets up its workspace, team, products, and statuses, and every product gets a live public portal.
3. **Feedback board.** Customers can post, vote, and comment. Admins keep the board clean. Commenters get an email when someone replies.
4. **Roadmap and notifications.** Admins plan on a private Kanban board and publish a public roadmap that can't leak internal fields. Everyone who touched a post is notified when its status moves.
5. **Changelog and FAQ.** Admins publish release notes and FAQ answers, so customers can see what shipped and find answers on their own.

Tenant isolation and public-response contract tests start in Phase 2 and grow with every later phase.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Walking Skeleton** - Users sign in with Google/GitHub on the full Docker stack; uploads become WebP on a persistent volume; migrations run at boot; Brevo SMTP is reachable from the VPS
- [ ] **Phase 2: Workspaces, Products & Platform Owner** - Platform owner admits companies by invite; companies set up their workspace, team, products, and statuses; every product gets a public portal
- [ ] **Phase 3: Feedback Board & Conversations** - Customers post, vote, search, and comment; admins moderate and merge; commenters get reply emails
- [ ] **Phase 4: Dual-Layer Roadmap & Closing the Loop** - Private Kanban, a public roadmap that can't leak internal fields, linked-post status sync, in-app notifications, and My activity
- [ ] **Phase 5: Changelog & FAQ** - Rich-text release notes with WebP images, tags, drafts, and permalinks; a searchable FAQ that links to the feedback board

## Phase Details

### Phase 1: Walking Skeleton

**Goal:** As a user, I want to sign in with Google or GitHub on the live stack and stay signed in, so that every later feature has a proven foundation.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, UPLD-01, OPS-01, OPS-02
**Success Criteria** (what must be TRUE):

  1. On the Dockerized stack (web and API on one domain, with `/api/*` and `/uploads/*` routed to NestJS), a user can sign in with Google and with GitHub, see their name and avatar on a server-rendered page, stay signed in across refreshes, and sign out from any page.
  2. A signed-in user can upload a PNG, JPEG, WebP, or GIF under the size limit and get it back as WebP from `/uploads/...`. SVGs, oversized images, and non-image files (including renamed ones) are rejected with a clear error.
  3. After either container is redeployed (`docker compose down && up` locally, a Dokploy redeploy on the VPS), earlier uploads and database rows are still there, and a newly added migration was applied automatically when the API started.
  4. From the Oracle VPS, the API container can open an authenticated SMTP session to Brevo on port 587 (or 2525/465 as a fallback). The working port is recorded for Phase 3.
  5. The deployed web app is served from vinext's standalone output, and the same app code also passes a `next build` canary in CI. If a blocking vinext defect appears, the phase exits by switching the build to `next build`.

**Plans:** 5/11 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Toolchain: pinned Bun workspace, shared contracts, lint guards, human-reviewed lockfile

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — API container migrates Postgres at boot under an advisory lock; [BLOCKING] live-schema gate

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Better Auth in Nest: /api/v1/me, refresh-safe default-deny guard, origin check, session lifecycle tests

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — vinext web shell in Docker behind Caddy: server-rendered identity, Tailwind tokens, `next build` canary
- [x] 01-07-PLAN.md — Upload pipeline (2 MB, magic bytes, WebP ≤1600px) on the uploads volume; new migration applied at start (API track, runs beside 01-04..01-06)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — /login with Google/GitHub, safe `?next=`, OAuth error mapping; Caddy dev loop

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-06-PLAN.md — Header and user menu on every page, sign-out, browser keep-alive, global pages, session e2e

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 01-08-PLAN.md — Dev-only /dev/upload page with runtime flag gating and every UI state; routed upload e2e (joins web and API tracks)

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 01-09-PLAN.md — Durability: redeploy persistence, migration race/idempotency tests, SMTP probe, Mailpit profile

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 01-10-PLAN.md — GitHub Actions CI, one human-action for external setup, staging auto-deploy on the VPS

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 01-11-PLAN.md — Tag-driven prod release, Brevo port recorded, isolation and VPS persistence proofs, blocking real-account sign-in gate on staging and prod

**UI hint**: yes
**Notes**: Research flag (`/gsd-plan-phase --research-phase`):

- Better Auth inside NestJS with `bodyParser: false`
- `__Secure-` cookies over internal http
- Bun isolated linker with vinext standalone (one React copy)
- The `--production --filter` Dockerfile pattern

Lint rules land here: no Vite-isms in app code; the web app may not import db, drizzle, pg, sharp, or the Better Auth server; no exclusion-mode column selection. Settle Tailwind wiring (`postcss` vs `@tailwindcss/vite`) and confirm that runtime env vars take effect without a rebuild.

### Phase 2: Workspaces, Products & Platform Owner

**Goal:** As an invited company admin, I want to set up my workspace, team, and product portals, so that my customers have a branded place to visit.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06, PLAT-07, WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05
**Success Criteria** (what must be TRUE):

  1. The platform owner role belongs to the verified email in server config, and no in-app control grants it. The owner can:
     - create a single-use, expiring workspace invite link for a specific email
     - see each invite's state (pending, used and by whom, expired, revoked) and revoke unused ones
     - browse all workspaces, products, and users with member, post, and vote counts
     Anyone else who requests the owner dashboard or its API gets a not-found response.
  2. Workspace creation:
     - The invite holder signs in, creates a workspace with a name, slug, and logo, and becomes its owner.
     - Taken or reserved slugs (`api`, `dashboard`, `login`, `uploads`) are rejected.
     - A user without an invite is told that workspace creation is invite-only.
     Teammates:
     - An admin can create a single-use, expiring link for a teammate's email. The teammate joins as an admin only by signing in with a matching verified email.
     - Admins can remove teammates or leave. The owner can't be removed and can't leave.
  3. An admin can:
     - create several products, each with a name, slug, and logo
     - rename a product or change its logo (the slug stays fixed)
     - delete a product
     A signed-out visitor can open `/{workspace}/{product}` for any live product. `/{workspace}` lists the live products, and a deleted product's portal is gone.
  4. Every new product starts with five seeded statuses, one per type, with Under Review as the default. An admin can:
     - add a status with a name, color, and type
     - rename, recolor, and reorder statuses
     - choose which status new posts start in
     - delete a status only by choosing a replacement (the default status and the last remaining status can't be deleted)
  5. The platform owner can suspend a workspace: its portals show an "unavailable" page, its dashboard goes offline, and its data is kept. The owner can also ban a user, who then can't sign in or act anywhere. Lifting a suspension or ban restores access.

**Plans**: TBD
**UI hint**: yes
**Notes**: This phase starts several things that later phases extend:

- the cross-tenant 404 test suite
- the split between public and admin controllers
- the scaffold for public-response contract tests
- `portalHref()` / the tenant resolver seam

Suspend and ban checks go in the shared guards, so every later feature inherits them. The transaction that reassigns a deleted status must take in posts (Phase 3) and roadmap items (Phase 4) as those tables arrive. Status seeding happens in the same transaction that creates the product.

### Phase 3: Feedback Board & Conversations

**Goal:** As a customer, I want to post, vote on, and discuss ideas on a product's board, so that the team sees what I actually need.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: AUTH-04, WORK-07, PROD-06, POST-01, POST-02, POST-03, POST-04, POST-05, POST-06, POST-07, POST-08, POST-09, POST-10, POST-11, CMNT-01, CMNT-02, CMNT-03, CMNT-04, MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, NOTF-01, NOTF-02, NOTF-03, OPS-03
**Success Criteria** (what must be TRUE):

  1. A signed-out visitor can read the board. Trying to post, vote, or comment prompts sign-in and then returns them to the same spot. A signed-in user can:
     - submit a post with a title, a plain-text description, and a category (Bug and Feature Request are seeded, and admins can edit categories)
     - edit their own post
     - upvote once (voting again has no effect) and remove their vote
  2. Every post has a permanent link page that shows its current status and the author's OAuth name and avatar, never their email. Visitors can:
     - sort by Top Voted or Newest
     - filter by category and by status (Completed and Closed posts are hidden by default)
     - search the text of titles and descriptions
  3. Signed-in users and admins can comment. Admin comments carry an Admin badge that the server decides, so a client can't forge it. Users can edit and delete their own comments. After a user deletes their account, their posts and comments stay up, shown as "Deleted user".
  4. An admin can:
     - edit or delete any post or comment (deleted items vanish from the portal but stay in the database)
     - change an unlinked post's status, with an optional public note shown on the post
     - see who voted (the public sees only the count)
     - merge a duplicate post into another: votes move without double-counting, comments move, and the duplicate's link redirects
  5. When someone else comments on a post that a user created or commented on, that user gets an email. In development it lands in Mailpit; in production it goes through Brevo, configured only by env settings. Users can turn these emails off in account settings, and every email has a one-click unsubscribe link. If sending fails, the comment still appears and the email is retried automatically.

**Plans**: TBD
**UI hint**: yes
**Notes**:

- Votes use idempotent PUT/DELETE with an atomic counter.
- Board search uses Postgres full-text search.
- Writes are throttled.
- Email goes out through an outbox with retries, on the Brevo port confirmed in Phase 1.
- Status changes (with public notes) are recorded as post activity now, because Phase 4's notifications and My activity read from that log.
- Deleting a status must also reassign its posts.

### Phase 4: Dual-Layer Roadmap & Closing the Loop

**Goal:** As an admin, I want to plan privately and share a public roadmap, so that users hear back when their feedback moves.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ROAD-01, ROAD-02, ROAD-03, ROAD-04, ROAD-05, ROAD-06, ROAD-07, ROAD-08, ROAD-09, ROAD-10, ROAD-11, ROAD-12, STAT-06, LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05
**Success Criteria** (what must be TRUE):

  1. An admin sees an internal Kanban board with one column per status. On it they can:
     - create items with an internal title and description
     - drag items between columns (which changes their status) and within a column (the order survives a reload)
     - set an item's assignee (a workspace member), internal notes, and target deadline
  2. Linking posts to items:
     - An admin can link an item to one or more posts, or turn a post into a prefilled, already-linked item with "Add to roadmap".
     - A post can be linked to at most one item.
     - Linked posts take the item's status and follow every move, even while the item is private. They show only the status, never the item's details, and their status can't be changed directly.
  3. Making items public:
     - An admin can toggle Make Public. The public title is prefilled from the internal title and is required.
     - The public description is written separately from the internal one.
     - The admin chooses which statuses appear as public columns.
     - A signed-out visitor sees only public items in those columns, showing just the public title, public description, and status.
  4. No public page or API response contains an item's internal title, internal description, notes, assignee, or deadline. An automated test plants canary values and checks every public endpoint (JSON and rendered HTML). It fails the build on any leak.
  5. When a post's status changes (set directly by an admin or through a roadmap move), each user who created, voted on, or commented on it gets an in-app notification that includes any public note:
     - the bell shows the unread count, groups repeated changes to the same post, and lets the user mark notifications as read
     - "My activity" lists the posts the user created, voted on, or commented on, and marks the ones whose status changed or that got new comments since their last visit

**Plans**: TBD
**UI hint**: yes
**Notes**: Research flag (`/gsd-plan-phase --research-phase`):

- the dnd-kit 0.5 Kanban
- fractional positions
- Drizzle composite FKs on `(id, product_id)` and partial indexes

Internal fields live in a separate 1:1 table. Public reads go through explicit `select()` column maps into hand-written `Public*` types. Deleting a status must also reassign roadmap items. Merging posts must respect the rule that a post links to at most one item.

### Phase 5: Changelog & FAQ

**Goal:** As an admin, I want to publish release notes and FAQ answers, so that customers see what shipped and can help themselves.
**Mode:** mvp
**Depends on**: Phase 3 (can run in parallel with Phase 4)
**Requirements**: CHLG-01, CHLG-02, CHLG-03, CHLG-04, CHLG-05, CHLG-06, CHLG-07, CHLG-08, FAQ-01, FAQ-02, FAQ-03, FAQ-04, FAQ-05, FAQ-06, FAQ-07
**Success Criteria** (what must be TRUE):

  1. An admin can write a changelog entry in a rich-text editor (headings, lists, bold, italics, links) and insert images, which are stored as WebP. Anything outside that formatting never runs on the public page. Entries can be tagged: New, Improved, and Fixed are seeded, and admins can add, rename, and delete tags. A draft can be saved that the public can't see.
  2. An admin can publish an entry, edit it after publishing, unpublish it back to draft, and delete it. Anyone can read a product's published entries, newest first. Each entry has a permanent link that shows a title and image preview when shared.
  3. An admin can create, rename, and delete FAQ categories, and create, edit, and delete questions with rich-text answers. Categories can be reordered, and so can the questions within a category.
  4. A visitor can browse the FAQ by category and search questions and answers by text. Opening a question's own link shows the FAQ with that question expanded.
  5. FAQ search results end with a "Didn't find it?" button that opens the new-post form on that product's feedback board.

**Plans**: TBD
**UI hint**: yes
**Notes**: Research flag: the Tiptap static renderer under vinext RSC, and CSP nonces (vinext #3205). Rich text is stored as Tiptap JSON in jsonb, checked against a strict Zod allowlist, and never rendered with `dangerouslySetInnerHTML`. Changelog work needs only Phase 2. FAQ-07 needs Phase 3's new-post form.

## Progress

**Execution Order:**
Phases run in numeric order: 1 → 2 → 3 → 4 → 5. Phase 5 can start once Phase 3 is done and run in parallel with Phase 4.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Walking Skeleton | 5/11 | In Progress|  |
| 2. Workspaces, Products & Platform Owner | 0/TBD | Not started | - |
| 3. Feedback Board & Conversations | 0/TBD | Not started | - |
| 4. Dual-Layer Roadmap & Closing the Loop | 0/TBD | Not started | - |
| 5. Changelog & FAQ | 0/TBD | Not started | - |
