---
phase: 05-changelog-faq
plan: 05
subsystem: faq-public-admin
tags: [faq, public-portal, admin-manager, dnd-kit, lexorank, instant-search, highlight, accordions, permalinks, feedback-redirect]

# Dependency graph
requires: [05-01, 05-02, 05-03]
provides:
  - "apps/web/components/faq/faq-highlight.tsx (ReDoS-safe regex keyword highlighter wrapping matches in <mark>)"
  - "apps/web/components/faq/faq-search-bar.tsx (44px search input with clear button and matching answer counter)"
  - "apps/web/components/faq/faq-not-found-prompt.tsx (empty search banner linking to feedback board with prefilled title)"
  - "apps/web/components/faq/faq-accordion-item.tsx (multi-open CSS grid collapsible row with copy link permalink and pulse flash)"
  - "apps/web/components/faq/faq-section.tsx (stacked category section with anchor target and accordion list)"
  - "apps/web/components/faq/faq-sidebar-nav.tsx (desktop sticky category sidebar navigation with question counts)"
  - "apps/web/components/faq/faq-portal.tsx (public FAQ orchestrator with 0ms client-side search, hash deep linking, and empty state)"
  - "apps/web/components/faq/faq-category-dialog.tsx (Radix Dialog for creating or renaming an FAQ category)"
  - "apps/web/components/faq/faq-question-dialog.tsx (Radix Dialog for creating or editing FAQ questions with RichTextEditor)"
  - "apps/web/components/faq/faq-question-item.tsx (draggable question row with drag handle, truncated preview, and actions menu)"
  - "apps/web/components/faq/faq-category-item.tsx (draggable category card with question count, add question, and droppable area)"
  - "apps/web/components/faq/faq-manager.tsx (admin drag-and-drop FAQ manager with LexoRank reordering and optimistic rollback)"
  - "apps/web/app/[ws]/[product]/faq/page.tsx (public FAQ portal route)"
  - "apps/web/app/dashboard/[ws]/[product]/faq/page.tsx (admin FAQ manager route)"
  - "apps/web/test/faq-portal.test.tsx and apps/web/test/faq-admin.test.tsx"
affects: []

actuals:
  tokens: 58000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "ReDoS-safe regex escaping for keyword highlighting without DoS vulnerability (T-05-13)"
    - "0ms latency instant client-side keyword search across preloaded category questions and rich-text answers (D-11)"
    - "CSS grid row transition (grid-rows-[1fr] vs grid-rows-[0fr]) for smooth height accordion collapse"
    - "Multi-open accordion state allowing visitors to expand multiple answers simultaneously (D-10)"
    - "Deep-link #q-[id] hash detection with automatic accordion expansion, scroll into view, and accent pulse flash (D-10, FAQ-06)"
    - "Fallback feedback redirect button prefilling search query as title param on /{ws}/{product}?new=true (D-12, FAQ-07)"
    - "Drag-and-drop fractional reordering for both categories and questions using @dnd-kit/react and LexoRank (D-16, FAQ-03)"
    - "Optimistic local state update with automatic rollback and error toast on API mutation failure (T-05-14)"

key-files:
  created:
    - apps/web/components/faq/faq-highlight.tsx
    - apps/web/components/faq/faq-search-bar.tsx
    - apps/web/components/faq/faq-not-found-prompt.tsx
    - apps/web/components/faq/faq-accordion-item.tsx
    - apps/web/components/faq/faq-section.tsx
    - apps/web/components/faq/faq-sidebar-nav.tsx
    - apps/web/components/faq/faq-portal.tsx
    - apps/web/components/faq/faq-category-dialog.tsx
    - apps/web/components/faq/faq-question-dialog.tsx
    - apps/web/components/faq/faq-question-item.tsx
    - apps/web/components/faq/faq-category-item.tsx
    - apps/web/components/faq/faq-manager.tsx
    - apps/web/app/[ws]/[product]/faq/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/faq/page.tsx
    - apps/web/test/faq-portal.test.tsx
    - apps/web/test/faq-admin.test.tsx

key-decisions:
  - "Built client-side search across preloaded category trees for 0ms typing response without backend load (D-11)"
  - "Escaped all RegExp special characters in HighlightText, mitigating ReDoS attack surface (T-05-13)"
  - "Supported multi-open accordions instead of accordion radio locking, permitting multiple answers to remain expanded (D-10)"
  - "Generated permalinks with hash fragment #q-[id] copying to clipboard with toast notification (FAQ-06)"
  - "Redirected unmatched queries to the feedback board with prefilled title parameter (?new=true&title={q}) (D-12, FAQ-07)"
  - "Utilized @dnd-kit/react and LexoRank generateKeyBetween for seamless fractional drag-and-drop reordering (FAQ-03)"

requirements-completed: [FAQ-01, FAQ-02, FAQ-03, FAQ-04, FAQ-05, FAQ-06, FAQ-07]

duration: 30min
completed: 2026-10-12
---

# Plan 05-05: Public FAQ Portal with Instant Search & Admin FAQ Drag-and-Drop Manager UI Summary

