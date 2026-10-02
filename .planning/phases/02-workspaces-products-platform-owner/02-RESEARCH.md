# Phase 2: Workspaces, Products & Platform Owner - Research

**Researched:** 2026-10-02
**Domain:** Multi-tenant SaaS foundations: tenancy schema, guards, invite tokens, platform-owner console, ban and suspension, branded public portal shell
**Confidence:** HIGH for the stack and existing-code facts (read from source this session), MEDIUM for the recommended module and route shapes (design choices)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Admin area & URLs
- **D-01:** The admin dashboard is a separate tree: `/dashboard/{ws}/...` holds workspace pages (Settings, Team, Products), and `/dashboard/{ws}/{product}/...` holds product pages (Statuses now; Board, Roadmap, Changelog, and FAQ in later phases). Public portal routes (`/{ws}`, `/{ws}/{product}`) contain no admin UI. — **Reversibility:** costly — every later phase adds pages under this tree, and moving it means rewriting routes and links.
- **D-02:** Landing after sign-in when there is no `?next=`: a user with 0 workspaces stays on home (with a "Create workspace" CTA if they hold a valid platform invite or are the owner, otherwise an invite-only note); a user with 1 workspace goes to `/dashboard/{ws}`; a user with 2+ goes to a `/dashboard` picker list.
- **D-03:** The workspace switcher is a dropdown in the dashboard header, showing the current workspace's logo and name. It reuses the existing Radix DropdownMenu, lists the user's workspaces, and offers "Create workspace" when allowed.
- **D-04:** Dashboard navigation is a left sidebar with a workspace section and a per-product section, so it scales through Phase 5.
- **D-05:** The platform owner console lives at `/platform` (invites, workspaces, users) and is linked only from the owner's user menu. Add `platform` to the reserved slugs. Non-owners get the app's normal 404, from both the page and its API (PLAT-07).
- **D-06:** The platform owner is also a normal user: they sign in the same way, can create workspaces without an invite, and can post and vote on portals. Console access is an extra capability derived from the config email.

#### Portal shell & branding
- **D-07:** `/{ws}/{product}` renders a branded header, a tab nav, and a neutral "coming soon" body. A tab appears only once its feature exists, and Phases 3–5 drop their content into the body slot.
- **D-08:** Branding is per product, with the workspace logo as fallback:
  - logo and name (PROD-01)
  - **accent color**: one hex per product that re-themes buttons, links, the vote button, and the active tab by overriding a CSS token; the text color on the accent is picked automatically for WCAG contrast
  - **tagline**: a one-liner shown in the portal header, on `/{ws}` product cards, and as the meta description
  - **website link** ("Back to {company}"): optional, `https:` only, and falls back to the workspace website URL
  - favicon and Open Graph tags generated automatically from the logo, name, and tagline, with no extra uploads
  — **Reversibility:** costly — these are new columns on products and workspaces, and the portal theming plumbing that later phases inherit.
- **D-09:** Workspaces get a **website URL** field (`https:` only). It is the product website-link fallback and the redirect target in D-10.
- **D-10:** `/{ws}` lists the workspace's live products as cards (logo, name, tagline, accent). With exactly one live product it **auto-redirects** to that portal. A workspace setting can **disable** the page: `/{ws}` then redirects to the workspace website URL, or returns 404 when none is set. New workspaces default to enabled, which satisfies PROD-05.
- **D-11:** Portals show a small "Powered by UserHQ" footer link. It is always on, with no toggle in v1.
- **D-12:** Explicitly excluded: custom CSS, custom fonts, custom domains, a dark theme (deferred since Phase 1), and separate favicon or OG image uploads.

#### Invite links (platform + teammate)
- **D-13:** One route, `/invite/{token}`, serves both kinds from one invites table with a `kind` (`platform` | `workspace`). Accepting a platform invite leads to the "Create your workspace" form; accepting a workspace invite joins the user as admin and lands on `/dashboard/{ws}`.
- **D-14:** Every invite is bound to **one specific email**, is single-use, and **expires after 7 days**. The token is cryptographically random and stored only as a hash; the raw token appears only in the link. **No email is sent**: the inviter copies the link and shares it themselves (v1 email is reserved for comment notifications). — **Reversibility:** costly — a hashed token can't be recovered, so a later "show the link again" means regenerating it.
- **D-15:** A signed-out visitor opening an invite link goes **straight to `/login?next=/invite/{token}`** with no preview page. The invite is accepted on return.
- **D-16:** **Strict email match** (WORK-04): the user's verified OAuth email must equal the invite email (case-insensitive). On mismatch, show a plain page ("This invite is for another email address", with the email masked) and an option to sign out and use another account. The invite stays unused. Expired, used, and revoked links each get a clear message telling the user to ask for a new link.
- **D-17:** The invite list shows each invite's state (pending, used and by whom, expired, revoked), with revoke for unused invites (PLAT-03, and the same for teammate invites).

#### Defaults for areas not discussed (user accepted)
- **D-18:** Product delete is a soft delete. The slug stays reserved within the workspace and is never reused, and there is no restore UI in v1. The admin confirms by typing the product name. The deleted portal and its `/{ws}` card disappear.
- **D-19:** A ban revokes all of the user's sessions immediately and blocks new sign-ins (checked in the shared guard and at sign-in). The user's content stays.
- **D-20:** A suspended workspace shows its admins an "unavailable" notice in place of the dashboard, and its portals show the public "unavailable" page. No suspension reason is shown in v1.
- **D-21:** The status editor reorders with drag handles. Colors come from a preset palette plus a free hex input.

### Claude's Discretion
- How reorder is implemented: @dnd-kit/react (already chosen for the Phase 4 Kanban), or a lighter approach if that's simpler.
- The preset palette values, the contrast algorithm for accent text, and the slug format rules (length, charset).
- How the "coming soon" body looks, and the copy for invite error pages.
- How the `/dashboard` picker and the empty home state look.

### Deferred Ideas (OUT OF SCOPE)
- **Inviter/owner approval of an email-mismatched invite claim.** This covers approval requests, locking the invite to the requester, and pending badges on the invite list. The user wants it eventually, but not now.
- Restoring a deleted product, and showing a suspension reason. Revisit if admins ask.
- Custom domains, custom CSS, and a dark theme for portals.

