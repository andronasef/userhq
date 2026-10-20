---
name: UserHQ
description: A welcoming, precise home for customer feedback and product progress.
colors:
  primary: "#5B5CF6"
  primary-text: "#4D4ED8"
  ink: "#10172A"
  paper: "#F6F7FB"
  white: "#FFFFFF"
  mist: "#E9ECF5"
  slate: "#59647A"
  line: "#DCE1ED"
  input-line: "#C7CFDF"
  lavender: "#EEEDFF"
  coral: "#FF6B4A"
  aqua: "#24C8B4"
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
    backgroundColor: "{colors.lavender}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
---

## Overview

**Creative North Star: "A good listener, with a clear plan."**

UserHQ feels human, attentive, and capable. The supplied face mark introduces warmth; precise type, quiet paper surfaces, and clear indigo actions keep attention on customers and the work ahead. This adapts the supplied brand identity to a working application rather than reproducing its brand book.

**Key Characteristics:**

- Warm identity, calm working surfaces.
- Clear hierarchy and compact, readable controls.
- Customer identity has priority inside tenant portals.

## Colors

Electric indigo marks UserHQ actions and identity. Its darker text companion supports readable links and selected navigation. Ink carries headings and primary content; slate carries secondary content on paper or white. Mist groups quiet information and lavender identifies selected application navigation. Coral is a small warm punctuation; aqua is reserved for meaningful progress, not decorative text.

**The Tenant Identity Rule.** Product accent overrides continue to own primary actions, foreground contrast, focus rings, and entity avatars. UserHQ brand colors belong to the UserHQ mark and attribution, not a replacement for a customer's logo or name.

**The Readable Color Rule.** Body and placeholder text meet 4.5:1 contrast; large text and essential graphical affordances meet 3:1. Never use coral or aqua as small text on white.

## Typography

Manrope is the product voice. Space Grotesk gives headings and the wordmark a distinctive, confident rhythm. Headings use balanced wrapping; body copy uses relaxed leading. Standard working headings are compact (24px); the welcome heading grows from 36px to 48px. Controls use semibold 14px labels, with 16px mobile inputs to avoid browser zoom.

Both Latin variable fonts are self-hosted under `public/fonts/` with their SIL Open Font Licenses. Assets come from Fontsource's Manrope and Space Grotesk variable distributions. Other scripts fall back to the system sans-serif without blocking rendering.

## Layout

Working screens keep existing information architecture and content density. App and portal containers use a readable centered maximum width (1024px); dashboard content fills the space beside a fixed desktop navigation column (240px). Shell headers are 64px tall. Mobile drops the sidebar into the existing navigation drawer and keeps the workspace selector usable.

Use close spacing within a control group and generous space between tasks. Welcome and sign-in screens may breathe more, but their sign-in action remains immediately visible. Responsive composition must tolerate long customer names and avoid horizontal scrolling.

## Elevation & Depth

**The Quiet Surface Rule.** Paper grounds the application. White surfaces and thin neutral boundaries organize content; do not add a shadow to a bordered card. Existing dialogs and popovers retain their functional elevation. Keep decoration out of task surfaces.

The welcome and sign-in entrance settles once over 500ms with a slight vertical move and resolving blur. Content is visible from the beginning. Reduced-motion preferences remove the animation.

## Shapes

Controls have gently curved corners; larger surfaces use the slightly more generous surface radius. Pills belong to compact tags, icon controls, and scrollbar thumbs. Rich-text inline code and code blocks use the smaller code radii. The supplied single-color face retains its original proportions and clipped 145-unit viewBox. Do not redraw or stretch it. The source contains an out-of-frame subpath; local SVG overflow is hidden to preserve the intended visible face.

## Components

The shared `UserHQBrand` pairs a 32px face mark with a two-color Space Grotesk wordmark. Compact portal attribution uses a 20px mark and 14px type. Mark imagery is decorative when adjacent to the accessible brand name. Root metadata points to the local SVG favicon; tenant-specific icon metadata remains intact.

Primary buttons use the active semantic accent and white text; hover lowers brightness to 95% and the pressed state lowers it to 90%. Outline buttons and inputs use white backgrounds and visible neutral strokes. Neutral badges use mist with ink text, a pill silhouette, and compact semibold labels. Inputs retain error, disabled, and read-only states. Keyboard focus uses a 2px accent indicator and clear offset. Selection, carets, and scrollbars draw from the same token system; tables use tabular numerals.

Dashboard selected navigation uses lavender with deeper indigo text and semibold weight. Tenant headers retain their own entity logos. Portal attribution is deliberately small and subordinate to the customer brand.

## Do's and Don'ts

- **Do** keep the supplied face and the two-color wordmark consistent.
- **Do** preserve tenant logos, names, accents, and existing behavior.
- **Do** use white working surfaces against the paper background.
- **Do** verify real content, narrow widths, focus, loading, error, and reduced-motion states.
- **Don't** use coral or aqua for low-contrast body text.
- **Don't** turn working screens into decorative marketing compositions.
- **Don't** add fake customer activity, metrics, or product claims.
