# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.4.1] - 2026-11-10

### Added

- **Multi-locale Markdown User Guide**: Converted the in-app platform & API guide (`/guide`) to a localized Markdown architecture with complete documentation across all 13 supported languages (`en`, `ar`, `de`, `es`, `fr`, `ja`, `ko`, `pt`, `ru`, `zh`, `fil`, `hi`, `id`), featuring full bidirectional RTL layout support for Arabic, an interactive Swagger API explorer component, categorized navigation, and quick links.
- **Language Switcher in User Menu & Account Settings**: Added a language selection submenu to the user profile avatar dropdown across the entire application and a dedicated language preference card in user `/account` settings, allowing team members and admins to switch their preferred interface language without cluttering the main navigation header.

### Changed

- **Portal interface follows the visitor's language**: The portal UI is shown in the visitor's own language even when that language is not enabled for the product, and the language switcher lists every supported language. A product's enabled languages now only decide which translated content is shown; entries without a translation still fall back to the product's default language.

## [v0.4.0] - 2026-11-10

### Added

- **Multi-Language Platform UI & Entry Localization**: Full bidirectional internationalization supporting 13 languages (English, Arabic RTL, German, Spanish, French, Portuguese, Russian, Hindi, Filipino, Indonesian, Japanese, Korean, and Simplified Chinese). Features automatic visitor language detection (query parameter cascade > `userhq_locale` cookie > browser `navigator.languages` > product default locale > `en`), compact language switchers in header and public portal, product-level language controls in settings, multi-locale authoring tabs in Changelog, FAQ, and Roadmap studios, and seamless public portal fallbacks with an "Original" badge.
- **Server-side portal localization**: Public roadmap, changelog and FAQ endpoints accept `?lang=` and return already-localized text with `resolvedLocale` and `isFallback`; the stored `translations` map is no longer exposed publicly. The portal is limited to the product's enabled languages, the "Original" badge compares against the product's default language, and the visitor's language is read on the server to avoid an English flash and layout shift for right-to-left languages.
- **Localized interface strings**: Visitor-facing portal text, the theme toggle, the user menu and the language-settings form are translated into all 13 languages, and translation keys are now type-checked. Sidebar and portal tab labels that previously always showed English now translate.
- **Default-language change preview**: Changing a product's default language promotes existing translations into the main fields and keeps the previous text as a translation; `GET .../locales/swap-preview?target=<locale>` reports how many entries are promoted or fall back before you commit.
- **Safer language settings**: Translation keys are restricted to supported languages with the same length limits as the main fields, and a product's default language must be one of its enabled languages.

- Product user badges with exact or regex name/value attribution rules, signed links, a product users directory and manual grants/revocation.
- Badge chips on post details and comments.

### Security

- Signed httpOnly guest attribution cookies, verified binding after sign-in, and removal of public self-claim.
- Anchored, capped regex matching, throttled public attribution and timestamp checks for signed links.
- Manual grants require membership or product participation; API keys receive no directory email.

### Upgrade notes

- The merged migration sequence is `0025_green_spot` (localization), `0026_jazzy_wildside` (badging tables), then `0027_badge_rule_key_match_type`. Existing databases from the previous `main` apply all three at API startup. A development database that already applied the separate badging branch's old 0025/0026 history needs migration reconciliation or a fresh disposable database before using this merged history; see the deployment guide.
- Signed rules require `{param}_ts` and HMAC-SHA256 over `value + "." + timestamp`; update link generators.
- Regex rules now match the entire input. Migration 0027 adds the parameter-name match mode; normal startup migration application is sufficient. No new environment variables.

## [v0.3.1] - 2026-11-09

### Added

