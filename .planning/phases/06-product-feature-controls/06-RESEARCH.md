# Phase 6: Product Feature Controls - Research

**Researched:** 2026-11-05
**Domain:** Per-product module switches (Board / Roadmap / Changelog / FAQ) enforced in a NestJS API, a vinext/RSC portal, and the email/in-app notification pipelines
**Confidence:** HIGH for in-repo facts (every claim below was read or executed this session); MEDIUM for UX-shaped choices (flagged in the Assumptions Log)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(copied verbatim from `06-CONTEXT.md` "Locked decisions")

- D-07: Owners/admins independently control Board, Roadmap, Changelog and FAQ per product.
- D-08: Disable public navigation and direct public API/page access, including public writes; backend enforcement is required.
- D-09: Preserve data and relationships; authenticated admins can continue managing and re-enable content.
- D-10: Suppress public links/previews and customer notifications for disabled modules; recheck delivery; restore valid links on re-enable.
- D-11: Existing products keep all four enabled defaults; tenant isolation and roadmap privacy remain mandatory.
- D-12: Both GSD and Matt workflows remain required. GitHub tracker and a shared glossary are intended; setup/spec/ticket drafts require concrete review.
- D-02 applies only to reuse of the delivery-policy seam. Building browser push is a separate slice, not phase 6.
- D-13 (confirmed 2026-11-05): All-disabled landing fallback order is Board → Roadmap → Changelog → FAQ, then a neutral branded unavailable state.
- D-14 (confirmed 2026-11-05): Notifications suppressed while a module was disabled are NOT replayed on re-enable; only events after re-enable notify.

### Claude's Discretion
(the CONTEXT "Engineering proposals, not new product decisions" block; research may select a comparable typed representation without changing behavior)

- Use an explicitly validated `features` object of board/roadmap/changelog/faq booleans. Proposed persistence: four not-null product booleans with enabled defaults, mapped into the capability object rather than exposing raw database rows. Research may select a comparable typed representation without changing behavior. Extend the existing PATCH product endpoint; merge partial feature changes without resetting omitted settings. Include allowlisted capabilities in the necessary admin and portal metadata responses.
- Compose public feature enforcement with PortalGuard/session authorization; it must not grant admin access or replace TenantGuard. Proposed unavailable response: the existing not_found/404 contract. Check module availability on feature endpoints even when an admin invokes the public URL; private admin routes remain the management path.
- Inventory before coding: board posts/comments/votes/mutes and product categories/statuses (including where returned inside metadata); roadmap list/detail; changelog list/permalink; FAQ read/search/deep-link; activity and notifications. Public product/workspace branding metadata remains accessible without disabled feature content. Auth, account settings and unsubscribe must remain reachable; unsubscribe must keep working even if Board is disabled.
- Preserve directory entries unless a reviewed UX rule says otherwise; never link them to a disabled feature. Public JSON must suppress disabled-module previews/linked data, not merely rely on hidden links. Preserve underlying relationships.
- Research should define a durable skip/suppression outcome for existing queued email and prevent in-app unread badges from counting hidden items.

### Deferred Ideas (OUT OF SCOPE)
- Out of phase: theme implementation, workspace inbox, API-key authentication, automation endpoints, outbound webhooks and browser-push infrastructure.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | Owners/admins independently enable/disable Board, Roadmap, Changelog, FAQ; workspace-scoped | Four `*_enabled` columns + partial `features` PATCH on the existing `ProductsController` (TenantGuard already admits owner and admin); per-column SET so no read-modify-write (Persistence, Pattern 2) |
| CAP-02 | Existing products keep all four enabled; toggling preserves content; re-enable restores | `ADD COLUMN ... DEFAULT true NOT NULL`; **trimmed** generated migration; upgrade-path test pattern from `packages/db/test/migrate.test.ts` (Migration section) |
| CAP-03 | Disabled modules reject public reads/writes/direct URLs in the API as well as web | `@PortalFeature()` metadata read by an extended `PortalGuard`; full endpoint inventory (Public Surface Inventory) |
| CAP-04 | Admins keep private management of disabled modules without weakening guards | Roadmap/Changelog/FAQ admin routes already use `TenantGuard`; **Board management currently rides public portal routes and must get admin routes** (Critical Finding 1) |
| CAP-05 | Navigation, directory links and landing honor enabled modules, incl. standalone and all-disabled | `PortalTabs` features prop, root-page redirect order per D-13, page-level `notFound()` (Web section) |
| CAP-06 | Cross-feature links/previews and nested projections do not leak; relationships survive | Nested projection matrix N1-N10 (includes two leaks the draft plans miss) |
| CAP-07 | Notifications and delivery pipelines check availability at delivery | Fan-out gate, `visible()` gate, worker item-query gate, enqueue gate (Delivery section) |
| CAP-08 | Cross-tenant, bypass, migration, re-enable, roadmap-privacy tests | Validation Architecture; reuse `createTestApp`, `seedTenants`, `public-contract.test.ts` route scan, canary |
| CAP-09 | One reusable policy composing with existing authorization, reusable by later slices | `apps/api/src/portal/product-features.ts`: pure predicate + decorator + Drizzle column map, callable with no HTTP context |
</phase_requirements>

## Summary

The feature switches are architecturally small: four boolean columns on `products`, one extension of the product PATCH contract, one decorator plus a few lines in the existing `PortalGuard`, and gates in four delivery choke points. The risk is not in that core; it is in **surface coverage and three hidden couplings the draft plans do not mention**.

(1) The admin dashboard performs Board management (edit/delete post, create/edit/delete comment, merge-candidate search) by calling the *public* `/api/v1/portal/...` routes. Gating those routes per the CONTEXT proposal ("even when an admin invokes the public URL") silently breaks CAP-04/D-09 for Board unless thin admin-route equivalents are added and the dashboard components repointed. (2) `drizzle-kit generate` against the current snapshot chain emits two spurious `device_info` `ADD COLUMN` statements; shipping that output unedited would make migration fail at boot on every database. I reproduced this and the fix (hand-trim, then re-generate reports "No schema changes"). (3) Two nested leaks are absent from the drafts: the public post page returns the linked public roadmap item (`roadmapItem`) and the unsubscribe state returns post title and URL.

Delivery is easy because each pipeline has exactly one choke point, and the existing `cancelled` batch status already provides the durable terminal outcome D-14 needs. Recommended default (stateless, matches D-10 "recheck at delivery"): gate at fan-out/enqueue creation, gate the worker's per-batch item query, and filter the in-app `visible()` predicate. Two behaviours worth user confirmation are listed in Open Questions.

**Primary recommendation:** Four `*_enabled` boolean columns, a `@PortalFeature('board'|'roadmap'|'changelog'|'faq'|'exempt')` decorator enforced fail-closed inside the existing `PortalGuard`, and add Board admin-management routes in the *same plan* that gates the Board portal controllers; hand-trim the generated migration to only the four `ALTER TABLE products` statements.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Persist module flags | Database | API | Columns on `products`; worker and guard both join on them |
| Authorize toggling (owner/admin, tenant-scoped) | API (`TenantGuard`) | - | Existing guard; `tenant.productId` comes from the guard, never from the body |
| Deny public reads/writes of a disabled module | API (`PortalGuard` + decorator) | Frontend Server (page `notFound()`) | D-08: backend is the authority; pages mirror it for correct 404 status |
| Suppress nested projections (roadmap postCount, post.roadmapItem, statuses/categories) | API | - | Public JSON must not leak (CAP-06); UI hiding is not a control |
| Hide nav tabs, CTAs, landing redirect, unavailable state | Frontend Server (RSC) | Browser (`PortalTabs`) | Layout/page already fetch portal metadata server-side |
| Admin Board management while Board disabled | API (`TenantGuard` routes) | Browser (dashboard components) | Currently coupled to public routes (Critical Finding 1) |
| Customer notification suppression | API (fan-out, worker, notifications service) | Database | Recheck at the delivery choke points, no HTTP context |
| Settings UI (four toggles) | Browser (dashboard form) | Frontend Server | Native checkbox precedent in `workspace-settings-forms.tsx`; no new dependency |

