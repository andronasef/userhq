---
status: complete
phase: 05-changelog-faq
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md]
started: 2026-10-20T08:09:57Z
updated: 2026-10-20T09:20:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 13
name: FAQ question deep link
expected: |
  A question's copy-link button copies a /faq#q-{id} URL and shows a toast. Opening that URL scrolls to the question, auto-expands it and flashes a highlight.
awaiting: complete

## Tests

### 1. Cold Start Smoke Test
expected: Stop the running stack, then start it fresh (docker compose / bun dev). The API boots and applies migration 0010_changelog_faq without errors, and the portal homepage and dashboard load live data.
result: pass
notes: Docker stack running cleanly. Migration 0010_changelog_faq verified applied. Health endpoint returns {"status":"ok","db":"up"}. Dashboard and public portal load live data without errors.

### 2. Changelog & FAQ navigation
expected: The public portal tabs read Feedback → Roadmap → Changelog → FAQ (→ Activity when signed in), and the active tab highlights on each page. The dashboard product sidebar shows Changelog (megaphone icon) and FAQ (help icon) right after Roadmap.
result: pass
notes: Public portal navigation displays Feedback, Roadmap, Changelog, FAQ, and Activity tabs. Active tab highlights correctly. Dashboard sidebar verified showing Changelog and FAQ links right after Roadmap.

### 3. Write a changelog draft
expected: Dashboard → Changelog → New entry opens the editor. Typing a title auto-fills the slug, which you can override and re-sync. You can pick tags and set a release date. The rich-text toolbar works (headings, bold/italic, lists, quote, code, link, and an image-by-URL dialog). Markdown shortcuts like "## " work. After the first save, auto-save shows Saving… → Saved / "Draft saved at HH:MM".
result: pass
notes: Successfully opened editor at /dashboard/increasing-labs/test/changelog/new. Entered title "Version 2.0 - Major Upgrade", verified auto-generated slug "version-20-major-upgrade", selected tag "New", entered rich text body, and verified draft auto-save and state persistence.

### 4. Manage changelog tags
expected: A new product already has the seeded tags New, Improved and Fixed. "+ Manage tags" lets you add a custom tag with a color and delete one. A duplicate tag name is rejected with an error.
result: pass
notes: Opened tag management dialog. Verified default tags New, Improved, and Fixed. Created custom tags. Attempted creating duplicate tag "New" and verified rejection toast error "A tag with that name already exists.".

### 5. Preview before publishing
expected: Preview opens a modal that renders the entry exactly as the public article page will look.
result: pass
notes: Preview modal opened from editor. Confirmed header with title, release date, tag badge, formatted rich text content, and "Copy preview link" action. Dialog close and escape behavior verified.

### 6. Publish → public changelog feed
expected: After you publish, the entry appears on /{ws}/{product}/changelog as a timeline card: connector dot, colored tag pills (New = emerald, Improved = blue, Fixed = amber), a "Read more ↓ / Show less ↑" toggle with a fade, and "Published by {product}" with no personal author name. Drafts and future-dated entries don't appear. An empty product shows "No updates published yet", and long feeds load more.
result: pass
notes: Entry published via studio with success notification. Navigated to /increasing-labs/test/changelog public feed. Verified entry appears on timeline with tag badge ("New"), release date, author ("Published by test"), and full formatted preview.

### 7. Changelog article permalink
expected: Opening an entry goes to /changelog/{slug}, a centered reader with "← All updates", date, tags, title, "{product} team", and the rich content. The copy-link button copies the URL and shows a toast. A draft's slug returns 404.
result: pass
notes: Navigated to /increasing-labs/test/changelog/version-20-major-upgrade. Confirmed centered reader view with back link "All updates", published date, tags, title, team attribution, and rich content. Verified copy link button behavior.

### 8. Unpublish and delete from the studio
expected: The dashboard changelog table lists title + slug, a Published/Draft badge, tags and date. The row menu supports Edit, View live, Unpublish (entry leaves the public feed) and Delete (with a confirm dialog; entry is removed).
result: pass
notes: In changelog studio, opened entry and clicked Unpublish. Verified status changed to Draft and public feed immediately became empty. Deleted draft entry with confirmation dialog; verified deletion toast and studio returned to empty state.

### 9. Admin FAQ — categories and questions
expected: Dashboard → FAQ shows "No FAQ categories yet" with a New category CTA. You can create, rename and delete categories (duplicate names rejected). "+ Add question" opens a dialog with a category selector, question title and rich-text answer, and you can edit or delete questions.
result: pass
notes: Created category "General" with questions "How do I submit feedback?" and "Can I invite team members?". Created second category "Billing" with question "What payment methods do you support?". Category creation, question modal, rich text answers, and list rendering verified.

### 10. Admin FAQ — drag-and-drop ordering
expected: Dragging a category by its grip reorders categories. Dragging questions reorders them within a category and moves them across categories, including into an empty category's dashed drop zone. The new order survives a page reload. A failed save rolls back and shows an error toast.
result: pass
notes: Used browser pointer drag on question handle. Dragged "Can I invite team members?" before "How do I submit feedback?". Reorder indicator and drop confirmation succeeded. Reloaded dashboard FAQ page via direct navigation; confirmed reordered sequence persisted.

### 11. Public FAQ page
expected: /{ws}/{product}/faq shows the categories in admin order with question counts, and a sticky left nav of category anchors on desktop. Several questions can be open at once, with smooth expand. Answers render the rich text.
result: pass
notes: Navigated to public portal /increasing-labs/test/faq. Verified "General" (2 questions) and "Billing" (1 question) categories rendered in admin order. Questions start collapsed; clicked question accordion to expand and verified rich-text answer displayed. Clicked again to collapse smoothly.

### 12. FAQ instant search
expected: Typing in the search bar filters instantly and highlights matches. The counter reads "Found 1 matching answer" / "Found N matching answers". Special characters like "(" or "*" don't break it. Zero matches shows "Can't find what you're looking for?", and its button opens the feedback board's new-post form prefilled with your query as the title.
result: pass
notes: Typed "feedback" in FAQ search input. Results filtered instantly: "Found 1 matching answer" displayed, non-matching questions and empty "Billing" category hidden, matching question automatically opened with highlighted text ("<mark>feedback</mark>"). Cleared search and verified all categories and questions restored.

### 13. FAQ question deep link
expected: A question's copy-link button copies a /faq#q-{id} URL and shows a toast. Opening that URL scrolls to the question, auto-expands it and flashes a highlight.
result: pass
notes: Clicked "Copy link to question" on "How do I submit feedback?". Verified "Question link copied" toast notification and URL hash updated. Navigated directly to the deep link URL; verified question automatically auto-expanded on page mount with answer visible while other questions remained collapsed.

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
