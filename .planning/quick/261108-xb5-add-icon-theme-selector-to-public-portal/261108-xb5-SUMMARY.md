---
phase: quick-261108-xb5
plan: 01
subsystem: appearance
tags: [themes, portal, header, ui]
status: complete
verified-date: 2026-11-09
requires:
  - phase: quick-261108-wst
    provides: Charcoal appearance and theme toggle options
provides:
  - Header dropdown theme toggle in PortalFrame
affects: [public-portals, appearance]
tech-stack:
  added: []
  patterns: [Compact dropdown ThemeToggle in PortalFrame header]
key-files:
  created: []
  modified: [apps/web/components/portal/portal-frame.tsx, apps/web/test/theme-toggle.test.tsx, apps/api/test/browser/appearance.spec.ts, CHANGELOG.md, README.md, docs/user-guide.md]
---

# Public portal header theme selector summary

**The dashboard-style dropdown theme toggle icon is now available directly in the public portal header alongside sign-in / user controls.**

## Scope & Implementation

- **Header Integration**: Added `<ThemeToggle variant="dropdown" />` to `PortalFrame` header actions row in `apps/web/components/portal/portal-frame.tsx`.
- **Public Accessibility**: Visible for all portal visitors (both anonymous and authenticated users) and responsive across desktop and mobile.
- **Full Synchronization**: Shares the same persistent client preference and anti-FOUC theme state with the footer segmented control and platform dashboard. All 4 theme options (System, Light, Dark, Charcoal) are available.
- **Documentation**: Documented in `CHANGELOG.md` under `[Unreleased]`, updated `README.md`, and added guidance in `docs/user-guide.md`.
- **Tests**:
  - Unit test in `apps/web/test/theme-toggle.test.tsx` verifying `PortalFrame` renders the header dropdown trigger and footer segmented control.
  - Browser tests in `apps/api/test/browser/appearance.spec.ts` covering theme selection, keyboard access, mobile responsiveness, and persistence across navigation.
