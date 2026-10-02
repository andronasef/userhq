<!-- GSD:project-start source:PROJECT.md -->

## Project

**UserHQ**

UserHQ is a centralized customer feedback and product management platform. It gives B2B SaaS companies, agencies, and creators a clean, branded portal where their customers can submit and upvote ideas, watch a public roadmap, read release notes, and self-serve answers from an FAQ — while the product team plans privately behind the same data.

The core philosophy is to bridge the gap between what users want and what the product team actually builds, without the noise of traditional support tickets.

**Core Value:** An admin can see what their users actually want, ranked by demand, and close the loop publicly — feedback in, roadmap out, changelog shipped.

### Constraints

- **Web**: Next.js 16.x app + Tailwind CSS v4 + Radix UI (individual `@radix-ui/react-*` packages), built with vinext using native `output: "standalone"` — not the Nitro preset, and not `next build`. User decision; Nitro path has a blocking open bug.
- **API**: NestJS — decoupled backend specified in the PRD.
- **Database**: PostgreSQL via Drizzle ORM with drizzle-kit migrations, `pg` driver — User decision replacing Prisma. Migrations are generated at dev time and committed; the API container applies them at boot under an advisory lock; drizzle-kit is not shipped in the production image.
- **Auth**: Better Auth inside NestJS, OAuth only (Google, GitHub), database sessions — User decision replacing NextAuth.js, which vinext marks unsupported.
- **Package manager / runtime**: Bun for installs, workspaces, and scripts; Node 24 LTS runs both containers — User decision. Bun as runtime was rejected over open Bun bugs affecting NestJS decorator metadata and cheap-VPS CPUs.
- **Repo shape**: Bun-workspace monorepo, two Docker images — `apps/web`, `apps/api`, `packages/db` (Drizzle schema, used by the API only), `packages/types` (shared DTOs and public response types).
- **File storage**: Local server storage on a named Docker volume, images converted to WebP in the API — Cost-efficiency for v1; no cloud storage dependency.
- **Infrastructure**: Docker + Dokploy, named Docker volumes for Postgres and uploads — Self-hosted deployment target; data must survive container replacement.
- **Email**: SMTP via Brevo's free tier (300 emails/day) in production, configured entirely by environment settings so the provider can be swapped; Mailpit container catches all mail in development — User decision. Hosting is a free Oracle Cloud VPS, where outbound port 25 is blocked; Phase 1 must confirm Brevo's submission port (587, or 2525/465 as fallbacks) is reachable from the VPS. Email sends from an outbox with retries so a provider failure never blocks a user action.
- **Privacy**: Internal roadmap fields must be unreachable from any public endpoint — Core trust guarantee of the dual-layer roadmap; a leak here is the product's worst failure mode.
- **Tenant isolation**: Every query is scoped by product/workspace, enforced by NestJS guards and covered by a cross-tenant test suite that grows with each feature.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR: decisions the roadmap must absorb

## vinext verdict (highest priority)

