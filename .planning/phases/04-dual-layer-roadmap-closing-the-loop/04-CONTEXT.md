# Phase 04: Dual-Layer Roadmap & Closing the Loop - Context

**Gathered:** 2026-10-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 04 delivers the internal planning engine and closing-the-loop feedback mechanisms:
1. **Internal Kanban Board**: Admin-only Kanban board at `/dashboard/{ws}/{product}/roadmap` with columns per status, dnd-kit drag-and-drop intra/inter-column reordering, item assignees (workspace members), flexible target deadlines, and rich cards with public/private status badges.
2. **Dual-Layer Privacy Model**: Separation between internal fields (internal title, internal description, notes, assignee, deadline) and public fields (public title, public description, status). Internal fields are physically separated in the database (`roadmap_item_internals` 1:1 table) and strictly forbidden from public API responses and HTML pages, asserted by automated leak-detection canary tests.
3. **Post-to-Roadmap Linking**: 1:many item-to-post linking (each post links to at most 1 item). Linked posts inherit item status changes automatically and cannot have their status edited directly while linked. "Add to roadmap" action from feedback posts prefills a new item.
4. **Public Roadmap**: Customer-facing roadmap tab on the product portal at `/{ws}/{product}/roadmap`. Renders only public items across admin-selected public status columns (STAT-06). Horizontal multi-column board on desktop, segmented status tabs on mobile.
5. **In-App Notifications & My Activity**: Global notification bell in portal and dashboard navbars with unread count and grouped status change notifications (including public notes). "My activity" feed at `/{ws}/{product}/activity` tracking posts the user created, voted on, or commented on, with visual update badges for status changes and new comments.
6. **Status Deletion Cascade**: Status deletion and reassignment transaction expanded to cover roadmap items in addition to posts.

</domain>

<decisions>
## Implementation Decisions

### Internal Kanban & Item Details
- **D-01:** Roadmap card clicking opens item details in a **Modal Dialog** (centered overlay, consistent with existing dialog patterns across the dashboard and portal).
- **D-02:** Target deadline is a **Flexible Target (Quarter / Month / Exact Date)**, allowing admins to plan with agile release horizons ("Q4 2026", "Nov 2026") or pick a specific calendar date. — **Reversibility:** costly — schema needs `deadline_text` and optional `deadline_date`.
- **D-03:** Internal Kanban cards are **Rich Cards** displaying title, assignee avatar, deadline badge, linked post count badge, and a distinct "Public" / "Private" badge.
- **D-04:** Drag-and-drop card positioning uses **Fractional Rank / LexoRank Positioning** for O(1) single-row updates when cards move between or within columns without re-indexing adjacent cards. — **Reversibility:** costly — rank column format (`rank` string or floating-point position).

### Public Roadmap Layout & Mobile View
- **D-05:** Layout is **Desktop Horizontal Columns + Mobile Segmented Status Tabs** (`tab-nav` style on mobile: e.g. Under Review | Planned | In Progress | Shipped for smooth one-handed browsing).
- **D-06:** Public status column visibility (STAT-06) is configured in **both Status Settings (`/dashboard/{ws}/{product}/statuses`) and a quick toggle popover on the internal Kanban board toolbar**. — **Reversibility:** costly — `statuses.is_public_roadmap` boolean column and UI toggles.
- **D-07:** Clicking a public roadmap card opens a **Public Detail Modal** displaying full public title, public description, and links to any associated public feedback posts (allowing visitors to read discussions and upvote).
- **D-08:** Empty public status columns show a **Clean Empty Placeholder** with column header, count (0), and a subtle placeholder message ("Nothing in this stage yet").

### Post Linking & "Add to Roadmap" Workflow
- **D-09:** "Add to roadmap" action is placed **Inside Admin Menu & Post Header** (in the "⋯ Admin" dropdown on both portal & dashboard, plus a prominent button in the dashboard post detail header).
- **D-10:** Linking existing posts from inside a roadmap item uses an **Inline Combobox Search** inside the item modal with live autocomplete results (title, votes, status).
- **D-11:** Linked post status lock is displayed via an **Admin Banner with Unlink + Disabled Status Dropdown** on the dashboard post detail view ("Linked to roadmap item: [Title]" with an Unlink button, status dropdown disabled with tooltip). On the public portal, the post displays only the status badge with zero roadmap details. — **Reversibility:** costly — privacy barrier & contract assertion.
- **D-12:** When a roadmap item is deleted, linked posts **Retain Current Status & Unlock** (decided by Builder). Posts keep their current status as a standalone value and are unlinked cleanly; admins can edit their status manually without confusing status rollbacks for customers.

