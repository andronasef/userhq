# Phase 6: Product Feature Controls

**Status: proposed / not started.** Product behavior approved; exact engineering proposals below await concrete review. No phase research, UI-SPEC or plan-check verdict has yet been produced.

## Locked decisions

Source: [expansion draft](../../../docs/specs/workspace-platform-expansion.md).

- D-07: Owners/admins independently control Board, Roadmap, Changelog and FAQ per product.
- D-08: Disable public navigation and direct public API/page access, including public writes; backend enforcement is required.
- D-09: Preserve data and relationships; authenticated admins can continue managing and re-enable content.
- D-10: Suppress public links/previews and customer notifications for disabled modules; recheck delivery; restore valid links on re-enable.
- D-11: Existing products keep all four enabled defaults; tenant isolation and roadmap privacy remain mandatory.
- D-12: Both GSD and Matt workflows remain required. GitHub tracker and a shared glossary are intended; setup/spec/ticket drafts require concrete review.
- D-02 applies only to reuse of the delivery-policy seam. Building browser push is a separate slice, not phase 6.

## Grounded current state and source pointers

- Product schema: `packages/db/src/schema/tenancy.ts`; no capability flags or separate boards entity. Each product owns one feedback board. Status types already include review/planned/active/completed/closed.
- Contracts: `packages/types/src/tenancy.ts`; admin CRUD: `apps/api/src/products/products.controller.ts`. Extend the existing product update contract, admin detail/list projections and portal allowlists rather than creating a parallel settings service.
- Tenant authorization: `apps/api/src/tenancy/tenant.guard.ts`; public resolution: `apps/api/src/portal/portal.guard.ts` and `portal.controller.ts` in that directory. Preserve suspended/deleted workspace/product checks.
- Public feature controllers: `apps/api/src/feedback/portal-posts.controller.ts`, `portal-comments.controller.ts`, `portal-votes.controller.ts`, `portal-mutes.controller.ts`; `apps/api/src/roadmap/portal-roadmap.controller.ts`; `apps/api/src/changelog/portal-changelog.controller.ts`; `apps/api/src/faq/portal-faq.controller.ts`.
- Web entry points: `apps/web/app/[ws]/page.tsx`, `[ws]/[product]/layout.tsx`, `[ws]/[product]/page.tsx`, `p/[ref]/page.tsx`, roadmap and changelog detail pages, FAQ and activity pages. These are relative to `apps/web/app/` except the first full path.
- Settings: `apps/web/app/dashboard/[ws]/[product]/settings/page.tsx` and `product-general-form.tsx` in that directory. Portal components: `apps/web/components/portal/portal-tabs.tsx`, `portal-frame.tsx`, `product-card.tsx`; FAQ CTA: `apps/web/components/faq/faq-portal.tsx`.
- Nested public data: roadmap service/controller linked posts, FAQ feedback CTA, portal product categories/statuses, notification item/list/count and My activity. Inspect `apps/api/src/notifications/notifications.service.ts`, `portal-activity.controller.ts` and `apps/web/components/notifications/notification-item.tsx` before modifying projections.
- Existing customer delivery: `apps/api/src/email/outbox.ts`, `worker.ts`, `render.ts`, and `unsubscribe.controller.ts`. Browser-push subscriptions/delivery do not exist today.
- Test prior art: `apps/api/test/products.test.ts`, `portal.test.ts`, `portal-isolation.test.ts`, `portal-roadmap.test.ts`, `canary-roadmap-leak.test.ts`, `notifications.test.ts`, `activity.test.ts`, `email.test.ts`. `test/support/test-app.ts` creates a real migrated temporary database; `test/support/stack.ts` addresses the Docker stack; `test/browser/` uses Playwright.

## Engineering proposals, not new product decisions

Use an explicitly validated `features` object of board/roadmap/changelog/faq booleans. Proposed persistence: four not-null product booleans with enabled defaults, mapped into the capability object rather than exposing raw database rows. Research may select a comparable typed representation without changing behavior. Extend the existing PATCH product endpoint; merge partial feature changes without resetting omitted settings. Include allowlisted capabilities in the necessary admin and portal metadata responses.

Compose public feature enforcement with PortalGuard/session authorization; it must not grant admin access or replace TenantGuard. Proposed unavailable response: the existing not_found/404 contract. Check module availability on feature endpoints even when an admin invokes the public URL; private admin routes remain the management path.

Inventory before coding: board posts/comments/votes/mutes and product categories/statuses (including where returned inside metadata); roadmap list/detail; changelog list/permalink; FAQ read/search/deep-link; activity and notifications. Public product/workspace branding metadata remains accessible without disabled feature content. Auth, account settings and unsubscribe must remain reachable; unsubscribe must keep working even if Board is disabled.

Proposed fallback landing order: Board → Roadmap → Changelog → FAQ → neutral unavailable state. Preserve directory entries unless a reviewed UX rule says otherwise; never link them to a disabled feature. Public JSON must suppress disabled-module previews/linked data, not merely rely on hidden links. Preserve underlying relationships.

Pause means suppressed deliveries are not blindly replayed on re-enable. Research should define a durable skip/suppression outcome for existing queued email and prevent in-app unread badges from counting hidden items. This exact re-enable policy remains a proposal for review.

## Verification and migration constraints

Use `bun run --filter @userhq/db db:generate` to generate committed migrations, and apply them with the existing ORM migrator under its advisory lock. Never use drizzle-kit push. `createTestDatabase()` already applies committed migrations; prove defaults on pre-existing rows as well as fresh creation before accepting the tracer.

Main seam: real Nest HTTP responses/persistence with `createTestApp`, then Docker HTTP/Playwright journeys. API tests need local Postgres and compiled workspace packages. Docker-stack tests require a local disposable stack plus E2E_DATABASE_URL/E2E_BASE_URL; do not point tests at production. Use existing script runners, never bun test for Nest decorators. No dependency install is expected.

## Required gates before execution

1. Review concrete spec, proposed test seams, ticket graph and setup draft through Matt's skills.
2. Perform phase-specific research and pattern mapping, then UI-SPEC for product settings/portal states.
3. Reconcile these proposed plans with that evidence and run GSD plan checking/security review.
4. Execute through GSD with behavior-first tests and Matt diff review. No phase-6 requirement is complete at capture time.

Out of phase: theme implementation, workspace inbox, API-key authentication, automation endpoints, outbound webhooks and browser-push infrastructure.