- **Author Contact & Geolocation in Feedback Triage**: Requests and comments in the workspace dashboard now display the author's verified contact email (with 1-click mailto) and IP-based geographic location (country/city badge) for private workspace admin context.
- **Platform User Guide & Interactive Swagger Explorer**: Dedicated `/guide` route restricted to workspace owners and admins, featuring comprehensive guidance for workspace setup, feedback triage, portal management, and an interactive OpenAPI 3.1 Swagger explorer with cURL, TypeScript, and Python code snippets.
- **Workspace overview tabs**: Requests (All Boards) is now the primary landing tab on `/dashboard/[ws]`, followed by Comments, then Products.
- **Charcoal appearance**: A neutral near-black fourth theme alongside System, Light and the existing navy Dark theme, with saved device preference and readable product accents.
- **Public header theme menu**: Visitors and signed-in customers can choose all four themes from the same compact icon menu used in the dashboard. The footer selector remains available and stays synchronized.

### Fixed

- **Post navigation**: Workspace requests and comments link to the correct dashboard post route and offer a separate public-portal action. Admin board rows and post details also provide public links when Feedback is enabled; old dashboard `/posts` URLs redirect to `/board`.

## [v0.3.0] - 2026-11-08

### Added

- **Workspace feedback dashboard**: Review requests and comments across products, filter and paginate the inbox, reply to customers, and manage shared Needs attention state separately from personal read state.
- **Product feature controls**: Workspace owners and admins can enable Board, Roadmap, Changelog and FAQ independently for each product. Disabled modules are hidden from public navigation and blocked by public API gates while admin management retains the data.
- **Themes**: Light, dark and system appearance across the dashboard and public portals, with readable brand text and focus indicators on normal, muted and tinted surfaces.
- **Browser push**: Notification preferences, product following and same-origin notification click targets, with queued delivery and stale-subscription cleanup.
- **Workspace automation API**: Scoped API keys, product restrictions, integration attribution, feedback exports, and automation for requests, comments, roadmap, changelog, FAQ and product settings.
- **Signed webhooks**: Product-filtered subscriptions, one-time signing secrets, secret rotation, delivery logs, retries, manual redelivery and scheduled changelog publication events.

### Fixed

- API keys deny unclassified routes, cannot impersonate their creators, and enforce tenant and product boundaries. Empty restriction inputs are rejected; malformed stored restrictions deny access.
- Webhook and push delivery validate public HTTPS destinations, pin validated DNS results, reject redirects and bound request duration and response size.
- Push registration rejects endpoint takeover attempts. Account switching with matching browser keys replaces the subscription and discards the previous owner's queued deliveries.
- Inbox replies share the comment pipeline; attention handling, reply visibility and historical attention backfill are consistent across entry points.
- API-key rate limits use shared PostgreSQL storage across API instances. Concurrent integration-actor initialization handles both identity uniqueness constraints.
- Integration tests use owned loopback listeners and wait for PostgreSQL clients to close before deleting temporary databases.

### Upgrade requirements