### Notification Bell & "My Activity" Feed
- **D-13:** The notification bell is located in **Both Portal & Dashboard Headers** in the top-right navbar next to the user avatar.
- **D-14:** Notification dropdown is a **Popover Dropdown with "Mark all as read" + Navigate on Click**. Shows grouped notifications per post with status pill and public note preview; clicking a row marks it as read and navigates to the post.
- **D-15:** "My activity" is located as a **Product Portal Tab & User Dropdown Link** (`/{ws}/{product}/activity` on the portal, plus a direct link in the user avatar dropdown menu).
- **D-16:** "My activity" organizes posts in a **Combined Feed with Badges ("Status changed", "New comments")** highlighting recent updates since the user's last visit.

### Builder Discretion
- **D-12 (Post behavior on item deletion):** Retain current status and unlock linked posts. Ensures customer-facing status does not abruptly revert to "Under Review" when an internal planning item is removed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Requirements & Architecture
- `.planning/ROADMAP.md` § "Phase 4: Dual-Layer Roadmap & Closing the Loop" — Core scope, success criteria, and strict privacy guarantees
- `.planning/REQUIREMENTS.md` — ROAD-01 through ROAD-12, STAT-06, and LOOP-01 through LOOP-05
- `.planning/PROJECT.md` — Privacy constraint: internal roadmap fields must be unreachable from any public endpoint; canary test contract

### Prior Phase Decided Patterns
- `.planning/phases/03-feedback-board-conversations/03-CONTEXT.md` — D-01 (portal/dashboard admin menu), D-05 (status change activity logging), D-07 (card design tokens)
- `.planning/phases/02-workspaces-products-platform-owner/02-CONTEXT.md` — Status editor pattern and tenant-isolation guards

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/src/schema/feedback.ts`: `posts`, `postActivity` tables. `postActivity` already snapshots status changes (`toStatusId`, `statusName`, `statusColor`, `note`) and actor.
- `packages/db/src/schema/tenancy.ts`: `statuses`, `workspaceMembers`, `products`. `statuses` is ready for `isPublicRoadmap` boolean addition.
- `apps/web/components/portal/portal-frame.tsx` & `tab-nav.tsx`: Portal navigation bar already handles tabs ("Feedback", "Roadmap", "Activity").
- `apps/web/components/ui/dialog.tsx`: Radix Dialog used for item detail modal and quick actions.
- `apps/web/components/dashboard/sidebar.tsx`: Product sidebar already links to product sections; add "Roadmap".
- `apps/api/src/products/statuses.controller.ts`: Status delete and reassignment logic to expand to roadmap items.

### Established Patterns
- **Dual-Table Privacy**: `roadmap_items` (public-safe fields: id, productId, statusId, publicTitle, publicDescription, isPublic, rank, createdAt) and `roadmap_item_internals` (1:1 table for internalTitle, internalDescription, internalNotes, assigneeId, deadlineText, deadlineDate).
- **Allowlist Public Queries**: Strict Drizzle `select()` using only public table columns mapped to explicit Zod public response types.
- **Canary Tests**: Automated test suite asserting absence of canary strings across all public routes.

### Integration Points
- `/api/v1/workspaces/:wsSlug/products/:prodSlug/roadmap`: Internal and public roadmap endpoints.
- `/api/v1/workspaces/:wsSlug/products/:prodSlug/posts/:number/link-roadmap`: Linking/unlinking endpoints.
- `/api/v1/notifications` & `/api/v1/me/activity`: In-app notification bell and user activity feed endpoints.

</code_context>

<specifics>
## Specific Ideas

- The public roadmap mirrors modern product portals (like Linear or Canny) with clean column status headers, clear public card summaries, and full privacy isolation.
- On mobile devices, status columns convert into smooth segmented tabs for clean one-handed switching.

</specifics>

<deferred>
## Deferred Ideas

- **ROAD-V2-01**: Public roadmap cards showing total votes from linked posts (deferred to v2 in REQUIREMENTS.md).
- **LOOP-V2-01**: Post timeline of every past status change with public notes (v2).
- **LOOP-V2-03**: Email notifications when a post status changes (email reserved for comments only in v1 per PROJECT.md).

</deferred>

---

*Phase: 04-dual-layer-roadmap-closing-the-loop*
*Context gathered: 2026-10-11*
