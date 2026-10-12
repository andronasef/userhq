# Phase 05: Changelog & FAQ - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-12
**Phase:** 05-Changelog & FAQ
**Areas discussed:** Changelog Feed & Article Layout, Editor & Image Insertion, FAQ Navigation & Search, Publishing Workflow & Attribution

---

## Changelog Feed & Article Layout

### How should the public changelog feed be visually presented?

| Option | Description | Selected |
|---|---|---|
| Connected timeline | Vertical line with date badges and tag pills connecting entries (classic changelog aesthetic, e.g. Linear/Raycast) | ✓ |
| Standalone cards | Distinct bordered cards with shadow for each release note (matches Feedback & Roadmap card styling) | |
| Minimal article stream | Clean unboxed blog-like stream with subtle dividers | |
| You decide | Agent picks best aesthetic | |

**User's choice:** Connected timeline
**Notes:** Creates a modern developer-tool release feed aesthetic.

### How should long changelog entries with multiple paragraphs or images be displayed in the feed?

| Option | Description | Selected |
|---|---|---|
| Expandable inline ("Read more") | Feed shows preview snippet; clicking unfolds full content right in place, with a permalink icon to share | ✓ |
| Full content inline | Every release note renders fully in the timeline feed regardless of length | |
| Truncate with page link | Short snippet in feed with "Read full update →" linking to the dedicated permalink page | |
| You decide | Agent discretion | |

**User's choice:** Expandable inline ("Read more")
**Notes:** Keeps the timeline clean while allowing readers to read full notes without leaving the feed.

### How should the dedicated changelog permalink page (/{ws}/{product}/changelog/[slug]) be presented?

| Option | Description | Selected |
|---|---|---|
| Centered standalone article | Clean single-column article page with "← All updates" breadcrumb, tags, and full OpenGraph social cards | ✓ |
| Article with sidebar | Dedicated article page with a right-hand sidebar linking to recent updates in the same product | |
| Modal over feed | Opens as an overlay modal when clicked from feed, but renders full standalone article on direct link or refresh | |
| You decide | Agent discretion | |

**User's choice:** Centered standalone article
**Notes:** Clean reading layout optimized for deep linking and social sharing.

### How should tags (New, Improved, Fixed) be displayed on changelog entries?

| Option | Description | Selected |
|---|---|---|
| Interactive tag pills (?tag=...) | Colored badges (New/Improved/Fixed) at the top of entries that let visitors filter the timeline by tag | |
| Static colored badges | Visual badges only on the entry (New = emerald, Improved = blue, Fixed = amber); filtering deferred to v2 per requirements | ✓ |
| Subtle outline pills beside date | Minimal monochromatic outline tags beside the release date marker | |
| You decide | Agent discretion | ✓ (Chosen) |

**User's choice:** You decide
**Notes:** Builder discretion selected static colored badges to align with REQUIREMENTS.md deferring tag filtering to v2 (CHLG-V2-01).

---

## Editor & Image Insertion

### How should the rich-text formatting toolbar be positioned and displayed in the admin editor?

| Option | Description | Selected |
|---|---|---|
| Sticky top toolbar | Fixed header bar above editor with icon buttons (H1/H2, Bold, Italic, Lists, Link, Image); predictable and mobile-friendly | ✓ |
| Floating bubble menu | Minimal canvas where formatting toolbar appears directly above selected text (Notion/Medium style) | |
| Hybrid | Sticky top bar for headings & image insertion + floating bubble menu for inline text styling | |
| You decide | Agent discretion | |

**User's choice:** Sticky top toolbar
**Notes:** Provides visible and reliable formatting actions.

### How should image insertion and uploading work in the editor?

| Option | Description | Selected |
|---|---|---|
| Dual upload (File button + Drag-and-drop/Paste) | File button opens file dialog + drag/drop and clipboard paste | |
| Image button only | Toolbar image button opens file dialog | |
| Remote URLs only | Images inserted via remote http/https URLs with URL input and optional alt text; direct file upload disabled | ✓ |

**User's choice:** Remote URLs only
**Notes:** The user specified that image uploads are disabled in this version; remote image URLs are supported.

### How should draft saving and publishing actions be structured in the editor?

| Option | Description | Selected |
|---|---|---|
| Explicit save buttons with dirty indicator | Dedicated Save Draft and Publish buttons with Unsaved changes indicator | ✓ |
| Debounced auto-save | Background auto-save every 3s to draft state with timestamp indicator | ✓ |
| Save & Preview modal | Preview button lets admin preview full formatted post before publishing | ✓ |
| All of them | Hybrid combining all three features | ✓ (Chosen) |

**User's choice:** All of them!
**Notes:** Admin gets explicit Save Draft / Publish buttons + dirty tracking + background auto-save to draft + live preview.

### Should the rich-text editor support markdown shortcuts / auto-formatting while typing?

