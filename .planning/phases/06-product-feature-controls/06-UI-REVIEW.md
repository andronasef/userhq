# Phase 6 — UI Review

**Audited:** 2026-11-08
**Baseline:** 06-UI-SPEC.md
**Screenshots:** not captured (no dev server on 3000, 5173 or 8080); code-only audit. The 320/375/768 overflow backstop and the keyboard and screen-reader backstop are NOT verified.
**Interaction captures:** off (workflow.ui_interaction_capture is false); interaction findings are code-derived.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every contract string (rows, notice, dialog, toast, state page, empty states) matches verbatim |
| 2. Visuals | 3/4 | Sidebar and settings match; unavailable-state action and tab-less layouts are unverified visually |
| 3. Color | 3/4 | Accent restrained to declared roles; `accent-foreground` checkbox and `bg-card` badge are per spec; no render to confirm light-dark() |
| 4. Typography | 3/4 | `font-semibold` and `text-sm` or `text-base` used throughout, with no `font-medium`; rendered sizes unverified |
| 5. Spacing | 3/4 | Scale followed; `size-3 mr-1` badge icon and `gap-0.5` are existing precedents; 320px wrap unverified |
| 6. Experience Design | 2/4 | One dashboard "View portal" link is not gated, and the hidden-module notice is not confirmed on Categories or Statuses pages |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Ungated "View portal" link in the Board empty state** (WARNING) — `apps/web/app/dashboard/[ws]/[product]/board/board-view.tsx:99` links to `portalHref(ws, product)` with no Board check. With Board off, an admin lands on the landing fallback or the unavailable page, and U6 says hide it. Fix: render the action only when `product.features.board` is true, or pass a `boardEnabled` prop.
2. **Board notice missing on Categories** (WARNING) — `HiddenModuleNotice` is only wired into `board/page.tsx`, `board/[number]/post-detail-view.tsx`, `roadmap-view.tsx`, `faq/page.tsx` and both changelog components. The spec lists Categories under Board, and no Categories file contains a notice. Fix: add `<HiddenModuleNotice module="board" />` to the Categories dashboard page (locate it; the grep found no dedicated file), or confirm it lives in a shared component.
3. **Sidebar hidden state is mouse-only for sighted keyboard users** (WARNING) — the `EyeOff` icon plus `sr-only` text is correct, but the `title` attribute is the only visible explanation. This meets the spec, but the spec's a11y backstop (screen-reader walkthrough, 320/375/768 visual check) has not been executed. Fix: run the dev server and execute the backstop checks before sign-off.

Additional minor items:
- The UI-SPEC Checker Sign-Off is still unchecked ("Approval: pending") even though the front matter says `approved`.
- The concurrency case (a stale checkbox when two admins save) is accepted by the spec as unresolved; no change.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- `product-features-form.tsx:32-50`: row names and descriptions are verbatim. Intro, helper, "Save features", "Features updated", "Saving…" and "Keep visible" match. The dialog title, description and confirm label for one, several and all-off cases match, including the Board notifications suffix.
- `hidden-module-notice.tsx:7-12`: all four sentences are verbatim, and the CTA reads "Turn on in settings".
- `[ws]/[product]/page.tsx`: "Nothing is available here right now", the body with `{name}`, and "Visit {company}" all match.
- `public-roadmap-board.tsx:61-64`: the Board-off body and the suppressed button match.
- `faq-portal.tsx:166-173`: the "Explore feedback" action is dropped when Board is off.
- `faq-not-found-prompt.tsx:27`: "No answers match your search" is present.
- No generic labels were found in the new code.

### Pillar 2: Visuals (3/4)
- The settings row anatomy matches the contract: a label-wrapped row, `min-h-11`, a badge showing the saved state, and the all-off helper with an `Info` icon and `role="status"` (not the Alert neutral variant).
- The sidebar's `EyeOff` icon, `sr-only` text and `title` are on all four modules; Statuses and Settings are undecorated.
- The notice banner uses `bg-muted`, an outline badge on `bg-card`, and the button is `w-full sm:w-auto` and stacks on mobile.
- The unavailable page is rendered inside the portal frame (the layout supplies the frame) with HTTP 200 and `noindex`.
- Deduction: the "Visit {company}" action uses `buttonVariants` on a Next `Link` with an external `websiteUrl`, which works but was not rendered or checked for focus appearance.
- Deduction: no screenshots, so hierarchy and the 320px layout are unconfirmed.

