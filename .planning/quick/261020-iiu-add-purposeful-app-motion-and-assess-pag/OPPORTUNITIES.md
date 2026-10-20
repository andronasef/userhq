# UserHQ animation opportunities

The product is predominantly Operate and Read: customers scan feedback and answers, while admins repeatedly manage content. Existing motion is limited to the welcome entrance, functional FAQ expansion/chevron rotation, loading indicators, and Sonner's own presentation. Dialog classes name utilities that are not defined by the current stylesheet; the drawer and dropdown have no authored state motion. The visual direction remains Calm Teal, with the light-mode face fixed at #0F182A.

## Opportunities

All six candidates passed frequency, purpose, speed, and function. The four gate answers are explicit in the table. Shared curves extend the current motion vocabulary: --ease-out = cubic-bezier(0.23, 1, 0.32, 1); --ease-in-out = cubic-bezier(0.77, 0, 0.175, 1); --ease-drawer = cubic-bezier(0.32, 0.72, 0, 1). Current welcome easing remains unchanged.

| # | Location | Today | Purpose | Frequency | Suggested motion | Gate: speed / function |
|---|---|---|---|---|---|---|
| 1 | apps/web/components/ui/dialog.tsx:21,41; apps/web/components/ui/confirm-dialog.tsx:67,82 | Named animation utilities have no local definitions, so surfaces appear abruptly. | Preventing a jarring change | Occasional; eligible for pointer use, keyboard activation stays immediate. | Pointer content enters opacity 0→1 and scale 0.97→1, 220ms --ease-out; reverse exit 140ms. Overlay opacity 160ms in/120ms out. Reduced motion: opacity only, 60ms, no scale. | Under 300ms; isolates an occasional action without moving readable page data. Keep focus/pending behavior. |
| 2 | apps/web/components/ui/drawer.tsx:26,47 | Mobile navigation teleports at the left edge. | Spatial consistency | Occasional mobile shell use; keyboard open/close stays immediate. | Pointer drawer translateX(-100%)→0, 240ms --ease-drawer; symmetric exit 180ms. Overlay 160ms in/120ms out. Reduced motion: 60ms opacity, no slide. | Under 300ms; origin and exit identify the same surface, with no blocked interaction. |
| 3 | apps/web/components/ui/dropdown-menu.tsx:29 | Menu has no spatial connection to its trigger. | Spatial consistency | Occasional; frequent keyboard actions remain immediate. | Pointer opacity 0→1 and scale 0.97→1, 160ms --ease-out; exit 100ms. Origin uses var(--radix-dropdown-menu-content-transform-origin). Reduced motion: opacity only, 60ms. | Under 200ms; keeps placement, collision handling, focus, and immediate selection. |
| 4 | apps/web/components/ui/button.tsx:7 | Color feedback exists, but physical press acknowledgment is absent. | Feedback | Tens/day; only near-imperceptible motion is justified. | Pointer-only :active scale(0.98), transform 120ms --ease-out; release retargets to 1. Keyboard activation and reduced motion use color feedback without scale. Disabled controls remain still. | 120ms; two-percent contraction acknowledges the same press without moving surrounding layout. No hover travel is added. |
| 5 | apps/web/components/faq/faq-accordion-item.tsx:86,99 | Expansion already explains state, but its grid/chevron motion lacks a reduced-motion alternative. | State indication | Occasional answer opening; functional state transition is justified. | Keep current 200ms grid expansion, assign --ease-out; chevron transform rotates 0→180deg over 200ms --ease-out. In reduced motion resolve grid/rotation immediately and retain a gentle 60ms opacity/color state cue. | 200ms; preserve the existing functional grid technique rather than add ornamental answer motion. |
| 6 | apps/web/components/portal/portal-tabs.tsx:40; apps/web/components/portal/portal-frame.tsx:99 | Public sections replace the content region while the shell is already structurally stable. | Preventing a jarring change | Occasional section changes only; eligible pointer tabs, excluding keyboard, history, deep links, and query churn. | After the matching route commits, opacity 0.8→1 over 140ms --ease-out, no delay or translation. Reduced motion: at most 60ms opacity. Cancel on superseding navigation; default content is visible. | 140ms; user may read/interact immediately, stable shell never animates. Restricting it avoids routine navigation overhead. |

No new hover effect is suggested. If an implementation adds hover motion, it must be gated by @media (hover: hover) and (pointer: fine), with the same reduced-motion policy.

## Rejected candidates

- Admin shell/core navigation — **frequency gate:** daily repeated navigation should remain immediate; blanket page enter/exit choreography adds latency to a work tool.
- Feedback filters, FAQ search, and query-param changes — **function gate:** users are reading and comparing results; repeated fading or list travel obscures feedback and makes fast input feel slower.
- Roadmap data, vote counts, cards, and list stagger — **function gate:** decorative movement of functional information hinders scanning. Preserve any existing drag-and-drop feedback rather than add travel to resting data.
- Keyboard-opened menus, dialogs, focus jumps, and shortcuts — **frequency/input gate:** keyboard-triggered motion is disqualified; state and focus should resolve immediately.
- Sonner toast entrances and the existing welcome settle — **opportunity check:** these already have motion. A finder should not invent a second presentation system or duplicate an existing entrance.

## Verdict

UserHQ needs a small shared motion vocabulary, concentrated on occasional overlays and clear action feedback. The highest-leverage change is implementing real dialog state animations and the accessibility/input policy once, then carrying it through shared primitives. A narrow public-section fade is justified; app-wide page choreography is not. The finder remains read-only: its implementation handoff is the accompanying GSD quick plan, using Impeccable's animation workflow. A standalone handoff could be invoked as improve-animations plan shared overlay continuity and accessible pointer feedback.