| Question | Verdict | Evidence | Confidence |
|---|---|---|---|
| (a) NextAuth / Auth.js v5 under vinext | **Unsupported** (vinext checker). `next-auth@5` never left beta (`5.0.0-beta.32`). | `check.ts`; issue #727 | HIGH |
| (a') Better Auth under vinext | **Supported and tested, partially.** The fixture covers the `[...all]` route handler, `auth.api.getSession({ headers: await headers() })` in an RSC, and sign-up/sign-in cookie round-trips. It covers **dev server only, email+password only**, and uses better-sqlite3 rather than Drizzle/Postgres. OAuth redirects and production standalone builds are untested. | `tests/fixtures/ecosystem/better-auth/*`, `tests/ecosystem.test.ts` | HIGH (what is tested) |
| (b) Node standalone build gives a runnable Docker image | **Documented and unit-tested. Rough edges are still open.** `output: "standalone"` gives `dist/standalone/{server.js, dist/client, dist/server, public/, node_modules/}`. Start it with `node server.js`, configured by `PORT` and **`HOST`** (not `HOSTNAME`). The copier follows symlinked `node_modules` (tested with pnpm; Bun's isolated store is also symlink-based but untested). The standalone fixture is **Pages Router only**. Open: #3444 (NODE_ENV not defaulted; set it in the Dockerfile), #3443 (in monorepos it can copy the wrong version of a package; keep one React version via a Bun catalog), #3486/#3485 (don't force-bundle React). #2696: on **Windows**, the production server 404s nested static assets, so test production builds in Docker/WSL. | `docs/deploying/other-platforms.mdx`, `src/build/standalone.ts`, tests, issues | HIGH (facts) / MEDIUM (works for this app) |
| (b') Nitro Node path | **Avoid for v1.** Open: #3478 (every route returns 500 once the server bundle splits), #853, #3431, #3439, #3427. `nitro` is still `3.0.x-beta`. | issues | HIGH |
| (b'') vinext under the **Bun runtime** | **Unverified and not supported upstream.** There is no Bun runtime in vinext's CI. One community report (#3476) compiled vinext's Node prod server with `bun build --compile` on Bun 1.4.2. It passed 746 of 778 Next.js e2e cases, needed workarounds for #3443–#3446, and React export conditions resolved differently under Bun. | #3476, repo tree (no Bun CI) | HIGH (that it is unverified) |
| (c) Tailwind v4 | **Works with vinext's own generated setup:** `@import "tailwindcss";` plus `postcss.config.mjs` with `@tailwindcss/postcss`. `postcss.config.json` and turbopack-loader configs are silently ignored (#1128). | `create-vinext-app/src/index.ts`, #1128 | HIGH |
| (c') Radix UI | **Works with per-primitive packages**, as vinext's shadcn fixture does. The `radix-ui` barrel hangs the build under isolated installs (#3483). The issue's root cause is pnpm peer-context forking (`node_modules/.pnpm/radix-ui@x/...`). Bun's isolated linker uses an analogous per-peer store (`node_modules/.bun/...`), so treat Bun as affected until the spike shows otherwise. | #3483, PR #3516 (open), fixture `package.json` | HIGH / MEDIUM (Bun) |
| `next/image` / `next/font/google` | Partial. On Node, `/_next/image` is served unresized (#3446), and Google Fonts load from the CDN at runtime. Use plain `<img srcSet>` with API-generated WebP widths, and `@fontsource-variable/*`. | README table, #3446 | HIGH |

### Phase 1 spike (blocking; do this before any feature work)

- If the vinext build fails under Bun's isolated linker, set `linker = "hoisted"` in `bunfig.toml`.
- If vinext fails outright, build the same `app/` code with `next build` (Next.js 16.3.x standalone). vinext init is non-destructive, so this is a build-script change. Keep it available by avoiding Vite-only APIs (`import.meta.env`) in app code. **MEDIUM**

## Bun: reading (a) vs (b)

| Concern | (a) Bun PM, Node runtime | (b) Bun runtime too | Evidence |
|---|---|---|---|
| Hardware | No issue (sharp still needs SSE4.2 on x64 Linux; check the VPS with `grep -c sse4_2 /proc/cpuinfo`) | **Bun 1.4.2 spins at 100% CPU before opening the entry file on KVM/QEMU VMs whose CPUID hides SSE4.2** (#43683, same root cause as #41361; fix in progress, unreleased). Those are typical cheap VPS hosts. | bun#43683 (HIGH); sharp install docs (HIGH) |
| NestJS DI | tsc-compiled, standard `design:paramtypes` | The Bun transpiler implements `experimentalDecorators` + `emitDecoratorMetadata`, but **serializes `X \| undefined` / `X \| null` as `X` even under `strictNullChecks`**, unlike tsc/SWC (#44120, open). Historical issue: types from `import type` causing module-resolution errors. Nest does not list Bun as a supported runtime. | bun `src/bundler/transpiler.rs`, `runtime.js` (MEDIUM); bun#44120 (HIGH) |
| vinext | The documented, tested self-host path (`node server.js`) | Unverified. Community only (#3476). | vinext repo (HIGH) |
| Better Auth | Fine | Better Auth itself supports Bun, but `@thallesp/nestjs-better-auth` declares `engines.node >=22.22.1` only | npm (HIGH) |
| sharp | Fine | sharp docs list Bun as supported (Node-API v9) | sharp install docs (MEDIUM) |
| Windows dev box | **#44242: `bun run start` fails with "bun: unknown error" when the script runs `nest start`** (Bun 1.4.2, Nest CLI 12.0.7, fresh `nest new --package-manager bun`). Affects both readings. **Workaround:** scripts call `node ./node_modules/@nestjs/cli/bin/nest.js start --watch` explicitly. Confirm in the spike. | Same | bun#44242 (HIGH that it exists; workaround MEDIUM) |
| Payoff | Fast installs, built-in workspaces, catalogs, `--filter` | Faster cold start, which doesn't matter for two always-on containers | — |

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|---|---|---|---|---|
| Node.js | **24.21.0 LTS** (`node:24-bookworm-slim`) | Runtime for both images | Active LTS. Satisfies vinext `>=22`, nestjs-better-auth `>=22.22.1`, Nest 12 ESM via `require(esm)`. Debian slim (glibc) avoids sharp/musl friction. | HIGH |
| Bun | **1.4.2** (binary copied from `oven/bun:1.4.2-slim`) | Package manager, workspaces, catalogs, `bun run --filter` | User decision. New Bun workspaces default to the **isolated linker** (lockfile `configVersion = 1`), a pnpm-like layout. `workspaces.catalog` + `catalog:` pin React, Zod and Tiptap once. `trustedDependencies` gates lifecycle scripts. Text lockfile `bun.lock`. | HIGH (versions/docs) |
| TypeScript | **6.0.3** | Language, whole repo | TS 7.0 has no compiler API, so `nest build`, the Swagger plugin and ts-jest can't run on it. nestjs-better-auth peers `^5.9 \|\| ^6`. | HIGH |
| vinext | **1.0.0** (pin exact) | Next.js 16 API on Vite: build, dev, prod server | Locked. | HIGH |
| Vite / @vitejs/plugin-rsc / @vitejs/plugin-react | **8.3.1 / 0.5.35 / 6.1.1** | Bundler and RSC/React plugins | vinext peers: vite ^8, plugin-rsc ^0.5.34, plugin-react ^5.1.4\|\|^6 | HIGH |
| React / react-dom / react-server-dom-webpack | **19.3.0**, all identical, exact pin via Bun catalog | UI runtime | vinext peer `^19.2.6`. One copy only (#3443). | HIGH |
| Next.js API target | **16.3.x** (the `next` package is not required) | API contract | vinext ships `next/*` fallback types. Add `next` as a devDependency only if a library's types require it. | MEDIUM |
| Tailwind CSS | **4.3.3** + `@tailwindcss/postcss` 4.3.3 | Styling | Use `postcss.config.mjs`, matching what `create-vinext-app` emits | HIGH |
| Radix UI primitives | `@radix-ui/react-*` (e.g. `react-dialog` 1.1.23) | Accessible headless primitives | Locked. Individual packages only. | HIGH |
| NestJS | **12.1.2** (`core`, `common`, `platform-express`), `@nestjs/cli` 12.0.8 | API server | Nest 12 (2026-08-28): Standard Schema (Zod) validation and serialization, ESM packages, Vitest default for ESM. Express platform, required by nestjs-better-auth (`express ^5.1`). | HIGH |
| PostgreSQL | **18** (`postgres:18` image) | Database | **Volume gotcha:** the 18 image uses `VOLUME /var/lib/postgresql` and `PGDATA=/var/lib/postgresql/18/docker`. Mount at `/var/lib/postgresql`, not `.../data`. | MEDIUM |
| Drizzle ORM | **drizzle-orm 0.45.3** (pin exact) | Schema-as-code, SQL query builder, relational queries | User decision. Latest **stable** (2026-09-21). 1.0 is still `1.0.0-rc.4` (tag `rc`) and brings Relational Queries v2 and a new folder-per-migration layout. Upgrade later with `drizzle-kit up` once 1.0 is GA. Pure JS, with no engine binary or codegen step, which is much friendlier to vinext and Docker than Prisma. | HIGH (versions) |
| drizzle-kit | **0.31.11** (devDependency of `packages/db`) | `generate` SQL migrations from schema diffs, `studio`, `check` | Dev-time only. Generated SQL is committed. Production applies it with the ORM's `migrate()`. | HIGH |
| Postgres driver | **`pg` 8.23.1** (+ `@types/pg`) via `drizzle-orm/node-postgres` | DB connection pool | The most widely deployed Node Postgres driver, actively released (2026-09-30), the default in Drizzle's docs and the migrator path we use, and runtime-agnostic (works if (b) is ever adopted). `postgres` (postgres.js) 3.4.9 is fine but releases less often. `Bun.sql` (`drizzle-orm/bun-sql`) would tie the code to reading (b). | MEDIUM |
| Better Auth | **1.7.7** + `@better-auth/drizzle-adapter` 1.7.7 + `@thallesp/nestjs-better-auth` **2.8.0** | OAuth (Google, GitHub), DB-backed sessions | Drizzle adapter peer: `drizzle-orm ^0.45.2 \|\| >=1.0.0-rc.1 <2`. `npx auth generate` emits the Drizzle auth schema (user/session/account/verification). Database sessions are the default. Email/password and magic link are v2 plugins. The Nest module installs a **global default-deny AuthGuard**. | HIGH (peers) / MEDIUM (integration) |
| sharp | **0.35.5** | WebP conversion, resize, EXIF strip (API only) | Locked to `apps/api`. Node-API v9 (Node `>=20.9`). Prebuilt Linux x64 binaries need **glibc ≥2.28 and a CPU with SSE4.2**. | HIGH |
| Zod | **4.6.5** | Shared schemas: web forms, Nest validation, response allowlists | Implements Standard Schema, which Nest 12 consumes natively | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---|---|---|---|---|
| `@tanstack/react-query` | 5.104.0 | Client mutations, optimistic updates | Votes, comments, Kanban moves, admin CRUD. Not for initial page data, which RSC fetches. | HIGH |
| `react-hook-form` + `@hookform/resolvers` | 7.88.0 / 5.9.1 | Forms with `zodResolver(sharedSchema)` | All forms | HIGH |
| `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/static-renderer` | **3.31.4** (identical, via catalog) | Changelog editor and rendering stored JSON | Editor in a `"use client"` boundary with `immediatelyRender: false`. Read side uses `renderToReactElement` (`@tiptap/static-renderer/pm/react`) in an RSC. | MEDIUM |
| `@dnd-kit/react` + `@dnd-kit/helpers` | **0.5.0** (pin exact) | Roadmap Kanban | `move()` helper for grouped column state, and the "multiple sortable lists" guide | MEDIUM |
| `nuqs` | 2.10.1 | URL search-param state (filters, sort, FAQ search) | Listed as tested in vinext's compatibility doc | HIGH |
| `sonner`, `lucide-react` | 2.0.8 / 1.49.0 | Toasts, icons | lucide's barrel is optimized by vinext and unaffected by #3483 | HIGH |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7.1 / 2.1.1 / 3.7.0 | shadcn/ui utilities | Copied-in shadcn components | HIGH |
| `@fontsource-variable/inter` | 5.3.0 | Self-hosted font | Instead of `next/font/google` | MEDIUM |
| `drizzle-zod` | 0.8.3 | Zod schemas derived from tables | **Admin-internal input validation only.** Never use it for public response DTOs, because derived schemas include every column, internal fields included. | MEDIUM |
| `@nestjs/config`, `@nestjs/throttler`, `@nestjs/terminus` | 12.0.1 / 6.7.1 / 12.1.0 | Env config, rate-limiting public writes, health check | API bootstrap | HIGH |
| `@nestjs/serve-static` (or `express.static`) | 12.0.0 | Serve `/uploads/*` with `immutable` cache headers | Upload delivery | MEDIUM |
| `@nestjs/swagger` + `zod-openapi` | 12.0.2 / 6.0.2 | OpenAPI from Zod (`standardSchemaConverter`) | Optional in v1 | MEDIUM |
| `file-type` | 22.1.1 | Magic-byte sniffing before sharp | Every upload | HIGH |
| `nestjs-pino` + `pino`, `helmet` | 5.2.1 / 10.3.1, 8.3.0 | Logs, security headers | API | MEDIUM |
| `tsdown` | 0.23.0 | Build `packages/types` and `packages/db` to ESM + `.d.ts` | Nest's `tsc` build and Node runtime need compiled JS from workspace packages (Vite would accept TS, Node/tsc won't) | MEDIUM |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| Vitest **5.0.3** | Unit and integration tests | Runs on Node via shebang under `bun run`. Nest 12's ESM default. Don't use `bun test` for Nest code, because it would put decorators on Bun's transpiler (#44120). |
| Playwright **1.63.0** | E2E against the Docker-built images | Includes the privacy test: public roadmap JSON contains no internal fields |
| oxlint 1.86 + Prettier 3.9 | Lint and format | `no-restricted-imports`: `apps/web` may not import `@userhq/db`, `drizzle-orm`, `pg`, `sharp`, or `better-auth` other than `better-auth/react`/`better-auth/cookies`. Also forbid exclusion-mode `columns: { x: false }` in public query modules. |
| drizzle-kit 0.31.11 | `bun run --filter @userhq/db db:generate` / `db:studio` / `db:check` | Runs on Node. SQL output is committed to `packages/db/migrations/`. |
| `npx auth generate` (`auth` 1.7.7) | Generates the Drizzle auth schema once | Commit it as `packages/db/src/schema/auth.ts` and own it from then on |
| `vinext check` | Scans `apps/web` for unsupported imports | Run in CI |
| docker compose (dev) | Postgres 18 and a local Traefik/Caddy mirroring production path routing | Same-origin cookies in dev |

## Monorepo layout (Bun workspaces)

- **Recommended (auth in Nest):** they don't. `packages/db` has one consumer, the API. The web app shares only `@userhq/types` (Zod contracts). The API validates sessions in-process with Better Auth. This is the strongest privacy boundary: the web image has no DB credentials.
- **If the team keeps Better Auth in the vinext app** (the sibling ARCHITECTURE.md draft): add `packages/auth` exporting `createAuth(db)`, with one `betterAuth({...})` config (Drizzle adapter, providers, cookie settings, secret). Both apps import `@userhq/db` + `@userhq/auth`. Web mounts `toNextJsHandler(auth)` at `app/api/auth/[...all]/route.ts`. Nest validates with **`auth.api.getSession({ headers })` from the same config**, not with hand-rolled `session` table lookups, so cookie signing, cookie names and cookie-cache semantics can't drift. Drizzle + `pg` are pure JS, and vinext's standalone copier ships `pg` as a server external, so this is workable. The costs are the OAuth flow running inside vinext (untested upstream) and DB credentials in the web image.

## Drizzle specifics

- **Versions:** `drizzle-orm@0.45.3`, `drizzle-kit@0.31.11`, both stable. `1.0.0-rc.4` exists, and Better Auth already ships `@better-auth/drizzle-adapter/relations-v2` for it, but starting a greenfield product on an RC ORM adds churn without v1 benefit. Plan the 1.0 upgrade as post-v1 tech debt. **HIGH (versions) / MEDIUM (call)**
- **Driver:** `drizzle(new Pool({ connectionString, max: 10 }), { schema })` from `drizzle-orm/node-postgres`. One pool per API process.
- **Column allowlists for public DTOs (privacy-critical):**
- **Migrations:** `drizzle-kit generate` at dev time produces committed SQL. In production, the API container runs `node packages/db/dist/migrate.js` (a `migrate(db, { migrationsFolder })` call from `drizzle-orm/node-postgres/migrator`, wrapped in `SELECT pg_advisory_lock(<const>)`) **before** `node dist/main.js`, in the same `CMD`. Why not `drizzle-kit migrate` in production: it would ship drizzle-kit and its dependencies in the image for no gain. Why not a separate Dokploy job: one replica in v1, and the advisory lock already makes it safe to scale. Don't call `migrate()` inside Nest's bootstrap, because mixing it with DI startup makes failures harder to read. **MEDIUM**
- **Statuses as rows:** `statuses(id, productId, name, position, ...)` with FKs from `posts.statusId` and `roadmap_items.statusId`, and `ON DELETE RESTRICT` plus an explicit reassignment transaction for deletes. This matches PROJECT.md; Drizzle's `references(() => statuses.id, { onDelete: 'restrict' })` expresses it.
- **Changelog body:** `jsonb('body').$type<TiptapDoc>()`, validated by the Zod Tiptap schema on write.

## Q3: Auth sharing between vinext web and NestJS (one recommendation)

- **API:** `betterAuth({ baseURL: PUBLIC_URL, basePath: "/api/auth", secret, database: drizzleAdapter(db, { provider: "pg", schema }), socialProviders: { google, github }, trustedOrigins: [PUBLIC_URL] })`, mounted with `AuthModule.forRoot({ auth })` and `NestFactory.create(AppModule, { bodyParser: false })`. The global AuthGuard is default-deny. Public reads are marked `@AllowAnonymous()`/`@OptionalAuth()`. OAuth callbacks are `https://app.example.com/api/auth/callback/{google|github}`.
- **Web, browser side:** `createAuthClient()` (`better-auth/react`) for `signIn.social`, `signOut` and `useSession`. Mutations go to same-origin `/api/v1/*`.
- **Web, RSC side:** `apiServer(path)` does `fetch(API_INTERNAL_URL + path, { headers: { cookie: (await headers()).get("cookie") ?? "" }, cache: "no-store" })`. The root layout calls `GET /api/v1/me`, wrapped in React `cache()`.
- **Web, `proxy.ts`:** optimistic redirect only, via `getSessionCookie(request)` from `better-auth/cookies`. Real authorization always happens in Nest.

## Q4: Rich-text editor for changelog entries

- Headless, so it fits Radix + Tailwind. StarterKit v3 bundles Link and Underline. The Image extension inserts the API-returned `/uploads/...` URL. The static renderer needs no editor and no DOM.
- **XSS:** (1) the API validates the document with a strict Zod schema: node and mark allowlist, `link.href` limited to `https:`/`http:`/`mailto:`, `image.src` matching `^/uploads/[a-z0-9/-]+\.webp$`. This is the real boundary. (2) Render through React elements with a `markMapping.link` that forces `rel="noopener noreferrer nofollow"`, and no `dangerouslySetInnerHTML`. (3) Configure editor Link `protocols`/`isAllowedUri` (UX only). (4) Any future HTML output (RSS, email) goes through `sanitize-html` 2.18.0 server-side.
- Load the editor with `next/dynamic` `ssr: false`.

## Q5: Kanban drag-and-drop

## Q6: Validation and shared DTOs

- Nest: a global `StandardSchemaValidationPipe` and `@Body({ schema: CreatePostInput })`, plus a global `StandardSchemaSerializerInterceptor` with `@SerializeOptions({ schema: PublicRoadmapItem })` on every public handler. Add a test that asserts every `@AllowAnonymous()`/`@OptionalAuth()` route declares a serializer schema.
- Web: `zodResolver(CreatePostInput)` with the same messages as the server.
- Not class-validator: it duplicates the schemas and can't be shared with the browser. Not nestjs-zod: its peers stop at Nest 11. Not drizzle-zod for public responses: derived schemas include internal columns.

## Q7: Data fetching (web to API)

## Installation (Bun)

# root package.json: set "workspaces": { "packages": ["apps/*","packages/*"], "catalog": { ... } } first

# packages/types

# packages/db

# apps/api

# apps/web  (scaffold: bunx create-vinext-app@latest web --platform=node)

# then: `bun pm untrusted` and add only the packages that need install scripts to "trustedDependencies"

## Dockerfiles: reading (a), Node runtime with Bun as PM (sketch; validate in the spike)

# syntax=docker/dockerfile:1.7

# syntax=docker/dockerfile:1.7

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|---|---|---|
| Bun as PM, Node runtime (a) | Bun runtime (b) | After the bun#43683 fix is released, #44120 is fixed, and vinext adds Bun CI |
| Better Auth in Nest | Better Auth in web via shared `packages/auth` | If the team insists the web app owns sign-in. Workable with Drizzle, but OAuth inside vinext is untested and DB credentials end up in the web image. |
| drizzle-orm 0.45.3 | drizzle-orm 1.0.0-rc.x (Relational Queries v2) | Once 1.0 is GA. Better Auth already supports it via `@better-auth/drizzle-adapter/relations-v2`. |
| `pg` (node-postgres) | `postgres` (postgres.js) 3.4.9 | Equivalent capability. Pick one and stay with it. |
| `pg` | `Bun.sql` via `drizzle-orm/bun-sql` | Only under reading (b) |
| `migrate()` in the API container `CMD` | Separate Dokploy one-shot job running `drizzle-kit migrate` | Many replicas, or a need to gate deploys on migration review |
| vinext `output: "standalone"` | Nitro `NITRO_PRESET=node` | Once #3478/#853 are fixed |
| vinext | `next build` (16.3.x standalone) | If the Phase 1 spike fails |
| `@dnd-kit/react` 0.5 | `@dnd-kit/core` 6.3 + `sortable` 10 | If 0.5 has a blocking bug |
| Tiptap 3 | Lexical 0.52 | Not for changelog-scale content |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `next-auth` / `@auth/nextjs` | vinext: `unsupported`. Maintenance mode upstream. | `better-auth` |
| `radix-ui` barrel package | `vite build` hangs under isolated installs (#3483) | `@radix-ui/react-<primitive>` (rewrite shadcn CLI output) |
| `oven/bun` as the **runtime** base image | No Node, and Bun 1.4.2 hangs on SSE4.2-hiding VPS CPUs (#43683) | `node:24-bookworm-slim` + copied Bun binary |
| `bun --bun` / `bun run --bun` in scripts | Forces vite/nest/drizzle-kit onto Bun's runtime | Plain `bun run` (Node via shebang) |
| `bun test` for Nest code | Puts decorator metadata on Bun's transpiler (#44120) | Vitest on Node |
| drizzle-orm/drizzle-kit 1.0 RCs | Pre-release, with migration-format churn | 0.45.3 / 0.31.11 |
| drizzle-kit in the production image | Unneeded weight. The ORM's `migrate()` applies committed SQL. | `drizzle-orm/node-postgres/migrator` |
| RQB exclusion-mode `columns: { x: false }` on public paths, or `drizzle-zod`-derived public DTOs | Fails open when internal columns are added | Explicit `select()` column maps plus hand-written `Public*` Zod schemas |
| TypeScript 7.0 as the compiler | No compiler API, so `nest build` breaks | TS 6.0.3 |
| `nestjs-zod`, `class-validator` | Nest-11-only, or a duplicate schema system | Nest 12 Standard Schema + Zod |
| Nitro deploy path | #3478, #853 | `output: "standalone"` |
| `next/image` for uploads, `next/font/google` | Unresized on Node (#3446); runtime CDN fonts | `<img srcSet>` with API WebP widths; `@fontsource-variable/*` |
| sharp or any native module in `apps/web` | Native modules fail in vinext's RSC dev environment | Image work only in Nest |
| Stored changelog HTML / `dangerouslySetInnerHTML` | XSS and a permanent sanitizing burden | Tiptap JSON + static renderer + Zod allowlist |
| Server Actions for app mutations | Extra hop and a second auth path in vinext | TanStack Query to Nest |
| `postcss.config.json` / turbopack Tailwind config | Ignored by vinext (#1128) | `postcss.config.mjs` |
| Running production builds natively on Windows | #2696 (vinext static 404s), #44242 (`bun run` + `nest start`) | Docker/WSL. Call the Nest CLI via `node` in scripts. |

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| vinext@1.0.0 | vite ^8, @vitejs/plugin-rsc ^0.5.34, plugin-react ^5.1.4\|\|^6, react/react-dom/rsdw ^19.2.6, Node >=22 | From published peers/engines |
| better-auth@1.7.7 / @better-auth/drizzle-adapter@1.7.7 | drizzle-orm ^0.45.2 \|\| >=1.0.0-rc.1 <2 | 0.45.3 is inside the range |
| @thallesp/nestjs-better-auth@2.8.0 | @nestjs/* ^11.1.6\|\|^12, better-auth >=1.5 <2, express ^5.1, typescript ^5.9\|\|^6, **node** >=22.22.1 | Forces Express, TS ≤6 and the Node runtime |
| @nestjs/core@12.1.2 | Node 20.19+/22.12+ (24 recommended); ESM packages | Vitest over Jest |
| drizzle-orm@0.45.3 | drizzle-kit@0.31.11 | Keep the pair in lockstep. The 1.0 upgrade changes the migrations layout. |
| Bun 1.4.2 workspaces | isolated linker default (configVersion 1), `catalog:`, `workspace:*` | Lockfile written on Windows has to install cleanly in Linux (spike check) |
| sharp@0.35.5 | Node-API v9; Linux x64 glibc ≥2.28 **+ SSE4.2** | Check VPS CPU flags |
| @tiptap/*@3.31.4 | react ^17–^19 | All identical via catalog |
| @dnd-kit/react@0.5.0 | react ^18\|\|^19 | Pin exact |
| postgres:18 | volume at `/var/lib/postgresql` | Not `.../data` |

## Sources

- **cloudflare/vinext @ 1.0.0** (GitHub API, primary source, HIGH): README; `docs/deploying/other-platforms.mdx`; `docs/reference/differences.mdx`; `packages/vinext/src/check.ts`; `src/build/standalone.ts`; `packages/create-vinext-app/src/index.ts`; `.agents/skills/migrate-to-vinext/references/compatibility.md`; `tests/fixtures/ecosystem/{better-auth,shadcn}/*`; `tests/ecosystem.test.ts`; root `package.json`, `pnpm-workspace.yaml`
- **vinext issues** (HIGH): #727, #3483 + PR #3516, #1128, #3443, #3444, #3445, #3446, #3485, #3486, #3476 (Bun compile report), #3478, #853, #3431, #3439, #3427, #2696, #2813
- **oven-sh/bun issues** (HIGH): #43683 (1.4.2 hangs on CPUs hiding SSE4.2, fix in progress), #44120 (emitDecoratorMetadata nullable unions), #44242 (Windows `bun run` + `nest start`)
- **npm registry** (HIGH): dist-tags, peers and engines for all packages, 2026-10-01. Notable: drizzle-orm `latest=0.45.3`, `rc=1.0.0-rc.4`; bun `latest=1.4.2`; prisma `latest` is an 8.0 RC (no longer relevant).
- **Docker Hub** (HIGH): `oven/bun` tags `1.4.2`, `-debian`, `-slim`, `-alpine`, `-distroless`
- **Context7** (MEDIUM per seam): `/oven-sh/bun` (isolated-installs default table, catalogs, trustedDependencies, shebang/`--bun` behavior, decorator transpiler/runtime code); `/drizzle-team/drizzle-orm-docs` (migrations: `migrate()` vs `drizzle-kit migrate`, RQB `columns`); `/better-auth/better-auth` (Drizzle adapter config, relations-v2 entry, `npx auth` CLI, NestJS integration, cookies); `/nestjs/docs.nestjs.com` (StandardSchemaValidationPipe, StandardSchemaSerializerInterceptor, swagger converter); `/ueberdosis/tiptap-docs`; `/clauderic/dnd-kit`
- **Web** (LOW unless corroborated): [sharp install](https://sharp.pixelplumbing.com/install) (Bun support, SSE4.2/glibc requirements; fetched, MEDIUM), [NestJS v12 is Now Available (Trilon)](https://trilon.io/blog/nestjs-12-is-now-available), [NestJS v12 release](https://github.com/nestjs/nest/releases/tag/v12.0.0), [NestJS and TypeScript 7](https://fernforge.github.io/devnotes/nestjs-typescript-7/) (corroborated by peer ranges, MEDIUM), [Auth.js is now part of Better Auth](https://better-auth.com/blog/authjs-joins-better-auth), [Dokploy Domains](https://docs.dokploy.com/docs/core/domains), [Postgres 18 Docker PGDATA change](https://aronschueler.de/blog/2025/10/30/fixing-postgres-18-docker-compose-startup/) (several consistent reports, MEDIUM)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