## Critical Findings (read first)

### CF-1: Dashboard Board management uses PUBLIC portal routes (blocks CAP-04 if gated naively) [VERIFIED: grep + reads this session]

`apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx` renders `PostActionsMenu`, `PostTimeline` (which contains `CommentComposer` and `CommentItem`) and the merge dialog. These call the public controllers:

| Admin action in dashboard | Call site | Public route it hits |
|---|---|---|
| Reply / comment | `components/post/comment-composer.tsx:78` | `POST /api/v1/portal/{ws}/{product}/posts/{n}/comments` |
| Edit / delete comment | `components/post/comment-item.tsx:86,117` | `PATCH/DELETE /api/v1/portal/{ws}/{product}/comments/{id}` |
| Delete post | `components/post/post-actions-menu.tsx:57` | `DELETE /api/v1/portal/{ws}/{product}/posts/{n}` |
| Edit post | `components/board/post-form-dialog.tsx:107` | `PATCH /api/v1/portal/{ws}/{product}/posts/{n}` |
| Merge-candidate search | `components/post/merge-dialog.tsx:72-73` | `GET /api/v1/portal/{ws}/{product}/posts?q=...&status=all` |

Already on admin (`TenantGuard`) routes and unaffected: status change (`status-change-dialog.tsx:70`), merge execution (`merge-dialog.tsx:105`, `bulk-merge-dialog.tsx:65`), voters (`voter-list.tsx:45`), restore, deleted lists, admin post list/detail. Roadmap, Changelog and FAQ admin UIs do not call `/portal/` (only `changelog-feed.tsx:42` load-more and `public-roadmap-modal.tsx:54` do, both public views).

CONTEXT proposes gating "even when an admin invokes the public URL". With that rule, disabling Board makes post edit/delete and every comment action 404 for the admin, which violates D-09/CAP-04 and the draft 06-01 truth "private admin management still works".

**Recommendation (Option A, consistent with CONTEXT):** keep the strict public gate; add thin `TenantGuard` routes under `workspaces/:ws/products/:product/` that call the same services (`CommentsService.createComment/updateComment/deleteComment`, `PostsService.updatePost/deletePost` take a `portal`-shaped `{workspaceId, productId}` plus the user; `createComment` derives admin status via `isWorkspaceAdmin(tx, user.id, portal.workspaceId)` [VERIFIED comments.service.ts:63]; planner must confirm the update/delete paths derive it the same way), reuse the same Zod DTOs, and repoint the dashboard variants. The merge search can use the existing admin list `GET .../posts?q=&status=all` (`AdminBoardQuerySchema` extends `BoardQuerySchema`, which has `q`, `status: all|open|uuid`, `sort`; the dialog only needs `number`, `title`, `voteCount`, which `AdminPostRow` has). Components already carry a `variant` prop (`PostActionsMenu`, `MergeDialog`); thread one through `PostTimeline` -> `CommentItem`/`CommentComposer` and `PostFormDialog`.
**Land the admin routes and the dashboard repoint no later than the plan that gates the Board portal controllers**, otherwise the dashboard is broken between commits.
**Fallback (Option B, needs user sign-off because it contradicts the CONTEXT proposal):** let `PortalGuard` skip the Board gate for callers who are owner/admin of that workspace. Smaller, but public-URL behaviour then depends on the caller and "signed-in caller rejected" tests become role-conditional.

### CF-2: `drizzle-kit generate` currently emits spurious `device_info` columns [VERIFIED: executed in a throwaway copy at /tmp/p6gen, repo untouched]

The newest snapshot is `0011_snapshot.json`; it contains `accent_text_color` but not `device_info` (grep count 0), while `0011_device_info.sql` and `0012_accent_text_color.sql` were hand-written/journal-only. I copied `packages/db` to `/tmp`, added four boolean columns, ran `drizzle-kit generate --name product_features`, and got:

```
ALTER TABLE "comments" ADD COLUMN "device_info" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "device_info" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "feature_board" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "feature_roadmap" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "feature_changelog" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "feature_faq" boolean DEFAULT true NOT NULL;
```

Applied as-is this fails ("column already exists") on every database that ran `0011_device_info`, including fresh ones. After deleting the two `device_info` lines, a second `drizzle-kit generate` printed `No schema changes, nothing to migrate` and `drizzle-kit check` printed `Everything's fine`. So the new snapshot (generated from the full current schema) repairs the chain. The draft 06-01 verify command (`db:generate && ... db:check`) would pass `db:check` and still ship a broken migration. Plan must say: generate with `--name`, **hand-delete the two `device_info` statements**, re-run generate and require "No schema changes", then apply on a fresh DB and an upgraded DB. New journal `when` was `1793866533340`, greater than the previous `1792500000000`; the migrator only applies entries whose `folderMillis` exceeds the last applied `created_at` (`pg-core/dialect.js:62`), and runs the batch in one transaction.

### CF-3: Two nested leaks missing from the drafts [VERIFIED: reads]

- **N1** `GET /portal/:ws/:product/posts/:number` returns `roadmapItem: {id, title}` (public roadmap title) — `apps/api/src/feedback/posts.service.ts:654-659`:
  ```
  roadmapItem: row.roadmapItemId && row.publicRoadmapTitle
    ? { id: row.roadmapItemId, title: row.publicRoadmapTitle }
    : null,
  ```
  With Roadmap disabled this exposes roadmap content and the web banner links to `/roadmap`. Draft 06-03 only covers the opposite direction (Board data inside Roadmap).
- **N7** `GET /unsubscribe/:token` returns `postTitle`/`postUrl` from `resolvePost` (`unsubscribe.controller.ts:71`). With Board disabled that is a Board-content disclosure to anyone holding a token, and no draft plan lists `unsubscribe.controller.ts`.

## Standard Stack

No new packages. Everything is already installed. [VERIFIED: `apps/api/package.json`, `apps/web/package.json`, `packages/db/package.json` read this session]

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm / drizzle-kit | 0.45.3 / 0.31.11 | Columns + generated SQL migration | Project-locked; `db:check` and `generate` already work |
| pg | 8.23.1 | Driver used by `runMigrations` (advisory lock `MIGRATION_LOCK_KEY = 727001`) | Existing |
| @nestjs/common / core | 12.1.2 | Guards, `SetMetadata`, `Reflector` | `SessionGuard`/`OriginGuard` already inject `Reflector` (`auth/guards.ts`) |
| zod | 4.6.5 (catalog) | `ProductFeaturesSchema`, partial PATCH input | Existing shared-contract pattern |
| vitest / supertest / @playwright/test | 5.0.3 / 7.3.0 / 1.63.0 | HTTP + browser acceptance | Existing seams |
| vinext + React | 1.0.0 / 19.3.0 | Portal pages; `redirect`/`notFound` from `next/navigation` | Already used in `[ws]/page.tsx` and `activity/page.tsx` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Four boolean columns | One `jsonb features` column | Needs a CHECK constraint and `COALESCE` in every worker/guard/notification join and per-key merge SQL; no benefit. Columns give typed `eq(products.boardEnabled, true)` in all joins. **Use columns.** |
| Policy in `PortalGuard` | Separate `PortalFeatureGuard` | A second guard repeats the product lookup unless it reads `req.portal`; extending `PortalGuard` adds zero queries (it already selects the product row) |
| Native checkbox | `@radix-ui/react-switch` | Would be a new dependency ("No dependency install is expected"); the workspace form already uses a native checkbox |

