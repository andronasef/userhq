---
status: complete
reviewed: 2026-11-10
implementation_commit: 03b8390
---

# Multi-Language Platform & Entry Localization Summary

## 1. Overview & Objectives Delivered
The localization foundation and reviewed admin workflows support 13 target languages, including Arabic direction switching, automatic browser language detection with cookie/query cascade overrides, platform-wide language switchers, and product entry translation capabilities:
- **Supported Locales (13)**: English (`en`), Arabic (`ar`, RTL), German (`de`), Spanish (`es`), French (`fr`), Portuguese (`pt`), Russian (`ru`), Hindi (`hi`), Filipino (`fil`), Indonesian (`id`), Japanese (`ja`), Korean (`ko`), Chinese Simplified (`zh`).
- **Detection Cascade**: `?lang=` / `?locale=` URL query parameter > `userhq_locale` cookie > `Accept-Language` / `navigator.languages` > product default locale > `en`.
- **Bidirectional Support**: Sets `dir="rtl"` and `lang` on document root and aligns inputs, alignments, and icons dynamically.
- **Entry Multi-Language Editor**: Workspace owners can configure enabled product languages and write translations for **Roadmap**, **Changelog**, and **FAQ** entries with visual translated/untranslated status indicators.
- **Fallback Guarantee**: If an entry has no translation for the visitor's language, it displays the preserved original/source-language content with an **Original** badge.

---

## 2. Key Changes Across Packages

### A. `@userhq/types`
- Created `packages/types/src/i18n.ts` containing:
  - `SUPPORTED_LOCALES` and `LOCALE_CATALOG` metadata (name, nativeName, dir).
  - `ProductLocalesConfigSchema` (`defaultLocale`, `enabledLocales`).
  - Helper functions `normalizeLocale` (handles dialects like `pt-BR`, `es-419`, `tl`) and `isRtl`.
- Updated schemas to include optional `translations` / `locales`:
  - `ProductDetailSchema`, `UpdateProductInputSchema`, `PublicPortalProductSchema`.
  - `ChangelogTranslationSchema`, `AdminChangelogEntrySchema`, `PublicChangelogEntrySchema`.
  - `FaqTranslationSchema`, `AdminFaqQuestionSchema`, `PublicFaqQuestionSchema`.
  - `RoadmapTranslationSchema`, `AdminRoadmapItemSchema`, `PublicRoadmapItemSchema`.
- Unit tests written and passing in `packages/types/test/i18n.test.ts`.

### B. `@userhq/db`
- Added JSONB `locales` column to `products` table in `packages/db/src/schema/tenancy.ts`.
- Added JSONB `translations` column to:
  - `changelog_entries` in `packages/db/src/schema/changelog.ts`.
  - `faq_questions` in `packages/db/src/schema/faq.ts`.
  - `roadmap_items` in `packages/db/src/schema/roadmap.ts` (adhering strictly to ROAD-12 zero-join public portal architecture).
- Generated Drizzle migration `packages/db/migrations/0025_green_spot.sql`.

### C. `@userhq/api`
- Extended API controllers and services to save, update, select, and return `locales` and `translations`:
  - `ProductsController` & `PortalController` for product locale configs.
  - `ChangelogService` & `PortalChangelogController` for changelog entry translations.
  - `FaqService` & `PortalFaqController` for FAQ question translations.
  - `RoadmapService` & `PortalRoadmapController` for roadmap item translations.

### D. `@userhq/web`
- **I18n Foundation**:
  - Dictionaries for all 13 languages in `apps/web/lib/i18n/dictionaries.ts`.
  - React context provider `apps/web/lib/i18n/context.tsx` with client-side detection cascade, dynamic `dir`, and `useI18n()` hook.
  - Mounted `<I18nProvider>` in root `apps/web/app/layout.tsx`.
- **Navigation & Language Switchers**:
  - Reusable dropdown `<LanguageSwitcher />` in `apps/web/components/language-switcher.tsx`, mounted in dashboard header and portal frame.
  - Localized dashboard navigation labels and public portal tabs.
- **Product Settings**:
  - Created `ProductLocalesForm` in `apps/web/app/dashboard/[ws]/[product]/settings/product-locales-form.tsx` allowing product owners to set default language and toggle enabled portal languages.
- **Entry Authorship**:
  - Reusable `EntryLocaleTabs` with translation status dots and RTL indicators.
  - Integrated into `ChangelogEditor`, `FaqQuestionDialog`, and `RoadmapItemModal`.
- **Public Portal Display**:
  - Localized timeline, article, FAQ accordion, and roadmap card/modal with "Original" fallback indicator when untranslated.

---

## 3. Verification & Quality Gates
- **Typecheck**: `bun run typecheck` passed with 0 errors across `@userhq/types`, `@userhq/db`, `@userhq/web`, and `@userhq/api`.
- **Tests**:
  - `@userhq/types`: 39 tests passed.
  - `@userhq/web`: 338 tests passed (including contrast sweep and accessibility guards).
  - Lint rules: 26 passed.
- **Package Builds**:
  - `@userhq/types`: built successfully.
  - `@userhq/db`: built successfully.
  - `@userhq/api`: built successfully.


## 4. Admin review and commit finalization — 2026-11-10

Implementation commit: `03b8390` — `feat(i18n): localize admin workflows and guard default-language changes`.

Two independent reviews covered the pending changes against `d1b5fb1`. See [261109-loc-REVIEW.md](261109-loc-REVIEW.md) for separate Standards and Spec findings. The standards review reported three findings; the spec review reported three, with the FAQ validation defect overlapping. All were addressed within the reviewed pending-change scope.

The final change adds dictionary-backed admin labels, dialogs and notifications across roadmap, changelog, FAQ, product/workspace settings, team/invites, API keys and webhooks. The default-language dialog now requires a completed impact preview for the selected target, displays translated retry controls on failure and ignores stale responses after cancellation. Meaningful FAQ answer validation was restored, internal notes have their own label, and the webhook URL helper now correctly requires public HTTPS. Affected user/API/LLM guides were updated alongside implementation.

Fresh verification after fixes:

- `bun run test`: **1,253 passed** — lint-rule tests 26; shared types 39; DB 7; API 843; web 338. No failures.
- `bun run typecheck`: all four workspaces passed.
- `bun run lint`: passed with existing warnings; unused imports were removed from the affected API-key/webhook files.
- `bun run --filter '@userhq/web' build`: vinext production build passed with bundler warnings.
- `git diff --check`: passed.

Limits: no live browser interaction or visual Arabic RTL/layout review was performed. The new confirmation tests render controlled component states, rather than exercising an asynchronous browser sequence. The review covers pending changes and does not certify exhaustive translation of untouched helper/error copy across the entire platform. No release tag, deployment or push was requested or performed.
