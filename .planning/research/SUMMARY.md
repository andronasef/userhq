# Project Research Summary

**Project:** UserSaid
**Domain:** Multi-tenant customer feedback board + dual-layer roadmap + changelog + FAQ SaaS (Canny / Featurebase / Frill / Productboard Portal category)
**Researched:** 2026-10-01
**Confidence:** MEDIUM-HIGH

> **Reconciliation note.** The user made several decisions after the four research files were written. PROJECT.md is authoritative and this summary follows it. Where the research files disagree, this summary wins:
> - **Better Auth runs inside NestJS.** The web app forwards cookies and never imports `@usersaid/db`. ARCHITECTURE.md's "NextAuth in web, Nest reads the Session table" design is superseded.
> - **Drizzle ORM + drizzle-kit replace Prisma.** The Prisma schema sketch in ARCHITECTURE.md is a *logical* model only. Ignore the Prisma-specific pitfalls in PITFALLS.md: Pitfall 13 (Prisma 7 generator, P3009, `prisma.config.ts`), "Prisma returns no relations by default", "`@Exclude` vs Prisma plain objects", and `$queryRaw` caveats.
> - **Bun is the package manager only. Node 24 LTS is the runtime.** Read every pnpm reference as Bun workspaces/catalogs.
> - **The private/login-required portal toggle is dropped from v1.** All portals are publicly readable, and sign-in is needed only to post, vote, or comment. Treat PITFALLS.md Pitfall 6, `PortalGuard` visibility checks, the "private upload" discussion, and the FEATURES.md allowlist row as v2 notes.
> - **Invites are link-based** and accepted on sign-in with a matching *verified* OAuth email. No email is sent.
> - **vinext deploys through native `output: "standalone"` on Node**, not Nitro.

## Executive Summary

UserSaid is a Canny-class feedback platform. Its three-level tenancy (User → Workspace → Product) gives each product its own public portal with a board, roadmap, changelog, and FAQ. The internal roadmap sits behind the same data. Products in this category are built as a thin portal over a disciplined data layer. Statuses are typed rows, votes are idempotent and use denormalized counts, and public endpoints return allowlisted read models. Every vendor treats internal planning data as "never visible", not "hidden in the UI". The PRD's model of separate roadmap items with their own public title and description follows Productboard. It gives the strongest privacy story, but it means building two things Canny gets for free: vote aggregation on public cards, and a rule that a post links to at most one item.

The recommended approach is a Bun-workspace monorepo with two Node 24 images: `apps/web` (vinext 1.0.0 standalone) and `apps/api` (NestJS 12). Better Auth (Google/GitHub, database sessions) runs inside NestJS with a Drizzle 0.45.3 + `pg` adapter. One origin goes through Traefik: `/api/*` and `/uploads/*` route to Nest, and everything else goes to web. The web app reads data in RSCs over the internal network by forwarding the cookie. Its client components send mutations to same-origin `/api/v1` through TanStack Query. It never touches the database, sharp, or OAuth. Zod 4 contracts in `@usersaid/types` are shared by forms, Nest's native Standard Schema pipes, and the public response serializers.

The two biggest risks are (1) vinext's young self-hosted Node path, and (2) leaks of internal roadmap fields or cross-tenant data. For (1), Phase 1 must be a blocking walking skeleton that proves the whole chain inside Docker before any feature work. Keep the `next build` fallback cheap: app code imports only `next/*`, `react`, and npm packages, enforced by lint. For (2), use a separate 1:1 internal table and explicit core `select()` column maps on public paths. Ban exclusion-mode column selection. Add a key-set contract test with a canary string for every public endpoint, and a cross-tenant 404 test suite that grows with every phase. The product-level risk is the "graveyard board". With email out of scope, the in-app close-the-loop surfaces (post status timeline and "My activity") are needed to meet the Core Value at all.

## Key Findings

### Recommended Stack

The versions were checked against the npm registry on 2026-10-01 (HIGH). vinext facts come from its own source and issue tracker at 1.0.0 (HIGH). The integration recipes have not been run together and must be proven in Phase 1 (MEDIUM). See STACK.md for the Dockerfiles, install commands, and the Bun-specific checks.

