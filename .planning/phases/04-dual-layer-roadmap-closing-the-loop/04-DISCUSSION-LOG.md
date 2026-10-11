# Phase 04: Dual-Layer Roadmap & Closing the Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-11
**Phase:** 04-dual-layer-roadmap-closing-the-loop
**Areas discussed:** Internal Kanban & Item Details, Public Roadmap Layout & Mobile View, Post Linking & "Add to Roadmap" Workflow, Notification Bell & "My Activity" Feed

---

## Internal Kanban & Item Details

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-over Sheet (Drawer) | Slides in from the right; keeps the Kanban board visible underneath for fast context switching | |
| Modal Dialog | Centered pop-up dialog; familiar pattern already used across the app | ✓ |
| Dedicated Subpage | Navigates to `/dashboard/{ws}/{product}/roadmap/[id]` with full screen width | |
| You decide | Pick the pattern that best fits the existing dashboard layout | |

**User's choice:** Modal Dialog — Centered pop-up dialog; familiar pattern already used across the app (new post, settings dialogs)
**Notes:** Provides a focused centered overlay for inspecting/editing all item details and linked posts.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Flexible Target (Quarter / Month / Exact Date) | Admin can pick either a broad release target ("Q4 2026", "Nov 2026") or an exact date | ✓ |
| Exact Calendar Date Only | Standard date picker selecting a specific target completion day | |
| Quarter Only (Q1, Q2, Q3, Q4 + Year) | High-level planning by quarters without specific calendar dates | |
| You decide | Choose the cleanest approach for product teams | |

**User's choice:** (Recommended) Flexible Target (Quarter / Month / Exact Date)
**Notes:** Fits modern agile roadmap planning where teams often plan in quarters or months before committing to an exact day.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rich Card | Title, assignee avatar, deadline badge, linked post count badge, and a distinct "Public" / "Private" badge | ✓ |
| Compact Card | Title, linked post count, and a subtle public indicator; cleaner and fits more items vertically | |
| You decide | Pick a balanced layout that avoids visual clutter while showing key operational context | |

**User's choice:** (Recommended) Rich Card
**Notes:** Provides full operational context directly on cards during Kanban reviews without opening each card.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fractional Rank / LexoRank Positioning | O(1) single-row updates when cards are dragged and dropped between or within columns | ✓ |
| Integer Sequence with Column Rebalancing | Re-indexes cards 0, 1, 2... within the column on drop in a quick transaction | |
| You decide | Choose the most resilient database ordering strategy for dnd-kit drag-and-drop | |

**User's choice:** (Recommended) Fractional Rank / LexoRank Positioning
**Notes:** High performance drag-and-drop updates with minimal write contention.

---

## Public Roadmap Layout & Mobile View

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop Horizontal Columns + Mobile Segmented Status Tabs | Desktop shows all public columns side-by-side; mobile switches between columns via tab bar | ✓ |
| Horizontal Snap-Scroll on both Desktop & Mobile | Retains the side-by-side Kanban look on mobile via swipeable horizontal snap columns | |
| Vertical Stacked Sections | Each public status is a stacked section or collapsible accordion on both desktop and mobile | |
| You decide | Pick the pattern that offers the best readability and mobile responsiveness | |

**User's choice:** (Recommended) Desktop Horizontal Columns + Mobile Segmented Status Tabs
**Notes:** Optimal usability across devices; mobile avoids awkward horizontal panning across 4+ columns.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Status Settings + Quick Toggle on Kanban Board | Statuses page has "Show on public roadmap" toggle, plus a quick "Public columns" filter popover on roadmap toolbar | ✓ |
| Status Settings Page Only | Kept in `/dashboard/{ws}/{product}/statuses` alongside status configuration | |
| Roadmap Page Header Only | Directly managed from the internal Kanban board header via a dialog | |
| You decide | Keep it intuitive and close to where the admin plans | |

**User's choice:** (Recommended) Status Settings + Quick Toggle on Kanban Board
**Notes:** Gives admins full configuration on the statuses page plus convenience while viewing the roadmap.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Public Detail Modal | Clicking a card opens a clean dialog with full public title and description, plus links to associated feedback posts | ✓ |
| In-place Expand / Collapse | Clicking a card toggles full text expansion directly in the column | |
| Static Card (No modal) | Card displays full public title and truncated description directly in the column; non-clickable | |
| You decide | Balance discoverability with simplicity | |

**User's choice:** (Recommended) Public Detail Modal
**Notes:** Allows visitors to read the full description and jump to original feedback posts to engage.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clean Empty Placeholder | Render the column header with count (0) and a subtle placeholder ("Nothing in this stage yet") | ✓ |
| Hide Empty Columns on Public Portal | Only display columns that have at least 1 public item, collapsing unused stages | |
| You decide | Ensure the public portal looks intentional even when a column is empty | |

**User's choice:** (Recommended) Clean Empty Placeholder
**Notes:** Displays the pipeline stages clearly even before items reach that stage.

---

