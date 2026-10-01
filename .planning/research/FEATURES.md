# Feature Research

**Domain:** Multi-tenant customer feedback board + public roadmap + changelog + FAQ SaaS (Canny, Featurebase, Frill, Upvoty, Nolt, Productboard Portal, UserJot)
**Researched:** 2026-10-01
**Confidence:** MEDIUM overall. Each sourced claim comes from a first-party vendor help center or feature page, but the GSD `classify-confidence` seam rates every web source LOW (websearch/webfetch). The "table stakes" calls rest on the same pattern showing up independently across 3 or more vendors. Single-vendor claims are marked *(single source)*, and inferences with no source are marked *(inference)*.

---

## How to read this

The PRD covers the **core loop** well: posts, votes, comments, roadmap, statuses, changelog, FAQ. The PRD does **not** specify three groups of features that every competitor ships:

1. **Admin hygiene tools.** Merge, edit/delete any post, delete comments, ban users. Without these, a public board turns into a junk drawer within weeks.
2. **A close-the-loop channel.** Competitors send email. Email is out of scope here, so an **in-app** replacement is required. Without one, the stated Core Value ("close the loop publicly") cannot be met.
3. **Status semantics.** Admin-editable statuses still need a fixed "type" underneath so the system knows what "shipped" or "closed" means.

There are also two **PRD contradictions** that need a decision before requirements are frozen:

- **"Invite teammates by email" with email out of scope.** Invites have to work without sending email: an invite link, plus a pending invite matched against the OAuth email at sign-in.
- **"Login-required" portal is not private.** Anyone with a Google or GitHub account can sign in. If the use case is a "private beta portal" (as PROJECT.md Key Decisions says), the portal needs an access allowlist (email domain and/or invited emails).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Status column: **PRD** = already in PROJECT.md Active requirements. **MISSING** = not in PRD, recommended for v1. **MISSING (v1.x)** = expected, but can ship shortly after launch.

#### Workspace, Product & Auth

| Feature | Status | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| OAuth sign-in (Google, GitHub) | PRD | Low-friction identity; all competitors offer social login | LOW | GitHub can return a null/private primary email. Request the `user:email` scope and fetch verified emails, or invite matching breaks *(inference)* |
| Create workspace / products, name/slug/logo | PRD | n/a | LOW | |
| **Invite teammates without email delivery** | MISSING (PRD contradiction) | PRD says "invite by email", but email sending is out of scope | MEDIUM | Admin enters an email, which creates a `PendingInvite` and a copyable invite link (token, expiry). On OAuth sign-in, if the verified email matches a pending invite, show "Accept invitation". Admin can revoke. |
| **Remove teammate / leave workspace** | MISSING | Every team tool has it; needed when people leave | LOW | Guard against removing the last member |
| **Edit product settings; delete product** | MISSING | Admins rename and fix logos; test products need deleting | LOW–MED | Slug changes break public URLs. Either forbid slug edits in v1 or keep a `slug_history` redirect. Delete should be a soft delete with a confirm-by-typing-name step. |
| **Private portal = access allowlist, not just "logged in"** | MISSING (PRD gap) | Canny/Featurebase private boards restrict *who* can see, not just "must be signed in" | MEDIUM | With global OAuth accounts, "login-required" only blocks anonymous crawlers. Add an allowed-email-domains list plus individually allowed emails per product. Without this, the "private beta portal" use case does not work. |
| Product portal SEO basics (title/OG meta; `noindex` on private products) | MISSING | Public boards are found via search; private ones must not leak | LOW | Metadata API is available under vinext |
| User display name + avatar (from OAuth) shown on posts/comments | Implied | Social proof; admin badge sits next to it | LOW | |
| **Delete my account** (anonymize content) | MISSING (v1.x) | GDPR expectation for a public-facing SaaS | MEDIUM | Replace author with "Deleted user"; keep votes as counts. Do not cascade-delete posts. |

#### Feedback Board