**Also binding:** `02-UI-SPEC.md` (approved 2026-10-02) fixes the route map, components, copy, error-code names, reserved slugs, slug regex, palette, seeded status colors, and the `accentTokens()` contract. This research does not re-decide any of it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Platform owner = verified email in server config; can't be granted in-app | `PLATFORM_OWNER_EMAIL` env plus an `emailVerified` check (Pattern 3, Pitfall 2) |
| PLAT-02 | Owner creates an expiring, single-use workspace invite for an email | `invites` table with `kind='platform'`, hashed token, atomic consume (Pattern 5) |
| PLAT-03 | Owner sees invite state and revokes unused ones | State is derived from `used_at` / `revoked_at` / `expires_at` (Pattern 5) |
| PLAT-04 | Owner browses workspaces, products, users with member/post/vote counts | `/api/v1/platform/*` list endpoints; posts and votes return literal `0` until Phase 3 (Pattern 3) |
| PLAT-05 | Suspend or lift a workspace; portals show unavailable, dashboard offline | `workspaces.suspended_at`, checked in `TenantGuard` and `PortalGuard` (Pattern 2) |
| PLAT-06 | Ban or lift a user platform-wide | `user.banned_at`, Better Auth `session.create.before` hook, delete sessions, `SessionGuard` check (Pattern 4) |
| PLAT-07 | Owner console and API are 404 for everyone else | `@Public()` on the platform controller plus a guard that throws 404, so anonymous callers get 404 and not 401 (Pitfall 1) |
| WORK-01 | Invite holder or owner creates a workspace (name, slug, logo) and becomes owner | `POST /workspaces` consumes the platform invite in the same transaction (Pattern 5) |
| WORK-02 | Taken or reserved slugs rejected | Shared `RESERVED_WORKSPACE_SLUGS` plus a unique index and `onConflictDoNothing` (Pattern 6) |
| WORK-03 | Admin creates a teammate invite link for an email | Same `invites` table, `kind='workspace'` |
| WORK-04 | Invitee joins as admin only with a matching verified email | Accept checks `user.emailVerified && lower(email) = invite.email` (Pattern 5) |
| WORK-05 | Admin removes a teammate; owner can't be removed | `DELETE /workspaces/:ws/members/:userId` refuses `role='owner'` |
| WORK-06 | Admin leaves; owner can't | `POST /workspaces/:ws/leave` refuses `role='owner'` |
| PROD-01 | Create multiple products (name, slug, logo) | Product insert plus status seed in one transaction (Pattern 7) |
| PROD-02 | Rename and relogo; slug fixed | `PATCH` schema has no `slug` key; Zod strips unknown keys |
| PROD-03 | Delete removes the portal, keeps the data | `products.deleted_at`; every resolver filters `deleted_at IS NULL` |
| PROD-04 | Anyone views `/{ws}/{product}` signed out | `GET /api/v1/portal/:ws/:product` is `@Public()` and returns an allowlisted DTO |
| PROD-05 | `/{ws}` lists products | `GET /api/v1/portal/:ws` |
| STAT-01 | Five seeded statuses, Under Review default | Seed constant inside the product-create transaction |
| STAT-02 | Add a status (name, color, type) | `status_type` pgEnum plus a case-insensitive unique name index |
| STAT-03 | Rename, recolor, reorder | `PATCH` plus `PUT .../statuses/order` with the full id list |
| STAT-04 | Delete only with a replacement; default and last can't be deleted | `DELETE ...?moveTo=` transaction; posts and roadmap items join in Phases 3 and 4 (Pattern 8) |
| STAT-05 | Choose the default status | Partial unique index plus two-step update ordering (Pitfall 5) |
</phase_requirements>

## Summary

Phase 1 left a small, clean base. There is a global `OriginGuard` + `SessionGuard` pair, `@Public()` / `@CurrentUser()`, an `ApiException` filter with a closed `API_ERROR_CODES` list, a Drizzle `schema` object with `auth` and `uploads` tables, a `createTestApp()` harness that boots Nest against a throwaway Postgres database per test file, and Better Auth 1.7.7 with database sessions and no cookie cache. All of these were read this session. Phase 2 adds no new backend dependencies. Everything it needs is already installed: Drizzle partial and expression indexes, `db.transaction`, Better Auth `databaseHooks` and `user.additionalFields`, Nest 12 `StandardSchemaValidationPipe` and `StandardSchemaSerializerInterceptor`, and `node:crypto`. The web app adds the seven UI packages that the approved UI-SPEC names.

The phase is mostly authorization plumbing. One `TenantGuard` resolves `:ws` and an optional `:product` from slugs and checks membership (non-members get 404), then suspension (members get 403 `workspace_suspended`), then product liveness. One `PortalGuard` does the same for the public portal: suspension, deletion, unknown slug. One `PlatformOwnerGuard` 404s everyone except the verified config email. Ban is enforced in three places: a Better Auth `session.create.before` hook blocks new sessions, the ban action deletes existing session rows, and `SessionGuard` treats a banned user as signed out. Slugs are immutable for both workspaces and products, so admin API routes can be keyed by slug (`/workspaces/:ws/products/:product/...`). That removes the slug-to-id round trip from every RSC page.

The phase must leave behind three seams that Phases 3–5 extend:
- a cross-tenant 404 suite that fails when a new `:ws` route is not listed in it
- a public-response contract test that fails when an `@Public()` handler lacks a serializer schema
- the status-delete transaction, with a marked spot where posts and roadmap items will be reassigned

**Primary recommendation:** Build the schema and the three guards first, and the cross-tenant and contract test scaffolds with them. Then build the feature controllers on top: platform, workspaces and team, products and statuses, portal. The web dashboard, portal, and platform UI come last, against a stable API.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Platform-owner identity | API (`env` + session user) | Web (reads `me.isPlatformOwner`) | Config email lives only in the API container. The web image never sees it. |
| Tenant resolution and membership authz | API (`TenantGuard`) | Web (RSC calls `notFound()` on API 404) | Real authorization always happens in Nest (CLAUDE.md Q3). |
| Ban (block sign-in, kill sessions) | API (Better Auth hook + `SessionGuard`) | Web (`/login?error=account_banned` copy) | Sessions are DB rows in the API's database. |
| Suspension | API (`TenantGuard`, `PortalGuard`, invite accept) | Web (unavailable pages keyed on the `workspace_suspended` code) | — |
| Invite tokens (generate, hash, consume) | API | Web (`/invite/[token]` page; accept POST from a client component) | The raw token must never be stored, and hashing happens server-side. |
| Slug rules and reserved list | Shared `@userhq/types` | API enforces, web pre-validates | One constant, two consumers (UI-SPEC). |
| Accent contrast (`accentTokens`) | Web (`lib/accent.ts`) | API validates hex on write | The value goes into an inline `style`. Both the server regex and the client fallback guard it. |
| Portal rendering, metadata, OG | Web RSC (`generateMetadata`) | API `GET /portal/...` allowlisted DTO | — |
| Logo storage | API (`uploads` table, volume) | Web (`LogoField` upload) | Phase 1 pipeline, unchanged. |
| Status ordering and default | Database (partial unique index) + API transaction | Web (optimistic dnd list) | The DB constraint is the invariant. |

## Project Constraints (from CLAUDE.md)

