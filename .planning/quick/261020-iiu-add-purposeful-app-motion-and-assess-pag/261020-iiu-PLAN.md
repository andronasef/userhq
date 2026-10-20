---
phase: quick-261020-iiu
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/globals.css
  - apps/web/app/layout.tsx
  - apps/web/components/motion-input.tsx
  - apps/web/components/ui/dialog.tsx
  - apps/web/test/motion.test.tsx
  - apps/web/components/ui/confirm-dialog.tsx
  - apps/web/components/ui/drawer.tsx
  - apps/web/components/ui/dropdown-menu.tsx
  - apps/web/components/ui/button.tsx
  - apps/web/components/faq/faq-accordion-item.tsx
  - apps/web/components/portal/portal-section-motion.tsx
  - apps/web/components/portal/portal-frame.tsx
  - apps/web/lib/portal-motion.test.ts
  - apps/web/DESIGN.md
  - CHANGELOG.md
autonomous: true
requirements: [MOTION-01, MOTION-02, MOTION-03]
estimate:
  tokens: 24000
  raw_tokens: 24000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - Pointer users see restrained, interruptible overlay continuity and immediate button feedback throughout the shared application primitives.
    - Keyboard navigation remains immediate and reduced motion replaces spatial effects with gentle opacity or color feedback.
    - Public section changes may receive a short post-commit fade while the portal shell remains stable; frequent admin navigation and query changes remain immediate.
    - Calm Teal, the light-mode face color '#0F182A', tenant branding, content, and authorization behavior remain intact.
  artifacts:
    - path: apps/web/components/motion-input.tsx
      provides: Root-level pointer/keyboard modality tracking without rendering application content conditionally
    - path: apps/web/app/globals.css
      provides: Shared motion curves, state-based primitive animation, and intentional reduced-motion alternatives
    - path: apps/web/components/portal/portal-section-motion.tsx
      provides: Scoped pointer navigation intent and interruptible post-commit content fade
  key_links:
    - from: apps/web/app/layout.tsx
      to: apps/web/components/motion-input.tsx
      via: Root client effect sets a document modality attribute before interaction state changes
    - from: apps/web/components/ui/dialog.tsx
      to: apps/web/app/globals.css
      via: Radix data-state drives real entrance and exit keyframes
    - from: apps/web/components/portal/portal-section-motion.tsx
      to: apps/web/components/portal/portal-frame.tsx
      via: Only an owned portal-tab pointer activation can animate the committed content region
---

<objective>
Add purposeful motion across UserHQ through the existing shared primitives and assess page transitions per the user's request. MOTION-01 covers occasional surfaces and press feedback; MOTION-02 covers accessibility and interruption; MOTION-03 covers a narrow public-section transition where it aids continuity.

Purpose: Make state changes feel connected while preserving the speed of a daily-use customer feedback application.
Output: Production CSS/client motion, focused behavior coverage, browser evidence, and updated design/changelog documentation. No new package is required.
</objective>

<context>
@AGENTS.md
@apps/web/PRODUCT.md
@apps/web/DESIGN.md
@.planning/quick/261020-iiu-add-purposeful-app-motion-and-assess-pag/OPPORTUNITIES.md
@apps/web/components/tab-nav.tsx
</context>

<motion_thesis>
Focal moment: an occasional surface arrives from its actual spatial relationship: a drawer from the left, a menu from its trigger, a centered dialog with a small depth change. Continuity: preserve the portal shell and soften only an explicitly chosen public section after its route has committed. Feedback: a 0.98 pointer press confirms activation. Budget: CSS transform/opacity, no dependency, no delayed navigation, no decorative movement of readable data. Keep the existing welcome moment and Sonner's behavior.
</motion_thesis>

<tasks>