| Feature | Status | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| Submit post (title, description, category) | PRD | n/a | LOW | Store description as **plain text/markdown-lite**, not user-supplied rich HTML (XSS) |
| One upvote per user per post | PRD | n/a | LOW | `UNIQUE(post_id, user_id)` on Vote. Merge depends on this constraint (see Dependencies). |
| **Remove my vote (toggle)** | MISSING | Universal UI pattern; PRD only says "upvote" | LOW | |
| Comments; admin badge | PRD | n/a | LOW | |
| **Edit/delete my own comment** | MISSING | Universal | LOW | Soft delete: "comment deleted" placeholder keeps the thread readable |
| **Edit my own post** | MISSING | Users fix typos and add detail | LOW | Competitor end-user edit rules are not documented (Canny/Featurebase docs only cover admin edit). Recommend: author can edit title/description; author can delete only while the post has no other votes/comments *(inference)* |
| Filter by category; sort Top/Newest | PRD | n/a | LOW | |
| **Filter by status; hide closed/completed by default** | MISSING | Canny portal filters by status; otherwise shipped/declined posts clog "Top" forever | LOW | Depends on status **type** (below) |
| **Search posts (title + description)** | MISSING | Every competitor board has search; the board is unusable past about 50 posts without it | LOW–MED | Postgres `tsvector` + GIN index, or `pg_trgm`. The same index powers "similar posts". |
| **Similar-posts suggestions while typing a new post** | MISSING | Canny: "as users compose a new post, Canny suggests similar posts"; Frill does the same. This is the main way competitors prevent duplicates. | MEDIUM | **Not AI.** Plain text search on title. Not covered by the "automated duplicate detection" exclusion. Reuses the search index. |
| Post detail page with permalink | Implied | Sharing a post URL is how voters are recruited | LOW | |
| **Admin: edit any post** | MISSING | Canny: "Posts can be edited by Canny admins for clarity" | LOW | |
| **Admin: delete any post / comment** | MISSING | Canny, Featurebase, Nolt, Upvoty all have it | LOW | Soft delete. Canny notes delete is irreversible and recommends "Closed" status instead, which is a good default nudge. |
| **Admin: merge duplicate posts** | MISSING | Canny, Featurebase, Frill ("votes and comments transfer automatically"), Upvoty, Nolt all have manual merge | MEDIUM | Move votes (dedupe users who voted on both), move comments, turn the source into a tombstone with `merged_into_id` that redirects, and add an activity entry "X was merged into this post". Canny sends no notification on merge and only supports unmerging the most recent merge in a chain. Recommend **no unmerge in v1**. |
| **Admin: change a post's status directly (with optional public message)** | MISSING (implied) | Canny/Featurebase status changes carry a comment that appears on the post | LOW–MED | PRD only syncs status via roadmap link. Unlinked posts also need status changes ("Closed", "Under review"). |
| **Admin: voter list on a post (admin-only)** | MISSING | Core value is "see what users want". Canny shows voter identity only to teammates; the public sees the count. | LOW | Public endpoint returns `vote_count` only, never voter identities *(Canny)* |
| **Status activity timeline on post** ("Status changed to Planned · message") | MISSING | This is how a visitor sees the loop closed on the post itself | LOW | Needed for in-app close-the-loop |
| **My posts / posts I voted on** | MISSING | Featurebase: "My profile" shows the user's posts, comments, upvotes | LOW | The main in-app close-the-loop surface (see section 2) |
| **Ban user from product / spam** | MISSING (v1.x) | Canny "Mark as spam" deletes the post and bans the author | LOW–MED | OAuth-only cuts spam a lot, so this can follow launch |
| Moderation / approval queue (opt-in per product) | Nice-to-have (v1.x) | Featurebase, Nolt, Frill, Upvoty all offer it as an **opt-in** toggle; pending posts are visible to the author only | MEDIUM | Adds a `pending` visibility state that every public query must respect, which is a privacy-filter surface like the roadmap. Defer until a customer asks. |
| Vote on behalf of a customer | Nice-to-have (v1.x), high B2B value | Canny "Add voter", Nolt, Frill. Sales/support log demand from calls. | MEDIUM | Collides with OAuth-only identity. v1.x option: only for users who already exist on the platform. Placeholder users (email-only, no Account) need a careful claim-on-sign-in design. Defer. |
| Pinned posts | Nice-to-have | Nolt, Frill ("Pinned Ideas & Comments") | LOW | `pinned_at` column; pinned posts sort first |
| Threaded replies | Nice-to-have | Canny replies auto-@mention the parent author; Frill has mentions and reactions. Deep nesting is rare. | LOW–MED | If built: **one level** (`parent_id`, depth ≤ 1). Flat comments are acceptable for v1. |
| Internal (admin-only) comments on posts | Nice-to-have (v1.x) | Canny internal comments; Nolt "private fields… without revealing it to board Members or the public" | MEDIUM | Same privacy risk class as roadmap internal notes. Must go through the same public-DTO boundary. |
| Images/attachments on posts | Defer | Canny admins can add attachments | MEDIUM | The upload pipeline exists for changelog, but user-uploaded images on public boards add abuse and storage-growth risk |

