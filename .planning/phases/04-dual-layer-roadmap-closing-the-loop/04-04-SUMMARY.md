---
phase: "04-dual-layer-roadmap-closing-the-loop"
plan: "04-04"
status: "complete"
completed_at: "2026-10-11"
key_files:
  - "apps/web/app/dashboard/[ws]/[product]/roadmap/page.tsx"
  - "apps/web/app/dashboard/[ws]/[product]/roadmap/roadmap-view.tsx"
  - "apps/web/components/roadmap/kanban-board.tsx"
  - "apps/web/components/roadmap/kanban-column.tsx"
  - "apps/web/components/roadmap/kanban-card.tsx"
  - "apps/web/components/roadmap/public-columns-popover.tsx"
  - "apps/web/components/roadmap/post-link-combobox.tsx"
  - "apps/web/components/roadmap/roadmap-item-modal.tsx"
  - "apps/web/components/post/linked-roadmap-banner.tsx"
  - "apps/web/components/post/post-actions-menu.tsx"
  - "apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx"
---

# Plan 04-04 Summary: Internal Kanban Board & Admin Cockpit

## One-liner
Delivered the full-fidelity internal Kanban board with `@dnd-kit/react` drag-and-drop, Rocicorp LexoRank reordering, dual-layer privacy badges, post linking combobox, roadmap item creation/editing modal, and linked post status lock enforcement.

## What Was Built

### Task 1: Internal Kanban Board UI & Status Management
- **Dashboard Sidebar & Navigation:** Added `Roadmap` entry with `Kanban` icon linking directly to `/dashboard/[ws]/[product]/roadmap`.
- **Status Dialog & List:** Added `Show on public roadmap` (`isPublicRoadmap`) toggle to create/edit status dialogs with a distinct `Public` badge in the statuses table.
- **Status Column Popover (`PublicColumnsPopover`):** Quick toggle popover in the roadmap toolbar enabling administrators to flip public visibility on any column without leaving the board.
- **Kanban Board (`KanbanBoard`, `KanbanColumn`, `KanbanCard`):**
  - Multi-column layout with color badges and public/internal indicators.
  - Drag-and-drop reordering within and across columns using `@dnd-kit/react` and Rocicorp `generateKeyBetween` midpoint fractional indexing.
  - Optimistic local updates with API persistence (`PATCH .../roadmap/:id/move`) and automatic rollback on failure.
  - Assignee filtering with quick dropdown selector.
- **RSC Route (`page.tsx`, `roadmap-view.tsx`):**
  - Fetches product details, statuses, workspace members, and admin roadmap items.
  - Connects all board interactions to modals and state updates.

### Task 2: Roadmap Item Modal, Post Linking, and Status Locking
- **PostLinkCombobox (`post-link-combobox.tsx`):**
  - Debounced search querying `GET .../roadmap/search-posts?q=...`.
  - Displays vote count, post number, title, and current status.
  - Visual indicators and disablement for posts already linked to the current item or linked to another roadmap item.
- **RoadmapItemModal (`roadmap-item-modal.tsx`):**
  - Dual-layer privacy controls: "Make public" switch dynamically toggles customer-facing `publicTitle` and `publicDescription` with auto-prefill from internal title.
  - Internal scope controls: `internalTitle`, `internalDescription`, and `internalNotes`.
  - Assignee selection and target deadline text.
  - Inline post linking and unlinking with live count badges.
  - Delete item workflow protected by destructive confirmation dialog explaining that linked posts remain unlocked on the board.
- **Status Locking Banner & Actions (`linked-roadmap-banner.tsx`, `post-actions-menu.tsx`, `post-detail-view.tsx`):**
  - Injected informative linked roadmap banner on admin post detail views with direct navigation to the roadmap item.
  - Disabled manual "Change status" button when a post is locked to a roadmap item, displaying explanatory tooltip copy.
  - Updated post actions menu with "Add to roadmap" (opening create modal with post pre-linked) or "View on roadmap" (linking to existing item).

## Verification
- `bun run typecheck`: Passed with 0 errors across `@userhq/types`, `@userhq/db`, `@userhq/api`, and `@userhq/web`.
- `bun run lint`: Passed with 0 errors and 0 warnings.
- Unit and Canary tests:
  - `canary-roadmap-leak.test.ts`: 6/6 passed.
  - `roadmap.test.ts`: 8/8 passed.
  - `portal-roadmap.test.ts`: 3/3 passed.
  - Full API test suite: 378/378 passed.
