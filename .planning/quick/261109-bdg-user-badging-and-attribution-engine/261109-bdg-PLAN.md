---
phase: quick-261109-bdg
plan: 01
type: execute
autonomous: true
status: in-progress
requirements: [BDG-01, BDG-02, BDG-03, BDG-04]
---

# User Badging & Attribution Engine

Implement the complete User Badging & Attribution Engine:
- **BDG-01**: Database schema & migrations (`product_badges`, `product_badge_rules`, `user_product_badges`) with tenant & product scoping, priorities, and unique constraints.
- **BDG-02**: Core validation schemas and TypeScript definitions in `@userhq/types`.
- **BDG-03**: API controllers in `apps/api`:
  - `BadgesController`: Badge and rule CRUD, regex validation, HMAC secret verification.
  - `ProductUsersController`: Aggregated product user directory with search, badge filters, manual grant/revoke.
  - `PortalAttributionController`: Ingest query parameters, verify signatures, issue 30-day attribution cookies, auto-bind on auth/interaction.
- **BDG-04**: Web UI in `apps/web`:
  - Portal attribution handler with silent `window.history.replaceState` URL scrubbing.
  - Public badge display on comments, posts, and author lines.
  - Dashboard Badges configuration under product settings.
  - Dashboard Product Users directory (`/dashboard/[ws]/[product]/users`).
  - Inbox badge filtering.
