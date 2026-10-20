---
name: UserHQ
description: A welcoming, precise home for customer feedback and product progress.
colors:
  primary: "#087F75"
  primary-text: "#066A62"
  ink: "#0F182A"
  paper: "#F6F8F7"
  white: "#FFFFFF"
  mist: "#EAF0ED"
  slate: "#53645F"
  line: "#D8E2DE"
  input-line: "#BDCDC6"
  selection: "#E1F1ED"
typography:
  headline:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.025em"
  working-title:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  welcome:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  welcome-wide:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  richtext-h1:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  richtext-h2:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  richtext-h3:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
rounded:
  inline-code: "4px"
  code-block: "6px"
  pill: "9999px"
  control: "12px"
  surface: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  badge-neutral:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 8px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  navigation-selected:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

## Overview

**Creative North Star: "A good listener, with a clear plan."**

UserHQ feels human, attentive, and capable. The supplied face mark introduces warmth; precise type, quiet paper surfaces, and calm teal actions keep attention on customers and the work ahead. This adapts the supplied brand identity to a working application rather than reproducing its brand book.

**Key Characteristics:**

- Warm identity, calm working surfaces.
- Clear hierarchy and compact, readable controls.
- Customer identity has priority inside tenant portals.

## Colors

Calm Teal (#087F75) marks UserHQ actions, focus rings, and the HQ wordmark suffix. Its deeper text companion (#066A62) keeps links and selected navigation readable on pale surfaces. Ink (#0F182A) carries headings, primary content, and the face mark. The canvas is a green-tinted paper (#F6F8F7) with white working surfaces; green-neutral slate (#53645F) carries secondary content. Mist groups quiet information and pale teal (#E1F1ED) identifies selected application navigation. Boundaries use #D8E2DE, with the stronger #BDCDC6 on inputs.

**The Face Color Rule.** The supplied face and favicon are always #0F182A on the current light interface, regardless of tenant accent or operating-system theme. For a future dark interface, use #E8EEF7 as the face color against a dark canvas. This recommendation does not activate a dark theme or recolor the current light interface.

**The Tenant Identity Rule.** Product accent overrides continue to own primary actions, foreground contrast, focus rings, and entity avatars. UserHQ brand colors belong to the UserHQ mark and attribution, not a replacement for a customer's logo or name.

**The Readable Color Rule.** Body and placeholder text meet 4.5:1 contrast; large text and essential graphical affordances meet 3:1. Pale teal is a selection surface; readable ink or primary text belongs on top of it.

## Typography

Manrope is the product voice. Space Grotesk gives headings and the wordmark a distinctive, confident rhythm. Headings use balanced wrapping; body copy uses relaxed leading. Standard working headings are compact (24px); the welcome heading grows from 36px to 48px. Controls use semibold 14px labels, with 16px mobile inputs to avoid browser zoom.

Both Latin variable fonts are self-hosted under `public/fonts/` with their SIL Open Font Licenses. Assets come from Fontsource's Manrope and Space Grotesk variable distributions. Other scripts fall back to the system sans-serif without blocking rendering.

## Layout

Working screens keep existing information architecture and content density. App and portal containers use a readable centered maximum width (1024px); dashboard content fills the space beside a fixed desktop navigation column (240px). Shell headers are 64px tall. Mobile drops the sidebar into the existing navigation drawer and keeps the workspace selector usable.

Use close spacing within a control group and generous space between tasks. Welcome and sign-in screens may breathe more, but their sign-in action remains immediately visible. Responsive composition must tolerate long customer names and avoid horizontal scrolling.

## Elevation & Depth

**The Quiet Surface Rule.** Paper grounds the application. White surfaces and thin neutral boundaries organize content; do not add a shadow to a bordered card. Existing dialogs and popovers retain their functional elevation. Keep decoration out of task surfaces.

The welcome and sign-in entrance settles once over 500ms with a slight vertical move and resolving blur. Content is visible from the beginning. Reduced motion substitutes a gentle 60ms opacity change.

**The Motion Serves the Task Rule.** Pointer-opened dialogs use 220ms opacity and 0.97-to-1 scale, with a 140ms exit. Their scrims fade in 160ms and out 120ms. Drawers enter from their own left edge over 240ms and exit over 180ms. Menus grow from the Radix trigger origin over 160ms, exiting in 100ms. Shared buttons and vote controls acknowledge a pointer press with a 0.98 scale over 120ms; surrounding layout stays still.

Use `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for feedback and surface arrivals, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` for drawers, and `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` when a symmetric curve is needed. `--motion-feedback` is 120ms. Keyboard-opened surfaces and navigation resolve immediately. Under reduced motion, spatial travel and scaling give way to 60ms opacity; presses retain color feedback. FAQ expansion retains its functional grid technique for pointer use, resolves immediately for keyboard/reduced motion, and keeps collapsed answers inert.

Public portal tab changes may fade only the committed content region from 0.82 to 1 opacity over 140ms (0.97 to 1 over 60ms with reduced motion). Keep the shell stable. Never delay or intercept the router. Initial loads, keyboard/history navigation, filters/search/query changes, nested articles/posts, and frequent admin navigation do not receive page choreography. Rapid navigation cancels the previous fade. Existing Sonner toasts and drag feedback retain their own behavior.

## Shapes

Controls have gently curved corners; larger surfaces use the slightly more generous surface radius. Pills belong to compact tags, icon controls, and scrollbar thumbs. Rich-text inline code and code blocks use the smaller code radii. The supplied single-color face retains its original proportions and clipped 145-unit viewBox. Do not redraw or stretch it. The source contains an out-of-frame subpath; local SVG overflow is hidden to preserve the intended visible face.

## Components

The shared `UserHQBrand` pairs a 32px face mark with a two-color Space Grotesk wordmark. Compact portal attribution uses a 20px mark and 14px type. Mark imagery is decorative when adjacent to the accessible brand name. Root metadata points to the local SVG favicon; tenant-specific icon metadata remains intact.

Primary buttons use the active semantic accent and white text; hover lowers brightness to 95% and the pressed state lowers it to 90%. Outline buttons and inputs use white backgrounds and visible neutral strokes. Neutral badges use mist with ink text, a pill silhouette, and compact semibold labels. Inputs retain error, disabled, and read-only states. Keyboard focus uses a 2px accent indicator and clear offset. Selection, carets, and scrollbars draw from the same token system; tables use tabular numerals.

Dashboard selected navigation uses pale teal with deeper teal text and semibold weight. Tenant headers retain their own entity logos. Portal attribution is deliberately small and subordinate to the customer brand.

## Do's and Don'ts

- **Do** keep the supplied face and the two-color wordmark consistent.
- **Do** preserve tenant logos, names, accents, and existing behavior.
- **Do** use white working surfaces against the paper background.
- **Do** verify real content, narrow widths, focus, loading, error, and reduced-motion states.
- **Don't** use pale selection colors as body text.
- **Don't** turn working screens into decorative marketing compositions.
- **Don't** add fake customer activity, metrics, or product claims.