#### Dual-Layer Roadmap

| Feature | Status | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| Kanban by status; drag between columns | PRD | n/a | MEDIUM | |
| **Manual card order within a column** | MISSING | Kanban users expect drag-to-reorder to stick | LOW–MED | Fractional/lexorank `position` column |
| Link item ↔ posts; status sync | PRD | n/a | MEDIUM | **Decide: a post links to at most ONE roadmap item.** Otherwise two items in different statuses fight over the post's status. While linked, post status is read-only and driven by the item. |
| **"Add to roadmap" from a post** (creates item pre-filled + linked) | MISSING | The board-to-roadmap move is the core admin workflow | LOW | |
| Internal fields (assignee, notes, deadline) | PRD | Canny internal roadmap has owners and scoring and is "NEVER visible to end-users" | LOW | Assignee must be a workspace member |
| Make Public toggle; public title/description separate from internal | PRD | Productboard Portal does exactly this: "portal description is separate from the internal description", public name defaults to internal name | LOW | Default the public title to the internal title on toggle, editable |
| **Public card shows aggregate demand** (vote total of linked public posts + links to them) | MISSING | Canny's public roadmap *is* posts, so votes always show; without counts the roadmap looks arbitrary | LOW–MED | Count only **public, non-deleted, non-merged** linked posts so the count never reveals hidden posts |
| **Which statuses appear as public roadmap columns** | MISSING | Canny: choose which statuses show on the end-user roadmap; defaults Planned / In Progress / Complete | LOW | `show_on_public_roadmap` flag per status |
| **Public roadmap ordering** | MISSING (decision) | Canny sorts its public roadmap by last status change, most recent first | LOW | Recommend admin manual order, falling back to `status_changed_at desc` |
| Cap/paginate "Complete" column | Nice-to-have | Shipped column grows forever | LOW | Show last N, link to changelog |
| Filter internal board by assignee / overdue | Nice-to-have | | LOW | |

#### Statuses

| Feature | Status | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| Seeded defaults; rename/reorder/add/delete | PRD | Canny defaults: Open, Under Review, Planned, In Progress, Complete, Closed | LOW | Seed those six |
| **Fixed semantic `type` beneath editable name** | MISSING (critical) | Featurebase: five fixed types (Reviewing, Planned, Active, Completed, Canceled) with custom names and colors | LOW | Enum e.g. `OPEN, REVIEW, PLANNED, ACTIVE, DONE, CLOSED`. The system needs it for: default board filter (hide DONE/CLOSED), "shipped" notifications, changelog linking, and default public-roadmap columns. Without it, logic depends on admin-editable names. |
| **Color per status** | MISSING | Canny and Featurebase both | LOW | |
| **Default status for new posts** | MISSING | Featurebase: one status is the default applied to new requests | LOW | Exactly one default per product |
| **Delete with reassignment** | MISSING (PRD flags as needing definition) | Featurebase: requests using a deleted status "are moved to your current default status". Canny does not document this. | LOW–MED | Delete dialog shows the count of posts and items affected and a "Move them to: [status]" picker that defaults to the default status. Single transaction. **Cannot delete the default status** (reassign default first). Must keep at least 1 status. Reassignment is **silent** (no notifications). |
| Status change carries an optional public message | MISSING | Canny: "add a comment (along with an image) as part of the update"; Featurebase: "Draft an update to explain the change" | LOW | Feeds the post timeline and notifications |

#### Changelog

| Feature | Status | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| Rich text + images (WebP) + tags; reverse-chrono feed | PRD | n/a | MEDIUM | Store editor JSON (e.g. Tiptap/ProseMirror) and render with an allowlist. Never store raw admin HTML unsanitized. |
| **Draft vs published state** | MISSING (implicit in "publish") | Canny: draft/scheduled/published; Featurebase autosaves drafts | LOW | `published_at nullable`; public queries filter `published_at <= now()` |
| **Edit after publish; unpublish; delete** | MISSING | Typos happen post-publish | LOW | |
| **Per-entry permalink + OG meta** | MISSING | Entries get shared on social and in release emails customers send themselves | LOW | |
| **Filter feed by tag** | MISSING | Featurebase: categories "can also be used to filter changelogs"; defaults New / Improved / Fixed | LOW | Seed tags: New, Improved, Fixed |
| **Link entry to roadmap items/posts** ("Shipped in this release") | MISSING, high value | Canny: "link them to shipped requests, and notify users who cared"; UserJot drafts the changelog when a post completes | MEDIUM | Main close-the-loop trigger. On publish, notify voters of linked posts in-app. Optionally offer "mark linked items DONE" (Canny users have asked for this). |
| "New since your last visit" indicator | MISSING | Cheap stand-in for changelog emails | LOW | `last_seen_changelog_at` per (user, product), or localStorage for anonymous users |
| Scheduled publishing | Defer | Canny, Featurebase | MEDIUM | Needs a job runner or a cron that checks `published_at` |
| RSS feed | Nice-to-have, recommended | Featurebase offers RSS / subscribe | LOW | The only zero-infrastructure "subscription" channel available while email is out of scope |
| Changelog reactions/comments | Defer | Frill has "Announcement Comments" requested on its own board | LOW–MED | |

