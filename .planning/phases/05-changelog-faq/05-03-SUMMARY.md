---
phase: 05-changelog-faq
plan: 03
subsystem: frontend-foundations-rich-text
tags: [tiptap, rich-text, prose-mirror, navigation, sidebar, portal-tabs, api-server, error-mappings]

# Dependency graph
requires: [05-01]
provides:
  - "apps/web/components/rich-text/rich-text-viewer.tsx (DOM-free static renderer via @tiptap/static-renderer/pm/react, zero dangerouslySetInnerHTML)"
  - "apps/web/components/rich-text/editor-toolbar.tsx ('use client' sticky formatting toolbar with Radix image and link modals)"
  - "apps/web/components/rich-text/rich-text-editor.tsx ('use client' interactive canvas with immediatelyRender: false, markdown shortcuts, onChange listener)"
  - "apps/web/components/portal/portal-tabs.tsx updated with Changelog and FAQ tabs"
  - "apps/web/components/dashboard/sidebar.tsx updated with Changelog and FAQ links"
  - "apps/web/lib/api-server.ts updated with typed server fetchers for public and admin changelog and FAQ"
  - "apps/web/lib/api-errors.ts updated with Phase 5 error code copies and field mappings"
  - "apps/web/test/rich-text.test.tsx comprehensive unit tests"
affects: [05-04, 05-05]

actuals:
  tokens: 38000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Static DOM-free ProseMirror AST rendering via @tiptap/static-renderer/pm/react generating native React JSX elements"
    - "Zero dangerouslySetInnerHTML guarantee for rich text rendering"
    - "Tiptap useEditor immediatelyRender: false SSR hydration safety"
    - "Remote image insertion dialog validating http:// and https:// URLs with 200 char alt text limit"

key-files:
  created:
    - apps/web/components/rich-text/rich-text-viewer.tsx
    - apps/web/components/rich-text/editor-toolbar.tsx
    - apps/web/components/rich-text/rich-text-editor.tsx
    - apps/web/test/rich-text.test.tsx
  modified:
    - apps/web/app/globals.css
    - apps/web/components/dashboard/sidebar.tsx
    - apps/web/components/portal/portal-tabs.tsx
    - apps/web/lib/api-errors.ts
    - apps/web/lib/api-server.ts
    - apps/web/vitest.config.ts

key-decisions:
  - "Used @tiptap/static-renderer/pm/react for server and client ProseMirror rendering, guaranteeing zero dangerouslySetInnerHTML"
  - "Configured useEditor with immediatelyRender: false to avoid Next.js / React 19 hydration mismatches"
  - "Enforced remote image URL protocol validation (http: or https:) with optional alt text up to 200 characters (D-06)"
  - "Established portal tab ordering: Feedback -> Roadmap -> Changelog -> FAQ -> Activity (when logged in)"
  - "Integrated Changelog and FAQ links in dashboard product sub-navigation between Roadmap and Categories"

patterns-established:
  - "RichTextViewer renders null on empty ASTs ({ type: 'doc', content: [] }) and maps AST nodes to sanitized JSX"
  - "EditorToolbar provides sticky formatting buttons and accessible Radix dialogs for links and remote images"
  - "Server API fetchers in api-server.ts export cached functions validating JSON responses against Zod DTO schemas"

requirements-completed: [CHLG-01, CHLG-02, FAQ-01, FAQ-02]

duration: 15min
completed: 2026-10-12
---

# Plan 05-03: Frontend Core Foundations & Shared Rich Text Viewer/Editor Summary

Implemented frontend foundations for Phase 05 (Changelog & FAQ): static ProseMirror AST viewer, interactive Tiptap editor canvas with sticky formatting toolbar and remote image insertion modal, updated navigation tabs and sidebar links, typed server fetchers, and error code mappings.

