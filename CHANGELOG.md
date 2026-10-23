# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