#### FAQ

FAQ is **not a standard feature** of Canny, Nolt, or Frill. Featurebase has a separate help center. This module is a mild differentiator, so keep it small.

| Feature | Status | Why Expected | Complexity | Notes |
|---------|--------|--------------|------------|-------|
| Q&A grouped in categories; browse; search | PRD | n/a | LOW | Same Postgres FTS approach as posts |
| **Order categories and questions** | MISSING | FAQ order is editorial (most important first) | LOW | `position` columns |
| **Rich-text (or markdown) answers with links** | MISSING | Answers need links/steps | LOW | Reuse the changelog renderer |
| **Deep link to a single question** (anchor/permalink) | MISSING | Support agents paste FAQ links | LOW | |
| Draft/hidden toggle per Q&A | Nice-to-have | | LOW | |
| "Didn't find it? Submit feedback" CTA from FAQ search | Differentiator (cheap) | Links the FAQ into the feedback loop | LOW | Prefill post title with the search query |

---

### Q2: Closing the loop without email (minimum in-app mechanism)

**What competitors do.** Canny auto-enrolls voters for updates when they vote, sends status-change emails to voters (with an optional admin comment and image), and has an in-app **bell with unread preview plus a full notifications page**. Triggers: new comments, status updates, merges, mentions, vote milestones. Featurebase has a **notification center/inbox** that separates seen from unseen, a **"My profile"** page listing the user's posts, comments, and upvotes, and status updates that "appear on the Request itself". Frill has "Automatic Notifications" when followed ideas update. Every one of them uses email as the primary channel. Bell, inbox, and profile are the in-app complements, and they are what UserSaid has to build.

**Recommended minimum (v1).** Four pieces, all LOW–MEDIUM:

1. **Implicit subscription, no follow table.** Recipients for post X are computed at fan-out time: post author ∪ voters ∪ commenters (minus the actor). There is nothing new to store.
2. **Status-change activity entry on the post.** Every status change, direct or via a roadmap-item sync, writes a `PostActivity` row (`from_status`, `to_status`, optional public message, actor). It renders in the post timeline, so a visitor who returns sees "Planned → Complete: Shipped in v2.3".
3. **Notification rows + bell.** `Notification(user_id, product_id, type, post_id, payload, read_at)`. Fan out on:
   - post status change
   - an admin comment on a post you authored, voted on, or commented on
   - your post was merged (your vote moved)
   - a changelog entry linking a post you voted on was published

   The portal header bell shows the unread count for **that product**, plus mark-read and mark-all-read. Fetch on navigation or poll every 60s. **No websockets.**
4. **"My activity" page per product.** Tabs for My posts and Voted, each showing current status, with posts **updated since last visit** marked. This also helps users who never open the bell.

**Must-have spam guard.** Dragging a roadmap card back and forth fans out to every voter each time. Coalesce: if an unread `STATUS_CHANGED` notification for the same (user, post) already exists, **update** it instead of inserting a new one. Optionally notify only when the status *type* changes.

**Cut line if time is short.** Items 2 and 4 alone (timeline + My activity with "updated" markers from `status_changed_at > last_seen_at`) close the loop with **no notification table at all**. Add the bell (3) when possible. Shipping neither means the Core Value is not met.

---

### Q3: Internal vs public roadmap split, and status deletion

