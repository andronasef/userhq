---
phase: quick
plan: 261020-ies
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/globals.css
  - apps/web/app/(app)/page.tsx
  - apps/web/components/dashboard/sidebar.tsx
  - apps/web/public/brand/userhq-mark.svg
  - apps/web/public/favicon.svg
  - apps/web/DESIGN.md
  - apps/web/.impeccable/design.json
  - CHANGELOG.md
autonomous: true
requirements: [USER-CALM-TEAL, USER-LOGO-FACE]
must_haves:
  truths:
    - UserHQ uses the approved Calm Teal accent, soft green canvas, and pale teal selections.
    - Every supplied UserHQ face asset uses the fixed light-mode ink color independently of tenant branding.
    - Typography, layout, behavior, and tenant color overrides remain intact.
  artifacts:
    - path: apps/web/app/globals.css
      provides: Calm Teal semantic tokens
    - path: apps/web/public/brand/userhq-mark.svg
      provides: Fixed ink face
    - path: apps/web/DESIGN.md
      provides: Approved palette and documented dark face recommendation
  key_links:
    - from: apps/web/components/dashboard/sidebar.tsx
      to: apps/web/app/globals.css
      via: Semantic accent and selection variables
---

<objective>
Apply the user-approved Calm Teal direction to the current UserHQ interface. Keep the existing brand shape and product behavior while replacing the previous purple and coral identity colors. The app remains light mode; record #E8EEF7 as the recommended face color for a future dark mode.
</objective>

<context>
@.planning/STATE.md
@apps/web/app/globals.css
@apps/web/components/userhq-brand.tsx
@apps/web/DESIGN.md
</context>

<tasks>
<task type="auto">
  <name>Apply Calm Teal consistently to interface tokens, identity assets, and design documentation</name>
  <files>apps/web/app/globals.css, apps/web/app/(app)/page.tsx, apps/web/components/dashboard/sidebar.tsx, apps/web/public/brand/userhq-mark.svg, apps/web/public/favicon.svg, apps/web/DESIGN.md, apps/web/.impeccable/design.json, CHANGELOG.md</files>
  <action>Use #087F75 for the primary accent and focus ring, #F6F8F7 for the application canvas, #E1F1ED for selected surfaces, #D8E2DE for borders, and #0F182A for foreground ink and the logo face. Choose compatible muted and input tones with readable contrast. Rename the previous hue-specific brand variables to brand-accent and brand-selection, updating their interface consumers. Remove the old ornamental coral dot and obsolete decorative color tokens. Recolor the supplied mark and favicon so the face is always #0F182A in light mode; keep its shape and white facial details intact. Preserve the existing Manrope and Space Grotesk typography, responsive structure, application behavior, and tenant color override paths. Update DESIGN.md and its Impeccable sidecar together so both describe the approved palette and its semantic roles. Document #E8EEF7 only as the recommended dark-mode face color, without adding dark-mode product behavior. Add a concise Changed entry to CHANGELOG.md. Follow the parent-loaded Impeccable context and craft floor. Inspect the rendered welcome and sign-in surfaces at desktop and mobile sizes, and inspect selected navigation and tenant override wiring.</action>
  <verify>
    <automated>bun run lint && bun run --filter '@userhq/web' typecheck && bun run --filter '@userhq/web' test && bun run --filter '@userhq/web' build</automated>
    <human-check>Render desktop and mobile pages; confirm teal actions and selections, fixed ink logo faces, readable focus and text contrast, and intact tenant branding.</human-check>
  </verify>
  <done>The current interface and static identity assets use the approved palette; design artifacts agree; the changelog records the change; automated checks pass and rendered desktop/mobile review reveals no color or layout regression.</done>
</task>
</tasks>

<verification>
Run the repository's existing lint, web typecheck, web test, and vinext build commands. Inspect changed tokens and all their consumers. Confirm no API, authorization, data, or tenant override behavior changed.
</verification>

<success_criteria>
Approved Calm Teal colors appear consistently, the light-mode face is #0F182A everywhere, the dark-mode face recommendation is documented, and existing application behavior remains intact.
</success_criteria>

<output>
Create 261020-ies-SUMMARY.md in this quick-task directory after implementation and verification.
</output>