- Web is vinext 1.0.0 with `output: "standalone"`. There are no Server Actions for app mutations: use TanStack Query to call Nest. Do not use `import.meta.env` or Vite-only APIs (lint rule `userhq/no-import-meta-env`).
- `apps/web` may not import `@userhq/db`, `drizzle-orm`, `pg`, `sharp`, or `better-auth` except its client entries. The `radix-ui` barrel, `next/image`, and `next/font/google` are banned too (enforced in `.oxlintrc.json`).
- Use individual `@radix-ui/react-*` packages, hand-written shadcn-style components, and no shadcn CLI.
- Public responses use explicit `select()` column maps plus hand-written `Public*` Zod schemas. Never use `columns: { x: false }` (lint rule `userhq/no-exclusion-columns` on `apps/api/**` and `packages/db/**`). Never derive public DTOs with `drizzle-zod`.
- Validation uses Nest 12 Standard Schema with Zod. Not class-validator, not nestjs-zod.
- Every query is scoped by workspace or product and enforced by Nest guards. The cross-tenant test suite grows with each feature.
- Internal roadmap fields must be unreachable from public endpoints. This phase starts the contract-test scaffold for that.
- Drizzle 0.45.3 and drizzle-kit 0.31.11. Migrations are generated (`bun run --filter @userhq/db db:generate`) and committed.
- Tests run on Vitest on Node. Never use `bun test` for Nest code. Scripts call the Nest CLI through `node`.
- Install with Bun's isolated linker (`bunfig.toml` `linker = "isolated"`, `exact = true`). New packages go through `bun pm untrusted` review.
- GSD workflow: changes happen through `/gsd-execute-phase`.

## Standard Stack

### Core (already installed — no backend additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.3 | Schema, `transaction`, partial and expression unique indexes, `check()`, `pgEnum` | `uniqueIndex().on(...SQL).where(SQL)`, `check(name, SQL)`, `pgEnum` and `transaction` all exist in installed typings [VERIFIED: node_modules drizzle-orm pg-core/indexes.d.ts:37-67, checks.d.ts:18, columns/enum.d.ts:82, node-postgres/session.d.ts:50] |
| better-auth | 1.7.7 | `databaseHooks.session.create.before`, `user.additionalFields` with `input: false` | The admin plugin uses exactly this hook for bans [VERIFIED: better-auth dist/plugins/admin/admin.mjs:33-51] |
| @nestjs/common | 12.1.2 | `StandardSchemaValidationPipe`, `StandardSchemaSerializerInterceptor`, `@Body({ schema })` | [VERIFIED: node_modules @nestjs/common pipes/standard-schema-validation.pipe.d.ts; route-params.decorator.d.ts:13] |
| @nestjs/core | 12.1.2 | `DiscoveryService` for the route-coverage tests | [VERIFIED: node_modules @nestjs/core/discovery/discovery-service.d.ts exists] |
| zod | 4.6.5 | Shared input schemas, `z.url({ protocol, hostname })` | [VERIFIED: zod v4/core/schemas.d.ts:179-180] |
| node:crypto | Node 24 | `randomBytes(32)`, `createHash('sha256')` for invite tokens | stdlib |

### Supporting (web, new in Phase 2 — all named by the approved UI-SPEC)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | 1.1.23 | `Dialog`, `Drawer` | Status add/edit form, mobile sidebar |
| @radix-ui/react-alert-dialog | 1.1.23 | `ConfirmDialog` | Every destructive confirm |
| sonner | 2.0.8 | Toasts (success only) | `<Toaster>` in each shell layout |
| @dnd-kit/react | 0.5.0 | Status reorder | `DragDropProvider` + `useSortable` with `handleRef` |
| react-hook-form | **7.88.0** (see audit) | Forms | Create and settings forms |
| @hookform/resolvers | 5.9.1 | `zodResolver(sharedSchema)` | Same |

Versions were verified with `/opt/homebrew/bin/npm view` on 2026-10-02 [VERIFIED: npm registry]. `@radix-ui/react-alert-dialog@1.1.23` depends on `@radix-ui/react-dialog: 1.1.23`, and both share `react-slot 1.3.3` / `react-primitive 2.1.10` with the already-installed dropdown, so there is no duplicate Radix tree.