### 1. Static Rich Text Viewer (`RichTextViewer`)
- Implemented `apps/web/components/rich-text/rich-text-viewer.tsx`:
  - Uses `@tiptap/static-renderer/pm/react`'s `renderToReactElement` to transform ProseMirror JSON AST to native React JSX components.
  - Guarantees zero `dangerouslySetInnerHTML`.
  - Configures `StarterKit` with headings (levels 1-3), secure links (`target="_blank"`, `rel="noopener noreferrer nofollow"`), and `Image` with responsive rounded border styling.
  - Returns `null` when content is missing or has an empty node array.
  - Added typography styling rules in `apps/web/app/globals.css` for `.rich-text-content` and `.tiptap`.

### 2. Interactive Rich Text Editor & Toolbar (`RichTextEditor`, `EditorToolbar`)
- Implemented `apps/web/components/rich-text/editor-toolbar.tsx`:
  - Client component (`"use client"`) rendering a sticky top toolbar with visual toggle states for active formatting.
  - Icon buttons for H2, H3, Bold, Italic, Strikethrough, Code block, Bullet list, Numbered list, Quote, Divider, Link, and Image.
  - Built-in Radix `Dialog` for remote image insertion validating `http://` or `https://` URLs and enforcing 200 char alt text limits (D-06).
  - Built-in Radix `Dialog` for setting and removing links.
- Implemented `apps/web/components/rich-text/rich-text-editor.tsx`:
  - Configures `useEditor` with `immediatelyRender: false` for Next.js / React 19 SSR hydration safety.
  - Supports Markdown shortcuts (`##`, `###`, `-`, `1.`, `>`, ````) out of the box.
  - Emits `onChange?.(editor.getJSON() as RichTextDoc)` on document updates.
  - Synchronizes `disabled` state via `editor.setEditable(!disabled)`.

### 3. Navigation & Sidebar Updates
- Updated `apps/web/components/portal/portal-tabs.tsx`:
  - Added `Changelog` (`/{ws}/{product}/changelog`) and `FAQ` (`/{ws}/{product}/faq`) tabs.
  - Preserved canonical ordering: Feedback -> Roadmap -> Changelog -> FAQ -> Activity (if logged in).
  - Configured active tab matching using `pathname.startsWith(...)`.
- Updated `apps/web/components/dashboard/sidebar.tsx`:
  - Added `Changelog` (with `Megaphone` icon) and `FAQ` (with `HelpCircle` icon) under product sub-navigation directly after Roadmap and before Categories.

### 4. API Server Fetchers & Error Mappings
- Updated `apps/web/lib/api-server.ts`:
  - Added cached typed server fetchers: `getPublicChangelogFeed`, `getPublicChangelogEntry`, `getAdminChangelogList`, `getAdminChangelogEntry`, `getAdminChangelogTags`, `getPublicFaqTree`, and `getAdminFaqCategories`.
- Updated `apps/web/lib/api-errors.ts`:
  - Mapped Phase 5 API error codes (`title_length`, `slug_required`, `slug_format`, `slug_conflict`, `content_required`, `invalid_image_url`, `category_name_required`, `category_not_found`, `reorder_failed`) to user-friendly messages and form field targets.

### 5. Verification & Tests
- Authored unit test suite in `apps/web/test/rich-text.test.tsx` (6 tests passing):
  - Renders null on null/empty doc.
  - Renders paragraphs, headings (H1-H3), bullet lists, ordered lists, blockquotes, inline code, and code blocks as semantic React elements.
  - Renders links with `target="_blank"` and `rel="noopener noreferrer nofollow"`.
  - Renders images with responsive styling and valid `src` and `alt`.
  - Verified source code contains zero `dangerouslySetInnerHTML`.
  - Verified `RichTextEditor` uses `immediatelyRender: false`.
- Ran full test suite across monorepo:
  - `tools/lint-rules`: 26 tests passed.
  - `@userhq/db`: 4 tests passed.
  - `@userhq/api`: 419 tests passed.
  - `@userhq/web`: 68 tests passed.
  - Typecheck passed cleanly across all workspaces.
