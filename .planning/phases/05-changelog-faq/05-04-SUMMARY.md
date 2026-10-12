---
phase: 05-changelog-faq
plan: 04
subsystem: changelog-public-admin
tags: [changelog, public-portal, admin-studio, editor-canvas, tags-dialog, timeline, permalink, auto-save]

# Dependency graph
requires: [05-01, 05-02, 05-03]
provides:
  - "apps/web/components/changelog/changelog-timeline-item.tsx (connected vertical timeline item with tag pills, copy link, collapsible body preview, brand attribution)"
  - "apps/web/components/changelog/changelog-feed.tsx (public feed with connected vertical track and EmptyState)"
  - "apps/web/components/changelog/changelog-article.tsx (standalone article view with Back link, OpenGraph metadata, brand attribution)"
  - "apps/web/components/changelog/changelog-tag-dialog.tsx (Radix Dialog for managing and creating tags with color presets)"
  - "apps/web/components/changelog/changelog-preview-modal.tsx (Radix Dialog rendering live ChangelogArticle preview for author)"
  - "apps/web/components/changelog/changelog-editor.tsx (authoring canvas with debounced auto-save, auto slug derivation, custom release dates, unpublish, and delete)"
  - "apps/web/components/changelog/changelog-studio.tsx (admin management surface with release entries list, status badges, actions menu, and tags shortcut)"
  - "apps/web/app/[ws]/[product]/changelog/page.tsx (public changelog feed route)"
  - "apps/web/app/[ws]/[product]/changelog/[slug]/page.tsx (public changelog permalink route)"
  - "apps/web/app/dashboard/[ws]/[product]/changelog/page.tsx (admin changelog studio route)"
  - "apps/web/app/dashboard/[ws]/[product]/changelog/new/page.tsx (admin changelog create route)"
  - "apps/web/app/dashboard/[ws]/[product]/changelog/[id]/page.tsx (admin changelog edit route)"
  - "apps/web/test/changelog-timeline.test.tsx and apps/web/test/changelog-admin.test.tsx"
affects: [05-05]

actuals:
  tokens: 42000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Connected vertical line track timeline using absolute connector dot and left border"
    - "CSS mask-fade-bottom gradient for collapsible rich text preview"
    - "Product-only brand attribution (D-14) with zero personal identity leak"
    - "Debounced 3s auto-save (D-07) for draft changes on existing entries"
    - "Auto-derived slug from title with manual edit unlock and re-sync button (D-15)"
    - "Backdated and custom release dates with datetime-local picker (D-13)"

key-files:
  created:
    - apps/web/components/changelog/changelog-timeline-item.tsx
    - apps/web/components/changelog/changelog-feed.tsx
    - apps/web/components/changelog/changelog-article.tsx
    - apps/web/components/changelog/changelog-tag-dialog.tsx
    - apps/web/components/changelog/changelog-preview-modal.tsx
    - apps/web/components/changelog/changelog-editor.tsx
    - apps/web/components/changelog/changelog-studio.tsx
    - apps/web/app/[ws]/[product]/changelog/page.tsx
    - apps/web/app/[ws]/[product]/changelog/[slug]/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/changelog/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/changelog/new/page.tsx
    - apps/web/app/dashboard/[ws]/[product]/changelog/[id]/page.tsx
    - apps/web/test/changelog-timeline.test.tsx
    - apps/web/test/changelog-admin.test.tsx
  modified:
    - apps/web/app/globals.css
    - apps/web/vitest.config.ts

key-decisions:
  - "Attributed changelog entries exclusively to the product brand (D-14), never leaking author personal member details"
  - "Rendered collapsible timeline entries with a 4-paragraph/1200-character heuristic and smooth CSS gradient mask fade (D-09)"
  - "Equipped the authoring editor with a 3,000ms debounced auto-save timer saving to draft state (D-07)"
  - "Provided real-time title-to-slug derivation with manual override toggle and re-sync button (D-15)"
  - "Supported custom release dates and backdating via datetime-local picker (D-13)"
  - "Provided full unpublish (CHLG-05) and delete (CHLG-06) capabilities in both studio listing and editor"

patterns-established:
  - "Timeline feed uses relative border-l track with circular connector nodes"
  - "Article permalink pages generate dynamic OpenGraph article metadata"
  - "Admin Changelog Studio displays status badges based on publishedAt timestamp"

requirements-completed: [CHLG-01, CHLG-02, CHLG-03, CHLG-04, CHLG-05, CHLG-06, CHLG-07, CHLG-08]

duration: 25min
completed: 2026-10-12
---

# Plan 05-04: Public & Admin Changelog Feed, Article Permalink, and Studio UI Summary

Implemented complete public and admin changelog surfaces for Phase 05: public chronological timeline feed with collapsible preview cards, standalone article permalink pages with OpenGraph metadata, admin changelog studio listing, authoring editor canvas with auto-save and slug derivation, tag management dialog, and exact live preview modal.