<task type="tracer">
  <name>Task 1: Prove an accessible pointer-opened dialog through the shared motion system</name>
  <files>apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/components/motion-input.tsx, apps/web/components/ui/dialog.tsx, apps/web/test/motion.test.tsx</files>
  <action>Implement MOTION-01 and MOTION-02 on one complete dialog path. Add shared --ease-out cubic-bezier(0.23, 1, 0.32, 1), --ease-in-out cubic-bezier(0.77, 0, 0.175, 1), and --ease-drawer cubic-bezier(0.32, 0.72, 0, 1) tokens. Add a tiny client component in the root layout that listens to pointerdown and keydown in capture phase, writes the current input modality to the document, removes listeners on unmount, and leaves SSR content visible. Keyboard begins as the safe immediate path. Give Dialog real Radix data-state keyframes: content opacity and scale 0.97 to 1 over 220ms --ease-out; reverse exit 140ms; overlay opacity 160ms in and 120ms out. Preserve the CSS translation used for centered positioning. Let Radix retain closing content until the actual animation finishes. Gate spatial/opacity motion to pointer modality; keyboard-triggered open/close remains immediate. Under reduced motion use a gentle 60ms opacity change with no scale or slide. Add focused regressions for the modality policy and primitive wiring using the existing Vitest setup; do not install DOM or motion packages just for tests. Inspect the rendered existing dialog flow before and after changing it.</action>
  <verify>
    <automated>bun run --filter '@userhq/web' test -- test/motion.test.tsx</automated>
    <human-check>Use the established browser verification path on an existing create/edit dialog: pointer open, close, reopen while exiting, Escape, Tab focus, keyboard-triggered open, reduced motion, desktop and mobile. Observe the real animation and focus restoration; screenshot timing alone is insufficient.</human-check>
  </verify>
  <done>The existing dialog flow opens and closes with defined state animations for pointer input, remains immediately usable by keyboard, has a gentle reduced-motion path, restores focus, and survives rapid reversal without disappearing or trapping interaction.</done>
</task>

<task type="auto">
  <name>Task 2: Carry the proven vocabulary through shared overlays, button feedback, and FAQ state</name>
  <files>apps/web/components/ui/confirm-dialog.tsx, apps/web/components/ui/drawer.tsx, apps/web/components/ui/dropdown-menu.tsx, apps/web/components/ui/button.tsx, apps/web/components/faq/faq-accordion-item.tsx</files>
  <action>Expand MOTION-01 and MOTION-02 using Task 1's already-defined shared CSS. Apply the dialog and overlay hooks to ConfirmDialog without changing its pending/error/focus protection. Animate Drawer from translateX(-100%) to its resting position over 240ms --ease-drawer, with symmetric 180ms exit and the shared overlay. Animate DropdownMenuContent opacity/scale 0.97 to 1 over 160ms --ease-out, exit 100ms, with transform-origin var(--radix-dropdown-menu-content-transform-origin). Preserve collision and focus behavior. Apply pointer-only Button press scale 0.98 over 120ms --ease-out, including asChild consumers; disabled controls and keyboard activation do not scale. Avoid hover travel; keep existing state colors and focus rings. Use reduced-motion opacity for surfaces and color-only press feedback. Retain FAQ's established grid expansion, assign the shared 200ms curve, and make reduced-motion expansion and chevron rotation immediate while preserving legible state/color feedback. Each effect uses explicit properties, never a catch-all transition. Reuse the CSS rules from Task 1 rather than adding another vocabulary.</action>
  <verify>
    <automated>bun run --filter '@userhq/web' test</automated>
    <human-check>Open the mobile drawer and a dropdown with pointer and keyboard; dismiss by outside click and Escape. Rapidly reverse open state. Check confirmation pending behavior and FAQ expand/collapse in normal and reduced motion. Confirm no visible animation on keyboard-opened overlays.</human-check>
  </verify>
  <done>All shared occasional surfaces have coherent real entry/exit behavior, pointer buttons acknowledge presses, and FAQ retains its readable expansion while every keyboard/reduced-motion path remains accessible and immediate where specified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add only earned public-section continuity and verify the complete app motion</name>
  <files>apps/web/components/portal/portal-section-motion.tsx, apps/web/components/portal/portal-frame.tsx, apps/web/lib/portal-motion.test.ts, apps/web/DESIGN.md, CHANGELOG.md</files>
  <behavior>
    - A primary unmodified pointer activation on an owned portal section tab can fade the newly committed content from opacity 0.8 to 1 over 140ms --ease-out.
    - Initial rendering, current-tab activation, modified clicks, keyboard activation, query-only navigation, deep content links, admin navigation, and browser history navigation do not animate.
    - A later navigation cancels an earlier animation and stale intent; content is visible and interactive if WAAPI is absent or throws.
    - Reduced motion uses at most a 60ms opacity change, with no content translation or scale.
  </behavior>
  <action>Implement MOTION-03 with a small client content wrapper exported from portal-tabs.tsx and consumed by PortalFrame around only its existing children region, keeping header/tabs/footer stable. Record pointer navigation intent only within PortalTabs for a primary unmodified activation of one of that portal's actual section hrefs. Do not change shared TabNav semantics, intercept links, prevent default navigation, delay the router, capture a page snapshot, or make content initially invisible. On a matching committed pathname animate that wrapper with WAAPI using the behavior contract; consume the intent once, expire or clear unrelated intent, cancel previous animation before starting another and on cleanup, and guard missing browser APIs. Add meaningful tests around intent eligibility, initial render, route matching, reduced-motion choice, and interruption using existing tooling. Document the shared curves, durations, input policy, reduced-motion alternatives, and deliberately rejected route choreography in DESIGN.md. Add a concise Changed changelog entry. Run the existing lint/typecheck/test/build commands and perform a final visual/interaction pass across public portal sections, mobile navigation, a dialog, dropdown, and FAQ. Preserve Calm Teal, the light-mode face color, tenant accents, content, and all auth boundaries.</action>
  <verify>
    <automated>bun run --filter '@userhq/web' test -- lib/portal-motion.test.ts</automated>
    <human-check>Navigate public Feedback/Roadmap/Changelog/FAQ sections by pointer, keyboard, history, and rapid repeated clicks. Confirm the content changes immediately, only eligible pointer changes fade, the shell stays still, filters/search do not reanimate, and the reduced-motion path is gentle.</human-check>
  </verify>
  <done>Only deliberate public section pointer navigation receives a short cancellable fade after commit; initial, keyboard, query, history, and frequent admin paths remain immediate. Documentation records the final policy and all required automated/browser checks are recorded.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| Browser input to motion intent | Pointer and pathname data influence presentation only. |
