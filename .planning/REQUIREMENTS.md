# Requirements: UserHQ

**Defined:** 2026-10-01
**Core Value:** An admin can see what their users actually want, ranked by demand, and close the loop publicly — feedback in, roadmap out, changelog shipped.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in with a Google account
- [ ] **AUTH-02**: User can sign in with a GitHub account
- [ ] **AUTH-03**: User stays signed in across browser refreshes and can sign out from any page
- [ ] **AUTH-04**: User's OAuth display name and avatar appear on their posts and comments; their email is never shown publicly

### Platform Owner

- [ ] **PLAT-01**: The platform owner is identified by a verified email listed in server configuration; the role cannot be granted or claimed from inside the app
- [ ] **PLAT-02**: Platform owner can create an invite link for a specific email that lets that person create a workspace; the link expires and works only once
- [ ] **PLAT-03**: Platform owner can see every platform invite with its state (pending, used and by whom, expired, revoked) and revoke unused ones
- [ ] **PLAT-04**: Platform owner can browse all workspaces, products, and users, with counts of members, posts, and votes
- [ ] **PLAT-05**: Platform owner can suspend a workspace, which takes its portals and admin dashboard offline while keeping its data, and can lift the suspension; visitors to a suspended portal see an "unavailable" page
- [ ] **PLAT-06**: Platform owner can ban a user platform-wide, which stops them signing in or acting anywhere, and can lift the ban; their existing content stays
- [ ] **PLAT-07**: The platform owner dashboard and its API are reachable only by the platform owner; everyone else gets a not-found response

### Workspace

- [ ] **WORK-01**: Signed-in user who holds a valid platform invite (or the platform owner) can create a workspace with a name, slug, and uploaded logo, becoming its owner; other users are told workspace creation is invite-only
- [ ] **WORK-02**: Workspace slug is rejected if it is already taken or is a reserved word that would collide with app routes (e.g. `api`, `dashboard`, `login`, `uploads`)
- [ ] **WORK-03**: Admin can create a shareable invite link for a specific email address; the link expires and works only once
- [ ] **WORK-04**: Invitee joins the workspace as an admin by opening the link and signing in with a verified OAuth email that matches the invite
- [ ] **WORK-05**: Admin can remove a teammate from the workspace; the owner cannot be removed
- [ ] **WORK-06**: Admin can leave a workspace, except the owner
- [ ] **WORK-07**: User can delete their own account; their posts and comments remain, shown as "Deleted user"

### Products & Portal

- [ ] **PROD-01**: Admin can create multiple products in a workspace, each with a name, slug, and uploaded logo
- [ ] **PROD-02**: Admin can rename a product and change its logo; the slug is fixed after creation so links never break
- [ ] **PROD-03**: Admin can delete a product, which removes its portal from public view while keeping its data
- [ ] **PROD-04**: Anyone can view a product's portal at `/{workspace}/{product}` without signing in
- [ ] **PROD-05**: Visitor to `/{workspace}` sees a list of that workspace's products
- [ ] **PROD-06**: Signed-out visitor who tries to post, vote, or comment is prompted to sign in and returned to where they were

### Statuses

- [ ] **STAT-01**: Each new product is seeded with five statuses, one per type: Under Review (Review), Planned (Planned), In Progress (Active), Completed (Completed), Declined (Closed); Under Review is the default
- [ ] **STAT-02**: Admin can add a status with a name, color, and one of the five fixed types
- [ ] **STAT-03**: Admin can rename, recolor, and reorder a product's statuses
- [ ] **STAT-04**: Admin can delete a status only by choosing which status its posts and roadmap items move to; the default status and the last status of a product cannot be deleted
- [ ] **STAT-05**: Admin can choose which status new posts start in
- [ ] **STAT-06**: Admin can choose which statuses appear as columns on the public roadmap

### Feedback Posts

- [ ] **POST-01**: Signed-in user can submit a post with a title, plain-text description, and category
- [ ] **POST-02**: Admin can create, rename, and delete a product's post categories; new products are seeded with Bug and Feature Request
- [ ] **POST-03**: Signed-in user can upvote a post; voting again has no further effect (one vote per user per post)
- [ ] **POST-04**: User can remove their own vote
- [ ] **POST-05**: User can edit their own post's title, description, and category
- [ ] **POST-06**: Each post has its own page with a permanent link
- [ ] **POST-07**: Visitor can sort the board by Top Voted or Newest
- [ ] **POST-08**: Visitor can filter the board by category
- [ ] **POST-09**: Visitor can filter the board by status; posts in Completed- and Closed-type statuses are hidden by default
- [ ] **POST-10**: Visitor can search posts by text in the title and description
- [ ] **POST-11**: Every post displays its current status