### 1. Public Changelog Feed & Standalone Article Reader (Task 1)
- **`apps/web/components/changelog/changelog-timeline-item.tsx`**:
  - Connected vertical timeline connector node (`absolute -left-[9px] top-1.5 size-4 rounded-full bg-background border-2 border-primary ring-4 ring-background`).
  - Semantic tag pills using `getChangelogTagClasses` (New=emerald, Improved=blue, Fixed=amber, custom=slate).
  - Quick permalink copy button with clipboard copy and toast feedback.
  - Collapsible body preview with `.mask-fade-bottom` CSS mask gradient and toggle button ("Read more ↓" / "Show less ↑").
  - Product brand attribution with `EntityLogo` and `Published by {productName}` (enforces D-14: zero author personal user identity leaked).
- **`apps/web/components/changelog/changelog-feed.tsx`**:
  - Renders `EmptyState` when entries array is empty (`No updates published yet`).
  - Connected timeline track with `relative pl-6 sm:pl-8 border-l border-border space-y-12 sm:space-y-16`.
- **`apps/web/components/changelog/changelog-article.tsx`**:
  - Centered reader (`max-w-3xl mx-auto px-4 sm:px-6 py-10`).
  - Breadcrumb back link (`← All updates`), publication date, tag badges, permalink copy button.
  - Title H1 and product brand attribution `{productName} team`.
  - Rich text content rendered via DOM-free `RichTextViewer`.
  - Bottom back link (`← Back to changelog`).
- **Public Routes**:
  - `apps/web/app/[ws]/[product]/changelog/page.tsx`: RSC calling `getPublicChangelogFeed`.
  - `apps/web/app/[ws]/[product]/changelog/[slug]/page.tsx`: RSC calling `getPublicChangelogEntry` with OpenGraph article metadata.

### 2. Admin Changelog Studio, Authoring Canvas, and Tag Dialog (Task 2)
- **`apps/web/components/changelog/changelog-tag-dialog.tsx`**:
  - Radix Dialog for managing tags (`CHLG-03`): lists existing product tags with color swatches, inline delete buttons, and form to add new tags with name input and color preset picker.
- **`apps/web/components/changelog/changelog-preview-modal.tsx`**:
  - Radix Dialog rendering `ChangelogArticle` inside a `max-w-4xl` modal (`D-07`), showing the exact public appearance before publishing.
- **`apps/web/components/changelog/changelog-editor.tsx`**:
  - Sticky top bar with Back link `← Changelog`, title `New entry` or `Edit entry`, live auto-save indicator (`Saved`, `Saving…`, `Draft saved at {HH:MM}`, `Unsaved changes`), Preview button, Save draft button, and Publish / Update button.
  - Title input with real-time slug auto-derivation (`D-15`) and manual override toggle / re-sync.
  - Tag selector with multi-select pills and `+ Manage tags` dialog shortcut.
  - Release date picker (`datetime-local`) allowing custom/backdated dates (`D-13`).
  - `RichTextEditor` canvas with sticky formatting toolbar and remote image URL modal.
  - Debounced auto-save (every 3s when dirty on existing entries via `PATCH /.../changelog/:id`).
  - Unpublish action (`POST /.../unpublish`, `CHLG-05`) and delete action with `ConfirmDialog` (`DELETE`, `CHLG-06`).
- **`apps/web/components/changelog/changelog-studio.tsx`**:
  - Admin management table with Title + slug, Status badge (`Published` in emerald vs `Draft` in neutral), Tags, Release Date, and action menu (`Edit`, `View live`, `Unpublish`, `Delete`).
  - EmptyState with Megaphone icon when no entries exist.
- **Dashboard Routes**:
  - `apps/web/app/dashboard/[ws]/[product]/changelog/page.tsx`: RSC calling `getAdminChangelogList`.
  - `apps/web/app/dashboard/[ws]/[product]/changelog/new/page.tsx`: RSC calling `getAdminChangelogTags` and rendering `ChangelogEditor` in create mode.
  - `apps/web/app/dashboard/[ws]/[product]/changelog/[id]/page.tsx`: RSC calling `getAdminChangelogEntry` and rendering `ChangelogEditor` in edit mode.

### 3. Verification & Test Suite
- `apps/web/test/changelog-timeline.test.tsx`: 7 tests covering empty feed, timeline track, circular connector node, tag color classes, inline expansion toggle, brand attribution, and standalone article reader.
- `apps/web/test/changelog-admin.test.tsx`: 6 tests covering empty studio, table with status badges, create/edit mode editor, tag dialog, and preview modal.
- All workspace tests passed: 26/26 lint rules, 4/4 db tests, 419/419 api tests, 81/81 web tests.
- Full workspace typecheck passed with zero errors (`bun run typecheck`).
