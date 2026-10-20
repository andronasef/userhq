---
phase: quick
plan: 261020-txt
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/db/src/schema/tenancy.ts
  - packages/types/src/tenancy.ts
  - apps/api/src/products/products.controller.ts
  - apps/api/src/portal/portal.controller.ts
  - apps/api/test/products.test.ts
  - apps/web/lib/accent.ts
  - apps/web/lib/accent.test.ts
  - apps/web/components/color-field.tsx
  - apps/web/app/dashboard/[ws]/[product]/settings/product-branding-form.tsx
  - apps/web/app/[ws]/[product]/layout.tsx
  - apps/web/components/portal/product-card.tsx
  - apps/web/components/header-brand.tsx
autonomous: true
requirements: [USER-CHOOSE-BUTTON-TEXT-COLOR]
must_haves:
  truths:
    - Products can store an optional custom accent text color for buttons and elements with accent background.
    - When accent text color is null or unset, it automatically calculates text color based on WCAG contrast (#FFFFFF or #000000).
    - Product branding settings form allows choosing text color on accent/buttons with presets (Auto, White, Black, neutrals/palette) and custom hex input.
    - The branding preview immediately reflects both accent color and text color.
    - Portal layout and styles apply the configured text color to --primary-foreground.
  artifacts:
    - path: packages/db/src/schema/tenancy.ts
      provides: accentTextColor column on products
    - path: packages/types/src/tenancy.ts
      provides: accentTextColor in ProductDetail and UpdateProductInput
    - path: apps/web/lib/accent.ts
      provides: accentTokens and accentStyle with custom foreground support
    - path: apps/web/app/dashboard/[ws]/[product]/settings/product-branding-form.tsx
      provides: Text color selector with live preview and save mutation
---

<objective>
Allow workspace managers to choose the text color on buttons and elements that use the product accent color as background, with presets (Auto, White, Black, palette) and custom hex input, with persistence to the database and portal styling.
</objective>

<tasks>
<task type=\"auto\">
  <name>Add accentTextColor to database schema and generate migration</name>
  <files>packages/db/src/schema/tenancy.ts</files>
  <action>Add optional accentTextColor text column with hex regex check constraint to the products table. Generate drizzle migration.</action>
</task>
<task type=\"auto\">
  <name>Update types and API for accentTextColor</name>
  <files>packages/types/src/tenancy.ts, apps/api/src/products/products.controller.ts, apps/api/src/portal/portal.controller.ts, apps/api/test/products.test.ts</files>
  <action>Expose accentTextColor in ProductDetailSchema, ProductSummarySchema, PublicPortalProductSchema, PublicPortalDirectorySchema, and UpdateProductInputSchema. Update controllers to select and accept accentTextColor in PATCH requests. Add API tests.</action>
</task>
<task type=\"auto\">
  <name>Support custom foreground in accent tokens and update web UI</name>
  <files>apps/web/lib/accent.ts, apps/web/lib/accent.test.ts, apps/web/components/color-field.tsx, apps/web/app/dashboard/[ws]/[product]/settings/product-branding-form.tsx, apps/web/app/[ws]/[product]/layout.tsx, apps/web/components/portal/product-card.tsx, apps/web/components/header-brand.tsx</files>
  <action>Update accentTokens and accentStyle to support customFgHex while retaining auto contrast fallback. Enhance ColorField to support custom presets and an Auto swatch/option. Add text color field to ProductBrandingForm with live preview. Connect portal layout to supply accentTextColor.</action>
</task>
</tasks>
