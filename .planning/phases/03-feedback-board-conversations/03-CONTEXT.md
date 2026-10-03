# Phase 3: Feedback Board & Conversations - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A public, branded feedback board per product, at `/{ws}/{product}` (the "Feedback" tab in the D-07 portal shell). Signed-in customers can:
- post, vote on, search, and filter ideas
- comment on posts, with one level of replies

Admins can moderate from the dashboard and inline on the portal:
- edit and delete posts and comments, and restore deleted ones
- change a post's status, with an optional public note
- see who voted
- merge duplicate posts

Covers AUTH-04, WORK-07, PROD-06, POST-01–11, CMNT-01–04, MOD-01–05, NOTF-01–03, and OPS-03. Roadmap linking and status sync from roadmap items are Phase 4. This phase only records the status-change activity that Phase 4 reads.

Already locked by ROADMAP.md (not re-discussed):
- votes use idempotent PUT/DELETE with an atomic counter
- board search uses Postgres FTS
- writes are throttled
- email goes out through an outbox with retries
- status changes are recorded as post activity
- deleting a status reassigns its posts
- Completed and Closed posts are hidden by default

</domain>

<decisions>
## Implementation Decisions

### Admin moderation surface
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

### Board & post page layout
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

### Comment structure
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

### Comment email behavior
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

### Claude's Discretion
- The batch outbox mechanics: the scheduler, how the 24h window is implemented, and the retry/backoff policy.
- The exact page size, how the cursor is encoded, and the slug length rules for permalinks.
- How the search ranks results (FTS ranking vs Top Voted when search and sort are combined).
- The design of the dashboard board table and post detail view, and the empty states.
- The category editor UX for POST-02 (follow the Phase 2 status editor pattern).
- The account deletion flow and confirmation UX for WORK-07.
- Rate-limit thresholds for posts, comments, and votes.
- How the voter list (MOD-04) looks on the dashboard and in the inline menu.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` § "Phase 3: Feedback Board & Conversations" — goal, success criteria, locked notes (votes, FTS, throttling, outbox, activity log, status reassignment)
- `.planning/REQUIREMENTS.md` — AUTH-04, WORK-07, PROD-06, POST-01–11, CMNT-01–04, MOD-01–05, NOTF-01–03, OPS-03
- `.planning/PROJECT.md` — Out of Scope (email limited to comment notifications; no AI duplicate detection), the privacy and tenant-isolation constraints

### Prior decisions
- `.planning/phases/02-workspaces-products-platform-owner/02-CONTEXT.md` — D-01 (dashboard tree, **amended by this phase's D-01**), D-07/D-08 (portal shell and accent theming), D-19/D-20 (ban and suspension effects), D-21 (status editor pattern)
- `.planning/phases/02-workspaces-products-platform-owner/02-UI-SPEC.md` — design tokens, EntityLogo, accent tokens, and component conventions to extend
- `.planning/phases/01-walking-skeleton/01-09-SUMMARY.md` — the SMTP port probe and nodemailer transport modes; use the confirmed Brevo port

### Stack research
- `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` — the TanStack Query vs RSC split, nuqs, throttler, and the Zod public-DTO allowlists

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/ui/*`: dialog (new-post dialog, merge dialog), dropdown-menu (inline admin menu), confirm-dialog (deletes), table (dashboard board), badge (Admin badge, status pill), avatar (author), native-select (toolbar filters), drawer (mobile filters)
- `apps/web/components/portal/portal-frame.tsx`: the portal shell. The board drops into its body slot, and `tab-nav.tsx` gains a "Feedback" tab
- `apps/web/components/dashboard/sidebar.tsx`: add a "Board" entry to the per-product section
- `apps/web/components/dashboard/status-list.tsx` and `status-dialog.tsx`: the pattern for the category editor (POST-02)
- `apps/api/src/auth/decorators.ts` (`Public`, `CurrentUser`), `guards.ts` (`SessionGuard`, `OriginGuard`), and `portal/portal.guard.ts` (`PortalGuard`): reuse these for public reads and authenticated writes
- `apps/api/src/products/statuses.controller.ts` `deleteStatus`: extend its reassignment transaction to cover posts
- `apps/api/src/scripts/smtp-check.ts` plus `nodemailer` 10.0.13 (already in `apps/api`): the base for the email transport

### Established Patterns
- Drizzle schema lives in `packages/db/src/schema/` (`tenancy.ts` has the `statuses` table and the `status_type` enum: review, planned, active, completed, closed). Add posts, votes, comments, categories, activity, outbox, and mutes here
- Shared Zod contracts live in `packages/types/src/`, with explicit public DTO allowlists that never include an email (AUTH-04)
- The `@tanstack/react-query` 5.104.0 and react-hook-form dependencies are already present

### Integration Points
- New dependencies needed: `nuqs` (D-11) and `@nestjs/throttler` (for the throttled writes required in ROADMAP.md). Neither is installed yet; pin both per CLAUDE.md
- The Mailpit container in docker compose for dev (OPS-03). Check whether it already exists; add it if not
- `/me` must expose workspace admin membership so the portal can show the inline admin menu (D-01)
- The account settings page needs a comment-email toggle (NOTF-02) and account deletion (WORK-07)

</code_context>

<specifics>
## Specific Ideas

- The board looks like Canny or Featurebase: compact rows with a vote box on the left.
- The email is "one email a day that queues if he has multiple things in the platform per company", the user's own words. The batch is per company (workspace), not per product.

</specifics>

<deferred>
## Deferred Ideas

- Product-wide admin email alerts for new posts and comments. This would be a new email type, which PROJECT.md excludes from scope.
- A per-user digest timezone or send-hour preference.

</deferred>

---

*Phase: 03-feedback-board-conversations*
*Context gathered: 2026-10-03*
