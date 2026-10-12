# Phase 05: Changelog & FAQ - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 05 delivers customer-facing release communications and self-serve help resources:
1. **Public Changelog Feed & Permalinks**: Connected timeline feed at `/{ws}/{product}/changelog` showcasing published release notes chronologically with expandable inline snippets, tag badges, and standalone permalink article pages (`/{ws}/{product}/changelog/[slug]`) complete with OpenGraph preview metadata.
2. **Admin Changelog Studio**: Rich-text authoring at `/dashboard/{ws}/{product}/changelog` with sticky toolbar, markdown shortcut auto-conversion, remote image URL insertion, tag assignment (seeded with New, Improved, Fixed; admin-customizable), custom release date picker, slug auto-generation with manual override, explicit Save/Publish controls, debounced draft auto-save, and live preview.
3. **Public FAQ Portal & Live Search**: Left-sidebar category navigation with stacked category sections and multi-open question accordions at `/{ws}/{product}/faq`. Instant client-side search across question titles and answer texts with highlighted matching keywords, deep link auto-expansion (`#q-[id]`), and a "Didn't find it?" prompt linking to `/{ws}/{product}?new=true` with prefilled search text.
4. **Admin FAQ Management**: Categorized Q&A editor at `/dashboard/{ws}/{product}/faq` with rich-text answers and smooth drag-and-drop reordering for both categories and questions using `@dnd-kit/react` fractional ranks.

</domain>

<decisions>
## Implementation Decisions

### Changelog Feed & Article Layout
- **D-01:** Changelog feed is presented as a **Connected Timeline** — a vertical line connecting release entries with date markers and tag badges (classic changelog aesthetic, e.g. Linear/Raycast).
- **D-02:** Long changelog entries use **Expandable Inline ("Read more")** in the feed — displays a concise preview snippet that unfolds full content in place upon click, alongside a direct permalink share icon.
- **D-03:** Changelog permalink pages (`/{ws}/{product}/changelog/[slug]`) render as a **Centered Standalone Article** — clean single-column layout with "← All updates" back navigation, tags, and full OpenGraph social cards.
- **D-04:** Entry tags (New, Improved, Fixed) are displayed as **Static Colored Badges** (New = emerald, Improved = blue, Fixed = amber). Tag filtering is deferred to v2 per requirements (CHLG-V2-01).

### Editor & Image Insertion
- **D-05:** Formatting toolbar uses a **Sticky Top Toolbar** fixed above the editor canvas with icon buttons for headings (H1/H2), formatting (bold, italic), lists (bullet, ordered), quotes, code blocks, links, and images.
- **D-06:** Images are inserted via **Remote URLs Only** — local file upload and WebP conversion for changelog images is disabled for this version; images are inserted via remote `http://` / `https://` URLs with a URL input and optional alt text. — **Reversibility:** costly — schema stores remote image URL/alt text in rich text JSONB rather than internal upload file IDs.
- **D-07:** Draft saving and publishing uses a **Comprehensive Hybrid Workflow**:
  - Dedicated **Save Draft** and **Publish** buttons with an "Unsaved changes" dirty indicator.
  - Background **debounced auto-save** (every ~3s when dirty) with a "Draft saved at [time]" indicator.
  - A **Live Preview** modal/toggle showing the exact rendered output before publishing.