### Comments

- [ ] **CMNT-01**: Signed-in users and admins can comment on a post
- [ ] **CMNT-02**: Comments written by a workspace admin show an Admin badge, determined by the server rather than the client
- [ ] **CMNT-03**: User can edit their own comment
- [ ] **CMNT-04**: User can delete their own comment

### Moderation

- [ ] **MOD-01**: Admin can edit any post or comment in their workspace's products
- [ ] **MOD-02**: Admin can delete any post or comment; it disappears from the portal but is kept in the database
- [ ] **MOD-03**: Admin can change the status of a post that is not linked to a roadmap item, with an optional public note shown on the post
- [ ] **MOD-04**: Admin can see the list of users who voted on a post; the public sees only the count
- [ ] **MOD-05**: Admin can merge a duplicate post into another: votes move without creating double votes, comments move, and the duplicate's link redirects to the target

### Closing the Loop

- [ ] **LOOP-01**: Signed-in user has a "My activity" page listing the posts they created, voted on, or commented on
- [ ] **LOOP-02**: "My activity" marks posts whose status changed or that received new comments since the user's last visit
- [ ] **LOOP-03**: User receives an in-app notification when a post they created, voted on, or commented on changes status, including any public note
- [ ] **LOOP-04**: A notification bell shows the unread count; repeated changes to the same post are grouped into one notification
- [ ] **LOOP-05**: User can mark notifications as read

### Roadmap

- [ ] **ROAD-01**: Admin sees the internal roadmap as a Kanban board with one column per status
- [ ] **ROAD-02**: Admin can create a roadmap item with an internal title and internal description
- [ ] **ROAD-03**: Admin can move an item between columns by drag and drop, which changes its status
- [ ] **ROAD-04**: Admin can reorder items within a column by drag and drop
- [ ] **ROAD-05**: Admin can set an item's assignee (a workspace member), internal notes, and target deadline
- [ ] **ROAD-06**: Admin can link a roadmap item to one or more posts; a post can be linked to at most one item
- [ ] **ROAD-07**: Linked posts take the item's status and follow it whenever the item moves; a linked post's status cannot be changed directly. This applies even while the item is not public — the post shows the status, never the item's details.
- [ ] **ROAD-08**: Admin can create a roadmap item from a post ("Add to roadmap"), prefilled from the post and already linked to it
- [ ] **ROAD-09**: Admin can toggle an item's Make Public switch; turning it on prefills the public title from the internal title, and an item cannot be public without a public title
- [ ] **ROAD-10**: Admin can write a public description separate from the internal description
- [ ] **ROAD-11**: Anyone can view the public roadmap, which shows only public items in public-roadmap statuses, and only their public title, public description, and status
- [ ] **ROAD-12**: No public page or API response ever contains an item's internal title, internal description, notes, assignee, or deadline, and an automated test checks every public endpoint for this

### Changelog

- [ ] **CHLG-01**: Admin can write a changelog entry with formatted rich text (headings, lists, bold, italics, links)
- [ ] **CHLG-02**: Admin can insert images into an entry; they are converted to WebP automatically
- [ ] **CHLG-03**: Admin can tag an entry; new products are seeded with New, Improved, and Fixed tags, and admins can add, rename, and delete tags
- [ ] **CHLG-04**: Admin can save an entry as a draft that the public cannot see
- [ ] **CHLG-05**: Admin can publish an entry, edit it after publishing, and unpublish it back to draft
- [ ] **CHLG-06**: Admin can delete an entry
- [ ] **CHLG-07**: Anyone can read a product's published entries, newest first
- [ ] **CHLG-08**: Each entry has its own permanent link, with a title and image preview when shared

### FAQ

- [ ] **FAQ-01**: Admin can create, rename, and delete FAQ categories
- [ ] **FAQ-02**: Admin can create, edit, and delete questions in a category, with rich-text answers
- [ ] **FAQ-03**: Admin can reorder categories, and questions within a category
- [ ] **FAQ-04**: Visitor can browse the FAQ by category
- [ ] **FAQ-05**: Visitor can search questions and answers by text
- [ ] **FAQ-06**: Each question has its own link that opens the FAQ with that question expanded
- [ ] **FAQ-07**: FAQ search results end with a "Didn't find it?" button that opens the new-post form on the feedback board

### Email Notifications

- [ ] **NOTF-01**: User receives an email when someone else comments on a post they created or previously commented on
- [ ] **NOTF-02**: User can turn comment emails off in their account settings, and every email has a one-click unsubscribe link
- [ ] **NOTF-03**: A comment is saved and shown even if its email fails to send; failed emails are retried automatically