**Installation:** none. **Package Legitimacy Audit:** no external packages are added; the `package-legitimacy` gate is not applicable. `Packages removed: none. Packages flagged SUS: none.`

## Persistence Shape (decision: four boolean columns)

Add to `products` in `packages/db/src/schema/tenancy.ts`, mirroring the existing `directoryEnabled` precedent [VERIFIED: tenancy.ts:27]:

```
directoryEnabled: boolean("directory_enabled").notNull().default(true),
```

Recommended columns (names follow `directory_enabled`): `board_enabled`, `roadmap_enabled`, `changelog_enabled`, `faq_enabled`, each `boolean(...).notNull().default(true)`. The experiment above used `feature_*` names; the emitted SQL shape is identical (`ADD COLUMN "<name>" boolean DEFAULT true NOT NULL`). `ADD COLUMN ... DEFAULT <constant> NOT NULL` is a metadata-only change on PostgreSQL 11+ (project uses `postgres:18`), so existing rows read as `true` with no rewrite or backfill [CITED: PostgreSQL ALTER TABLE docs; the project's PG 18 per CLAUDE.md]. The migration therefore satisfies CAP-02 by construction; the test proves it.

Shared contract in `packages/types/src/tenancy.ts` (existing symbols: `ProductDetailSchema` at :254 `= ProductSummarySchema.extend({...})`, `UpdateProductInputSchema` at :261, `PublicPortalProductSchema` at :6):

```ts
export const PRODUCT_FEATURE_KEYS = ["board", "roadmap", "changelog", "faq"] as const; // also the D-13 landing order
export type ProductFeatureKey = (typeof PRODUCT_FEATURE_KEYS)[number];
export const ProductFeaturesSchema = z.object({
  board: z.boolean(), roadmap: z.boolean(), changelog: z.boolean(), faq: z.boolean(),
});
// UpdateProductInputSchema gains:  features: ProductFeaturesSchema.partial().optional()
// ProductDetailSchema gains:       features: ProductFeaturesSchema
// PublicPortalProductSchema gains: features: ProductFeaturesSchema
```

Deploy note: `apps/web` parses `PublicPortalProductSchema` strictly, so an old API behind a new web would throw. Both images ship together via Dokploy; deploy API first if staged. [ASSUMED - A7]

## Architecture Patterns

### System Architecture Diagram

```
Admin (owner/admin) ──PATCH /workspaces/:ws/products/:product {features:{roadmap:false}}──┐
        │ TenantGuard (membership, ws+product from URL, never body)                        ▼
        │                                              UPDATE products SET roadmap_enabled=false  (only provided keys)
        └── admin Board routes (new) ── CommentsService / PostsService ──► content untouched (D-09)

Customer/anon ──GET/POST /portal/:ws/:product/<module>/...──► Global Origin+Session guards
        ──► PortalGuard: ws (404/403 suspended) → product (404) → READ @PortalFeature metadata
                         → flag off? throw ApiException("not_found",404,"Not found.")  [fail-closed if metadata missing]
                         → req.portal = {workspaceId, productId, features}
        ──► controller/service ──► projections strip nested cross-module data using req.portal.features
                (roadmap postCount/posts, post.roadmapItem, metadata categories/statuses)

Web request /[ws]/[product][/module]
   layout: getPortalProduct (React cache, deduped) → PortalTabs(features) / unavailable
   page:   features[module]? else notFound()      root page: first enabled by D-13 order → redirect() (307) else StatePage

Delivery choke points (no HTTP context; same predicate eq(products.boardEnabled,true)):
   status change/roadmap follow → NotificationsService.fanOutStatusChange (gate) → notifications row
   comment → enqueueCommentEmail (gate) → batches/items → EmailWorker.runOnce item query (gate) → none left ⇒ batch 'cancelled'
   GET /notifications[/unread-count] → visible() (gate)
```

### Recommended Project Structure
```
apps/api/src/portal/product-features.ts   # NEW: PORTAL_FEATURE metadata key, PortalFeature decorator, featureEnabled(), flag column map
apps/api/src/portal/portal.guard.ts       # extend: select flags, read metadata, 404 if off, set req.portal.features
apps/api/src/feedback/admin-board.controller.ts  # NEW (Option A): admin post edit/delete + comment create/edit/delete
packages/types/src/tenancy.ts             # ProductFeaturesSchema + three contract extensions
apps/web/lib/portal-features.ts           # NEW pure helpers: tabs list, landing resolver, hrefs (unit-testable, no hooks)
```

### Pattern 1: Declarative per-controller feature + fail-closed guard
**What:** `@PortalFeature('board')` on each portal controller class; `PortalGuard` reads it with `Reflector.getAllAndOverride` (same call shape as `OriginGuard`, `auth/guards.ts`). Missing metadata on a route that has `:product` throws a plain Error (500) so a future portal controller cannot ship ungated. `PortalController` (directory + branding metadata) is explicitly `'exempt'`.
**Why not blanket-gate PortalGuard:** it also fronts the branding metadata and activity; exemptions must be explicit and tested.
```ts
// Source: pattern from apps/api/src/auth/decorators.ts (SetMetadata) and auth/guards.ts (Reflector)
export const PORTAL_FEATURE = "portalFeature";
export type PortalFeature = ProductFeatureKey | "exempt";
export const PortalFeature = (f: PortalFeature) => SetMetadata(PORTAL_FEATURE, f);
export function featureEnabled(flags: ProductFeatures, f: PortalFeature) { return f === "exempt" || flags[f]; }
```
Order inside `canActivate` must stay: workspace lookup (404) → suspended (403 `workspace_suspended`) → product (404) → feature (404 `not_found`, message `"Not found."`, the same literal the guard already throws). Class-level `PortalGuard` runs before method-level `UserThrottlerGuard`, so denied requests do not consume throttle quota and 404 precedes body-validation 400s [VERIFIED: portal-posts.controller.ts uses class-level `@UseGuards(PortalGuard)` and method-level `@UseGuards(UserThrottlerGuard)`].

### Pattern 2: Partial merge without read-modify-write
In `ProductsController.updateProduct` (it builds `updateData` key by key), add one line per provided flag, e.g. `if (input.features?.board !== undefined) updateData.boardEnabled = input.features.board;`. Omitted keys are never written, so two admins toggling different modules cannot clobber each other. `getProduct` (re-read at the end of `updateProduct`) returns the mapped `features` object, not raw columns. Note `ProductGeneralForm` submits its whole RHF form on save and `ProductBrandingForm` PATCHes separately; implement the toggles as their **own** small form that PATCHes only `{ features }`, so neither existing form can reset them.

### Pattern 3: Policy usable outside HTTP
`product-features.ts` exports the column map and `featureEnabled`; the worker, notifications service and `enqueueCommentEmail` just add `eq(products.boardEnabled, true)` to joins they already have (see Delivery). No Nest provider needed. This satisfies CAP-09; the draft 06-04 key_link "worker.ts -> portal.guard.ts" should instead point at `product-features.ts`.

### Anti-Patterns to Avoid
- **Gating in the web only** (hidden tab / `notFound()` page): D-08 requires API denial; current pages swallow API errors (`roadmapRes.ok ? ... : []` in `roadmap/page.tsx`, `faqRes.ok ? ... : []`, `feedRes.ok ? ... : []`), so without an explicit features check a direct `/roadmap` URL would render an empty 200 page.
- **Exclusion-mode column selection** (`columns: {x:false}`) in projections: banned by `tools/oxlint-userhq.mjs` rule `no-exclusion-columns`.
- **Permanent redirects** for the landing fallback: 301/308 are cached and go stale after re-enable. Use `redirect()` (307). [ASSUMED standard HTTP semantics - A9]
- **Deleting or nulling relationships** to "hide" content (D-09): never touch `posts.roadmap_item_id`, FAQ/changelog rows; suppress in projections only.

## Public Surface Inventory (CAP-03/05/06) — the answer to "what can leak or act"

Source of truth: every `@Controller` found by `grep -rn "@Controller("` plus reading each handler. All portal routes are under `/api/v1/portal/:ws/...` unless stated.

### A. Direct endpoints
| # | Route | Controller:handler | Module decision | Draft plan coverage |
|---|-------|--------------------|-----------------|---------------------|
| 1 | `GET /portal/:ws` | `PortalController.getPortalDirectory` | `exempt` (names/logos only; keep directory entries) | 06-01/02 list file; no change needed except decorator |
| 2 | `GET /portal/:ws/:product` | `PortalController.getPortalProduct` | `exempt` route, **projection changes** (see B-N4); add `features` | 06-03 task 2 mentions; 06-01 needs `features` first for tabs |
| 3 | `GET .../posts` | `PortalPostsController.listBoard` (`@Public`) | board | 06-01 |
| 4 | `GET .../posts/:number` | `getPostPage` (`@Public`; also serves `kind:"redirect"` for merged) | board + **N1** | 06-01; N1 missing |
| 5 | `POST .../posts` | `createPost` | board | 06-01 |
| 6 | `PATCH/DELETE .../posts/:number` | `updatePost`, `deletePost` | board (**admin dashboard dependency, CF-1**) | 06-01; CF-1 missing |
| 7 | `POST .../posts/:number/comments` | `PortalCommentsController.createComment` | board (CF-1) | 06-01 |
| 8 | `PATCH/DELETE .../comments/:id` | `updateComment`, `deleteComment` | board (CF-1) | 06-01 |
| 9 | `PUT/DELETE .../posts/:number/vote` | `PortalVotesController` | board | 06-01 |
| 10 | `PUT/DELETE .../posts/:number/mute` | `PortalMutesController` | board | 06-01 |
| 11 | `GET .../roadmap`, `GET .../roadmap/:id` | `PortalRoadmapController` (`@Public`) | roadmap + **N2/N3** | 06-02; N2/N3 in 06-03 |
| 12 | `GET .../changelog`, `GET .../changelog/:slug` | `PortalChangelogController` (`@Public`) | changelog | 06-02 |
| 13 | `GET .../faq` | `PortalFaqController` (`@Public`) | faq. **There is no FAQ search or deep-link endpoint**: search is client-side in `faq-portal.tsx` (`filteredCategories` memo) and deep links are same-page anchors. Draft 06-02 "tree/search/deep-link" is over-scoped; page-level gate suffices. | 06-02 |
| 14 | `GET .../activity` | `PortalActivityController.getMyActivity` (auth required) | board (engaged posts, titles, comment counts); gate before the `userProductActivityVisits` upsert | 06-03 |
| 15 | `GET /notifications`, `/notifications/unread-count`; `POST /notifications/mark-read`, `/notifications/:postId/read` | `NotificationsController` (account-scoped, not under `/portal`) | n/a: filter rows by `products.board_enabled` in `visible()` | 06-04 |
| 16 | `GET/POST/DELETE /unsubscribe/:token` | `UnsubscribeController` | **stay reachable**; strip `postTitle/postUrl` when board off (**N7**) | **missing from all plans** |
| 17 | `/me`, `/account`, `/api/auth/*` | other controllers | exempt | n/a |
| 18 | `/uploads/*` static | `configureApp` `useStaticAssets` | Images embedded in disabled changelog/FAQ stay fetchable by exact URL; they are unguessable keys and no endpoint enumerates them. Accept and document. [ASSUMED - A4] | n/a |

Not present [VERIFIED: `find` for sitemap/robots/rss/feed/opengraph-image in `apps/web` returned nothing]: sitemap, robots, RSS, OG image routes. Link-preview metadata is only `generateMetadata` (see Web section).

### B. Nested / projection leaks
| ID | Where | Leak when | Fix |
|----|-------|-----------|-----|
| N1 | `posts.service.ts:654-659` post page `roadmapItem` | roadmap off | `roadmapItem: null` when `!portal.features.roadmap` (pass flag from `req.portal`); hide `LinkedRoadmapBanner` portal variant |
| N2 | `portal-roadmap.controller.ts:53` list `postCount: count(posts.id)` (card shows "N ideas") | board off | map to `0` when board off (drop the posts left join) |
| N3 | `portal-roadmap.controller.ts:140` detail `linkedPosts` -> `posts[]` (title, voteCount, `/p/n` links) and `postCount: linkedPosts.length` | board off | skip query, `posts: []`, `postCount: 0`; modal already hides when `postCount === 0` |
| N4 | `portal.controller.ts:173` `categories` and `statuses` | board/roadmap off | `categories`: only if board on. `statuses`: all if board on; else only `isPublicRoadmap` ones if roadmap on; else `[]`. `isPublicRoadmap` returned as `false` when roadmap off. Roadmap's own public statuses must survive a Board-off state (CONTEXT requirement) |
| N5 | notification list/count and links to `/p/n` | board off | `visible()` gate + fan-out gate |
| N6 | activity | board off | whole route gated |
| N7 | unsubscribe `postTitle/postUrl` | board off | `resolvePost` returns `live:true,title:null,url:null`; mute/unmute still writes. Web `unsubscribe-view.tsx` already renders `data.postTitle ?? "this post"` and conditionally `data.postUrl`, so no UI change is required |
| N8 | email subject/body/links | board off | worker item query gate |
| N9 | post page `timeline` (status changes, comments) | board off | inside the gated route |
| N10 | web CTAs that deep-link into a disabled module | any off | see Web table |

## Web Surface

[VERIFIED: files read this session]

| File | Today | Change |
|------|-------|--------|
| `app/[ws]/[product]/layout.tsx` | `PortalTabs ws product hasUser`; description fallback "Share feedback, vote on ideas, and follow what's coming next" | pass `features`; pass no `tabs` when zero (PortalFrame renders `{tabs && ...}`); make fallback description feature-aware |
| `components/portal/portal-tabs.tsx` | hardcoded Feedback/Roadmap/Changelog/FAQ + Activity (if user) | filter by `features`; Activity only if `features.board && hasUser`. Prefer a pure `portalTabs(ws, product, features, hasUser)` in `lib/portal-features.ts` |
| `app/[ws]/[product]/page.tsx` (Board root; also the home href for logo, `ProjectContextTracker`, "Clear filters") | fetches product + board + me in `Promise.all` | await product first; if `!features.board`: first enabled of roadmap, changelog, faq -> `redirect()`; none -> unavailable `StatePage` inside the branded frame; `generateMetadata` returns `{}` when board off |
| `app/[ws]/page.tsx` | single product -> `redirect(portalHref(ws, slug))` | no change; the root redirect handles fallback (two 307 hops). Directory cards stay (CONTEXT) and always link to the root, never a disabled module |
| `.../roadmap/page.tsx`, `changelog/page.tsx`, `changelog/[slug]/page.tsx`, `faq/page.tsx` | swallow API failure into empty data | `if (!features.<m>) notFound()`; metadata returns a neutral title when off |
| `.../activity/page.tsx` | gated by `me.user` | `notFound()` when board off. Note `proxy.ts` matcher still redirects unauthenticated `/activity` and `/p/*` to login first; harmless, reveals nothing |
| `.../p/[ref]/page.tsx` | back button "All feedback" -> root | page 404s when board off via API; no extra change; hide `LinkedRoadmapBanner` when roadmap off (backed by N1) |
| `components/roadmap/public-roadmap-board.tsx:63` | empty-state CTA "View feedback board" | hide when board off (prop) |
| `components/faq/faq-portal.tsx:170` ("Explore feedback") and `faq-not-found-prompt.tsx` ("Post to feedback board") | unconditional CTAs | add `boardEnabled` prop; hide both |
| `components/activity/activity-feed.tsx`, `notification-item.tsx` | link to `/p/n` | server filtering removes the rows; no client change needed |
| `app/dashboard/[ws]/[product]/settings/page.tsx` + new form | no feature controls | new "Portal features" section with four native checkboxes (precedent: `ws-directory-enabled` in `workspace-settings-forms.tsx`), PATCH `{features:{...}}`, `router.refresh()` on success (precedent: `product-general-form.tsx` onSuccess) |
| dashboard "View on portal" (`post-actions-menu.tsx:129`) and "View portal" links | link to Board `/p/n` or root | `/p/n` 404s when board off; hide/disable that one item (UI-SPEC decision). "View portal" links hit the root and are fine |

vinext/RSC notes:
- `redirect()` and `notFound()` from `next/navigation` are already used in server components (`[ws]/page.tsx`, `activity/page.tsx`), so no new capability is needed. There is no `loading.tsx` in `apps/web/app` [VERIFIED by file listing], so streaming should not flush a 200 before `notFound()`; still assert the **HTTP status** in Playwright (`response.status() === 404`) because no existing spec asserts page status codes.
- A layout cannot see the current pathname, so the landing fallback must live in the root `page.tsx`, not the layout.
- `getPortalProduct` is wrapped in React `cache()` (`lib/api-server.ts`), so layout, page and `generateMetadata` share one fetch per request.
- `PortalTabs` is a client component: pass `features` as a plain-object prop; after settings PATCH call `router.refresh()`. A stale open tab keeps old tabs until navigation; the click then hits the API/page gate and 404s (matches CONTEXT "handle availability changes on refresh").
- Do not use `import.meta.env` (lint rule `no-import-meta-env`), and `apps/web` may not import `@userhq/db`/`drizzle-orm` (oxlint `no-restricted-imports`). Shared constants come from `@userhq/types`.

## Delivery (CAP-07, D-10, D-14)

Each pipeline has exactly one choke point:

| Pipeline | Choke point | Change |
|---|---|---|
| In-app creation | `NotificationsService.fanOutStatusChange` (`notifications.service.ts`); only two callers: `moderation.service.ts:166` (admin status change) and `roadmap.service.ts:700` (`followItemStatus`) | Add `WHERE EXISTS (SELECT 1 FROM products WHERE id = ${opts.productId} AND board_enabled)` to its stakeholder SQL (or an early return). Roadmap-driven status changes on a Board-off product then create `post_activity` (timeline preserved) but no notification |
| In-app read | `private visible(userId)` at :85-92, used by `getUnreadCount` and `listNotifications`; both already `innerJoin(products, ...)` (:99, :135) | Add `eq(products.boardEnabled, true)` to the `and(...)`. One edit fixes badge, list and `unreadCount` embedded in the list |
| Email enqueue | `enqueueCommentEmail` raw SQL CTE `r` (`outbox.ts:23` `WHERE u.id <> ${actorId} AND u.comment_emails ...`) | Add `AND EXISTS (SELECT 1 FROM posts p JOIN products pr ON pr.id = p.product_id WHERE p.id = ${postId} AND pr.board_enabled)`. Required because Option A's admin comment route can create comments while Board is off |
| Email send | `EmailWorker.runOnce` items query (`worker.ts:171` already `.innerJoin(products, eq(posts.productId, products.id))`) | Add `eq(products.boardEnabled, true)` to its `and(...)` |

**Durable outcome (D-14):** the worker already ends a batch whose item query returns nothing with `status: 'cancelled'` (`worker.ts:196-203`) and `emailBatchStatus` includes `"cancelled"` (`feedback.ts:198-205`: `pending, sending, retrying, sent, failed, cancelled`). Claiming only selects `pending|retrying` (and stale `sending`), so a `cancelled` or `sent` batch is terminal and can never replay. Consequences with the single item-query gate:
- Batch due **while Board is off** -> item query empty -> `cancelled` (durable), never revived on re-enable.
- Mixed batch (product A off, product B on, same workspace) -> only B's items render; batch becomes `sent`; A's items are dropped durably.
- Retry (`retrying`) falling due during the off-window -> `cancelled`.
- Comments cannot be created during the off-window except via admin routes, which the enqueue gate covers.
- Unsubscribe, one-click `List-Unsubscribe`, and recipient/workspace re-checks are untouched.

**In-app semantics with the same gate:** events during the off-window create no row (no replay). Unread rows created *before* disable are hidden while off and reappear on re-enable (they were delivered before the disable, they are not suppressed events). Both this and the email case "queued before disable, due after re-enable, delivered normally" are stateless-by-design; see Open Question 1 for the strict alternative (cancel/mark-read at disable inside the PATCH transaction).

## Migration approach (CAP-02)

1. Edit `packages/db/src/schema/tenancy.ts` (four columns). 2. From `packages/db`: `drizzle-kit generate --name product_features` (repo script `db:generate` = `drizzle-kit generate`; pass `--name`). 3. **Delete the two `device_info` statements** in the new SQL (CF-2). 4. Re-run generate: must print `No schema changes, nothing to migrate`. 5. `bun run --filter @userhq/db db:check` (verified passing today). 6. `git diff --stat` should show only the new `0013_*.sql`, `meta/0013_snapshot.json`, `meta/_journal.json`. 7. `bun run build:packages` (API imports `@userhq/db` from `dist`, `exports.import = ./dist/index.mjs`).

Upgrade-path test (extend `packages/db/test/migrate.test.ts`, which already has the exact pattern: "new migration applied: partial folder applies 1, full folder applies second" copies `migrations` to a temp dir, truncates `meta/_journal.json` entries, runs `node dist/migrate.js` with `MIGRATIONS_FOLDER`, then runs the real folder). New case: truncate to the 13 entries through `0012_accent_text_color`, run, insert a workspace + product row with plain SQL, run the full folder, assert the four columns are `true` and `count(*) FROM drizzle.__drizzle_migrations` equals the full journal length. `createTestDatabase()` in `apps/api/test/support/test-app.ts` calls `runMigrations` on the full folder, so it proves *fresh* creation only. Never use `drizzle-kit push` (CONTEXT).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-route policy | New middleware/interceptor stack or a JSON "rules" table | `SetMetadata` + `Reflector` inside existing `PortalGuard` | Same pattern as `OriginGuard`/`SessionGuard`; zero extra queries |
| Unavailable response | New error code or status | `new ApiException("not_found", 404, "Not found.")` | Existing contract (D-08); web already maps any 404 to `notFound()` |
| Durable email suppression | New status enum value or tombstone table | Existing `cancelled` batch status via the worker's empty-items branch | Already terminal and non-claimable |
| Switch UI | New Radix primitive | Native `<input type="checkbox">` as in `workspace-settings-forms.tsx` | No dependency install allowed |
| Migration | Hand-written SQL without snapshot | `drizzle-kit generate` + trim (CF-2) | Keeps snapshot chain consistent for 1.0 upgrade |
| Route-coverage proof | A hand-maintained endpoint list | Extend the `ModulesContainer`/`MetadataScanner` scan already in `test/public-contract.test.ts` | Unclassified future routes fail automatically |
| Landing/tab logic | Inline conditionals in server components | Pure `lib/portal-features.ts` + `lib/*.test.ts` (node-env vitest) | `apps/web` vitest runs in `environment: "node"`; hooks are not testable there |

**Key insight:** this feature fails open in the places that look "already handled" (empty-on-error pages, nested counts, tokens in emails, and public routes that the admin UI quietly reuses). The controls are cheap; the discipline is the inventory and the automated route-classification test.

## Runtime State Inventory (additive schema migration; no rename)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `products` rows get four new columns defaulting `true` (DB-level); no other table stores module state | Migration only (no data backfill); upgrade-path test |
| Live service config | None expected - flags live in Postgres, not an external UI (no external-service config was inspected) | None |
| OS-registered state | None - the email worker is an in-process `setInterval` (`worker.ts`), not an OS task | None |
| Secrets/env vars | None new; email tests use `SMTP_*`, `MAILPIT_HOST`, `TEST_DATABASE_ADMIN_URL` | None |
| Build artifacts | `packages/db/dist` and `packages/types/dist` are consumed by the API/tests via `exports`; stale after schema/type edits | `bun run build:packages` before any API test run |

## Common Pitfalls

### Pitfall 1: Shipping the unedited generated migration (CF-2)
**What goes wrong:** boot-time migration fails ("column already exists") on every DB. **Avoid:** trim, re-generate for "No schema changes", test fresh + upgrade. **Warning sign:** the new SQL file mentions `posts`/`comments`.

### Pitfall 2: Gating Board portal routes before admin routes exist (CF-1)
**What goes wrong:** dashboard post edit/delete/comment/merge-search 404. **Avoid:** admin routes + component repoint land first/together; add an HTTP test that an admin can edit, delete and comment on a post while Board is off, and that the same admin session gets 404 on the public URL.

### Pitfall 3: Pages that render empty instead of 404
**What goes wrong:** `/roadmap`, `/changelog`, `/faq` return 200 with an empty list because `roadmapRes.ok ? ... : []`. **Avoid:** explicit `features` check -> `notFound()`; Playwright asserts status 404 and absence of module text.

### Pitfall 4: Nested counts and refs (N1-N4)
**What goes wrong:** gating routes but leaving `postCount`, `roadmapItem`, categories/statuses. **Avoid:** projection tests that disable one module and assert the other modules' JSON contains none of the suppressed fields (use canary strings like `canary-roadmap-leak.test.ts` does).

### Pitfall 5: Statuses are shared by Board and Roadmap
Removing all statuses when Board is off would empty the public roadmap columns. Use the N4 rule.

### Pitfall 6: Stale `dist` in tests
API tests resolve `@userhq/db`/`@userhq/types` from `dist`. Forgetting `bun run build:packages` yields "column does not exist"/schema-parse errors that look like logic bugs.

### Pitfall 7: Fail-open default in the guard
A missing decorator silently allowing a new route is the repo's cardinal sin (`no-exclusion-columns` exists for the same reason). Fail closed and prove with the route scan.

### Pitfall 8: Admin session on the public URL
With Option A an admin hitting `/api/v1/portal/.../posts` while Board is off gets 404; QA expectations and Playwright "as admin" journeys must use dashboard routes.

## Code Examples

### Guard extension (shape; names to be finalized by the planner)
```ts
// Source: extends apps/api/src/portal/portal.guard.ts (read this session) — add flags to the existing product select
const [prod] = await this.db
  .select({ id: products.id, board: products.boardEnabled, roadmap: products.roadmapEnabled,
            changelog: products.changelogEnabled, faq: products.faqEnabled })
  .from(products).where(/* unchanged: workspace + slug + deletedAt IS NULL */).limit(1);
if (!prod) throw new ApiException("not_found", 404, "Not found.");
const features = { board: prod.board, roadmap: prod.roadmap, changelog: prod.changelog, faq: prod.faq };
const wanted = this.reflector.getAllAndOverride<PortalFeature>(PORTAL_FEATURE, [ctx.getHandler(), ctx.getClass()]);
if (!wanted) throw new Error("PortalGuard: route has no @PortalFeature()");   // fail closed
if (!featureEnabled(features, wanted)) throw new ApiException("not_found", 404, "Not found.");
req.portal = { workspaceId: ws.id, productId: prod.id, features };
```
The guard's current `req.portal` assignment is `req.portal = { workspaceId: ws.id, productId, };` (portal.guard.ts:63). The `ws`-only branch (`GET /portal/:ws`, no `:product`) must skip the feature check and keep `features` undefined.

### Landing resolver (pure, unit-testable)
```ts
// apps/web/lib/portal-features.ts
const HREF = { board: "", roadmap: "/roadmap", changelog: "/changelog", faq: "/faq" } as const;
export function landingHref(ws: string, product: string, f: ProductFeatures): string | null {
  for (const k of PRODUCT_FEATURE_KEYS) if (f[k]) return `/${ws}/${product}${HREF[k]}`;   // D-13 order
  return null; // -> unavailable StatePage
}
```

## Test Seams and Runnable Commands

### Environment Availability
| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | all scripts | yes | 1.4.2 (matches `packageManager`) | - |
| node (real binary) | `node dist/migrate.js`, vitest shebang | yes | v26.13.0 at `/opt/homebrew/bin/node` (engines `>=24`). In interactive zsh, `node` is aliased to bun; scripts run via `bun run` resolve the real binary | - |
| Docker daemon | `stack:up`, Playwright journeys, compose dev services | **no** - colima installed but not running (`docker ps` fails: cannot connect to `~/.colima/default/docker.sock`) | CLI 29.8.2 | `colima start` (not done in this session) |
| Postgres 127.0.0.1:5432 | all `createTestApp` API tests, `packages/db` tests | **no** (port closed) | - | `bun run dev:services` (compose.dev.yaml: postgres:18 + mailpit + caddy) |
| Mailpit 127.0.0.1:1025/8025 | `email.test.ts`, any worker-delivery assertion | **no** | - | same `dev:services`; override `MAILPIT_HOST` |
| Postgres 127.0.0.1:5433 + web `:8080` | Playwright (`stack.ts` defaults `E2E_DATABASE_URL`, `E2E_BASE_URL`) | **no** | - | `bun run stack:up` (needs `.env.docker`, which exists; not read here) |
| Playwright CLI | browser specs | yes (`test:browser -- --list` ran) | 1.63.0 | - |

**Missing with no fallback in this session:** every DB-backed and browser check. Nothing below was executed except where marked VERIFIED; the DB-less commands (`email-render`, web vitest, `db:check`, `--list`) did pass.

### Commands (all verified to accept a file filter)
- Quick API: `bun run build:packages && bun run --filter @userhq/api test -- test/product-features.test.ts` (verified filter semantics with `test/email-render.test.ts`: "Test Files 1 passed (1)").
- Contract scan: `bun run --filter @userhq/api test -- test/public-contract.test.ts` (extend it; the existing test iterates `ModulesContainer` and asserts a required-routes list).
- Isolation/leak: `... -- test/portal-isolation.test.ts test/canary-roadmap-leak.test.ts test/portal-roadmap.test.ts test/portal-changelog.test.ts test/portal-faq.test.ts test/activity.test.ts test/notifications.test.ts test/unsubscribe.test.ts` (all exist).
- Email: `... -- test/email.test.ts test/email-render.test.ts` (Mailpit required).
- DB: `bun run build:packages && bun run --filter @userhq/db test` and `bun run --filter @userhq/db db:check` (the latter passed this session).
- Web: `bun run --filter @userhq/web test -- lib/portal-features.test.ts` (filter verified with `test/faq-portal.test.tsx`: 12 passed); types: `bun run --filter @userhq/types test`.
- Browser: `bun run stack:up` then `bun run --filter @userhq/api test:browser -- test/browser/product-features.spec.ts` (`-- --list` verified); `bun run stack:down` after.
- Gates: `bun run lint`, `bun run typecheck`, `bun run ci:check` (script exists; includes `db:check`).
- Never `bun test` for Nest code (decorator metadata, CLAUDE.md).

### Seams to reuse
- `createTestApp()` returns `{ app, http, auth, test, db, env, close }`, creates a real temp database and applies committed migrations; `signedInCookie(test, {...})` mints sessions; `seedTenants` gives two tenants (tenant B has post, comment, public roadmap item, changelog, FAQ; tenant A only a product + status) so feature tests should add a small local seeder with a published changelog entry, FAQ question, public roadmap item linked to a post, and a second member.
- Workers: `testApp.app.get(EmailWorker)` then `runOnce(new Date(Date.now()+25*3600e3))` (pattern at `email.test.ts:199-206`); verify delivery via Mailpit REST filtered by recipient (messages are shared across tests).
- Canaries: high-entropy strings planted in disabled-module content, asserted absent from every other module's JSON and from SMTP bodies.

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`, but the orchestrator explicitly requested this section, so it is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.3 (api: SWC decorator metadata, `pool: forks`, `testTimeout: 30000`); Playwright 1.63.0 (`workers: 1`, `retries: 0`, `testDir: test/browser`) |
| Config file | `apps/api/vitest.config.ts`, `apps/api/playwright.config.ts`, `apps/web/vitest.config.ts` (`environment: "node"`), `packages/*/vitest` |
| Quick run command | `bun run --filter @userhq/api test -- test/product-features.test.ts` |
| Full suite command | `bun run ci:check` (needs Postgres + Mailpit; browser suite separately) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | owner and admin can toggle; other tenant's admin gets 404; partial PATCH leaves siblings unchanged; concurrent different-key toggles both persist | HTTP | `... -- test/product-features.test.ts` | Wave 0 |
| CAP-02 | fresh DB and upgraded pre-existing rows all `true`; toggle off/on preserves posts, links, FAQ, entries | DB + HTTP | `bun run --filter @userhq/db test`; product-features | Wave 0 (db test is an edit) |
| CAP-03 | for each module: every route in inventory A returns 404 `not_found` for anon, customer, and the admin on the public URL; other modules still 200; writes do not mutate rows | HTTP matrix | product-features | Wave 0 |
| CAP-04 | admin Board edit/delete/comment/merge-search and Roadmap/Changelog/FAQ admin CRUD work with that module off; non-member gets 404 | HTTP | product-features | Wave 0 |
| CAP-05 | tabs, directory, landing for 4 single-module combos + all-off + all-on; direct URL 404 status; keyboard/mobile nav | unit (`lib/portal-features`) + Playwright | `bun run --filter @userhq/web test -- lib/portal-features.test.ts`; spec | Wave 0 |
| CAP-06 | N1-N7 projections with canaries; relationships intact after re-enable | HTTP | product-features, portal-roadmap, canary | Wave 0 / edits |
| CAP-07 | enqueue -> disable -> worker -> no mail, batch `cancelled`; re-enable -> still none; mixed-product batch; fan-out skipped; unread badge/list exclude; unsubscribe works with Board off | HTTP + Mailpit | email, notifications, activity, unsubscribe tests | edits + Wave 0 |
| CAP-08 | two-tenant matrix per module; roadmap private-field canary green in all 16 module combinations (or a sampled subset incl. all-off) | HTTP | canary + isolation + product-features | edits |
| CAP-09 | route scan: every `portal/:ws/:product*` handler has an explicit `@PortalFeature`; guard throws without one | contract | `... -- test/public-contract.test.ts` | edit |

### Sampling Rate
- **Per task commit:** the single targeted test file above plus `bun run typecheck`.
- **Per wave merge:** all API files listed under "Isolation/leak" and "Email", plus web vitest and `db:check`.
- **Phase gate:** `bun run ci:check` and the Playwright spec green on a disposable stack before `/gsd-verify-work`; unavailable infrastructure is a blocker, never a pass.

### Wave 0 Gaps
- [ ] `apps/api/test/product-features.test.ts` (matrix + CF-1 admin-while-off + partial PATCH + projections)
- [ ] `apps/api/test/browser/product-features.spec.ts`
- [ ] `apps/web/lib/portal-features.test.ts` with the pure helper
- [ ] `packages/db/test/migrate.test.ts` upgrade-path case
- [ ] Local seeder for linked post/roadmap/changelog/FAQ (extend `test/support/seed.ts` or inline)
- [ ] Infrastructure start: `colima start`, `bun run dev:services`, `bun run stack:up`

## Security Domain

`security_enforcement` is on (ASVS level 1, block on high).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | Better Auth sessions untouched; new admin Board routes sit behind `TenantGuard` (401 when no user) |
| V3 Session Management | no change | - |
| V4 Access Control | **yes** | `TenantGuard` for toggling and admin Board routes; `PortalGuard` + `@PortalFeature` for public; `tenant.productId` from URL resolution, never body (mass-assignment safe) |
| V5 Input Validation | yes | Zod `features: ProductFeaturesSchema.partial()`; unknown keys stripped (Zod default); response re-validated through `ProductDetailSchema.parse` |
| V6 Cryptography | no | email tokens unchanged (`signToken`) |
| V8 Data Protection | **yes** | explicit public DTO allowlists; nested-projection suppression; unsubscribe title/url stripped |
| V13 API | yes | uniform 404 for disabled vs nonexistent; throttling preserved on mirrored admin comment route |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant toggle (IDOR via slug) | Elevation | `TenantGuard` joins membership on workspace slug then product; test with tenant B's admin cookie against tenant A slug -> 404 |
| Public route missed by the gate (new/forgotten endpoint) | Info disclosure | fail-closed guard + `ModulesContainer` route scan test |
| Nested data via another module's endpoint (N1-N4) | Info disclosure | server-side projection suppression with canaries |
| Email/notification replay revealing old content | Info disclosure | delivery-point gate + terminal `cancelled` |
| Token-bearing endpoint disclosing post title (N7) | Info disclosure | strip title/url when board off |
| Admin auth confusion (gate used as authorization) | Elevation | policy only denies; it never grants (TenantGuard unchanged); Option B must be explicitly signed off |
| TOCTOU: flag flips between guard and handler | Tampering/Info | accepted at ASVS 1 (single request, flag read once per request) [ASSUMED - A10] |
| Mass assignment on PATCH | Tampering | explicit key-by-key `updateData` build (existing style) |
| Stale caching of disabled pages | Info disclosure | `apiServer` uses `cache: "no-store"`; root fallback uses 307 |

## Draft-Plan Reconciliation (06-01..06-04 vs real code)

| Draft statement | Finding | Action |
|---|---|---|
| CONTEXT pointers (schema, contracts, controllers, web files, tests) | All referenced files exist and match descriptions. `[ws]/page.tsx` path is `apps/web/app/[ws]/page.tsx`; other web paths are relative to `apps/web/app/` as CONTEXT says. `apps/api/src/portal/portal.controller.ts` contains the two metadata handlers | none |
| 06-01 "private admin management still works" | False for Board posts/comments without CF-1 | add admin routes + repoint to 06-01 (or a new plan before it) |
| 06-01 verify `db:generate` | Emits broken SQL (CF-2) | add trim + "No schema changes" re-generate step |
| 06-01 files_modified | omits `portal/product-features.ts`, admin Board controller, `feedback.module.ts` registration, dashboard components in CF-1 table, `packages/db/test/migrate.test.ts` | add |
| 06-02 "FAQ tree/search/deep-link" | only `GET faq` exists; search is client-side | simplify |
| 06-02 uses `public-contract.test.ts` | good prior art; extend with feature-classification assertion | keep |
| 06-03 files | omits `posts.service.ts` (N1), `linked-roadmap-banner.tsx`, `public-roadmap-board.tsx`, `faq-not-found-prompt.tsx`, roadmap/changelog/faq `page.tsx` files, `generateMetadata` changes; says "inspect at gate" | add per Web table |
| 06-04 files | omits `unsubscribe.controller.ts` (N7); `render.ts` needs no change; `products.controller.ts` only if Open Question 1 strict option is chosen | adjust |
| 06-04 key_link worker -> `portal.guard.ts` | worker needs the column predicate, not the guard | point at `product-features.ts` |
| Wave order | Delivery (06-04 part 1) is API-only and depends only on the column; it can run parallel with 06-02 | optional reorder |
| Estimates (35-55k tokens, confidence low) | CF-1 adds ~6 handlers plus 5 component edits | re-estimate |

Suggested re-cut (planner's discretion): (1) persistence + contract + policy + guard + Board gate + admin Board routes + dashboard repoint + upgrade test; (2) remaining modules + projections N1-N4/N7 + route-scan test; (3) delivery gates (parallel with 2); (4) web settings, tabs, landing, page gates, CTAs, Playwright.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hide tabs only | API-enforced gating + page 404 | satisfies D-08 |
| Hand-edit snapshots | generate, trim, regenerate to a clean "No schema changes" | repairs the stale snapshot chain as a side effect |

**Deprecated/outdated:** none relevant (drizzle 1.0 RC upgrade is out of scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All-off product root renders the branded `StatePage` with HTTP 200 (precedent: suspended workspace state) rather than 404; maybe `noindex` | Web | UX/SEO preference; UI-SPEC to decide |
| A2 | Pre-disable unread in-app rows reappearing on re-enable is acceptable under D-14 | Delivery | If not, mark-read/delete at disable in PATCH transaction |
| A3 | A comment email queued before disable and due after re-enable is delivered normally | Delivery | If not, cancel pending items at disable (Open Question 1) |
| A4 | Uploaded images used by disabled changelog/FAQ content remain fetchable by exact unguessable URL; acceptable | Inventory | Needs access-checked uploads (out of scope) |
| A5 | Column names `board_enabled`... (experiment used `feature_*`; SQL shape identical) | Persistence | cosmetic |
| A6 | PostgreSQL 11+ fast default for `ADD COLUMN DEFAULT <const> NOT NULL` | Persistence | tests prove behaviour regardless |
| A7 | API deployed before/with web; web schema is strict | Persistence | one failed render during a staged rollout |
| A8 | Throttle decorators mirrored on the admin comment route | CF-1 | trivial |
| A9 | 301/308 would be cached by browsers/CDNs; use 307 | Web | stale landing after re-enable |
| A10 | Flag read once per request; mid-request flips acceptable | Security | negligible at ASVS 1 |
| A11 | Option A (strict public gate + admin routes) is what the user wants over Option B | CF-1 | wrong scope; needs confirmation |

## Open Questions

1. **Strict D-14 for items queued before a disable.**
   - Known: with the recommended gate, batches due during the off-window are cancelled durably; queued-before/due-after-re-enable mail and pre-disable unread in-app rows are delivered/visible again.
   - Unclear: whether "not replayed on re-enable" should also cover those.
   - Recommendation: ship stateless default; if strict, in the same `updateProduct` transaction on `board=false` delete the product's pending `comment_email_items` (worker then cancels the empty batches) and set `read_at = now()` on the product's unread notifications (about 15 lines, no schema change). Needs user confirmation (A2/A3).
2. **CF-1 Option A vs Option B** (A11). Recommendation A; confirm.
3. **All-off HTTP status and whether all-off products stay in the directory** (CONTEXT says preserve entries unless UX rule). UI-SPEC decision.
4. **Dashboard affordances while a module is off** (badge in sidebar, disable "View on portal"). UI-SPEC decision.

## Sources

### Primary (HIGH confidence — read or executed this session)
- `.planning/phases/06-product-feature-controls/` (CONTEXT, SOURCE-AUDIT, 06-01..06-04), `REQUIREMENTS.md` CAP-01..09, `docs/specs/workspace-platform-expansion.md`, `GLOSSARY.md` ("Product feature")
- API: `portal/portal.guard.ts`, `portal/portal.controller.ts`, `tenancy/tenant.guard.ts`, `products/products.controller.ts`, `feedback/portal-*.controller.ts`, `feedback/admin-posts.controller.ts`, `feedback/posts.service.ts`, `feedback/comments.service.ts`, `roadmap/portal-roadmap.controller.ts`, `changelog/portal-changelog.controller.ts`, `faq/portal-faq.controller.ts`, `notifications/*`, `email/outbox.ts`, `email/worker.ts`, `email/unsubscribe.controller.ts`, `auth/guards.ts`, `auth/decorators.ts`, `app.module.ts`, `common/api-error.filter.ts`
- DB/types: `packages/db/src/schema/{tenancy,feedback,notifications}.ts`, `src/index.ts` (`runMigrations`, `MIGRATION_LOCK_KEY = 727001`), `src/migrate.ts`, migrations 0010-0012 + `meta/_journal.json`, `packages/types/src/{tenancy,feedback,account,index}.ts`, `drizzle-orm/pg-core/dialect.js` migrator
- Web: layout/pages under `apps/web/app/[ws]/**`, `components/{portal,post,faq,roadmap,notifications,activity}/*`, `lib/api-server.ts`, `proxy.ts`, dashboard settings/post-detail files
- Tests: `test/support/{test-app,seed,stack,auth-helpers}.ts`, `public-contract.test.ts`, `portal-isolation.test.ts`, `canary-roadmap-leak.test.ts`, `email.test.ts`, `packages/db/test/migrate.test.ts`, `playwright.config.ts`
- Executed: `bun run --filter @userhq/db db:check` (passed); `bun run --filter @userhq/api test -- test/email-render.test.ts` (1 file, 16 tests passed); `bun run --filter @userhq/web test -- test/faq-portal.test.tsx` (12 passed); `bun run --filter @userhq/api test:browser -- --list test/browser/votes.spec.ts`; throwaway `drizzle-kit generate`/`check` in `/tmp/p6gen`; environment probes (`docker ps`, port checks)

### Secondary (MEDIUM)
- PostgreSQL fast-default behaviour (general knowledge, not fetched this session) — hence A6

### Tertiary (LOW)
- none

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; versions read from manifests
- Architecture: HIGH - guard/service/controller code read end to end; CF-1..3 reproduced by reading or execution
- Pitfalls: HIGH - CF-2 reproduced; others from direct reads
- Delivery semantics: MEDIUM - mechanics verified by reading, D-14 interpretation flagged (Open Question 1)
- Web/vinext behaviour: MEDIUM - precedent-based; no browser run was possible (no Docker)

**Research date:** 2026-11-05
**Valid until:** 2026-12-05 (stable codebase; re-check CF-2 if another migration lands first, since any newer `generate` will re-emit the same stale-snapshot diff until 0013's snapshot is committed)