- **Configure persistent `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` before deploying to production.** The API refuses to start without both; API-backed sign-in will fail while it is unavailable. Reuse the same pair across redeployments. See [deployment configuration](docs/deploy.md#browser-push-vapid-startup-requirement).
- Apply the committed database migrations through the API container's normal startup migration step. Back up the database and uploads before upgrading. Legacy empty product-restriction lists are normalized to unrestricted (`null`) to preserve their previous behavior.

These release notes were added after the published tag; `v0.3.0` continues to identify its original commit.

## [v0.2.2] - 2026-10-26

### Fixed

- **Changelog saving**: Release notes containing uploaded images (or images/links with empty attributes) no longer fail to save with "Check the highlighted fields" (`64bb4cd`).

## [v0.2.1] - 2026-10-23

### Added

- **Legal pages**: Public `/privacy` and `/terms` pages linked from the homepage footer (for the Google OAuth consent screen); `privacy` and `terms` are now reserved workspace slugs (`d156b68`).
- **Device info on feedback**: Capture and display user device info on board posts and comments (`bf1db7b`).
- **Custom button text color**: Product branding now supports a custom button text color (`6aa67d0`).

### Fixed

- **Portal dialog theming**: Product accent colors and ring tokens now propagate to portal dialogs (`81e4651`).

## [v0.2.0] - 2026-10-20

### Added

- **Homepage Hero & Interactive Product Showcase**: Redesigned landing page hero section with atmospheric canvas, radial bloom, and refined typography. Added an interactive tabbed `ProductShowcase` component previewing Feedback, Roadmap, Changelog, and FAQ tabs with simulated real-time interaction and a canonical `/{company}` browser preview pill. Integrated Increasing Labs partnership attribution and access request CTA (`7ec8ca7`).
- **Purposeful Interface Motion**: Added smooth, accessible animations across dialogs, drawers, dropdown menus, button press states, and public portal sections with immediate keyboard focus handling and `prefers-reduced-motion` compliance (`f27bd85`).
- **Changelog Studio & Public Feed (Phase 5)**: Admin changelog management with TipTap rich-text editing, WebP inline images, tag management, auto-saving drafts, and a public timeline feed with dedicated permalink articles.
- **FAQ Knowledge Base (Phase 5)**: Drag-and-drop FAQ manager with LexoRank ordering for categories and questions, and a public accordion portal featuring instant search and highlighted query terms.
- **Dual-Layer Roadmap & Notification Hub (Phase 4)**: Private drag-and-drop Kanban board for internal planning, leakage-proof public roadmap view, post linking with automated status updates, stakeholder notification fan-out, and "My Activity" stream.
- **Feedback Board & Community Discussions (Phase 3)**: Customer post submissions, debounced upvoting with concurrency rate-limiting, nested comments, post merging, admin moderation, and transactional email notifications via Brevo SMTP with RFC 8058 one-click unsubscribe.
- **Multi-Tenant Workspaces & Platform Management (Phase 2)**: Invite-only workspace onboarding, custom product portals, team invites with role protection, custom status pipelines, and global platform owner console.

### Changed

- **Brand Identity**: Applied the unified UserHQ brand identity across the web app with custom SVG mark, bundled local variable fonts (Manrope and Space Grotesk), Calm Teal accents, green-tinted paper surfaces, and a fixed navy face (`#0F182A`).
- **Navigation & Layout**: Added originating project breadcrumbs, back navigation from account settings to originating portals, full-width responsive Kanban columns, and eliminated unwanted tab scrollbars.

### Fixed

- **Native Development Startup**: Streamlined native dev startup and config loading from root `env.local.dev` for both Vite and NestJS servers (`21ff978`).
- **Database Migrations at Boot**: Applied committed migrations prior to native dev startup to prevent OAuth callback failures against outdated schemas.
- **Reverse Proxying**: Fixed development API and upload proxying to NestJS so social sign-in and media uploads function seamlessly.
- **Package Watchers**: Preserved shared package builds when starting watchers to prevent API startup import errors.
- **Data Integrity & Security**: Escaped SQL wildcards in roadmap searches, hardened LexoRank code unit sorting, enforced upload rate limiting (10/min), and soft-deleted products when workspaces are removed.

---

## [v0.1.0] - 2026-10-02

### Added

- **Walking Skeleton Stack**: End-to-end foundation running vinext (RSC) web frontend, NestJS API server, PostgreSQL, and Caddy reverse proxy in Docker.
- **Authentication**: Google and GitHub OAuth authentication powered by Better Auth, session validation, protected routes, and user profile menu.
- **Media Upload Pipeline**: Secure image upload validation, automatic conversion to WebP using Sharp, and persistent Docker volume storage.
- **Database Engine**: PostgreSQL with Drizzle ORM, boot-time migration runner safeguarded by PostgreSQL advisory locks, and health check endpoints.
- **CI/CD & DevOps**: GitHub Actions CI workflow, test matrix, production deployment runbooks for Oracle Cloud VPS, and tag-driven GitHub Releases.