Delivered the complete public FAQ self-serve portal and admin FAQ drag-and-drop manager interface for Phase 05, completing all remaining FAQ requirements (FAQ-01 through FAQ-07).

### 1. Public FAQ Portal (Task 1)
- **`apps/web/components/faq/faq-highlight.tsx`**:
  - `escapeRegex` utility escaping `[.*+?^${}()|[\]\\]` to protect against ReDoS (T-05-13).
  - `HighlightText` component wrapping matching substrings in `<mark className="bg-primary/20 text-primary font-medium px-0.5 rounded">`.
- **`apps/web/components/faq/faq-search-bar.tsx`**:
  - 44px height search input (`h-11 px-4 pl-11`) with search icon and clear `X` button.
  - Match readout with singular/plural awareness (`Found 1 matching answer` vs `Found {n} matching answers`).
- **`apps/web/components/faq/faq-not-found-prompt.tsx`**:
  - Informational prompt when search yields 0 matches (`Can't find what you're looking for?`).
  - Action button navigating to `/{ws}/{product}?new=true&title=${encodeURIComponent(query)}` (D-12, FAQ-07).
- **`apps/web/components/faq/faq-accordion-item.tsx`**:
  - Multi-open accordion row with smooth CSS grid expansion (`grid-rows-[1fr]` vs `grid-rows-[0fr]`).
  - Copy permalink button writing `/#q-[id]` to clipboard with toast confirmation (`FAQ-06`).
  - Deep-link focus effect with pulse flash highlight (`ring-2 ring-primary/40 bg-primary/5`).
  - Rich text content rendered safely via DOM-free `RichTextViewer`.
- **`apps/web/components/faq/faq-section.tsx`**:
  - Category anchor container (`<section id={category.id} className="scroll-mt-24 space-y-3">`).
  - Section header with category name and question count badge.
- **`apps/web/components/faq/faq-sidebar-nav.tsx`**:
  - Desktop sticky left navigation (`sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto`).
  - Anchor links to category sections with badge counts.
- **`apps/web/components/faq/faq-portal.tsx`**:
  - Client orchestrator managing client-side keyword filtering (`0ms latency`), multi-open question IDs set, deep link hash detection and auto-expansion, and EmptyState for 0 categories.
- **Public Route**:
  - `apps/web/app/[ws]/[product]/faq/page.tsx`: RSC calling `getPortalProduct` and `getPublicFaqTree`.

### 2. Admin FAQ Drag-and-Drop Manager & CRUD Dialogs (Task 2)
- **`apps/web/components/faq/faq-category-dialog.tsx`**:
  - Radix Dialog for creating or renaming an FAQ category (min: 2, max: 50 chars).
- **`apps/web/components/faq/faq-question-dialog.tsx`**:
  - Radix Dialog for creating or editing FAQ questions with category selector (`NativeSelect`), question title input (5–200 chars), and rich-text answer canvas (`RichTextEditor`).
- **`apps/web/components/faq/faq-question-item.tsx`**:
  - Draggable question row with `@dnd-kit/react/sortable` (`useSortable`), grip handle (`cursor-grab active:cursor-grabbing`), plain text preview snippet, and actions menu with Edit and Delete (`ConfirmDialog`).
- **`apps/web/components/faq/faq-category-item.tsx`**:
  - Draggable category card with `@dnd-kit/react/sortable` and droppable question container with `@dnd-kit/react` (`useDroppable`).
  - Card header with drag handle, category title, question count badge, `+ Add question` button, and actions menu (`Rename`, `Delete`).
  - Droppable question area rendering question items or dashed empty drop zone.
- **`apps/web/components/faq/faq-manager.tsx`**:
  - Client manager with `@dnd-kit/react` `DragDropProvider`.
  - Reordering of categories via `generateKeyBetween` calling `PATCH /api/v1/.../faq/categories/:id/reorder`.
  - Intra- and inter-category reordering of questions calling `PATCH /api/v1/.../faq/questions/:id/reorder`.
  - Optimistic local state updates with rollback and error toast on failure.
  - EmptyState with "No FAQ categories yet" and "New category" CTA.
- **Dashboard Route**:
  - `apps/web/app/dashboard/[ws]/[product]/faq/page.tsx`: RSC calling `getProduct` and `getAdminFaqCategories`.

### 3. Verification & Test Suite
- `apps/web/test/faq-portal.test.tsx`: 12 tests covering highlighting, regex escaping, search match counters, multi-open accordions, deep link hash IDs, empty states, and feedback board redirect URLs.
- `apps/web/test/faq-admin.test.tsx`: 8 tests covering category/question dialog rendering in create and edit modes, empty states, category item cards, question item drag rows, and manager integration.
- Full workspace test suite:
  - Lint rules: 26 passed
  - Database tests: 4 passed
  - API tests: 419 passed
  - Web tests: 101 passed
  - Total: 550 tests passed
- Full workspace typecheck: 0 errors across `@userhq/types`, `@userhq/db`, `@userhq/web`, `@userhq/api`.