## Post Linking & "Add to Roadmap" Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Admin Menu & Post Header | Available in the "⋯ Admin" dropdown (portal & dashboard) and as a prominent button on the dashboard post detail header | ✓ |
| Only in the "⋯ Admin" Dropdown Menu | Keeps all admin operations consolidated under the existing three-dots menu | |
| Dashboard Post Table & Detail View Only | Only available in `/dashboard/{ws}/{product}/board` views | |
| You decide | Maximize convenience for product managers triaging feedback | |

**User's choice:** (Recommended) Inside Admin Menu & Post Header
**Notes:** Maximum accessibility when triaging customer posts.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline Combobox Search inside Item Modal | Search bar with live autocomplete results (title, votes, status); click to link instantly | ✓ |
| Separate "Link Posts" Dialog | Opens a dedicated modal showing a searchable table of unlinked posts with checkboxes | |
| You decide | Pick the fastest and least cluttered workflow | |

**User's choice:** (Recommended) Inline Combobox Search inside Item Modal
**Notes:** Fast and responsive post search without opening nested modal dialogues.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Admin Banner with Unlink + Disabled Status Dropdown | Dashboard shows "Linked to roadmap item: [Title]" with Unlink button; status dropdown is locked with helper text. Public portal shows only the status badge with zero roadmap leakage | ✓ |
| Subtle Lock Icon on Status | Status badge displays a small lock icon for admins with tooltip | |
| You decide | Ensure admins never wonder why status editing is disabled while safeguarding privacy | |

**User's choice:** (Recommended) Admin Banner with Unlink + Disabled Status Dropdown
**Notes:** Explicitly guides admins on why post status cannot be modified independently, with one-click unlink.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Retain Current Status & Unlock | Linked posts keep their current status as a standalone value and are unlinked; admins can freely edit their status again manually | ✓ |
| Prompt on Deletion Dialog | Deletion confirmation dialog includes a checkbox: "Keep current status on linked posts" | |
| Revert to Default Status | Posts immediately revert to the product's default status ("Under Review") upon roadmap item deletion | |
| You decide | Choose the most intuitive behavior for customer communication | |

**User's choice:** You decide — Builder chose Retain Current Status & Unlock.
**Notes:** Prevents confusing status regressions for customers who were following the post.

---

## Notification Bell & "My Activity" Feed

| Option | Description | Selected |
|--------|-------------|----------|
| Both Portal & Dashboard Headers | In the top-right navbar next to the user avatar on all screens, so signed-in users and admins receive alerts everywhere | ✓ |
| Portal Header Only | In the customer-facing portal header where end-users engage with products | |
| Inside User Account Menu | Replaced with an unread badge on the user profile avatar that opens notifications inside the user menu | |
| You decide | Ensure maximum visibility without cluttering headers | |

**User's choice:** (Recommended) Both Portal & Dashboard Headers
**Notes:** Consistent notification access regardless of whether the user is browsing portals or managing products.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Popover Dropdown with "Mark all as read" + Navigate on Click | Shows grouped notifications with status pill & public note; clicking a row marks it read and navigates to the post; includes top "Mark all as read" button | ✓ |
| Auto-mark as Read on Popover Open | Opening the bell immediately clears the unread count badge | |
| Dedicated Full-Page Inbox | Bell links to `/{ws}/{product}/notifications` or `/account/notifications` | |
| You decide | Choose the smoothest pattern for user engagement | |

**User's choice:** (Recommended) Popover Dropdown with "Mark all as read" + Navigate on Click
**Notes:** Intuitive popover with full control over marking notifications as read.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Product Portal Tab & User Dropdown Link | Available as an "Activity" tab on the product portal (`/{ws}/{product}/activity`) and directly linked in user profile dropdown | ✓ |
| Global Account Subpage (`/account/activity`) | Centralized under global account settings | |
| Filter Tab on the Feedback Board | Reuses the existing board page (`/{ws}/{product}?view=my-activity`) | |
| You decide | Choose the most convenient place for users to track their ideas | |

**User's choice:** (Recommended) Product Portal Tab & User Dropdown Link
**Notes:** High visibility on the product portal alongside Feedback and Roadmap.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Combined Feed with Badges ("Status changed", "New comments") | Shows all relevant posts in one unified feed with distinct accent badges for recent updates since last visit | ✓ |
| Sub-tabs ("All", "Created", "Voted", "Commented") with Unread Indicator Dots | Filterable by relationship type with subtle unread dots for updated posts | |
| Combined Feed + Sub-tabs | Unified list with filter tabs and visual status/comment update badges | |
| You decide | Pick the cleanest design for fast scanning | |

**User's choice:** (Recommended) Combined Feed with Badges ("Status changed", "New comments")
**Notes:** Single combined feed with clear visual indicators of what changed since the user last visited.

---

## Builder's Discretion

- **Post Behavior on Item Deletion:** Retain current status and unlock linked posts cleanly without reverting them to default status.

## Deferred Ideas

- None — discussion stayed strictly within Phase 4 scope (ROAD-V2-01, LOOP-V2-01, and LOOP-V2-03 remain documented in REQUIREMENTS.md for future phases).