| Root client effect to SSR shell | Modality enhancement must not hide content or alter authorization. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-261020-iiu-01 | Denial of service | Portal content animation lifecycle | low | mitigate | Cancel on interruption/unmount; visible default content; no delay or navigation interception. |
| T-261020-iiu-02 | Tampering | Motion event listeners | low | mitigate | Scope intent to the current portal's known section hrefs; remove listeners; never interpret input as markup or code. |
| T-261020-iiu-SC | Tampering | Package installs | high | mitigate | No package installs are required; use CSS and browser WAAPI. |
</threat_model>

<source_audit>
| Source | Item | Coverage |
|---|---|---|
| GOAL | User requests app-wide purposeful motion and page transitions if needed | Tasks 1–3; shared primitives cover the app, narrow portal fade earns its place. |
| REQ | MOTION-01: useful motion; MOTION-02: accessibility; MOTION-03: route assessment | Tasks 1–3. This quick task has no assigned roadmap requirement IDs. |
| RESEARCH | Finder sweep, gate constraints, exact recipes, rejected high-frequency/data motion | OPPORTUNITIES.md and all task actions. No phase RESEARCH.md applies. |
| CONTEXT | Preserve approved Calm Teal, light face #0F182A, tenant identity; add animation autonomously | Task 3 preservation and final review; no CONTEXT.md or deferred decision is introduced. |
</source_audit>

<verification>
Run from repository root: bun run lint; bun run --filter '@userhq/web' typecheck; bun run --filter '@userhq/web' test; bun run --filter '@userhq/web' build. Inspect actual desktop/mobile output through the established browser path. Record normal/reduced motion, pointer/keyboard, rapid reversal, focus behavior, and portal navigation checks. Do not infer rendered motion quality from source assertions alone.
</verification>

<success_criteria>
Shared overlays and pointer presses feel connected without slowing task execution. Public section content has only a justified, interruption-safe fade. No new dependency, palette change, blanket page reveal, data movement, or navigation delay is introduced. Required verification passes and its limits are accurately reported.
</success_criteria>

<output>
Create .planning/quick/261020-iiu-add-purposeful-app-motion-and-assess-pag/261020-iiu-SUMMARY.md on completion. The parent orchestrator owns state updates and commits.
</output>

## Execution refinements

Portal navigation eligibility lives in lib/portal-motion.ts with six meaningful helper tests. Input-modality and overlay lifecycle behavior are verified in a temporary browser harness rather than source-mirroring motion.test.tsx assertions. PortalSectionMotion is a dedicated component. FAQ copy-link is made a sibling control to resolve the existing nested-button hydration error exposed by interactive verification.