| Vendor | Model | Internal/private data | Public view |
|--------|-------|----------------------|-------------|
| **Canny** | Public roadmap = posts grouped by status. Separate **internal roadmap** = prioritization tool (RICE impact/effort scoring, owners, multiple roadmaps) | "NEVER visible to end-users", only listed admins; internal comments admin-only | Statuses you choose as columns (defaults Planned / In Progress / Complete). Sorted by last status change. Can be disabled. |
| **Featurebase** | Roadmap = posts organized by status | Hidden posts, private categories; moderation pending state | Status-grouped posts; visibility per category/post |
| **Nolt** | Posts + roadmap | "Private fields" (notes, categories) visible only to moderators/admins/owners | Board + roadmap |
| **Frill** | Ideas board + roadmap by status | "Private Ideas" on a public board | Status-grouped ideas |
| **Productboard Portal** | Internal feature hierarchy; selected items published as portal cards | Everything internal by default | **Separate public name and description per card** ("portal description is separate from the internal description") |

**Implication for UserSaid.** The PRD's model (roadmap **items** separate from posts, linked many-to-one, with a public title and description) matches **Productboard's** approach, not Canny's or Featurebase's (where the roadmap *is* the posts). That is a reasonable choice and gives the strongest privacy story. It also means UserSaid must build two things Canny gets for free:
- **(a)** Vote aggregation on public roadmap cards.
- **(b)** The rule that a post links to at most one item.

The internal/public split must be enforced with separate public DTOs and queries, as PROJECT.md already states. Every vendor treats internal data as "never visible", not "hidden in the UI".

**Status deletion.** Only Featurebase documents its behavior: affected requests move to the current default status, and it advises reviewing them first. UserSaid should do the same, with an explicit picker. Details are in the Statuses table above.

---

### Differentiators (Competitive Advantage)

These line up with the Core Value ("ranked by demand, close the loop publicly") and with the admin-retention metric (roadmap moves + changelog entries per month).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **One-motion loop: post → roadmap item → changelog entry → voters notified in-app** | Most competitors bolt changelog onto the board. Making "ship it" a single flow directly drives the success metric. | MEDIUM | "Publish changelog" offers "mark linked items Done". Canny users have requested exactly this. |
| **Multi-product workspaces as a first-class concept** | Canny/Featurebase model one company = one portal with boards. A company with three apps gets three clean portals and one team. | (in PRD) | Already decided. Make the `/{workspace}` product picker look good. |
| **Productboard-style public copy on roadmap items** | Internal titles ("Refactor billing svc, P0 Acme escalation") never leak. Public copy is written for customers. | LOW | In PRD |
| **FAQ in the same portal** | Canny/Nolt/Frill don't have one. Deflects support and routes "didn't find it" to feedback. | LOW | Keep minimal |
| **Demand-ranked admin inbox** | Admin home lists untriaged posts (status type OPEN) sorted by votes, plus "new since last visit" | LOW–MED | Directly serves "see what users actually want, ranked by demand" |
| **Flat, no-per-seat positioning** | UserJot's whole pitch is unlimited admins and flat pricing. The single-role-for-all model fits this. | n/a | Billing out of scope, but don't design per-seat assumptions |
| RSS for changelog and per-product status updates | Subscription without email infrastructure | LOW | |

### Anti-Features (deliberately NOT in MVP)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time updates (websockets/SSE) for votes, comments, bell | "Feels modern" | Extra infra in a two-container Docker setup, connection handling through Dokploy proxy, little value at feedback cadence | Fetch on navigation; poll the bell every 60s |
| Anonymous / guest posting & voting | Lowers friction (UserJot sells "guest posting") | Conflicts with OAuth-only identity, invites spam, breaks one-vote-per-user | OAuth-only is the spam control. Revisit with magic link in v2. |
| Downvotes, vote budgets, weighted votes, "importance" levels (Productboard) | Richer signal | Complicates ranking, merge math, and UX; muddies "ranked by demand" | Single upvote; admins add context via comments |
| Prioritization scoring (RICE/impact-effort matrices) | Canny and Frill ("2D matrix") have it | Large feature, needs custom factors UI; the PRD's internal fields cover v1 | Assignee + deadline + vote count is enough to prioritize |
| Public ETAs / dates on public roadmap | Customers ask "when?" | Overpromising; missed public dates hurt trust. PRD rightly keeps deadline internal. | Status column is the public commitment |
| Timeline/Gantt roadmap views, multiple roadmaps per product | Planning teams like them | Scope creep into Jira/Linear territory | One Kanban per product |
| Multiple boards per product | Canny/Featurebase have boards | UserSaid's **product** already plays the role of a board; boards inside products adds a fourth tenancy level | Categories inside the product's single board |
| Custom post fields | Canny Pro ("up to three") | Form builder, validation, filtering complexity | Title + description + category |
| Embeddable widget / JS SDK / in-app changelog popup | Featurebase and Frill selling point | Cross-origin auth, CSP, versioned SDK. Effectively an integration, which is out of scope. | Link to the portal; RSS |
| Rich-text editor for end-user posts/comments | Nicer formatting | XSS surface on public pages; image-abuse surface | Plain text with line breaks + auto-linked URLs; rich text for admin-authored changelog/FAQ only |
| Deep comment threading, reactions, gamification/karma | Engagement | Moderation burden; low value for feedback | Flat (or 1-level) comments |
| Per-event notification preference matrix | Standard with email | With in-app only, there is nothing to unsubscribe from | Mark read / mark all read |
| Public voter lists | Social proof | Leaks customers of B2B clients to competitors browsing the board | Public count only; admin-only voter list (Canny model) |
| Unmerge | Canny has it (limited) | Requires keeping the full pre-merge vote set; edge cases with chained merges | Confirm dialog before merge; soft-deleted source post allows manual DB recovery |
| Hard deletes with cascades | Simplicity | Destroys vote history and audit; breaks links | Soft delete (`deleted_at`) everywhere user content lives |
| AI dedupe / AI changelog drafting | UserJot, Canny Autopilot, Featurebase AI | Explicitly out of scope | Text-search similar-posts suggestion |