**Core technologies:**
- **vinext 1.0.0 (pin exact) + Vite 8.3 + React 19.3 (single version via Bun catalog):** builds the Next.js 16 App Router API. Deploy with `output: "standalone"` and set `NODE_ENV=production`, `HOST=0.0.0.0` (not `HOSTNAME`), and `VINEXT_TRUST_PROXY=1` behind Traefik.
- **NestJS 12.1 (Express) + TypeScript 6.0.3:** Nest 12 validates and serializes Zod natively through Standard Schema. TS 7 breaks `nest build`.
- **Better Auth 1.7.7 + `@better-auth/drizzle-adapter` + `@thallesp/nestjs-better-auth` 2.8:** vinext marks NextAuth as unsupported and Better Auth as supported. The Nest module installs a global default-deny guard, and public reads opt out with `@AllowAnonymous()`/`@OptionalAuth()`.
- **Drizzle ORM 0.45.3 + drizzle-kit 0.31.11 + `pg` 8.23:** use the stable releases, not the 1.0 RC. SQL migrations are generated at dev time and committed. The API `CMD` applies them with `migrate()` under a `pg_advisory_lock` before `main.js` starts, and drizzle-kit is not shipped to production.
- **PostgreSQL 18:** mount the volume at `/var/lib/postgresql`, not `.../data`.
- **sharp 0.35.5 (API only):** needs glibc and a CPU with SSE4.2. Check the VPS.
- **Zod 4.6, TanStack Query 5, react-hook-form, Tiptap 3.31 (JSON in jsonb + static renderer), @dnd-kit/react 0.5 (pin exact), nuqs, Tailwind 4.3, individual `@radix-ui/react-*` packages (never the `radix-ui` barrel, which hangs the build).**
- **Bun 1.4.2:** used only for install, workspaces, catalogs, and scripts. Never pass `--bun`. Scripts run on Node through the shebang. Images are based on `node:24-bookworm-slim` with the Bun binary copied in. On Windows, call the Nest CLI with `node` (bun#44242), and test production builds in Docker/WSL (vinext#2696).

Avoid: next-auth, Nitro, Prisma, drizzle-zod for public DTOs, Server Actions for mutations, `next/image` for uploads, `next/font/google`, `bun test` for Nest code, and ISR/`"use cache"`. Every route is dynamic in v1.

### Expected Features

**Already in the PRD (core loop):** posts/votes/comments with an admin badge, a Kanban roadmap with internal and public layers, editable shared statuses, a changelog with WebP images and tags, and an FAQ with search.

**Table-stakes features MISSING from the PRD, to be scoped during requirements:**

*Statuses (critical, these shape the schema):*
- A fixed semantic **status type** enum under each editable name. It drives filters, "shipped", and the default roadmap columns.
- A color for each status, exactly one **default status** per product, and a `show_on_public_roadmap` flag.
- **Delete with mandatory reassignment** in a single transaction. The default status and the last remaining status cannot be deleted.
- An optional public message on any status change.

*Feedback board:*
- **Remove own vote** using idempotent PUT/DELETE, never a toggle.
- **Edit own post**, and **edit/delete own comment** (soft delete).
- **Status filter that hides DONE/CLOSED by default.**
- **Board search** (Postgres FTS or pg_trgm). This index is also used later for similar-post suggestions.
- **Admin hygiene:** edit any post, delete any post or comment (soft delete), change status directly on unlinked posts, and view the voter list (admin-only; the public sees counts).
- **Admin merge of duplicates:** move votes with dedupe, move comments, and leave a tombstone with `merged_into_id` that redirects. No unmerge.
- **Post status timeline** (a PostActivity log) and a **"My activity" page** with "updated since last visit" markers. This is the minimum close-the-loop without email.
- A post detail permalink, and the OAuth display name and avatar on posts. Never show emails publicly.

*Roadmap:*
- **A post links to at most one roadmap item.** While linked, the post's status is read-only and follows the item.
- **"Add to roadmap" from a post**, which creates a prefilled item and links it.
- **Manual card order** using fractional positions.
- **Aggregate vote count on public cards**, counting only non-deleted, non-merged linked posts.
- A public title that defaults to the internal title when the item is made public, then stays editable. A DB CHECK constraint prevents a public item without a public title.

*Changelog:*
- A **draft/published** state, plus **edit after publish, unpublish, and delete**.
- A **per-entry permalink with OG meta**, a **tag filter** on the feed, and seeded tags (New / Improved / Fixed).

*FAQ:*
- **Ordering** of categories and questions, **rich-text answers**, and **deep links to individual questions**.

*Workspace:*
- **Remove a teammate or leave a workspace.** The owner and last member are guarded: store `ownerId` even though v1 has a single role.
- **Edit and soft-delete products.** Freeze slugs in v1 or add a slug history.
- A **reserved-slug denylist**.
- **Title/OG metadata** for portals.
- **Delete my account** (anonymize) can ship in v1.x.

**Should have (differentiators, mostly v1.x):**
- An in-app notification bell with coalescing.
- Changelog linking to roadmap items and posts, with a "mark linked items Done on publish" option. This drives the success metric.
- Similar-post suggestions while typing, using text search rather than AI.
- A demand-ranked admin triage inbox.
- RSS for the changelog.
- FAQ "didn't find it? Submit feedback" CTA.

**Defer (v1.x / v2+):**
- Moderation queue, ban/spam, vote on behalf, pinned posts, one-level replies, internal admin comments, and scheduled publishing.
- **Private portals with an email/domain allowlist (v2).**
- Email, integrations, widgets, AI, scoring, subdomains.

**Anti-features:** real-time websockets, anonymous voting, downvotes or weighted votes, public ETAs, multiple boards per product, rich text in end-user posts, public voter lists, unmerge, and hard deletes.

### Architecture Approach

Traffic flows strictly web → api → db/volume. Tenant identity comes from slugs on portal routes and from IDs on admin routes. Nest guards resolve a `ProductContext` once per request, and every service takes `(productId, childId, ...)`. Writes use `UPDATE ... WHERE id AND product_id`, and a miss returns 404. Each feature module has separate `admin/` and `public/` controllers, and a lint rule stops `public/**` from importing `admin/**`. In the web app, the `dashboard/` and `[workspace]/[product]/` route trees are siblings. A single `portalHref()`/TenantLocator seam keeps future subdomains additive.

**Data model, translated to Drizzle:**
- `productId` is denormalized onto every tenant-owned table.
- Statuses are rows with a type enum, `isDefault` (with a partial unique index), and FKs from posts and items using `onDelete: 'restrict'`.
- `posts.roadmapItemId` is a nullable FK, so each post has at most one item.
- `votes` has a composite PK on (userId, postId), and `posts.voteCount` is updated in the same transaction using `INSERT ... ON CONFLICT DO NOTHING`.
- `roadmap_items` holds public-safe columns only. A separate 1:1 `roadmap_item_internal` table holds the internal title, notes, assignee, and target date.
- Changelog bodies are Tiptap JSON in jsonb.
- `uploads` stores a `storageKey`, never a URL.
- Invites store a `tokenHash` plus the lowercased email and an expiry.
- Better Auth's generated tables are committed once to `packages/db/src/schema/auth.ts`.
- Consider composite FKs on `(id, product_id)` so the database itself prevents cross-product references.

**Major components:**
1. **Traefik (Dokploy)** handles TLS and routes by path on one domain without stripping the path, so cookies need no CORS.
2. **apps/web (vinext standalone)** serves the portal and dashboard RSCs. Its `apiServer()` fetch forwards cookies, `better-auth/react` runs on the client, and `proxy.ts` does optimistic redirects only.
3. **apps/api (NestJS)** contains Better Auth at `/api/auth/*`, the tenancy guards, admin and public controllers, the domain services (StatusSync, votes, status delete-with-reassign, invite claim, merge), and the UploadService.
4. **UploadService** sniffs magic bytes, then runs sharp with `limitInputPixels` and `failOn` settings, then `rotate`, `resize`, and WebP conversion. It writes atomically to a named volume at `/data/uploads` and serves the files with `immutable` and `nosniff` headers. SVG is rejected.
5. **packages/db** (Drizzle schema, migrations, `migrate.ts`, and exported public column maps) is used by the API only. **packages/types** holds the Zod request schemas and hand-written `Public*` response schemas.

### Critical Pitfalls

1. **vinext Node immaturity** (#3444, #3443, #3483, #3478, #3604, #3446). *Avoid by:* standalone output, `NODE_ENV` and `HOST` set explicitly, one React version, per-primitive Radix packages, a "reload" prompt on chunk-load failure, exact version pins, and a Docker smoke test.
2. **Internal roadmap fields leaking.** *Avoid by:* the split table, `select()` column maps, the `Public*` Zod serializer, and canary contract tests on both the JSON and the rendered HTML. Never pass admin rows to portal client components. Also decide whether a post linked to a non-public item shows that item's status.
3. **Cross-tenant IDOR.** *Avoid by:* a single guard resolver, never accepting tenant IDs in request bodies, scoped queries, linked-post tenant checks, and a cross-tenant 404 matrix in CI from Phase 2 onward.
4. **Statuses without semantics, or orphaned on delete.** *Avoid by:* the type enum, `restrict` FKs, required reassignment, and protected default and last statuses. Seed statuses in the same transaction that creates the product.
5. **Vote races, changelog XSS, and upload attacks.** *Avoid by:*
   - Votes: idempotent PUT/DELETE and an atomic counter.
   - Changelog: Tiptap JSON with a strict Zod allowlist, no `dangerouslySetInnerHTML`, and a CSP (all tenants share one origin).
   - Uploads: bomb limits, SVG and polyglot rejection, UUID filenames.

   Also handle OAuth and storage:
   - Link accounts only on verified email, and request the GitHub `user:email` scope.
   - Use per-environment OAuth apps, and publish the Google consent screen before launch.
   - Use a named volume, `chown` it before `USER node`, write a boot probe file, and back the volume up together with Postgres.

## Implications for Roadmap

### Phase 1: Walking Skeleton Spike (blocking)
**Rationale:** Nobody has run this combination together yet, and every later phase depends on it.
**Delivers:**
- A Bun-workspace monorepo and two `node:24-bookworm-slim` images.
- Traefik path routing in compose.
- Better Auth Google and GitHub OAuth round trips through Nest, with the session visible in an RSC via `GET /api/v1/me` using the forwarded cookie, plus sign-out and a `proxy.ts` redirect.
- Drizzle migrations applied at API boot under an advisory lock.
- An upload converted to WebP on a named volume that survives `docker compose down && up`.
- A TanStack mutation.
- Lint rules: no Vite-isms; the web app may not import db, drizzle, pg, sharp, or the Better Auth server; no exclusion-mode column selection.
- A CI `next build` canary.
**Bun checks:** a frozen lockfile written on Windows installs on Linux; the build completes under the isolated linker (fall back to hoisted); exactly one react in the standalone output.
**Avoids:** Pitfalls 1, 2, 3, 11, 12 and the migration and boot pitfalls.
**Exit criterion:** pass, or switch to `next build` (about half a day to a day).

### Phase 2: Tenancy, Workspace & Product Shell
**Delivers:**
- Workspace and product CRUD with logos, reserved slugs, and the owner guard.
- Remove or leave a member.
- Link invites with a hashed, expiring, single-use token, accepted only on a matching verified email.
- Guards, the portal resolver, `portalHref()`, and the portal and dashboard shells.
- Seeding on product creation.
- The cross-tenant e2e harness, the public/admin split, and the contract-test scaffold.
**Avoids:** IDOR, slug collisions, invite hijacking.

### Phase 3: Statuses
**Rationale:** Posts and items need status FKs, and the type, default, and color columns must be in the first migration.
**Delivers:** typed rows with color and default; rename, reorder, add, and delete-with-reassignment; the `show_on_public_roadmap` flag. Can be folded into Phase 2.

### Phase 4: Feedback Board + Close-the-Loop Basics
**Delivers:**
- Categories, plain-text posts, and idempotent votes with remove vote.
- Comments with a server-derived admin badge; edit and delete own posts and comments.
- Sort, category filter, status filter, and FTS search; a permalink.
- Admin edit, delete, status change with a message, voter list, and merge.
- PostActivity timeline and My activity.
- Throttling on writes.

### Phase 5: Dual-Layer Roadmap
**Delivers:**
- Split-table items and a dnd-kit Kanban with fractional positions.
- Internal fields, the Make Public toggle with public copy, and the public roadmap with column maps, a serializer, and canary tests.
- Post links (at most one item per post) with `StatusSyncService` writing PostActivity.
- "Add to roadmap" from a post, and aggregate vote counts on public cards.

### Phase 6: Changelog
**Delivers:**
- A Tiptap editor, Zod-validated JSON, and static rendering in an RSC.
- WebP inline images, tags with a filter, and draft/publish/edit/unpublish/delete.
- Permalinks with OG metadata, and a CSP verified on the vinext build.
- Optional: link entries to items and posts and mark them Done on publish.

Can run in parallel with Phase 7.

### Phase 7: FAQ
**Delivers:** ordered categories and Q&A, rich answers, ILIKE search over the question plus a plain-text projection of the answer, deep links, and the "submit feedback" CTA.

### Phase 8: Hardening & Production Deploy
**Delivers:**
- Per-environment OAuth apps and a published Google consent screen.
- Dokploy Volume Backups for pgdata and uploads, with one restore drill.
- A rate-limit audit and the deploy-skew reload prompt.
- An E2E redeploy check that confirms uploads persist.
- Optionally, the notification bell.

### Phase Ordering Rationale
- The order follows the dependency chain: skeleton → tenancy → statuses → posts → roadmap. Changelog and FAQ depend only on tenancy and uploads, so they can run in parallel.
- Isolation and privacy test harnesses exist before the features they protect.
- Close-the-loop ships with the board. The Core Value fails without it because email is out of scope.

### Research Flags
Need `/gsd-plan-phase --research-phase`:
- **Phase 1:** Better Auth with the Nest adapter and `bodyParser: false`, `__Secure-` cookies over internal http, the Bun isolated linker with vinext standalone, and the Dockerfile `--production --filter` pattern.
- **Phase 5:** dnd-kit 0.5 Kanban, the semantics of a linked non-public item's status, and Drizzle composite FKs and partial indexes.
- **Phase 6:** the Tiptap static renderer under vinext RSC, and CSP nonces (#3205).

Standard patterns (skip research): Phases 3, 4, 7, 8.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Primary-source versions and vinext facts; the integration recipes are unproven until Phase 1 |
| Features | MEDIUM | Based on agreement across vendors; some edit and merge semantics are inferred |
| Architecture | MEDIUM-HIGH | Established patterns; translated here from Prisma/NextAuth-in-web to Drizzle/auth-in-Nest without review against real code |
| Pitfalls | MEDIUM-HIGH | vinext issues are HIGH; Prisma pitfalls are dropped; domain items are partly experience-based |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- **Tailwind wiring:** STACK.md says `postcss.config.mjs`, PITFALLS.md says `@tailwindcss/vite`. Settle it in the Phase 1 spike.
- **Linked non-public item status leak:** choose a status `isPublic` flag or a fallback to the nearest public status.
- **Status type enum values:** FEATURES.md and PITFALLS.md propose different sets. Pick one in requirements.
- **Close-the-loop tier:** decide whether the bell and changelog linking are v1 or v1.x.
- **Runtime env vars:** confirm they take effect without a rebuild in vinext standalone.
- **GitHub email:** confirm GitHub returns a verified primary email before trusting it for linking or invites.
- **Search:** FTS for the board, ILIKE for the FAQ. Watch English stemming on non-English portals.

## Sources

### Primary (HIGH confidence)
- cloudflare/vinext @ 1.0.0: source, fixtures, and issues #727, #3443, #3444, #3446, #3478, #3483, #3604, #2696, #2813, #3205, #1128, #3240
- oven-sh/bun #43683, #44120, #44242
- npm registry and Docker Hub (2026-10-01)

### Secondary (MEDIUM confidence)
- Context7: better-auth, drizzle-orm-docs, nestjs docs, bun, tiptap, dnd-kit
- sharp docs, Next.js data-security guide, Dokploy docs

### Tertiary (LOW confidence, cross-vendor corroborated)
- Canny, Featurebase, Frill, Nolt, Upvoty, Productboard, and UserJot help centers (URLs in FEATURES.md)
- Experience-based domain pitfalls

---
*Research completed: 2026-10-01*
*Ready for roadmap: yes*
