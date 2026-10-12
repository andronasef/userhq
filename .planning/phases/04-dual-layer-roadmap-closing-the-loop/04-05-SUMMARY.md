---
phase: "04-dual-layer-roadmap-closing-the-loop"
plan: "04-05"
status: "complete"
completed_at: "2026-10-12"
key_files:
  - "apps/web/app/[ws]/[product]/roadmap/page.tsx"
  - "apps/web/app/[ws]/[product]/roadmap/public-roadmap-view.tsx"
  - "apps/web/components/roadmap/public-roadmap-board.tsx"
  - "apps/web/components/roadmap/public-roadmap-card.tsx"
  - "apps/web/components/roadmap/public-roadmap-modal.tsx"
  - "apps/web/components/portal/portal-tabs.tsx"
  - "apps/web/components/notifications/notification-bell.tsx"
  - "apps/web/components/notifications/notification-item.tsx"
  - "apps/web/app/[ws]/[product]/activity/page.tsx"
  - "apps/web/app/[ws]/[product]/activity/activity-view.tsx"
  - "apps/web/components/activity/activity-feed.tsx"
  - "apps/api/test/canary-roadmap-leak.test.ts"
---

# Plan 04-05 Summary: Public Roadmap Portal, Notifications UI & Canary Leak Audit

## One-liner
Delivered the responsive public roadmap portal, in-app notification bell with unread indicator badge and mark-read controls, "My Activity" product feed with update highlights, and verified watertight privacy via automated canary leak testing across API and HTML.

## What Was Built

### Task 1: Public Customer Roadmap
- **RSC Route (`apps/web/app/[ws]/[product]/roadmap/page.tsx`, `public-roadmap-view.tsx`):**
  - Fetches product configuration and public roadmap items (`GET /api/v1/portal/:ws/:product/roadmap`).
  - Sets SEO metadata (`Roadmap · {product}`).
- **Responsive Multi-Column Board (`public-roadmap-board.tsx`):**
  - **Desktop (>=640px):** Multi-column horizontal scrolling layout showing columns for statuses where `is_public_roadmap === true`.
  - **Mobile (<640px):** Segmented pill row tabs with status dot and card counters, displaying a single vertical card stack.
  - **Empty States:** Subtle placeholders for empty columns (`Nothing in this stage yet`) and empty board CTA (`View feedback board`).
- **Public Roadmap Card (`public-roadmap-card.tsx`):**
  - Displays public title (2-line clamp) and description (3-line clamp).
  - Displays linked idea count badge (`{n} ideas`).
- **Public Roadmap Modal (`public-roadmap-modal.tsx`):**
  - Radix Dialog displaying status badge, public title, full description, and clickable linked feedback discussion rows with upvote counters.
- **Dynamic Portal Tabs (`portal-tabs.tsx`):**
  - Renders `Feedback`, `Roadmap`, and `Activity` (conditional on signed-in user) with path-based active tab detection.

### Task 2: Notification Bell, My Activity Feed, and Canary Leak Test
- **Notification Item (`notification-item.tsx`):**
  - Displays unread indicator dot, target post title, new status badge, public note preview blockquote, and relative timestamp.
  - Calls `onRead` and navigates directly to post permalink on click.
- **Notification Bell (`notification-bell.tsx`):**
  - Global navbar trigger with red unread count badge.
  - Dropdown menu featuring "Mark all as read" button and scrollable list of notifications.
  - Embedded into portal header, dashboard header, and app shell header.
- **User Menu & Proxy Updates (`user-menu.tsx`, `proxy.ts`):**
  - Added "My activity" dropdown item when browsing inside a portal product context.
  - Added `/:ws/:product/activity` to `proxy.ts` route matcher, protecting the route with a 307 redirect to `/login?next=...` for unauthenticated visitors.
- **My Activity Feed (`activity-feed.tsx`, `activity-view.tsx`, `page.tsx`):**
  - Chronological feed of posts user created, upvoted, or commented on.
  - Highlights updates since last visit with `Status changed` (amber) and `New comments` (blue) badges.
  - Empty state with CTA to explore feedback board.
- **Canary Leak Audit (`canary-roadmap-leak.test.ts`):**
  - Planted high-entropy canary values into `roadmap_item_internals`.
  - Asserted zero presence of canary tokens across all public portal endpoints and HTML.

## Verification
- `bun run typecheck`: Passed with 0 errors across all 4 packages.
- `bun run lint`: Passed with 0 errors and 0 warnings.
- `canary-roadmap-leak.test.ts`: 7/7 tests passed.
- All `apps/api` test suites: 32/32 passed (379 tests passed).
