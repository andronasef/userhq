---
type: quick
description: Apply the supplied UserHQ brand spirit to the web application
autonomous: true
files_modified:
  - PRODUCT.md
  - DESIGN.md
  - CHANGELOG.md
  - apps/web/app/globals.css
  - apps/web/app/layout.tsx
  - apps/web/public/brand/userhq-mark.svg
  - apps/web/public/favicon.svg
  - apps/web/components/userhq-brand.tsx
  - apps/web/components/header-brand.tsx
  - apps/web/components/dashboard/sidebar.tsx
  - apps/web/components/dashboard/mobile-nav.tsx
  - apps/web/components/portal/portal-frame.tsx
  - apps/web/app/(app)/page.tsx
  - apps/web/app/(app)/login/page.tsx
must_haves:
  truths:
    - UserHQ-owned entry and application surfaces express the supplied identity through a consistent face mark, typography, ink, indigo, and restrained warm accents.
    - Tenant portals retain their own names, logos, accent colors, navigation, and behavior.
    - The interface remains usable on desktop and mobile with accessible contrast, focus, and reduced-motion support.
  artifacts:
    - path: DESIGN.md
      provides: Durable rules for the adapted UserHQ identity and tenant boundaries
    - path: apps/web/components/userhq-brand.tsx
      provides: Reusable accessible UserHQ mark and wordmark
  key_links:
    - from: apps/web/app/globals.css
      to: shared application surfaces
      via: Existing semantic color and typography tokens
    - from: apps/web/components/userhq-brand.tsx
      to: header, dashboard, mobile navigation, and portal attribution
      via: Shared brand component
---

<objective>
Adapt the spirit of the user-provided UserHQ brand guide to the existing product, using Impeccable autonomously. Preserve current product behavior and tenant branding while replacing generic UserHQ presentation with a coherent, precise identity.
</objective>

<context>
@.planning/STATE.md
@AGENTS.md
@/Users/andrew/.t3/userdata/attachments/28febd89-abff-4511-ac75-ba4270ef5da2-ab0072f5-98c0-4e0b-8a87-0574032a5ee8-html.html

Scope: shared tokens, supplied face logo and favicon, header/dashboard/mobile brand, portal attribution, home and login entry surfaces. Use ink #10172A, indigo #5B5CF6, coral #FF6B4A, aqua #24C8B4, paper #F6F7FB, and the guide's Manrope/Space Grotesk typographic character. Inspect actual SVG geometry before extracting it. Make product-appropriate adaptations rather than reproducing the brand document layout. Preserve all pre-existing dirty changes and coordinate with other work in the shared checkout.
</context>

<tasks>

<task type="tracer">
  <name>Carry the supplied identity into one real application entry</name>
  <files>apps/web/app/globals.css, apps/web/app/layout.tsx, apps/web/public/brand/userhq-mark.svg, apps/web/public/favicon.svg, apps/web/components/userhq-brand.tsx, apps/web/components/header-brand.tsx</files>
  <action>Follow the loaded Impeccable context, new-work guidance, and craft floor. Inspect incumbent UI and the rendered brand reference. Extract the supplied single-color face into a clean local SVG and create an accessible reusable UserHQ mark/wordmark with sizing suitable for shell and compact attribution use. Adapt semantic tokens to paper, ink, and indigo with restrained coral/aqua use. Retain tenant token overrides and readable primary text. Carry the guide's font hierarchy using locally hosted assets or already available tooling, and preserve readable fallbacks. Register the local favicon through root metadata. Wire the brand into the existing HeaderBrand fallback while leaving its active project rendering intact. Prove the real entry renders with the new assets before expanding.</action>
  <verify><automated>bun run --filter '@userhq/web' typecheck</automated><human-check>Render the home entry and inspect the supplied mark, font loading, favicon, semantic colors, and focus behavior at desktop and mobile widths.</human-check></verify>
  <done>The real UserHQ entry visibly renders the adapted identity, the local mark and icon load, and active tenant/project headers retain their identities.</done>
</task>

<task type="auto">
  <name>Extend the identity across existing product touchpoints</name>
  <files>apps/web/components/dashboard/sidebar.tsx, apps/web/components/dashboard/mobile-nav.tsx, apps/web/components/portal/portal-frame.tsx, apps/web/app/(app)/page.tsx, apps/web/app/(app)/login/page.tsx</files>
  <action>Use the shared brand component in existing UserHQ dashboard/sidebar and mobile navigation positions, and in the portal's Powered by attribution. Adapt home and OAuth login presentation with the guide's warm, assured character and useful hierarchy. Keep Operate surfaces precise and restrained, and preserve all routes, session handling, OAuth callbacks, return paths, tenant names/logos/accents, and factual copy. Use existing content and controls rather than invented claims. Verify narrow widths, long tenant names, keyboard focus, contrast, and motion preferences. Treat shared styling carefully so tenant portal action colors continue to come from the tenant accent.</action>
  <verify><automated>bun run --filter '@userhq/web' test && bun run --filter '@userhq/web' typecheck</automated><human-check>Inspect home, login, dashboard shell, and a tenant portal at approximately 1440px and 390px. Exercise navigation and sign-in entry and confirm tenant branding survives.</human-check></verify>
  <done>Every in-scope UserHQ touchpoint uses one coherent identity without horizontal overflow, lost controls, or tenant branding regressions.</done>
</task>

<task type="auto">
  <name>Document the durable brand rules and finish verification</name>
  <files>PRODUCT.md, DESIGN.md, CHANGELOG.md</files>
  <action>Capture confirmed product context and the adapted identity in Impeccable's durable artifacts, including palette roles, typography, logo sizing, spacing, accessibility, surface modes, and the boundary between UserHQ branding and tenant customization. Add a concise categorized changelog entry. Review the complete diff against pre-existing dirty work. Batch any defects found in rendered desktop/mobile inspection, then rerun the affected checks. Record actual validation and any external environment limitation in the quick-task summary through the parent workflow.</action>
  <verify><automated>bun run --filter '@userhq/web' test && bun run --filter '@userhq/web' typecheck && bun run lint</automated><human-check>Look at the final rendered states together and verify that the documented visual rules match the shipped interface.</human-check></verify>
  <done>Durable product/design context and changelog describe the actual adaptation, checks pass or have a precise documented pre-existing limitation, and visual desktop/mobile verification is complete.</done>
</task>

</tasks>

<success_criteria>
The supplied UserHQ identity is recognizable throughout the scoped web surfaces; tenant branding and functionality remain intact; design documentation and changelog are updated; automated and rendered desktop/mobile checks have been completed.
</success_criteria>