| Option | Description | Selected |
|---|---|---|
| Full markdown shortcuts + essential blocks | Auto-conversion for #, -, >, code blocks in addition to toolbar | ✓ |
| Strict toolbar clicks only | Formatting via toolbar buttons only | |
| Basic formatting only | Headings and text styling only | |
| You decide | Agent discretion | |

**User's choice:** Full markdown shortcuts + essential blocks
**Notes:** Enables rapid markdown authoring for product release notes.

---

## FAQ Navigation & Search

### How should FAQ categories and questions be laid out on the public portal?

| Option | Description | Selected |
|---|---|---|
| Left sidebar category list + stacked sections | Left sticky list of categories with counts; main area displays all categories with smooth-scrolling | ✓ |
| Horizontal category tabs (pills) | Category filter pills across top | |
| Single-column grouped accordions | List of category headers with accordions, no sidebar | |
| You decide | Agent discretion | |

**User's choice:** Left sidebar category list + stacked category sections
**Notes:** Clean documentation-style navigation.

### How should FAQ question accordions behave when clicked and when visited via permalink?

| Option | Description | Selected |
|---|---|---|
| Multi-open accordions with highlight scroll | Expand multiple questions simultaneously; permalinks auto-scroll and highlight | ✓ |
| Single-open accordion | Only one question open per category at a time | |
| All expanded by default | All questions expanded initially | |
| You decide | Agent discretion | |

**User's choice:** Multi-open accordions with highlight scroll
**Notes:** Supports deep linking (#q-[id]) with smooth visual accent pulse.

### How should the FAQ search input execute searches across questions and answers?

| Option | Description | Selected |
|---|---|---|
| Instant client-side search with matching text highlight | Real-time filter across question titles and answer texts with highlighted keywords | ✓ |
| Debounced server-side search | API query with Postgres full-text search | |
| You decide | Agent discretion | |

**User's choice:** Instant client-side search with matching text highlight
**Notes:** Zero-latency search for immediate answers.

### How should the "Didn't find it?" button transition the user to the feedback board's new-post form?

| Option | Description | Selected |
|---|---|---|
| Navigate to feedback board with prefilled title | Directs to /{ws}/{product}?new=true with search query prefilled | ✓ |
| Open feedback modal directly on FAQ page | Opens modal on FAQ page without navigating | |
| Simple navigation link | Standard link to board | |
| You decide | Agent discretion | |

**User's choice:** Navigate to feedback board with prefilled title
**Notes:** Seamless loop closing from FAQ search to feedback submission.

---

## Publishing Workflow & Attribution

### Can admins customize or backdate the published date of a changelog entry?

| Option | Description | Selected |
|---|---|---|
| Allow custom / backdated release date | Defaults to current date/time, but admin can pick specific date/time | ✓ |
| Strictly automated publish date | Locked to timestamp when Publish button clicked | |
| You decide | Agent discretion | |

**User's choice:** Allow custom / backdated release date
**Notes:** Critical for historical release entries and precise launch sync.

### How should author attribution be presented on public changelog entries?

| Option | Description | Selected |
|---|---|---|
| Product brand only | Published by product team with product logo/name | ✓ |
| Admin author attribution | Displays admin name and OAuth avatar | |
| Admin author with toggle | Defaults to product brand with per-entry toggle | |
| You decide | Agent discretion | |

**User's choice:** Product brand only
**Notes:** Keeps public release notes branded to the product rather than individual admin profiles.

### How should permalink slugs for changelog entries be generated?

| Option | Description | Selected |
|---|---|---|
| Auto-generated from title with admin edit | Prefilled from title (e.g. "improved-export-performance") and editable before publish | ✓ |
| Date-prefixed slug | Formatted like "2026-10-12-improved-export-performance" | |
| Fixed UUID / short ID | Short random ID | |
| You decide | Agent discretion | |

**User's choice:** Auto-generated from title with admin edit
**Notes:** Clean, human-readable SEO slugs with customization.

### How should admins reorder FAQ categories and questions in the dashboard?

| Option | Description | Selected |
|---|---|---|
| Drag-and-drop with drag handles | Reorders categories and questions using @dnd-kit/react fractional ranks | ✓ |
| Up / Down arrow buttons | Step buttons per row | |
| Numeric display order input | Direct integer inputs | |
| You decide | Agent discretion | |

**User's choice:** Drag-and-drop with drag handles
**Notes:** Reuses existing `@dnd-kit/react` patterns from status management and roadmap Kanban.

---

## the agent's Discretion

- **D-04 (Tag interaction):** Static colored badges on changelog entries without filter controls, adhering to the v2 requirement deferral (CHLG-V2-01).

## Deferred Ideas

- **CHLG-V2-01**: Visitor filtering of changelog timeline by tag.
- **CHLG-V2-02**: RSS feed for product changelog.
- **LOOP-V2-02**: Linking changelog entries to roadmap items / posts they shipped.
- **CHLG-V2-IMAGE-UPLOAD**: Local file upload and automatic WebP conversion for changelog images.