### Uploads

- [ ] **UPLD-01**: Uploaded images (logos and changelog/FAQ images) are limited to PNG, JPEG, WebP, and GIF under a size limit, and are re-encoded to WebP; SVG and non-image files are rejected

### Operations

- [ ] **OPS-01**: Uploaded images and database data survive a redeploy of either container
- [ ] **OPS-02**: Database migrations apply automatically when the API starts
- [ ] **OPS-03**: Email sending is configured by environment settings (SMTP host, login, sender address); in development all email goes to a local Mailpit inbox instead of real recipients

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Closing the Loop

- **LOOP-V2-01**: Post shows a timeline of every past status change with its public note
- **LOOP-V2-02**: Changelog entry can link to the roadmap items and posts it shipped, with an option to mark them Completed on publish
- **LOOP-V2-03**: User receives an email when a post they created, voted on, or commented on changes status
- **LOOP-V2-04**: Admins receive an email when a new post is submitted to their product
- **LOOP-V2-05**: Voters receive an email when a changelog entry is published for their product
- **LOOP-V2-06**: Teammate invites are delivered by email as well as by link

### Roadmap

- **ROAD-V2-01**: Public roadmap cards show total votes from their linked posts

### Changelog

- **CHLG-V2-01**: Visitor can filter the changelog feed by tag
- **CHLG-V2-02**: Changelog has an RSS feed

### Platform Owner