**Drop `@dnd-kit/helpers` for Phase 2** (Claude's discretion, D-21). The official single-list guide needs only `isSortable` from `@dnd-kit/react/sortable` plus an array splice in `onDragEnd`. `move()` matters only for multi-list (Kanban) state [CITED: dndkit.com/react/guides/sortable-state-management]. Add it in Phase 4. If the planner prefers to follow the UI-SPEC dependency list literally, keeping it costs nothing (OK verdict).

**Installation:**
```bash
bun add --filter @userhq/web @radix-ui/react-dialog@1.1.23 @radix-ui/react-alert-dialog@1.1.23 sonner@2.0.8 @dnd-kit/react@0.5.0 react-hook-form@7.88.0 @hookform/resolvers@5.9.1
bun pm untrusted   # expect nothing new; none of these declare install scripts
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Own `banned_at` column + hook | Better Auth `admin` plugin | The plugin adds `role`, `banReason`, `banExpires`, and `/api/auth/admin/*` endpoints gated by an in-app role. That contradicts PLAT-01 ("can't be granted from inside the app"). Copy its hook pattern, not the plugin. |
| `statuses.is_default` + partial unique index | `products.default_status_id` FK | A circular FK (product→status→product) needs deferrable constraints or insert-then-update inside the create transaction. The flag plus partial index is simpler and still DB-enforced. |
| Slug-keyed admin routes | Id-keyed admin routes (ARCHITECTURE.md §7) | ARCHITECTURE chose ids so slug renames wouldn't break the dashboard. Both slugs are now immutable (UI-SPEC, PROD-02), so slugs remove an extra lookup per RSC page. |
| Hand-rolled `aria-live` announcements | dnd-kit `Accessibility` plugin defaults | The UI-SPEC needs name-based announcements. In 0.5.0 the `Accessibility` plugin has no `static configure` (unlike `KeyboardSensor`/`PointerSensor`) [VERIFIED: @dnd-kit/dom@0.5.0 index.d.ts:198-230]. |

## Package Legitimacy Audit

| Package | Registry | Age (this version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @radix-ui/react-dialog | npm | 1.1.23, 2026-07-24 | 88M/wk | github.com/radix-ui/primitives | OK | Approved |
| @radix-ui/react-alert-dialog | npm | 1.1.23, 2026-07-24 | 57M/wk | github.com/radix-ui/primitives | OK | Approved |
| sonner | npm | 2.0.8, 2026-08-09 | 62M/wk | github.com/emilkowalski/sonner | OK | Approved |
| @dnd-kit/react | npm | 0.5.0 | 1.7M/wk | github.com/clauderic/dnd-kit | OK | Approved |
| @dnd-kit/helpers | npm | 0.5.0 | 1.4M/wk | github.com/clauderic/dnd-kit | OK | Deferred to Phase 4 (not needed for one list) |
| react-hook-form | npm | 7.89.0 published 2026-09-26 (6 days) | 68M/wk | github.com/react-hook-form/react-hook-form | **SUS (reason: `too-new`)** | Pin **7.88.0** (2026-09-11) instead. CLAUDE.md's 7.89.0 pin is the flagged version. |
| @hookform/resolvers | npm | 5.9.1 | — | github.com/react-hook-form/resolvers | OK | Approved. Every validator peer (zod, yup, joi, …) is `optional: true` in `peerDependenciesMeta`, so Bun won't pull them. |

All verdicts come from `gsd-tools query package-legitimacy check --ecosystem npm` [VERIFIED: seam output 2026-10-02]. `npm view <pkg> scripts.postinstall` was empty for all seven.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `react-hook-form@7.89.0`. The only reason is recency; it is a 68M/week package. The planner keeps the existing `bun.lock` human-verify checkpoint and pins `7.88.0`. Alternatively the user explicitly confirms 7.89.0 at that checkpoint.

## Architecture Patterns

### System Architecture Diagram

```
Browser ──► Caddy/Traefik (same origin)
   │            ├── /api/* , /uploads/*  ──► Nest API (apps/api)
   │            └── everything else      ──► vinext web (apps/web)
   │
   │  RSC page (web) ── apiServer(path) + forwarded cookie ──► API
   │  Client mutation (TanStack) ── fetch('/api/v1/...', Origin) ──► API
   ▼
Nest request pipeline (global guards run in registration order):
  OriginGuard (non-GET needs same Origin)
    └► SessionGuard (Better Auth getSession; bannedAt ⇒ treated as anonymous)
         ├─ /api/auth/*  → Better Auth handler
         │       └─ OAuth callback → session.create.before hook
         │              banned? → redirect errorCallbackURL?error=account_banned
         ├─ /platform/*   @Public → PlatformOwnerGuard: owner? else 404
         ├─ /portal/:ws[/:product]  @Public → PortalGuard
         │       unknown/deleted → 404 · suspended → 403 workspace_suspended
         │       → allowlisted Public* DTO (Zod-strip serializer)
         ├─ /workspaces/:ws/...  → TenantGuard
         │       not member → 404 · suspended → 403 workspace_suspended
         │       :product missing/deleted → 404 → req.tenant
         │       → service(tx scoped by tenant.workspaceId / productId)
         ├─ /workspaces (POST create) → owner OR pending platform invite (consumed in tx)
         ├─ /invites/:token (GET state, POST accept) → hash lookup → email+verified match
         └─ /me → user + workspaces + canCreateWorkspace + isPlatformOwner
                          │
                          ▼
                 Postgres (Drizzle): user(+banned_at) · workspaces · workspace_members
                 · products · statuses · invites · uploads
```

### Recommended Project Structure

```
packages/types/src/
├── index.ts            # existing; re-export the files below
├── slugs.ts            # SLUG_RE, RESERVED_WORKSPACE_SLUGS, RESERVED_PRODUCT_SLUGS, slugify()
├── tenancy.ts          # Create/Update Workspace|Product|Status inputs, Public* portal schemas, Me additions
└── palette.ts          # PALETTE presets + SEEDED_STATUSES + DEFAULT_ACCENT (UI-SPEC values)
packages/db/src/schema/
├── auth.ts             # + bannedAt column on user
├── tenancy.ts          # workspaces, workspaceMembers, products, statuses, invites, enums
apps/api/src/
├── tenancy/            # TenantGuard, PortalGuard, @CurrentTenant(), slug + unique helpers
├── workspaces/         # workspaces.controller (admin), members, team invites
├── products/           # products.controller (admin), statuses.controller (admin)
├── portal/             # portal.controller (@Public, the only public tenant reads)
├── invites/            # invites.service (shared token logic), invites.controller (/invites/:token)
├── platform/           # platform.controller (@Public + PlatformOwnerGuard)
└── auth/               # existing; + ban hook in auth.ts, ban check in guards.ts, me.controller extended
apps/api/test/
├── cross-tenant.test.ts      # NEW seam: route table + coverage assertion
├── public-contract.test.ts   # NEW seam: every @Public handler has a schema; exact key sets
└── support/seed.ts           # two workspaces A/B with product + statuses each
apps/web/
├── app/layout.tsx            # html/body/font only
├── app/(app)/layout.tsx      # <AppShell> = Phase 1 header + container + Toaster
├── app/(app)/{page,login,invite/[token],platform/...,dev}/...
├── app/dashboard/page.tsx, app/dashboard/new/page.tsx   # wrap themselves in <AppShell>
├── app/dashboard/[ws]/layout.tsx       # dashboard shell (sidebar, switcher, QueryProvider)
├── app/[ws]/page.tsx, app/[ws]/[product]/{layout,page}.tsx   # portal shell
├── app/not-found.tsx         # must render <AppShell> itself (see Pitfall 9)
└── lib/{tenant.ts (portalHref), accent.ts, api-errors.ts}
```

### Pattern 1: Slug-keyed admin routes behind one `TenantGuard`

**What:** A single guard reads `req.params.ws` and optionally `req.params.product`. It runs one query (workspace by slug, joined to membership for `req.user.id`). It returns 404 when the workspace is missing or the caller is not a member, 403 `workspace_suspended` for members of a suspended workspace, and 404 when the product slug is missing or `deleted_at` is set. It attaches `req.tenant = { workspaceId, productId?, role }`. Services take `tenant.workspaceId` / `tenant.productId` as their first argument and never read either from the body.

**When to use:** Every `/api/v1/workspaces/:ws/...` route. Apply it at controller level with `@UseGuards(TenantGuard)`.

**Order matters:** check membership *before* suspension, so a non-member probing a suspended workspace still gets 404 (no existence leak).

### Pattern 2: Public reads only through `PortalGuard` + allowlisted DTOs

`PortalGuard` resolves `(ws, product)` with `deleted_at IS NULL`. It returns 404 when the slug is unknown and 403 `workspace_suspended` when the workspace is suspended. The portal page shows "This page is unavailable" for that code (UI-SPEC). The controller selects explicit columns (`select({ name: products.name, ... })`), maps them to a `PublicPortalProduct` object, and declares `@SerializeOptions({ schema: PublicPortalProductSchema })`. A Zod 4 `z.object` strips unknown keys on output, so the serializer is a second allowlist [VERIFIED: @nestjs/common serializer/standard-schema-serializer.interceptor.js:52-58 validates through `~standard.validate`]. Never use `z.looseObject` for a `Public*` schema.

### Pattern 3: Platform owner = verified config email, console 404 for everyone else

- Add `PLATFORM_OWNER_EMAIL: z.email().transform(s => s.toLowerCase())` to `EnvSchema` (required).
- `isPlatformOwner(user) = user.emailVerified === true && user.email.toLowerCase() === env.PLATFORM_OWNER_EMAIL`.
- `PlatformController` is `@Public()`, because otherwise `SessionGuard` returns **401** to anonymous callers. It uses `@UseGuards(PlatformOwnerGuard)`, which throws `ApiException("not_found", 404, …)` when `!req.user || !isPlatformOwner(req.user)`.
- Counts: `members` and `products` are `count(*)` subqueries. `posts` and `votes` return literal `0` with a `ponytail:` comment naming Phase 3 as the upgrade point (UI-SPEC: "rendered from the API, never hard-coded" in the web).
- Search: `ilike(workspaces.name, pattern)` OR `ilike(workspaces.slug, pattern)`, where `pattern = '%' + escapeLike(q) + '%'`. Paginate 50 rows with `limit(51)` to detect `hasNext`.

### Pattern 4: Ban = hook + session purge + guard (D-19)

1. `user.banned_at timestamptz NULL` in `packages/db/src/schema/auth.ts`. Declare it in Better Auth `user.additionalFields: { bannedAt: { type: "date", required: false, input: false } }`. Then `getSession()` returns it with no extra query, and `/api/auth/update-user` refuses to set it. [VERIFIED: better-auth dist/db/schema.mjs:65-75 throws `FIELD_NOT_ALLOWED` when an `input: false` field is set]
2. `databaseHooks.session.create.before` looks up `banned_at` with the `db` already passed to `createAuth`, and throws `APIError.from("FORBIDDEN", { code: "account_banned", message })`. The OAuth callback turns an `APIError` that carries `body.code` into a redirect to the `errorCallbackURL` with `?error=<code>` [VERIFIED: better-auth dist/api/routes/callback.mjs:78-84, 191-192]. The web already sends `errorCallbackURL = /login?next=…` [VERIFIED: apps/web/app/login/login-buttons.tsx:46-53]. The code **must be lowercase** because `isDisplayableErrorCode` only accepts `/^[a-z0-9_]{1,64}$/` [VERIFIED: apps/web/lib/login-errors.ts:66-68]. Use `account_banned`, which matches the UI-SPEC row.
3. The hook runs for **every** `internalAdapter.createSession`, including the test helpers, and `context` may be `null` [VERIFIED: better-auth dist/db/with-hooks.mjs:7-25; test-utils/auth-helpers.mjs:4-6]. Do not early-return on a null context the way the admin plugin does. Always check the DB.
4. Ban action, in one transaction: `UPDATE user SET banned_at = now()` plus `DELETE FROM session WHERE user_id = $id`. There is no cookie cache or secondary storage (`createAuth` sets neither [VERIFIED: apps/api/src/auth/auth.ts:13-36]), so deleting rows revokes immediately. Refuse to ban the platform owner (return 404 or 400).
5. `SessionGuard` sets `req.user = null` when `session?.user.bannedAt` is set (defense in depth).

### Pattern 5: Invite tokens (D-13–D-17)

- Generate: `token = randomBytes(32).toString("base64url")` and `tokenHash = createHash("sha256").update(token).digest("hex")`. Store the hash, return the link `PUBLIC_URL + "/invite/" + token` once.
- Table: `invites(id, kind invite_kind, workspace_id uuid NULL, email text, token_hash text UNIQUE, created_by_id, expires_at, used_at, used_by_id, revoked_at, created_at)`, plus `CHECK ((kind = 'workspace') = (workspace_id IS NOT NULL))`. Store `email` lowercased.
- State is derived and never stored: `revoked` if `revoked_at`, else `used` if `used_at`, else `expired` if `expires_at <= now()`, else `pending`.
- `invite_pending`: before insert, select a pending invite for `(kind, workspace_id, email)`. App-level only (`ponytail:` time-based state can't be a DB index).
- `already_member` (team invite): reject when a user with that lowercased email is already a member.
- `GET /invites/:token` (signed-in, not public) returns only `{ kind, state, workspaceName?, workspaceSlug?, emailMatches, maskedEmail, alreadyMember }`. **Never return the invite's full email to a non-matching user.**
- **Atomic single use:** `UPDATE invites SET used_at = now(), used_by_id = $u WHERE id = $id AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now() RETURNING id`. Zero rows means expired, used, or revoked (re-read for the exact state). Run it in the same transaction as the member insert (`onConflictDoNothing()` on the `(workspace_id, user_id)` PK).
- Platform invites are consumed by `POST /workspaces`, not by the invite page (UI-SPEC: the platform invite page redirects to `/dashboard/new`). `canCreateWorkspace = isPlatformOwner || exists pending platform invite where email = lower(user.email) AND user.emailVerified`. The owner creates without consuming anything.

### Pattern 6: Slug validation in three layers

1. Shared Zod: `z.string().regex(SLUG_RE, { message: "slug_invalid" }).refine(s => !RESERVED.has(s), { message: "slug_reserved" })`, with `SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` and length 2–32 (UI-SPEC).
2. DB: `workspaces.slug UNIQUE`, `products UNIQUE(workspace_id, slug)` (this also covers soft-deleted rows, so D-18's "never reused" comes free), and a `CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` backstop.
3. Insert with `.onConflictDoNothing().returning({ id })`. An empty result means `slug_taken`. This avoids parsing Postgres error codes for the common case.

### Pattern 7: Product creation seeds statuses in the same transaction

```typescript
await db.transaction(async (tx) => {
  const [p] = await tx.insert(products).values({ workspaceId, name, slug, logoUploadId, accentColor: DEFAULT_ACCENT })
    .onConflictDoNothing().returning({ id: products.id });
  if (!p) throw new ApiException("slug_taken", 409, "That URL is taken.");
  await tx.insert(statuses).values(SEEDED_STATUSES.map((s, i) => ({ ...s, productId: p.id, position: i })));
  return p;
});
```

### Pattern 8: Status delete with a replacement (extends in Phases 3–4)

`DELETE /workspaces/:ws/products/:product/statuses/:statusId?moveTo=:targetId`:
1. Load both statuses scoped to `tenant.productId` with `FOR UPDATE`. Either missing → 404. `moveTo === statusId` → 400.
2. If the target is `is_default` → `delete_default_status`. Each product has exactly one default, which the partial unique index guarantees, so the last remaining status is always the default. The default rule therefore subsumes STAT-04's "last status" rule, and a test should assert it.
3. Leave the marked spot `// Phase 3: UPDATE posts SET status_id = moveTo WHERE status_id = id AND product_id = …` / `// Phase 4: roadmap_items …`, then `DELETE`.
4. Add `UNIQUE (id, product_id)` on `statuses` now. Phase 3's `posts (status_id, product_id) REFERENCES statuses (id, product_id) ON DELETE RESTRICT` then makes cross-product status assignment impossible at the DB level (PITFALLS.md Pitfall 4).

### Pattern 9: Validation errors carry UI-SPEC codes

Register `StandardSchemaValidationPipe` globally with an `exceptionFactory` that takes the first issue whose `message` is in `API_ERROR_CODES` and throws `new ApiException(code, 400, …)`. Otherwise it throws `validation_failed`. Shared schemas then put the code in the message (`{ message: "invalid_color" }`), and one Zod schema drives both the client field error and the server code.

### Anti-Patterns to Avoid

- **Accepting `workspaceId` / `productId` / `role` in a request body.** Tenant comes from the guard only. Zod's default `z.object` strips unknown keys, so leave them out of input schemas.
- **`findFirst({ where: eq(statuses.id, id) })` without `productId`.** Every child lookup includes the tenant column.
- **A single `UPDATE ... SET is_default = (id = $new)`.** It can trip the partial unique index mid-statement. See Pitfall 5.
- **Linking `/platform` from proxy.ts to `/login`.** That gives anonymous users a redirect instead of a 404. See Pitfall 1.
- **Putting `assertCanView` logic only in the web page.** `generateMetadata` and the page both call the same API endpoint, which enforces suspension and deletion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session revocation on ban | Token blacklist or "banned" check per cookie | `DELETE FROM session WHERE user_id` + Better Auth hook | DB sessions, no cookie cache: deleting the row is the revocation |
| Blocking sign-in | Custom OAuth callback wrapper | `databaseHooks.session.create.before` throwing `APIError` | Callback already maps `body.code` → `?error=` redirect |
| Request validation | Manual `safeParse` in each handler | Global `StandardSchemaValidationPipe` + `@Body({ schema })` | Built into Nest 12 |
| Response allowlist | `delete obj.secret` / spreading rows | Explicit `select()` + `@SerializeOptions({ schema })` (Zod strip) | Fail-closed when columns are added |
| Drag reorder + keyboard a11y | Custom pointer/keyboard handlers | `@dnd-kit/react` `useSortable({ id, index, handle })` | Keyboard sensor, autoscroll, collision included |
| Dialog focus trap / Esc / return focus | Custom modal | `@radix-ui/react-dialog` / `-alert-dialog` | a11y contract in UI-SPEC depends on it |
| Random tokens / hashing | `Math.random`, uuid-as-secret | `crypto.randomBytes(32)` + `sha256` | 256-bit entropy, hash-only storage |
| Unique-race handling | select-then-insert | `onConflictDoNothing().returning()` | Atomic, no 23505 parsing |
| Route-coverage enforcement | A hand-maintained list nobody checks | `DiscoveryService` scan in the test that diffs against the test table | New routes fail CI until covered |

**Key insight:** The risky parts are authorization ordering and fail-open data shapes, not algorithms. Put each rule in one place (guard, DB constraint, serializer schema) and test that place.

## Common Pitfalls

### Pitfall 1: Anonymous users get 401 (not 404) from the platform API, or a login redirect from `/platform`
**What goes wrong:** `SessionGuard` is global and default-deny. A non-`@Public` platform controller returns `401 unauthorized` to anonymous callers, which reveals that the route exists and violates PLAT-07. CONTEXT's code-context note says `proxy.ts` will redirect `/platform` to login, which does the same thing on the web side.
**How to avoid:** Mark `PlatformController` `@Public()` and 404 inside `PlatformOwnerGuard`. Leave `/platform` out of the proxy matcher, and have every `/platform` page call `notFound()` unless `me.isPlatformOwner`.
**Warning signs:** The cross-tenant/PLAT-07 test asserts 404 for anonymous, non-owner, and banned callers. Anything else fails.

### Pitfall 2: Owner impersonation through an unverified email
**What goes wrong:** Before the real owner first signs in, someone creates a GitHub account whose primary email is the owner's address but unverified. Better Auth creates the user with `emailVerified: false`. GitHub maps `verified` per email [VERIFIED: @better-auth/core social-providers/github.mjs:76]; Google maps `email_verified` [VERIFIED: google.mjs:130].
**How to avoid:** `isPlatformOwner` and invite matching both require `user.emailVerified === true`.

### Pitfall 3: The `proxy.ts` early return
**What goes wrong:** The current proxy returns `NextResponse.next()` for every request unless `DEV_UPLOAD_PAGE === "true"` [VERIFIED: apps/web/proxy.ts:5-7, matcher `["/dev/:path*"]` at 25-27]. Adding `/dashboard` and `/invite` to the matcher without restructuring means the redirect never fires in production.
**How to avoid:** Gate only the `/dev` branch on the flag. Matcher: `["/dev/:path*", "/dashboard/:path*", "/dashboard", "/invite/:path*"]`. Redirect with `next=` built from `pathname + search`, as the existing code does.

### Pitfall 4: A new required env var breaks deploys and type-checks
**What goes wrong:** `PLATFORM_OWNER_EMAIL` becomes required in `EnvSchema`. `Env` objects are built as literals in `test/support/test-app.ts:63-84` and every `test/e2e/*.e2e.test.ts` (example: `upload-page.e2e.test.ts` builds `const env: Env = {...}`), so typecheck fails. In compose/Dokploy, the API crash-loops if the variable is missing.
**How to avoid:** Update all `Env` literals, add `PLATFORM_OWNER_EMAIL: ${PLATFORM_OWNER_EMAIL:?…}` to `compose.yaml`'s api service, `.env.example`, and the `docs/deploy.md` env table. Then **set it in Dokploy for staging and prod before tagging a release**. That last step is a manual runtime-state task.

### Pitfall 5: Setting the default status trips the partial unique index
**What goes wrong:** Postgres checks unique *indexes* row by row and cannot defer them. A single `UPDATE statuses SET is_default = (id = $new) WHERE product_id = $p` can transiently produce two `true` rows, depending on row order, and fail with 23505.
**How to avoid:** Two statements in one transaction, in order: unset the current default, then set the new one. Do not put a unique constraint on `(product_id, position)`; reorder rewrites every position, and a unique constraint fails the same way.

### Pitfall 6: Drizzle wraps Postgres errors
**What goes wrong:** Code checking `err.code === "23505"` never matches. Drizzle 0.45 throws `DrizzleQueryError`, and the pg error is in `.cause` [VERIFIED: drizzle-orm errors.d.ts:9-14; pg-core/session.js:41].
**How to avoid:** Prefer `onConflictDoNothing().returning()`. For updates (status rename hitting the `lower(name)` unique index), use one helper: `isUniqueViolation(e) => (e as any)?.cause?.code === "23505"`.

### Pitfall 7: Upload responses carry no id
**What goes wrong:** The UI-SPEC says `LogoField` stores "the returned upload id". `UploadResponseSchema` has only `url, width, height, bytes, format` [VERIFIED: packages/types/src/index.ts:39-45]. The upload row has `id uuid` and `uploader_id` [VERIFIED: packages/db/src/schema/uploads.ts:5-13].
**How to avoid:** Add `id: z.uuid()` to `UploadResponseSchema` and return it from `UploadsController`. Logos are FKs `logo_upload_id → uploads.id ON DELETE SET NULL`. On set, require `uploads.uploader_id = req.user.id` (or that it is already the entity's current logo). Public DTOs expose `logoUrl = "/uploads/" + storage_key` and never the id.

### Pitfall 8: Inline-style injection through accent or status colors
**What goes wrong:** The accent hex goes into `style={{ "--primary": … }}`, and status colors into dot fills. A stored `red;}` or `url(...)` becomes CSS injection.
**How to avoid:** The server Zod uses `/^#[0-9A-Fa-f]{6}$/` with the `invalid_color` code and stores the value uppercased. `accentTokens()` falls back to the default on anything else (UI-SPEC unit test). Optionally add a DB `CHECK` on `accent_color` and `statuses.color`.

### Pitfall 9: Splitting the root layout loses the header on 404 pages
**What goes wrong:** The UI-SPEC moves `Header` and the container from `app/layout.tsx` into an `(app)` group. `app/not-found.tsx` renders inside the root layout only, so after the split, 404s (including PLAT-07 and cross-tenant 404s) render bare.
**How to avoid:** Extract `<AppShell>` (header + main container + Toaster) as a component. Use it in `(app)/layout.tsx`, in `not-found.tsx`, and directly in `app/dashboard/page.tsx` and `app/dashboard/new/page.tsx`. That avoids a `dashboard/` folder existing in two route groups, which is a layout-merge edge case not verified under vinext.
**Warning signs:** `curl /platform` as a non-owner shows no header.

### Pitfall 10: Route precedence and reserved words
**What goes wrong:** `/{ws}` sits at the root next to `/login`, `/dashboard`, `/invite`, `/platform`, `/dev`. vinext matches static segments before dynamic ones [VERIFIED: vinext dist/routing/utils.js:1-45], so a workspace called `login` would be unreachable, and `/dashboard/{ws}/team` would shadow a product called `team`.
**How to avoid:** Use the UI-SPEC reserved lists. Also reserve top-level words that later phases are likely to need, because adding a reserved word later can't evict a workspace that already owns it. Phase 3's WORK-07 needs an account page, so reserve at least `account`, plus `settings`, `admin`, `auth`, `help`. Vite assets live under `/_next/` [VERIFIED: apps/web/dist/client contains `_next`], and the slug regex already excludes `_` and `.`.

### Pitfall 11: LIKE wildcards in platform search
**What goes wrong:** `?q=%` matches everything, and `_` matches any single character.
**How to avoid:** Use `escapeLike = q => q.replace(/[\\%_]/g, "\\$&")`, cap `q` at 100 characters, and trim it.

### Pitfall 12: Shell aliases in this dev environment
**What goes wrong:** In the interactive profile, `node` and `npm` are aliases for `bun` (observed: `type node` → "alias for bun"; `npm view` failed with "Script not found"). Homebrew's real Node is v26.10.0, while CI pins Node 24.21.0.
**How to avoid:** Executors use `bun run <script>` (shebang → real node) or `/opt/homebrew/bin/node` / `/opt/homebrew/bin/npm` explicitly.

## Code Examples

### Better Auth: ban hook + returned `bannedAt`
```typescript
// apps/api/src/auth/auth.ts  (extends existing createAuth(db, env, extraPlugins))
import { APIError } from "better-auth/api";          // exported: better-auth package.json "./api"
import { eq } from "drizzle-orm";
import { user as userTable } from "@userhq/db";

  user: {
    additionalFields: {
      bannedAt: { type: "date", required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        async before(session) {                     // context may be null; always check
          const [row] = await db.select({ bannedAt: userTable.bannedAt })
            .from(userTable).where(eq(userTable.id, session.userId));
          if (row?.bannedAt) {
            throw APIError.from("FORBIDDEN", { code: "account_banned", message: "This account can't sign in." });
          }
        },
      },
    },
  },
```
Sources: admin plugin pattern [VERIFIED: better-auth dist/plugins/admin/admin.mjs:33-51]; `APIError.from(status, {message, code})` [VERIFIED: @better-auth/core dist/error/index.mjs:19-24].

### TenantGuard skeleton
```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const { ws, product } = req.params;
    const [row] = await this.db
      .select({ id: workspaces.id, suspendedAt: workspaces.suspendedAt, role: workspaceMembers.role })
      .from(workspaces)
      .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, req.user.id)))
      .where(eq(workspaces.slug, ws));
    if (!row) throw new ApiException("not_found", 404, "Not found.");            // non-member == unknown
    if (row.suspendedAt) throw new ApiException("workspace_suspended", 403, "This workspace is suspended.");
    let productId: string | undefined;
    if (product !== undefined) {
      const [p] = await this.db.select({ id: products.id }).from(products)
        .where(and(eq(products.workspaceId, row.id), eq(products.slug, product), isNull(products.deletedAt)));
      if (!p) throw new ApiException("not_found", 404, "Not found.");
      productId = p.id;
    }
    req.tenant = { workspaceId: row.id, productId, role: row.role };
    return true;
  }
}
```

### Status reorder (dnd-kit 0.5, single list)
```tsx
// Source: dndkit.com/react/guides/sortable-state-management; types verified in @dnd-kit/react@0.5.0 sortable.d.ts
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";

function Row({ status, index }: { status: Status; index: number }) {
  const { ref, handleRef, isDragging } = useSortable({ id: status.id, index });
  return (
    <li ref={ref} className={isDragging ? "shadow-md ring-1 ring-border" : undefined}>
      <button ref={handleRef} aria-label={`Reorder ${status.name}`}>…</button> …
    </li>
  );
}

<DragDropProvider onDragEnd={(event) => {
  if (event.canceled) return;
  const { source } = event.operation;
  if (isSortable(source) && source.initialIndex !== source.index) {
    const next = [...items]; const [m] = next.splice(source.initialIndex, 1); next.splice(source.index, 0, m);
    setItems(next); saveOrder.mutate(next.map((s) => s.id));   // revert + toast.error on failure
  }
}}>…</DragDropProvider>
```
Announcements: own `<div aria-live="assertive" className="sr-only">` updated from `onDragStart` / `onDragOver` / `onDragEnd` with the UI-SPEC strings.

### Route-coverage assertion (cross-tenant seam)
```typescript
// apps/api/test/cross-tenant.test.ts
import { DiscoveryService } from "@nestjs/core";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants.js";
// 1. Collect every controller method whose full path contains ":ws".
// 2. Assert the set equals the keys of CROSS_TENANT_ROUTES (a table of {method, path, body?}).
// 3. For each entry: call as workspace A's admin with B's slugs/ids → expect 404.
// A new :ws route without a table entry fails step 2, which is how the suite "grows".
```
The same scan drives `public-contract.test.ts`: every handler with `IS_PUBLIC` metadata (handler or class) must have `class_serializer:options` metadata containing a `schema` [VERIFIED: @nestjs/common serializer/class-serializer.constants.js:1 `CLASS_SERIALIZER_OPTIONS = 'class_serializer:options'`]. Then add exact `Object.keys()` assertions on the `/portal/*` and `/me` responses.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| class-validator DTOs | `StandardSchemaValidationPipe` + Zod via `@Body({ schema })` | NestJS 12 | One schema shared by web forms and API |
| `@dnd-kit/core` + `sortable` | `@dnd-kit/react` 0.5 `useSortable` with `handleRef` | dnd-kit "next" line | Hooks API; one list needs no helpers |
| Prisma-era composite-relation advice (ARCHITECTURE.md §1) | Drizzle `foreignKey({ columns: [a, b], foreignColumns: [x, y] })` | Prisma replaced by Drizzle (user decision) | Same composite-FK idea, Drizzle syntax |

**Deprecated/outdated in the research docs:** ARCHITECTURE.md §1/§9 describe Prisma and NextAuth. Ignore that syntax. The tenancy *ideas* (unique membership lookup, hashed invite tokens, per-product statuses with `onDelete: Restrict`) still hold.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Two route groups each holding a `dashboard/` folder may misbehave in vinext, so `<AppShell>` is used directly instead | Pitfall 9 | Low. The recommended structure works either way. |
| A2 | Adding `account`, `settings`, `admin`, `auth`, `help` to reserved workspace slugs is wanted | Pitfall 10 | Low. It goes beyond the UI-SPEC list; the user may veto it. |
| A3 | A suspended workspace's public portal API answers 403 `workspace_suspended` (it reveals that the slug exists) | Pattern 2 | Low. Portal URLs are public by nature. |
| A4 | The platform invite is consumed at workspace creation and matched by email, not by token | Pattern 5 | Medium. Any verified user whose email has a pending invite can create without opening the link. That has the same security as D-14's email binding. |
| A5 | Platform owner can't be banned via the API | Pattern 4 | Low |
| A6 | Posts and votes counts return `0` from the API until Phase 3 | Pattern 3 | Low |

## Open Questions

1. **`/platform` in `proxy.ts` (CONTEXT code-context) vs PLAT-07's "not-found for everyone else"**
   - What we know: a login redirect for anonymous users differs from 404.
   - Recommendation: exclude `/platform` from the proxy and 404 in the page. A planner who wants the redirect should confirm it with the user.
2. **UI-SPEC backstops reference Playwright, which is not installed** (no `playwright` in any `package.json`).
   - Recommendation: cover the four 🧪 backstops (reorder plus reload, 320px header, computed accent styles, OG tags) through API tests plus an end-of-phase human-verify step (`human_verify_mode: end-of-phase`). The OG-tag check can be a `fetch` of portal HTML in the existing e2e suite. Do not add Playwright in this phase without a decision.
3. **react-hook-form pin:** use 7.88.0 (recommended), or confirm 7.89.0 at the install checkpoint.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | installs, scripts | ✓ | 1.4.2 | — |
| Node (real) | API tests, build | ✓ (`/opt/homebrew/bin/node`) | v26.10.0 local, CI 24.21.0 | `node` in the shell is aliased to bun (Pitfall 12) |
| Docker (colima) | Postgres for `createTestApp()` tests, compose smoke | ✗ daemon not running (`colima` installed) | — | `colima start && docker compose -f compose.dev.yaml up -d postgres` before API tests |
| PostgreSQL 18 | all API tests (`TEST_DATABASE_ADMIN_URL` 127.0.0.1:5432) | ✗ until colima starts | — | CI has a `postgres:18` service |
| Playwright | UI-SPEC 🧪 backstops | ✗ not installed | — | API/e2e fetch tests + human verify (Open Q2) |
| Dokploy env `PLATFORM_OWNER_EMAIL` | API boot in staging/prod | ✗ not set yet | — | **None.** Must be set before the release tag (Pitfall 4). |

**Missing dependencies with no fallback:** the Dokploy `PLATFORM_OWNER_EMAIL` for staging and prod. It is a manual task.
**Missing dependencies with fallback:** the Docker/Postgres local daemon (start colima), Playwright (human verify).

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth OAuth only. Ban hook blocks session creation. Owner = verified config email. |
| V3 Session Management | yes | DB sessions. Ban deletes rows. `SessionGuard` ignores banned users. |
| V4 Access Control | yes | `TenantGuard` / `PortalGuard` / `PlatformOwnerGuard`. 404 for non-members and non-owners. Owner can't be removed or leave. Cross-tenant suite. |
| V5 Input Validation | yes | Zod via `StandardSchemaValidationPipe`. Slug regex + reserved list + DB CHECK. `https:`-only `z.url`. Hex regex. LIKE escaping. |
| V6 Cryptography | yes | `randomBytes(32)` tokens, `sha256` hash storage. No hand-rolled crypto. |
| V8 Data Protection | yes | `Public*` allowlist DTOs. Masked invite email. No emails on portals. |
| V13 API | yes | `OriginGuard` (existing) on all mutations. Errors use `ApiErrorFilter` codes. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant IDOR (A's admin uses B's slugs/ids) | Elevation of privilege | Guard-resolved tenant, tenant column in every query, cross-tenant 404 suite with route coverage |
| Invite link used by the wrong person | Spoofing | Strict verified-email match, single-use atomic update, 7-day expiry |
| Invite token leakage (logs, Referer) | Information disclosure | Email binding makes a leaked link useless to others. Keep the token out of API error messages. |
| Platform-owner claim via unverified email | Elevation of privilege | `emailVerified === true` check |
| Banned user keeps acting | Elevation of privilege | Session purge + hook + guard check |
| Suspended workspace bypassed via direct API | Elevation of privilege | Suspension enforced in guards, not only in pages |
| CSS injection via accent or status color | Tampering | Server hex regex + `accentTokens()` fallback |
| `javascript:` website URL | Tampering / XSS | `z.url({ protocol: /^https$/, hostname: z.regexes.domain })`; render with `rel="noopener"` |
| Attaching someone else's upload as a logo | Tampering | `uploader_id = req.user.id` check |
| Existence probing (404 vs 403) | Information disclosure | Membership checked before suspension; malformed and unknown tokens share one response |
| Mass assignment (`role`, `workspaceId` in body) | Elevation of privilege | Zod `z.object` strips unknown keys; tenant only from the guard |

## Sources

### Primary (HIGH confidence, read this session)
- Repo source: `apps/api/src/{app.module,env,main}.ts`, `auth/{auth,guards,decorators,me.controller}.ts`, `common/api-error.filter.ts`, `uploads/*`; `packages/db/src/{index,schema/auth,schema/uploads}.ts`; `packages/types/src/index.ts`; `apps/web/{proxy.ts,lib/*,app/layout.tsx,app/login/*,components/{header,user-menu}.tsx}`; `apps/api/test/support/test-app.ts`, `test/auth.test.ts`; `.oxlintrc.json`, `tools/oxlint-userhq.mjs`, `compose.yaml`, `bunfig.toml`
- Installed packages: better-auth 1.7.7 (`api/routes/callback.mjs`, `plugins/admin/admin.mjs`, `db/with-hooks.mjs`, `db/internal-adapter.mjs`, `db/schema.mjs`, `plugins/test-utils/*`), @better-auth/core 1.7.7 (`social-providers/{github,google}.mjs`, `error/index.mjs`, `db/type.d.mts`), @nestjs/common 12.1.2 (`pipes/standard-schema-validation.pipe.d.ts`, `serializer/*`), drizzle-orm 0.45.3 (`pg-core/{indexes,checks,unique-constraint,foreign-keys}.d.ts`, `errors.d.ts`), vinext 1.0.0 (`dist/routing/{utils,app-router}.js`, `dist/shims/{navigation*,metadata}.js`), zod 4.6.5
- npm registry (`/opt/homebrew/bin/npm view`) + `gsd-tools package-legitimacy check`, 2026-10-02
- `@dnd-kit/react@0.5.0` and `@dnd-kit/dom@0.5.0` tarballs (`sortable.d.ts`, `index.d.ts`)

### Secondary (MEDIUM)
- dndkit.com/react/guides/sortable-state-management (single-list `onDragEnd` + `isSortable`), corroborated by the published types
- `.planning/research/ARCHITECTURE.md` §2, §4, §7; `PITFALLS.md` Pitfalls 4 and 7, Moderate (slugs, owner role)

### Tertiary (LOW)
- none relied on

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Every API was read from the installed source or published typings.
- Architecture: MEDIUM-HIGH. The guard and transaction shapes are design recommendations, built on verified primitives.
- Pitfalls: HIGH. Each one is tied to a specific line of existing code or library source.

**Research date:** 2026-10-02
**Valid until:** 2026-11-01 (stack pinned exactly; re-check only if the pins change)
