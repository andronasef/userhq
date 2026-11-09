---
type: execute
autonomous: true
task: 261109-loc
title: Multi-Language Platform UI & Entry Localization
---

# Multi-Language Platform UI & Entry Localization

## User Request & Intent
1. Localize the platform UI to 13 languages: English (`en`), Arabic (`ar`, RTL), German (`de`), Spanish (`es`), French (`fr`), Portuguese (`pt`), Russian (`ru`), Hindi (`hi`), Filipino (`fil`), Indonesian (`id`), Japanese (`ja`), Korean (`ko`), and Chinese Simplified (`zh`).
2. Detect user language automatically (?lang= query > userhq_locale cookie > browser Accept-Language/navigator.languages > fallback).
3. Add language selector in appropriate places (Portal header, App dashboard header).
4. Support Arabic RTL direction dynamic switching (`dir="rtl"`).
5. Allow workspace/product owners to configure enabled locales in Product Settings.
6. Provide an optional multi-locale editor tab interface for Roadmap items, Changelog entries, and FAQ questions, with fallback indicators for untranslated content on the public portal.

## Architecture & Scope
1. **Types & Schema (`@userhq/types`, `@userhq/db`)**:
   - `packages/types/src/i18n.ts`: Locale catalog, normalization, RTL mapping, `ProductLocalesConfigSchema`.
   - Add `locales` to products and `translations` JSONB to `changelog_entries`, `faq_questions`, and `roadmap_items`.
   - Migration `0025_green_spot.sql`.
2. **API (`@userhq/api`)**:
   - Pass through and validate `locales` on product details and updates.
   - Pass through and validate `translations` on Changelog, FAQ, and Roadmap admin services and portal controllers.
3. **Web Platform (`apps/web`)**:
   - `apps/web/lib/i18n/`: Complete typed dictionary for 13 languages, resolver, and `I18nProvider` with client-side detection & cookie persistence.
   - `LanguageSwitcher`: Dropdown with native language names and check indicators.
   - Settings: "Languages & Localization" card in `apps/web/app/dashboard/[ws]/[product]/settings`.
   - Entry locale editor tabs: `EntryLocaleTabs` component integrated into Changelog Studio, FAQ dialog, and Roadmap modal.
   - Public portal: Support `useI18n()`, portal tabs translation, and untranslated fallback badge.
4. **Verification**:
   - Types and unit tests (`bun test packages/types/test/i18n.test.ts`).
   - API build (`bun run --filter @userhq/api build`).
   - Web build / typecheck (`bun run --filter @userhq/web typecheck` / build).
   - Atomic commits adhering to GSD standards.