### Pillar 3: Color (3/4)
- No hardcoded hex values or rgb() in the new files. The accent is used only for the Save button, focus rings and the notice link (the button is outline; `--primary-text` text on `bg-muted` was not confirmed).
- Hidden-state signals are muted (outline badge, `text-muted-foreground` icon), as the spec requires.
- The post-spec dark mode switches `--ring` to `#14b8a6`; the row focus outline uses `outline-ring` and follows it. The `bg-card` badge on the `bg-muted` notice should be visually checked in dark mode.
- Deduction: contrast and the 60/30/10 split cannot be confirmed without renders.

### Pillar 4: Typography (3/4)
- The settings section uses `text-base font-semibold` for the `h2`, and `text-sm font-semibold` for labels with `text-sm` helper text. `font-medium` count in the form is 0. The unavailable page `h1` comes from `StatePage`.
- Sizes in use across the new surfaces: `text-sm`, `text-base`, `text-2xl` (existing board `h1`), plus the badge `text-xs`. This is within the declared four.
- Deduction: no renders to confirm line heights and wrapping.

### Pillar 5: Spacing (3/4)
- The section uses `border-t pt-8 mt-8 scroll-mt-24`; rows use `gap-2` between rows and `p-4 gap-4`; the notice uses `mb-6 p-4 gap-2 sm:gap-4`; the state page uses `py-12`. All are on the declared scale.
- Off-scale-ish values: `size-3 mr-1` (12px icon, 4px margin) and `gap-x-2 gap-y-1`, which are allowed. The sidebar's `gap-0.5` is existing code.
- The 44px row target is met through `min-h-11`.
- Deduction: overflow at 320, 375 and 768 is unchecked.

### Pillar 6: Experience Design (2/4)
Covered:
- Pristine, dirty, pending, error and stale handling: Save is disabled unless dirty, the fieldset is disabled while pending and until hydration (`ready`), and a destructive Alert appears on error with the user's choices kept. The confirm dialog fires only when turning something off. After a successful save, `reset`, a toast and `router.refresh()` run.
- `keepDirtyValues` handles server-refresh merges.
- Partial mutations send only dirty keys, never the whole product.
- The portal landing uses `redirect()` (307) for Board-off, with a missing-features check that falls through to the unavailable page.
- `PortalTabs` hides the bar below 2 tabs and gates Activity on board and user.
- Roadmap and FAQ Board-off empty states are handled as specified.

Gaps:
- **WARNING**: `board-view.tsx:99` has the ungated "View portal" link in the Board empty state (see fix 1).
- **WARNING**: the Categories dashboard page shows no Board notice (see fix 2). I did not locate a dedicated Categories page file, so this needs confirmation. The Statuses page has no notice by spec.
- **WARNING**: the checks `post-actions-menu.tsx` ("View on portal" gated by `boardEnabled`) pass, but `post-form-dialog.tsx:328` and the activity feed's "Explore feedback" link (`activity-feed.tsx:62-63`) still build portal links without a visible Board gate. The activity feed is only reachable when Board is on (the tab is hidden otherwise), so this is low risk.
- Backstops not executed: keyboard-only walkthrough, screen reader labels, and the 320, 375 and 768px visual check.

---

## Registry Safety

Skipped: no `components.json`, and no third-party registries are declared.

## Files Audited
- `apps/web/app/dashboard/[ws]/[product]/settings/page.tsx`
- `apps/web/app/dashboard/[ws]/[product]/settings/product-features-form.tsx`
- `apps/web/components/dashboard/sidebar.tsx`
- `apps/web/components/dashboard/hidden-module-notice.tsx`
- `apps/web/components/portal/portal-tabs.tsx`
- `apps/web/app/[ws]/[product]/page.tsx`
- `apps/web/lib/portal-features.ts`
- `apps/web/components/post/post-actions-menu.tsx`
- `apps/web/app/dashboard/[ws]/[product]/board/board-view.tsx`
- `apps/web/components/roadmap/public-roadmap-board.tsx`
- `apps/web/components/faq/faq-portal.tsx`
- `apps/web/components/faq/faq-not-found-prompt.tsx`
- Notice call sites: `board/page.tsx`, `board/[number]/post-detail-view.tsx`, `roadmap-view.tsx`, `faq/page.tsx`, and the changelog components