---

## Feature Dependencies

```
Status rows (per product) + status TYPE enum + default flag
    ├──required by──> Post.status_id FK, RoadmapItem.status_id FK
    ├──required by──> Board status filter / "hide closed" default
    ├──required by──> Public roadmap columns (show_on_public_roadmap)
    ├──required by──> Status deletion w/ reassignment (needs default status)
    └──required by──> "Shipped" notifications, changelog "mark Done"

Vote model with UNIQUE(post_id, user_id)
    ├──required by──> Top-voted sort (denormalized vote_count)
    ├──required by──> Merge posts (vote union + dedupe)
    ├──required by──> Vote-on-behalf (v1.x)
    └──required by──> Notification recipients (voters)

Post soft-delete + merged_into_id
    └──required by──> Merge, admin delete, public-query filters, roadmap vote aggregation

PostActivity (status change log w/ optional message)
    ├──required by──> Post timeline (in-app close-the-loop, minimum)
    ├──required by──> "Updated since last visit" markers on My activity
    └──feeds──> Notification fan-out

RoadmapItem ──link (post → at most one item)──> Post
    ├──requires──> Statuses (shared)
    ├──requires──> PostActivity (sync writes activity on each linked post)
    └──enables──> Public card vote aggregation (requires public-post filter)

Changelog entry ──links──> RoadmapItem / Post
    ├──requires──> Draft/published state
    └──enables──> "Shipped in" notification + "mark linked Done"

Search index (tsvector/pg_trgm on posts)
    ├──required by──> Board search
    └──required by──> Similar-posts suggestions on create

Pending invite + invite token
    └──requires──> OAuth verified email (GitHub user:email scope)

Product access allowlist
    └──requires──> Public/private toggle (PRD); conflicts with "login-required = any user"

Moderation queue (v1.x) ──conflicts/complicates──> every public query
    (adds a third visibility state; build only after public-DTO layer is solid)
```

### Dependency Notes

- **Statuses must land before posts and roadmap.** Every post and item has a status FK, and the type/default columns must exist from the first migration. Adding `type` later means guessing types for existing renamed statuses.
- **Merge requires the vote uniqueness constraint and soft-delete/tombstone columns.** Design these in the posts phase even if merge ships later. Retrofitting `merged_into_id` is cheap; retrofitting vote dedupe after duplicate votes exist is not.
- **Roadmap status sync requires PostActivity.** If sync just overwrites `post.status_id`, the loop is invisible to voters. Sync and activity logging should be one service method.
- **Public roadmap vote aggregation requires the public-post filter**, so it can't count hidden, merged, or deleted posts. Reuse one `publicPostWhere()` predicate everywhere.
- **Changelog linking enhances roadmap.** It needs both roadmap items and published-state changelog, so it comes in the last feature phase.
- **Notifications depend on PostActivity and votes**, and can be added after the timeline without schema churn if PostActivity exists.
- **Moderation conflicts with shipping fast.** It adds a visibility state to every public query. Defer it, and build the public-query layer so a `visibility` predicate can be added in one place.

---

## MVP Definition

### Launch With (v1)

PRD items, plus these additions:

- [ ] Status `type` enum, color, default flag, delete-with-reassignment. Without these, filters, roadmap columns, and the loop have no semantics.
- [ ] Invite via link + pending invite matched on OAuth email. Resolves the PRD contradiction.
- [ ] Product access allowlist (email domains / emails) for private portals. Resolves the "login-required ≠ private" gap.
- [ ] Remove vote; edit/delete own post (with limits) and own comment. Universal expectations.
- [ ] Board search + status filter (hide Done/Closed by default). Board unusable without them.
- [ ] Admin: edit/delete any post or comment, change post status with public message, view voters. Basic hygiene.
- [ ] Admin: merge duplicates (no unmerge). Every competitor has it; duplicates destroy vote signal.
- [ ] PostActivity timeline + "My activity" page with updated markers. Minimum close-the-loop.
- [ ] Post → at most one roadmap item; "Add to roadmap" from post; public card shows aggregate votes. Makes the dual-layer model coherent.
- [ ] Changelog draft/published, edit/unpublish, permalink, tag filter. Implied by "publish".
- [ ] FAQ ordering, rich answers, deep links.

### Add After Validation (v1.x)

- [ ] In-app notification bell (with coalescing). Add first if users don't return to My activity.
- [ ] Changelog ↔ roadmap/post linking + "mark Done on publish". The trigger is admins publishing changelogs regularly (the success metric).
- [ ] Similar-posts suggestions on create. Trigger: admins merging more than a few posts a week.
- [ ] Ban user / mark spam; opt-in moderation queue. Trigger: first abuse report.
- [ ] Pinned posts; one-level replies; internal admin comments.
- [ ] RSS feed for changelog.
- [ ] Delete-my-account (anonymize).
- [ ] Vote on behalf (existing users only).

### Future Consideration (v2+)

- [ ] Scheduled changelog publishing (needs a job runner)
- [ ] Email notifications, magic link (already planned v2)
- [ ] Prioritization scoring, multiple roadmaps
- [ ] Embeddable widget, integrations, AI dedupe (explicitly deferred)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Status type/default/color/reassign-on-delete | HIGH | LOW | P1 |
| Invite link + pending invite (no email) | HIGH | MEDIUM | P1 |
| Private portal allowlist | HIGH (for private use case) | MEDIUM | P1 |
| Board search + status filter | HIGH | LOW | P1 |
| Admin edit/delete/change status/view voters | HIGH | LOW | P1 |
| Merge duplicates | HIGH | MEDIUM | P1 |
| PostActivity timeline + My activity | HIGH | LOW | P1 |
| Remove vote, edit own post/comment | MEDIUM | LOW | P1 |
| Public roadmap vote aggregation; post→one item | MEDIUM | LOW | P1 |
| Changelog draft/permalink/tag filter | MEDIUM | LOW | P1 |
| In-app notification bell | HIGH | MEDIUM | P2 |
| Changelog ↔ item linking + notify | HIGH | MEDIUM | P2 |
| Similar-posts suggestions | MEDIUM | MEDIUM | P2 |
| Ban/spam, moderation queue | MEDIUM | MEDIUM | P2 |
| Vote on behalf | MEDIUM (B2B) | MEDIUM | P2 |
| Pinned posts, replies, internal comments | LOW–MEDIUM | LOW–MEDIUM | P2 |
| RSS | LOW | LOW | P2 |
| Scheduled publish, scoring, widgets | LOW for MVP | MEDIUM–HIGH | P3 |

**Priority key:** P1 = must have for launch; P2 = should have, add when possible; P3 = future.

## Competitor Feature Analysis