- **PLAT-V2-01**: Platform owner sees platform metrics: active workspaces, upvotes and comments per post, roadmap moves and changelog posts per workspace per month (the PRD's success metrics)
- **PLAT-V2-02**: Open self-serve workspace sign-up, replacing invite-only access

### Access & Auth

- **ACCS-V2-01**: Admin can make a product portal private, visible only to an allowlist of emails or email domains
- **ACCS-V2-02**: User can sign in with email and password
- **ACCS-V2-03**: User can sign in with a magic link
- **ACCS-V2-04**: Workspace has separate owner/admin/viewer permissions
- **ACCS-V2-05**: Portals can be reached by subdomain or custom domain

### Moderation & Engagement

- **ENGM-V2-01**: Optional moderation queue for new posts
- **ENGM-V2-02**: Admin can ban users or mark spam
- **ENGM-V2-03**: Admin can vote on behalf of a customer
- **ENGM-V2-04**: Admin can pin posts
- **ENGM-V2-05**: One level of replies on comments
- **ENGM-V2-06**: Internal admin-only comments on posts
- **ENGM-V2-07**: Scheduled changelog publishing
- **ENGM-V2-08**: Similar-post suggestions while typing a new post (text search, not AI)
- **ENGM-V2-09**: Demand-ranked admin triage inbox

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI assistant and automatic duplicate detection | Deferred in the PRD; manual merge covers v1 |
| Email beyond comment notifications in v1 (sign-in, invites, status changes, digests) | User decision: email is for important notifications only, and v1 sends just one type; the in-app bell and "My activity" carry the rest. Several are tracked in v2. |
| Self-hosted mail server (Postfix, Mailcow, Stalwart) | Oracle Cloud blocks outbound port 25 for tenancies created after June 2021, and cloud IPs have poor deliverability; Brevo is used as an SMTP relay instead |
| Third-party integrations (Jira, Slack, GitHub issues) | Not needed to validate the core loop |
| External cloud storage (S3, R2) | Local Docker volume is enough at MVP scale |
| Billing, plans, usage metering | No revenue model defined for MVP |
| Real-time updates over websockets | Polling or refresh is enough; adds infrastructure for little user value |
| Anonymous voting | Defeats one-vote-per-user integrity; PRD requires login to act |
| Downvotes or weighted votes | Category consensus: demand signal only goes up |
| Public ETAs or deadlines | Deadlines are internal-only by PRD design; public dates create broken promises |
| Multiple boards per product | A product is the board; categories cover sub-areas |
| Rich text in end-user posts | Plain text keeps posts readable and removes an XSS surface |
| Public voter lists | Privacy; admins see voters, the public sees counts |
| Undoing a merge | Votes are deduplicated on merge, so it can't be reversed cleanly |
| Permanently deleting posts or comments | Soft delete keeps merges, counts and history consistent |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 3 | Pending |
| PLAT-01 | Phase 2 | Pending |
| PLAT-02 | Phase 2 | Pending |
| PLAT-03 | Phase 2 | Pending |
| PLAT-04 | Phase 2 | Pending |
| PLAT-05 | Phase 2 | Pending |
| PLAT-06 | Phase 2 | Pending |
| PLAT-07 | Phase 2 | Pending |
| WORK-01 | Phase 2 | Pending |
| WORK-02 | Phase 2 | Pending |
| WORK-03 | Phase 2 | Pending |
| WORK-04 | Phase 2 | Pending |
| WORK-05 | Phase 2 | Pending |
| WORK-06 | Phase 2 | Pending |
| WORK-07 | Phase 3 | Pending |
| PROD-01 | Phase 2 | Pending |
| PROD-02 | Phase 2 | Pending |
| PROD-03 | Phase 2 | Pending |
| PROD-04 | Phase 2 | Pending |
| PROD-05 | Phase 2 | Pending |
| PROD-06 | Phase 3 | Pending |
| STAT-01 | Phase 2 | Pending |
| STAT-02 | Phase 2 | Pending |
| STAT-03 | Phase 2 | Pending |
| STAT-04 | Phase 2 | Pending |
| STAT-05 | Phase 2 | Pending |
| STAT-06 | Phase 4 | Pending |
| POST-01 | Phase 3 | Pending |
| POST-02 | Phase 3 | Pending |
| POST-03 | Phase 3 | Pending |
| POST-04 | Phase 3 | Pending |
| POST-05 | Phase 3 | Pending |
| POST-06 | Phase 3 | Pending |
| POST-07 | Phase 3 | Pending |
| POST-08 | Phase 3 | Pending |
| POST-09 | Phase 3 | Pending |
| POST-10 | Phase 3 | Pending |
| POST-11 | Phase 3 | Pending |
| CMNT-01 | Phase 3 | Pending |
| CMNT-02 | Phase 3 | Pending |
| CMNT-03 | Phase 3 | Pending |
| CMNT-04 | Phase 3 | Pending |
| MOD-01 | Phase 3 | Pending |
| MOD-02 | Phase 3 | Pending |
| MOD-03 | Phase 3 | Pending |
| MOD-04 | Phase 3 | Pending |
| MOD-05 | Phase 3 | Pending |
| LOOP-01 | Phase 4 | Pending |
| LOOP-02 | Phase 4 | Pending |
| LOOP-03 | Phase 4 | Pending |
| LOOP-04 | Phase 4 | Pending |
| LOOP-05 | Phase 4 | Pending |
| ROAD-01 | Phase 4 | Pending |
| ROAD-02 | Phase 4 | Pending |
| ROAD-03 | Phase 4 | Pending |
| ROAD-04 | Phase 4 | Pending |
| ROAD-05 | Phase 4 | Pending |
| ROAD-06 | Phase 4 | Pending |
| ROAD-07 | Phase 4 | Pending |
| ROAD-08 | Phase 4 | Pending |
| ROAD-09 | Phase 4 | Pending |
| ROAD-10 | Phase 4 | Pending |
| ROAD-11 | Phase 4 | Pending |
| ROAD-12 | Phase 4 | Pending |
| CHLG-01 | Phase 5 | Pending |
| CHLG-02 | Phase 5 | Pending |
| CHLG-03 | Phase 5 | Pending |
| CHLG-04 | Phase 5 | Pending |
| CHLG-05 | Phase 5 | Pending |
| CHLG-06 | Phase 5 | Pending |
| CHLG-07 | Phase 5 | Pending |
| CHLG-08 | Phase 5 | Pending |
| FAQ-01 | Phase 5 | Pending |
| FAQ-02 | Phase 5 | Pending |
| FAQ-03 | Phase 5 | Pending |
| FAQ-04 | Phase 5 | Pending |
| FAQ-05 | Phase 5 | Pending |
| FAQ-06 | Phase 5 | Pending |
| FAQ-07 | Phase 5 | Pending |
| NOTF-01 | Phase 3 | Pending |
| NOTF-02 | Phase 3 | Pending |
| NOTF-03 | Phase 3 | Pending |
| UPLD-01 | Phase 1 | Pending |
| OPS-01 | Phase 1 | Pending |
| OPS-02 | Phase 1 | Pending |
| OPS-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 89 total
- Mapped to phases: 89
- Unmapped: 0 ✓

**Per phase:**
- Phase 1 (Walking Skeleton): 6
- Phase 2 (Workspaces, Products & Platform Owner): 23
- Phase 3 (Feedback Board & Conversations): 27
- Phase 4 (Dual-Layer Roadmap & Closing the Loop): 18
- Phase 5 (Changelog & FAQ): 15

---
*Requirements defined: 2026-10-01*
*Last updated: 2026-10-01 after roadmap creation (traceability mapped)*
