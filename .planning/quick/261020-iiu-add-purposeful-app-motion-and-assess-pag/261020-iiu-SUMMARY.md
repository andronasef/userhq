---
status: complete
quick_id: 261020-iiu
implementation_commit: f27bd85
---

# Purposeful application motion

The read-only opportunity sweep is recorded in OPPORTUNITIES.md: six gated opportunities and five deliberate rejections. Impeccable implementation adds shared pointer-led dialogs/confirmations, drawer/menu continuity, subtle shared button and vote press feedback, accessible FAQ expansion, and occasional public portal section fades. No dependency added.

## Behavior

- Dialog opacity/scale0.97 in220ms and out140ms; scrim160/120ms. Drawer from its own left edge240/180ms. Menu from trigger origin160/100ms. Press scale0.98/120ms.
- Global lightweight input modality makes keyboard-triggered surfaces immediate. Reduced motion uses60ms opacity instead of spatial motion; presses retain color feedback.
- Public top-level pointer tab navigation fades committed content140ms (reduced60ms). No routing interception, wait or hidden content. Header/footer stable. Initial, keyboard, history, query, nested and admin navigation remain immediate; animations cancel on superseding routes.
- FAQ answers become inert/aria-hidden when collapsed. Isolated browser verification exposed an existing nested copy-link button; made it a sibling to prevent invalid DOM/hydration and keyboard behavior.
- DESIGN.md, design sidecar and CHANGELOG.md describe actual motion. Calm Teal and fixed navy face unchanged.

## Verification

-114 web tests across15 files passed, including6 meaningful navigation eligibility tests; web typecheck, repository lint, git diff --check and vinext production standalone build passed.
- Isolated temporary Vite harness imports real primitives with actual stylesheet. Browser verified pointer dialog entry, closing Presence retention, restored trigger focus, keyboard immediate dialog, drawer/menu motion, safe confirmation default focus, press scale, reduced60ms opacity without travel, FAQ inert state and no nested buttons. No page errors.
- Actual public portal verified140ms pointer and60ms reduced fades, stable header geometry, no initial/keyboard/back/query fade, no mobile overflow and no page errors. Both desktop and390px captures inspected after settling; actual active tab matches route.
- Impeccable detector ran once; only incumbent neutral quotation border and explicitly pinned Space Grotesk warnings. No new detector finding.
- Ephemeral scripts/captures/logs: /tmp/userhq-motion-review. Existing T3 screenshot mismatch fallback reused repository Playwright. Private admin end-to-end auth paths were not exercised; shared components tested in isolation and built.

## Execution refinements

Input modality is components/motion-input.tsx; portal eligibility uses lib/portal-motion.ts and lib/portal-motion.test.ts, and PortalSectionMotion has its own component. Browser behavior tests replace source-mirroring class assertions. Temporary QA server stopped after verification. No API/data/auth changes.