- **D-08:** Editor supports **Full Markdown Shortcuts** (auto-conversion of `#`, `-`, `>`, ```` ``` ````) alongside toolbar icon interactions for efficient authoring.

### FAQ Navigation & Search
- **D-09:** Public FAQ layout (`/{ws}/{product}/faq`) features a **Left Sidebar Category List + Stacked Sections** — sticky left navigation showing categories and question counts with smooth-scrolling and URL hash synchronization.
- **D-10:** Questions use **Multi-Open Accordions with Highlight Scroll** — visitors can expand multiple answers simultaneously. Visiting a question link (`#q-[id]`) auto-scrolls, expands the answer, and briefly flashes an accent highlight.
- **D-11:** FAQ search performs **Instant Client-Side Search with Keyword Highlighting** — real-time filtering across question titles and answer texts with matched terms highlighted in place.
- **D-12:** FAQ-07 "Didn't find it?" prompt **Navigates to Feedback Board with Prefilled Title** — links to `/{ws}/{product}?new=true` with the search query prefilled in the new post title input.

### Publishing Workflow & Attribution
- **D-13:** Release date allows **Custom / Backdated Release Dates** — defaults to current timestamp upon publish, but admins can select a specific date/time for historical release notes or precise deployment schedules.
- **D-14:** Public changelog entries show **Product Brand Only** — published under the product name and logo, keeping release updates focused on the company/product rather than individual admin users.
- **D-15:** Permalink slugs are **Auto-Generated from Title with Admin Edit** — slug is auto-derived from the title (e.g. `improved-export-performance`), editable before publishing, and deduplicated if conflicts arise.
- **D-16:** FAQ reordering in the dashboard uses **Drag-and-Drop with Grab Handles** for both categories and questions, powered by `@dnd-kit/react` with fractional ranking.

### Builder Discretion
- **D-04 (Tag interaction):** Static colored badges on entries without client-side filter controls, aligning with the explicit v2 deferral in REQUIREMENTS.md (CHLG-V2-01).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Requirements & Architecture
- `.planning/ROADMAP.md` § "Phase 5: Changelog & FAQ" — Core scope, success criteria, and Tiptap RSC note
- `.planning/REQUIREMENTS.md` — CHLG-01 through CHLG-08, FAQ-01 through FAQ-07
- `.planning/PROJECT.md` — Stack conventions, Next.js / vinext standalone deployment, Drizzle ORM, Better Auth

### Prior Phase Decisions & Patterns
- `.planning/phases/04-dual-layer-roadmap-closing-the-loop/04-CONTEXT.md` — D-04 (fractional ranking with `@dnd-kit/react`), D-05 (portal tabs and layout)
- `.planning/phases/03-feedback-board-conversations/03-CONTEXT.md` — D-01 (dashboard and portal layout patterns), D-07 (card and badge styling)
- `.planning/phases/02-workspaces-products-platform-owner/02-CONTEXT.md` — Category management and tenant isolation patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/portal/portal-tabs.tsx`: Portal navigation bar tabs; add "Changelog" (`/{ws}/{product}/changelog`) and "FAQ" (`/{ws}/{product}/faq`).
- `apps/web/components/dashboard/sidebar.tsx`: Product dashboard navigation; add "Changelog" (`/dashboard/{ws}/{product}/changelog`) and "FAQ" (`/dashboard/{ws}/{product}/faq`).
- `apps/web/components/ui/dialog.tsx`: Radix Dialog used for modals (preview modal, category edit dialogs).
- `apps/web/lib/accent.ts`: Product accent color tokens (`--primary`, `--primary-text`) for highlighting and badge accents.
- `@dnd-kit/react`: Fractional drag-and-drop reordering pattern used in status settings and roadmap board.

### Established Patterns
- **Tenant Isolation**: Every database query and API endpoint scoped by `workspaceId` / `productId`, verified by route guards and cross-tenant tests.
- **Safe Rich Text Rendering**: Store structured JSON/JSONB and render with a strict allowlist component, avoiding raw HTML string injection.
- **Public vs Admin Endpoints**: Separation of public readers (`/{ws}/{product}/...`) and admin-only management endpoints (`/dashboard/...` and `/api/v1/workspaces/:ws/...`).

### Integration Points
- Public portal routes: `apps/web/app/[ws]/[product]/changelog` and `apps/web/app/[ws]/[product]/faq`.
- Dashboard routes: `apps/web/app/dashboard/[ws]/[product]/changelog` and `apps/web/app/dashboard/[ws]/[product]/faq`.
- API endpoints: `/api/v1/workspaces/:ws/products/:prod/changelog` and `/api/v1/workspaces/:ws/products/:prod/faq`.

</code_context>

<specifics>
## Specific Ideas

- The changelog feed embraces a clean, modern developer-tool aesthetic (similar to Linear and Raycast release logs) with a subtle vertical timeline connecting milestones.
- The FAQ page offers instantaneous client-side keyword matching, allowing users to find answers immediately without page reloads.

</specifics>

<deferred>
## Deferred Ideas

- **CHLG-V2-01**: Visitor filtering of the changelog timeline by tag (deferred to v2 in REQUIREMENTS.md).
- **CHLG-V2-02**: RSS feed for changelog entries (deferred to v2 in REQUIREMENTS.md).
- **LOOP-V2-02**: Linking changelog entries to roadmap items / posts they shipped (deferred to v2 in REQUIREMENTS.md).
- **CHLG-V2-IMAGE-UPLOAD**: Server-side WebP image uploads directly from the changelog editor (deferred for v1; remote URLs used).

</deferred>

---

*Phase: 05-changelog-faq*
*Context gathered: 2026-10-12*