| Feature | Canny | Featurebase | Frill / Nolt / Upvoty | Our Approach |
|---------|-------|-------------|------------------------|--------------|
| Merge duplicates | Manual merge moves votes+comments, no notification; limited unmerge; Autopilot AI merge | "Mark as duplicate" merges from triage | Frill Smart Merge (votes+comments transfer); Nolt merge tool; Upvoty merge + "Merge AI" | Manual merge, vote dedupe, tombstone redirect, no unmerge |
| Duplicate prevention | Similar posts suggested while composing, across boards | Duplicate suggestions in triage | Frill suggests similar ideas while typing | Text-search suggestions (v1.x), no AI |
| Moderation | Mark as spam bans author+IP | Opt-in per collection; pending visible to author; publish / approve-for-author / delete | Nolt, Frill, Upvoty approval queues | Admin delete in v1; opt-in queue in v1.x |
| Vote on behalf | "Add voter"; voter identity teammate-only | (via integrations/support) | Nolt, Frill | v1.x, existing users only |
| Statuses | 6 defaults; custom on paid plans; choose roadmap columns | 5 fixed types under custom names; default status; delete moves posts to default | Status-grouped roadmaps | Fixed type + editable name/color; default; picker on delete |
| Close the loop | Voters auto-subscribed; status-change email + comment; bell + notifications page | Status updates on request + email; notification center; My profile | Frill auto-notify followers | Post timeline + My activity (v1); bell (v1.x); no email |
| Internal vs public roadmap | Separate internal prioritization tool, never public; public = posts by status | Status-organized posts; hidden/private categories | Nolt private fields; Frill private ideas | Separate items with public title/description (Productboard-style); DTO-enforced |
| Changelog | Draft/scheduled/published, labels, linked posts, voters notified | Autosaved drafts, schedule, New/Improved/Fixed, segments, RSS/subscribe | Frill announcements widget | Draft/published, tags, permalink; linking in v1.x |
| FAQ / help | None | Separate help center | None | Built-in FAQ (differentiator) |

## Sources

All accessed 2026-10-01. Per-source seam tier is LOW (web provider); the "table stakes" conclusions come from cross-vendor agreement.

- Canny, Managing posts (edit, delete, merge, unmerge, move, spam): https://help.canny.io/en/articles/3827592-managing-posts
- Canny, Merging and unmerging posts: https://help.canny.io/en/articles/5776649-merging-and-unmerging-posts
- Canny, Vote on behalf of your users: https://help.canny.io/en/articles/636112-vote-on-behalf-of-your-users
- Canny, Post statuses: https://help.canny.io/en/articles/673583-post-statuses
- Canny, Public roadmap: https://help.canny.io/en/articles/3828148-public-roadmap
- Canny, Internal roadmap (prioritization, never visible to end users): https://help.canny.io/en/articles/4999644-roadmap-prioritization
- Canny, Notifications (bell, notifications page, triggers): https://help.canny.io/en/articles/5380265-notifications
- Canny, Status change emails: https://help.canny.io/en/articles/1291127-status-change-emails
- Canny, Comments (internal/private comments): https://help.canny.io/en/articles/5795311-comments
- Canny, Create post form: https://help.canny.io/en/articles/5754243-the-create-post-form
- Canny, feedback board request "Mark post as complete when changelog entry is published": https://feedback.canny.io/feature-requests/p/mark-post-as-complete-when-changelog-entry-is-published
- Canny API reference (changelog draft/scheduled/published, labels): https://developers.canny.io/api-reference
- Featurebase, Post statuses (types, default, delete → default): https://help.featurebase.app/articles/6979960-post-statuses
- Featurebase, Post & comment moderation: https://help.featurebase.app/articles/6982593-post-and-comment-moderation
- Featurebase, Status updates & emails: https://help.featurebase.app/en/help/articles/8002760-status-updates-and-emails
- Featurebase, Editing & deleting existing posts: https://help.featurebase.app/articles/8928145-editing-and-deleting-existing-posts
- Featurebase, Changelog overview / subscribing users: https://help.featurebase.app/articles/5954038-changelog-overview , https://help.featurebase.app/articles/2705284-subscribing-users-to-changelogs
- Frill, Ideas features (private ideas, approval, pinning, smart merge, vote on behalf, notifications): https://frill.co/features/ideas
- Nolt, Features (moderation, pin, merge, vote on behalf, private fields): https://nolt.io/features (403 on direct fetch; content via search snippets), https://nolt.io/help/internal-notes
- Upvoty, Moderation & feedback boards: https://upvoty.com/features/moderation , https://upvoty.com/features/feedback-boards
- Productboard, Portals (separate public name/description): https://support.productboard.com/hc/en-us/articles/360056315454-Use-the-Portal-to-share-your-plans-and-collect-feedback-at-scale
- UserJot, positioning and pricing: https://userjot.com/compare/canny-alternative , https://userjot.com/product-roadmap

### Unverified / gaps

- Whether Canny or Featurebase let **end users** edit or delete their own posts: neither help article covers it. The UserSaid recommendation is an inference.
- Canny's behavior when a custom status is deleted: undocumented.
- Whether merge dedupes a user who voted on both posts: Canny docs are silent. Dedupe is required by our UNIQUE constraint regardless.
- The Featurebase notification-center details come from search snippets of its changelog, not a dedicated help article *(single source)*.

---
*Feature research for: multi-tenant customer feedback & public roadmap SaaS*
*Researched: 2026-10-01*
