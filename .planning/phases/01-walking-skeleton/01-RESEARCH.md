# Phase 1: Walking Skeleton - Research

**Researched:** 2026-10-01
**Domain:** Greenfield Bun-workspace monorepo: vinext (Next.js 16 API on Vite) web + NestJS 12 API with Better Auth OAuth, Drizzle/Postgres 18, sharp uploads, Docker/Dokploy deploy on an Oracle VPS, GitHub Actions CI
**Confidence:** MEDIUM-HIGH. Library behavior was read from primary source at tagged versions (HIGH). The integration of all of these pieces has never been run together, so the Phase 1 spike still has to prove it (MEDIUM).

This document builds on `.planning/research/{STACK,ARCHITECTURE,PITFALLS,SUMMARY}.md` and does not repeat them. It answers the Phase 1 research flags and the CONTEXT.md decisions, and it corrects three things the earlier research got wrong or left open: Bun `--filter` semantics, how Dokploy tag deploys actually behave, and sliding-session refresh through a cookie-forwarding RSC.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Sign-in & accounts
- **D-01:** Same-email accounts **auto-link**. Keep Better Auth's default implicit linking: when a user signs in with Google and later with GitHub and both report a verified email, it is one user with two `account` rows. Do not set `disableImplicitLinking`. Phase 2's teammate invites depend on one verified email mapping to one user. — **Reversibility:** costly — un-merging linked users later means splitting `account` rows and reassigning user-owned data.
- **D-02:** Sign-in lives on a dedicated **`/login` page** with Google and GitHub buttons and a `?next=` return path (validated as a same-origin relative path, so it can't be used as an open redirect). There is no modal. Phase 3's "prompt sign-in, then return to the same spot" reuses this page.
- **D-03:** Display name and avatar are **copied from the provider at first sign-in** and never auto-synced afterwards. Keep `updateUserInfoOnLink` false, so linking a second provider doesn't overwrite them.
- **D-04:** Sessions last **14 days, sliding**: the expiry renews while the session is in use. The user said "14 days", and sliding is recorded as the interpretation. In Better Auth terms: `session.expiresIn` = 14 days, with an `updateAge` that refreshes it (for example 1 day).

#### Upload rules
- **D-05:** Max upload size is **2 MB**. Enforce it in the multipart parser before sharp touches the bytes, and return a clear error when it's exceeded.
- **D-06:** Uploads are **static only**. Animated GIFs are flattened to their **first frame**, which saves VPS disk. Users who want animation or large images are expected to use external image URLs in content; that is a Phase 5 decision (see Deferred).
- **D-07:** Resizing is **cap only**: every upload becomes one WebP, downscaled to at most **1600px wide** (never upscaled), with EXIF stripped. There are no srcset widths and no per-purpose presets (logo vs content). The upload API takes no `purpose` parameter. Pick a sane `limitInputPixels` for decompression-bomb protection.
- **D-08:** Allowed inputs are PNG, JPEG, WebP, and GIF, detected by magic bytes (`file-type`) rather than by extension or MIME header. SVG, renamed non-images, and oversized files are rejected with a clear message (UPLD-01).
- **D-09:** Phase 1's upload UI is a **dev-only test page**, available only when signed in, that proves the pipeline. Phase 2 builds the real upload controls for logos. Hide or remove the test page before launch.

#### Environments & deploy
- **D-10:** Local dev uses **Caddy in the dev docker compose** for a single origin. It routes `localhost/api/*` and `/uploads/*` to Nest and everything else to the web dev server, mirroring prod's Traefik path routing so cookie and redirect bugs show up locally. This is not a Vite dev proxy.
- **D-11:** The VPS runs **staging and prod**, each with its own domain, Postgres, uploads volume, secrets, and Google/GitHub OAuth apps (or registered callbacks). The free VPS has limited RAM, so keep the footprint per environment small.
- **D-12:** Each environment is **one Dokploy compose app** (web, api, postgres) with Traefik path labels: `/api` and `/uploads` go to the api container, everything else to web. The same compose shape is used locally. Postgres 18 data is mounted at `/var/lib/postgresql`.
- **D-13:** CI is **GitHub Actions**. It runs lint (including the Phase 1 lint rules), tests, the vinext build, and the `next build` canary on PRs and on main. Images are built by Dokploy on deploy; there is no registry push.
- **D-14:** Deploy triggers: **a merge to main auto-deploys staging, and a release tag (`v*`) deploys prod**.
- **D-15:** **Staging catches mail in Mailpit.** Only prod sends through Brevo, so staging never emails real people or uses up the 300/day quota. The Brevo port reachability check (587, then 2525/465) still runs once from the VPS, and the working port is recorded for Phase 3.

#### Skeleton UI fidelity
- **D-16:** Build a **minimal real shell**, not throwaway pages:
  - Tailwind v4, wired the way vinext supports
  - `@fontsource-variable/inter`
  - a few shadcn-style components from individual `@radix-ui/react-*` packages: Button, Avatar, and DropdownMenu for the user menu with sign-out
  - a simple header with the user menu on every page, which satisfies "sign out from any page"
  Phase 2 extends this shell rather than replacing it. A full visual design (brand, tokens) comes later through `/gsd-ui-phase`.
- **D-17:** **Light mode only for now.** Use CSS color tokens from day one so dark mode can be added cheaply later.

### Claude's Discretion
- The SMTP reachability check method: a one-off script or CLI inside the API container, or an internal-only endpoint. It must not be publicly reachable.
- The exact Better Auth `updateAge`, the `limitInputPixels` value, and the WebP quality setting.
- The upload file naming and path scheme under `/uploads/` (it must match the Phase 5 allowlist regex `^/uploads/[a-z0-9/-]+\.webp$`).
- How the staging and prod compose files differ (one file plus env overrides is preferred).

### Deferred Ideas (OUT OF SCOPE)
- **External `https:` image URLs in rich text (changelog/FAQ). Decide in Phase 5.** The user wants people to be able to paste outside image URLs, and that is why uploads are static only. It conflicts with the current XSS allowlist (`image.src` must match `^/uploads/...\.webp$`), and hotlinked images expose visitor IPs to third parties, allow tracking pixels, and break when the external host removes them. Phase 5 must decide whether to allow them and under what restrictions.
- Srcset widths and per-purpose presets for uploads: add them if changelog pages feel heavy on mobile.
- Dark mode: tokens are ready; add it later.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign in with a Google account | Pattern 1 (Better Auth in Nest), Pattern 3 (`/login` + `signIn.social`), Pitfalls 1, 6, 9 |
| AUTH-02 | User can sign in with a GitHub account | Same as AUTH-01. GitHub `emailVerified` comes from `/user/emails`, so D-01 linking works with defaults (verified in source). |
| AUTH-03 | Stays signed in across refreshes, can sign out from any page | Pattern 1 (custom guard with `disableRefresh`), Pattern 2 (RSC `/api/v1/me`), header `SessionKeepAlive`, Pitfall 2 (refresh lost through RSC) |
| UPLD-01 | PNG/JPEG/WebP/GIF under a size limit, re-encoded to WebP, SVG and non-images rejected | Pattern 4 (multer limit, then `file-type`, then sharp), Code Examples, Pitfall 7 |
| OPS-01 | Uploads and DB data survive a redeploy | Pattern 6 (named volumes, `chown` before `USER node`, boot probe), Pattern 7 (Dokploy isolated deployments), Pitfall 4 |
| OPS-02 | Migrations apply automatically when the API starts | Pattern 5 (`pg.Client` + advisory lock + `migrate()` in `CMD`), Pitfall 8 (journal timestamp ordering) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These come from `.claude/CLAUDE.md` and carry the same authority as locked decisions:

- **Web:** Next.js 16.x API + Tailwind v4 + individual `@radix-ui/react-*` packages, built with **vinext** using native `output: "standalone"`. Not Nitro, and not `next build` for the deployed artifact. `next build` is only the CI canary and the escape hatch.
- **API:** NestJS. **Auth:** Better Auth inside NestJS, OAuth only (Google, GitHub), database sessions. NextAuth is forbidden.
- **DB:** PostgreSQL via Drizzle ORM + drizzle-kit + `pg`. Migrations are generated at dev time and committed. The API container applies them at boot under an advisory lock. drizzle-kit is **not** shipped in the production image.
- **Bun** for installs, workspaces, and scripts. **Node 24 LTS** runs both containers. Never use the Bun runtime, `--bun`, or `bun test` for Nest code.
- **Repo shape:** `apps/web`, `apps/api`, `packages/db` (API only), `packages/types` (shared Zod DTOs). Two Docker images.
- **Storage:** local named Docker volume, images converted to WebP in the API. sharp lives only in `apps/api`.
- **Infra:** Docker + Dokploy, named volumes for Postgres and uploads.
- **Email:** Brevo SMTP in prod, configured by env, Mailpit in dev/staging. Phase 1 confirms 587/2525/465 reachability from the VPS.
- **Privacy / tenant isolation:** not exercised yet in Phase 1. The lint rule banning exclusion-mode column selection lands now.
- **What NOT to use** (enforced in this phase): the `radix-ui` barrel, `next-auth`, Nitro, `oven/bun` as a runtime image, `--bun`, TS 7, `nestjs-zod`/`class-validator`, `next/image` for uploads, `next/font/google`, sharp in web, Server Actions for mutations, `postcss.config.json`, and production builds run natively on Windows.
- **Workflow:** changes go through GSD commands. Use Context7 for library docs.

## Summary

Phase 1 is a blocking spike that proves an unproven chain inside Docker. Most of the hard questions now have source-verified answers. **Better Auth inside Nest** works through `@thallesp/nestjs-better-auth` 2.8.0. The module re-adds JSON/urlencoded parsers for non-auth routes once you pass `bodyParser: false`, and it auto-excludes `/api/auth/*` from Nest's global prefix (verified in the module source). **`__Secure-` cookies over internal http are a non-issue.** Better Auth fixes cookie names at init from the static `baseURL` string (`https://` gives the `__Secure-` prefix) and reads them by name, so an RSC forwarding the `Cookie` header to `http://api:4000` still authenticates (verified in `cookies/index.ts@v1.7.7`). **D-01 auto-linking works with defaults.** Implicit linking needs (a trusted provider OR a provider-verified email) AND a verified local email. GitHub's `emailVerified` comes from `/user/emails`. So do **not** set `trustedProviders`: that would bypass the verified-email check.

There is one **real defect in the obvious design**. The library's global `AuthGuard` calls `auth.api.getSession({ headers })` on every Nest request. When `updateAge` is due, that call extends the DB session, but the refreshed `Set-Cookie` is dropped, both on server-to-server RSC calls and on internal API calls. After that, `shouldBeUpdated` is false for another day. In practice the browser cookie never slides, and the user is logged out 14 days after sign-in. That breaks D-04. **Fix:** set `disableGlobalAuthGuard: true` and register your own guard that calls `getSession({ headers, query: { disableRefresh: true } })`. Then let only the browser's own `GET /api/auth/get-session` (a tiny `SessionKeepAlive` client component in the header) perform the refresh, because only there does the `Set-Cookie` reach the browser.

On the build and deploy side, three earlier assumptions need correcting:
1. **Bun `--filter api` does not include workspace dependencies.** Use `--filter '@usersaid/api...'` (the trailing `...` selects the workspaces it depends on).
2. **Dokploy's "tag" trigger fires on any tag and still clones the configured branch with `--depth 1`.** It never checks out the tag, so it cannot deploy "the `v*` commit". Deploy prod from a `release` branch that a GitHub Action fast-forwards to the tag commit.
3. **Dokploy "Isolated Deployments" must be on.** Without it, the staging and prod stacks share `dokploy-network` with identical service names (`api`, `postgres`), and DNS can cross-wire staging into the prod DB.

For Tailwind, use **PostCSS** (`postcss.config.mjs` + `@tailwindcss/postcss`). It is what `create-vinext-app@1.0.0` emits and what vinext's own production site uses, and it is identical under `next build`.

**Primary recommendation:** Build the skeleton in this order:
1. monorepo and lint rules
2. `packages/db` (auth schema + migrate runner)
3. Nest API (custom session guard, `/api/v1/me`, uploads)
4. vinext web shell (`/login`, header menu, dev upload page)
5. `compose.yaml` with a local Caddy profile, and a production smoke test in Docker
6. GitHub Actions CI with the `next build` canary
7. Dokploy staging/prod with isolated deployments, then OAuth on staging and the SMTP probe on the VPS

Treat every MEDIUM item in this document as a spike check with a recorded result.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth redirect/callback, state, CSRF, account linking | API (Nest + Better Auth at `/api/auth/*`) | — | Locked: auth in Nest. vinext never runs OAuth code. |
| Session validation for every API call | API (custom `SessionGuard`, global, default-deny) | DB (session table) | DB sessions; validated where authorization is enforced |
| Session sliding refresh (`Set-Cookie`) | Browser → API (`GET /api/auth/get-session`) | — | Only a browser-originated response can update the cookie (Pitfall 2) |
| "Who am I" for server-rendered pages | Frontend server (RSC `apiServer('/api/v1/me')`) | API | RSC forwards the cookie over the internal network |
| Optimistic redirect to `/login` | Frontend server (`proxy.ts`, cookie presence only) | — | UX only; real authorization stays in Nest |
| `?next=` validation | Frontend server (`/login` page) + API (Better Auth `callbackURL` check) | — | Defense in depth against open redirects |
| Sign-in buttons, sign-out, keep-alive | Browser (`better-auth/react` client) | — | Same-origin calls to `/api/auth/*` |
| Upload validation + WebP encode | API (multer → file-type → sharp) | — | sharp is API-only by constraint |
| Upload storage + serving `/uploads/*` | API (`express.static` on a named volume) | Traefik/Caddy routes the path | Traefik can't serve files. Long-lived immutable cache headers. |
| Migrations | API container `CMD` (runs before `main.js`) | DB (advisory lock) | Locked decision; no drizzle-kit in prod |
| Path routing / TLS | Traefik (Dokploy) in prod, Caddy in local dev | — | One origin, no CORS |
| SMTP reachability probe | API image (one-off script via `docker exec`) | — | Never exposed over HTTP |

## Standard Stack

All versions were checked against the npm registry on 2026-10-01 (`npm view <pkg> version`) [VERIFIED: npm registry]. Pins and peer ranges follow `.planning/research/STACK.md`.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.21.0 (`node:24-bookworm-slim`) | Runtime, both images | Latest v24 LTS "Krypton", released 2026-09-07 [VERIFIED: nodejs.org/dist/index.json] |
| Bun | 1.4.2 (copied from `oven/bun:1.4.2-slim`) | PM, workspaces, catalogs, scripts | Locked. Local box has **1.4.0**; pin `"packageManager": "bun@1.4.2"` and upgrade [VERIFIED: `bun --version`] |
| TypeScript | 6.0.3 (pin; npm `latest` is 7.0.2) | Language | `nest build` needs the TS compiler API; the nestjs-better-auth peer is `^5.9.2 \|\| ^6.0.0` [VERIFIED: npm registry] |
| vinext | 1.0.0 (exact) | Next 16 App Router on Vite, standalone Node server | Locked. Peers: vite ^8, react/react-dom ^19.2.6, plugin-react ^5.1.4\|\|^6, optional plugin-rsc ^0.5.34 / rsdw. Engines: node >=22 [VERIFIED: npm registry] |
| vite / @vitejs/plugin-rsc / @vitejs/plugin-react | 8.3.1 / 0.5.35 / 6.1.1 (exact) | Bundler + RSC | vinext peers |
| react / react-dom / react-server-dom-webpack | 19.3.0, one copy via Bun catalog | UI | vinext #3443 (wrong-version copy) is still open |
| next | 16.3.8 (devDependency of `apps/web` only) | `next build` canary + real `next/*` types | Escape hatch kept warm |
| tailwindcss / @tailwindcss/postcss / postcss | 4.3.3 / 4.3.3 / latest 8.x | Styling via `postcss.config.mjs` | What `create-vinext-app@1.0.0` emits and what vinext's own `apps/web` uses [VERIFIED: vinext@1.0.0 source] |
| @radix-ui/react-avatar / -dropdown-menu / -slot | 1.2.6 / 2.1.24 / 1.3.3 | Avatar, user menu, Button `asChild` | Individual packages only (#3483) |
| @nestjs/core, common, platform-express | 12.1.2 | API | `platform-express@12.1.2` pins `express 5.2.1` and `multer 2.4.0` [VERIFIED: npm registry] |
| @nestjs/cli | 12.0.8 (dev) | `nest build` | Call it through `node` on Windows (bun #44242, open) |
| better-auth / @better-auth/drizzle-adapter | 1.7.7 / 1.7.7 | OAuth + DB sessions | Adapter peer `drizzle-orm ^0.45.2 \|\| >=1.0.0-rc.1 <2.0.0`. All 18 better-auth peers are optional [VERIFIED: npm registry] |
| @thallesp/nestjs-better-auth | 2.8.0 | Mounts the handler, body-parser handling, decorators, hooks | Peers `@nestjs/* ^11.1.6\|\|^12`, engines node >=22.22.1. express/graphql/websockets/qs peers are optional [VERIFIED: npm registry] |
| drizzle-orm / drizzle-kit / pg / @types/pg | 0.45.3 / 0.31.11 / 8.23.1 / latest | ORM, migration generation, driver | Locked |
| sharp | 0.35.5 | WebP encode (API only) | No install script. Prebuilt `@img/sharp-linux-x64` **and** `-linux-arm64` via optionalDependencies [VERIFIED: npm registry] |
| file-type | 22.1.1 | Magic-byte sniffing | ESM-only (`"type": "module"`), engines node >=22, `fileTypeFromBuffer()` [VERIFIED: tarball `source/index.d.ts:37`] |
| zod | 4.6.5 | Shared schemas; Nest 12 Standard Schema | Locked |
| nodemailer | 10.0.13 | SMTP probe now, outbox in Phase 3 | `transporter.verify()` does connect + STARTTLS + AUTH. Brevo's own Node example uses it [CITED: developers.brevo.com/docs/node-smtp-relay-example] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.104.0 | The one Phase 1 mutation (upload test page) | Client mutations only |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 | shadcn-style Button | Copy-in components |
| @fontsource-variable/inter | 5.3.0 | Self-hosted font | Imported once in the root layout |
| lucide-react | 1.49.0 | Icons in the menu (optional) | — |
| helmet | latest 8.x | API security headers | `main.ts` |
| reflect-metadata, rxjs | latest | Nest runtime peers | Required by Nest |
| vitest + unplugin-swc + @swc/core | 5.0.3 / 2.0.0 / 1.16.13 | API unit/integration tests with decorator metadata | Nest's documented Vitest recipe needs SWC for `emitDecoratorMetadata` [CITED: docs.nestjs.com/recipes/swc] |
| supertest | latest | HTTP-level API tests | Upload accept/reject matrix, guard behavior |
| oxlint | 1.86.0 | Lint, including restricted imports + local JS-plugin rules | CI |
| tsdown | 0.23.0 | Build `packages/db` and `packages/types` to ESM + d.ts | Node/tsc need compiled workspace JS |
| @playwright/test | 1.63.0 | Smoke E2E against the Docker stack (optional in Phase 1) | Uses Better Auth `testUtils` cookies, not real OAuth |
| caddy (image) | 2.11.4 | Local single-origin router | Dev compose + local prod smoke |
| axllent/mailpit (image) | 1.31.3 | Mail catcher, dev + staging | `COMPOSE_PROFILES=mail` on staging |
| postgres (image) | 18 | DB | `PGDATA=/var/lib/postgresql/18/docker`, `VOLUME /var/lib/postgresql` [VERIFIED: docker-library/postgres 18/bookworm/Dockerfile:191-192] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `SessionGuard` (`disableRefresh`) | Library's global `AuthGuard` | The library guard silently breaks sliding sessions (Pitfall 2). Keep the library for mounting, body parsing, and hooks. |
| PostCSS Tailwind | `@tailwindcss/vite` plugin | Use it only if the spike's vinext build drops CSS. It would add a vinext-only `vite.config.ts` plugin, which makes the `next build` fallback less identical. |
| Dev servers on the Windows host behind Caddy (`host.docker.internal`) | Dev servers inside containers | Bind-mounted Windows trees get no inotify events (polling needed), and Windows-installed `node_modules` (win32 sharp/swc binaries, Bun symlinks) don't run in Linux. |
| `release` branch for prod | Dokploy native `triggerType: "tag"` | The native tag trigger deploys branch HEAD on any tag (Pitfall 5) |
| Dokploy native push-on-`main` for staging | GitHub Action → `POST /api/compose.deploy` after CI is green | The API path gates staging on green CI. Native push is simpler but deploys even when CI is red. Either satisfies D-14. Recommend native push for Phase 1 and switch later if needed. |
| One-off `node dist/scripts/smtp-check.js` via `docker exec` | Internal-only HTTP endpoint | A script has no attack surface and is not reachable through Traefik |

**Installation:** follow STACK.md § Installation, with these corrections:
```bash
# root
bun add -d typescript@6.0.3 oxlint@1.86.0 prettier tsdown@0.23.0
# apps/api additions
bun add nodemailer@10.0.13 helmet reflect-metadata rxjs --cwd apps/api
bun add -d @types/nodemailer @types/multer @types/express vitest@5.0.3 unplugin-swc@2.0.0 @swc/core supertest @nestjs/testing@12.1.2 --cwd apps/api
# apps/web additions
bun add @radix-ui/react-avatar@1.2.6 @radix-ui/react-dropdown-menu@2.1.24 @radix-ui/react-slot@1.3.3 --cwd apps/web
bun add -d next@16.3.8 postcss --cwd apps/web
# then: bun pm untrusted   → trust only what needs scripts (e.g. @swc/core postinstall)
```
Do NOT install Tiptap, dnd-kit, nuqs, or drizzle-zod in Phase 1. No phase-1 feature needs them.

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm …` was run on 2026-10-01. Every `SUS` verdict has the same single reason, `too-new`. That flag refers to the **latest version's** publish date (within the last few weeks). It does not mean the packages themselves are new: each has a canonical repo and millions of weekly downloads. No `SLOP` verdicts. None of the top-level packages declares `install`/`postinstall`/`preinstall` (checked with `npm view <pkg> scripts.*`), except `@swc/core` (`node postinstall.js`, a local binding check).

| Package | Registry | Latest published | Weekly DL | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| typescript | npm | 2026-07-08 | 343M | microsoft/TypeScript | OK | Approved (pin 6.0.3) |
| zod | npm | 2026-09-13 | 360M | colinhacks/zod | SUS (too-new) | Flagged, recency only |
| drizzle-orm / drizzle-kit | npm | 2026-09-21 | 29M / 24M | drizzle-team/drizzle-orm | SUS (too-new) | Flagged, recency only |
| pg | npm | 2026-09-30 | 68M | brianc/node-postgres | SUS (too-new) | Flagged, recency only |
| @types/pg | npm | 2026-08-17 | 72M | DefinitelyTyped | OK | Approved |
| @nestjs/core, common, platform-express, testing | npm | 2026-09-30 | 11–18M | nestjs/nest | SUS (too-new) | Flagged, recency only |
| @nestjs/cli | npm | 2026-09-28 | 9.6M | nestjs/nest-cli | SUS (too-new) | Flagged, recency only |
| better-auth / @better-auth/drizzle-adapter / auth (CLI) | npm | 2026-09-30 | 11M / 10M / 0.7M | better-auth/better-auth | SUS (too-new) | Flagged, recency only |
| @thallesp/nestjs-better-auth | npm | 2026-09-03 | 140k | ThallesP/nestjs-better-auth | SUS (too-new) | Flagged. **Lowest download count in the stack.** Source was reviewed this session (guard, module, middleware). |
| sharp | npm | 2026-09-27 | 123M | lovell/sharp | SUS (too-new) | Flagged, recency only |
| file-type | npm | 2026-09-17 | 67M | sindresorhus/file-type | SUS (too-new) | Flagged, recency only |
| nodemailer / @types/nodemailer | npm | 2026-09-30 / 09-15 | 27M / 13M | nodemailer/nodemailer | SUS (too-new) | Flagged, recency only |
| helmet, @types/express, reflect-metadata, rxjs | npm | ≤2026-07 | 18–124M | canonical | OK | Approved |
| @types/multer, supertest | npm | 2026-09 | 12M / 21M | canonical | SUS (too-new) | Flagged, recency only |
| vinext | npm | 2026-09-28 | 1.6M | cloudflare/vinext | SUS (too-new) | Flagged, recency only (locked choice) |
| vite, @vitejs/plugin-rsc | npm | 2026-10-01 / 09-16 | 219M / 1.6M | vitejs | SUS (too-new) | Flagged, recency only |
| @vitejs/plugin-react | npm | 2026-08-28 | 111M | vitejs | OK | Approved |
| react, react-dom, react-server-dom-webpack | npm | 2026-09-09 | 212M / 200M / 2M | react/react | SUS (too-new) | Flagged, recency only |
| next | npm | 2026-09-30 | 72M | vercel/next.js | SUS (too-new) | Flagged, recency only (dev-only canary) |
| tailwindcss, @tailwindcss/postcss | npm | 2026-07-16 | 154M / 46M | tailwindlabs | OK | Approved |
| postcss | npm | 2026-09-03 | 341M | postcss/postcss | SUS (too-new) | Flagged, recency only |
| @radix-ui/react-avatar, -dropdown-menu, -slot | npm | 2026-07-24 | 61–211M | radix-ui/primitives | OK | Approved |
| class-variance-authority, clsx, @fontsource-variable/inter | npm | ≤2026-07 | 5–148M | canonical | OK | Approved |
| tailwind-merge, @tanstack/react-query | npm | 2026-09 | 101M / 80M | canonical | SUS (too-new) | Flagged, recency only |
| oxlint, prettier, vitest, tsdown, @playwright/test | npm | 2026-09 | 5–160M | canonical | SUS (too-new) | Flagged, recency only |
| unplugin-swc / @swc/core | npm | 2026-09-21 / 09-30 | 2.6M / 51M | unplugin / swc-project | SUS (too-new) | Flagged. @swc/core has a `postinstall` (local binding check) and needs a `trustedDependencies` entry. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** every package marked "Flagged" above, all for latest-version recency alone. **Planner:** add one `checkpoint:human-verify` task before the first `bun install` that commits `bun.lock`. The human reviews the lockfile's resolved versions against the pins in this table and checks `bun pm untrusted`. A separate checkpoint per package is not needed, because no package has a reason other than recency.

## Architecture Patterns

### System Architecture Diagram

```
                      Browser (https://staging.<domain> | https://<prod-domain> | http://localhost)
                         │  first-party cookies: [__Secure-]better-auth.session_token (SameSite=Lax, HttpOnly)
                         ▼
        ┌────────────── Router (prod: Dokploy Traefik  |  dev: Caddy http://localhost) ──────────────┐
        │ Host(x) && PathPrefix(/api)     ──► api:4000   (no strip)                                   │
        │ Host(x) && PathPrefix(/uploads) ──► api:4000   (no strip)                                   │
        │ Host(x)                         ──► web:3000   (longer rule wins → /api,/uploads go to API) │
        └──────────────┬──────────────────────────────────────────────┬───────────────────────────────┘
                       │                                              │
   ┌───────────────────▼───────────────────┐        ┌─────────────────▼────────────────────────────────────┐
   │ web (vinext standalone, node server.js)│        │ api (NestJS 12, Express 5, node dist/main.js)         │
   │ proxy.ts: cookie present? else →       │  RSC   │  /api/auth/*  → Better Auth handler (raw body)        │
   │   /login?next=<safe path>              │ fetch  │  body parsers re-added for everything else            │
   │ layout.tsx (RSC): apiServer('/api/v1/me')──────►│  SessionGuard (global): getSession(disableRefresh)    │
   │   forwards Cookie header only          │ http://│   ├ @Public routes pass; else 401                     │
   │ <Header>: Avatar + DropdownMenu        │ api:4000  /api/v1/me      → {user|null}                       │
   │ <SessionKeepAlive>: GET /api/auth/get-session  │  /api/v1/uploads  → multer(2MB) → file-type → sharp    │
   │ /login: signIn.social({callbackURL})   │        │  /uploads/*       → express.static(UPLOAD_DIR)        │
   │ /dev/upload: TanStack useMutation      │        │  /api/v1/health   → @Public                           │
   └────────────────────────────────────────┘        └───────┬───────────────────────────┬──────────────────┘
                                                             │ pg Pool                   │ fs (atomic rename)
   Container start (api CMD):                       ┌────────▼─────────┐        ┌────────▼──────────────┐
   node packages/db/dist/migrate.js                 │ postgres:18      │        │ volume: uploads       │
     ├ pg.Client → SELECT pg_advisory_lock(K)       │ volume: pgdata → │        │ /data/uploads/YYYY/MM/│
     ├ migrate(db,{migrationsFolder})  ─────────────►│ /var/lib/postgresql│      │   <uuid>.webp         │
     └ unlock; end  → exec node apps/api/dist/main.js└──────────────────┘        └───────────────────────┘

   External: Google / GitHub OAuth  ◄──redirects──►  /api/auth/callback/{google|github} on PUBLIC_URL
             smtp-relay.brevo.com:587|2525|465  ◄── one-off smtp-check script via docker exec (VPS)
```

### Recommended Project Structure

```
/
├─ package.json             # workspaces.packages + workspaces.catalog (react, react-dom, rsdw, zod); packageManager bun@1.4.2
├─ bun.lock  bunfig.toml    # [install] linker = "isolated" (explicit); flip to "hoisted" only if the spike needs it
├─ .oxlintrc.json           # restricted imports per directory + local jsPlugin rules
├─ tools/oxlint-usersaid.mjs  # local rules: no-import-meta-env, no-exclusion-columns (+ fixture test)
├─ compose.yaml             # prod shape: web, api, postgres (+ mailpit profile "mail", caddy profile "local")
├─ compose.dev.yaml         # dev infra: postgres, mailpit, caddy → host.docker.internal:{3000,4000}
├─ docker/Caddyfile.dev  docker/Caddyfile.local
├─ .dockerignore            # **/node_modules, **/dist, .env*, .git, .planning
├─ .github/workflows/ci.yml  .github/workflows/release.yml
├─ apps/web/   (vinext)     # next.config.ts (output:"standalone"), postcss.config.mjs, proxy.ts, Dockerfile
│   └─ app/ layout.tsx  globals.css  page.tsx  login/page.tsx  dev/upload/page.tsx
│      components/ui/{button,avatar,dropdown-menu}.tsx  components/{header,user-menu,session-keepalive}.tsx
│      lib/{api-server.ts, auth-client.ts, safe-next.ts, query-client.tsx}
├─ apps/api/   (Nest, "type":"module")  # Dockerfile, vitest.config.ts, nest-cli.json
│   └─ src/ main.ts  app.module.ts  env.ts
│      auth/{auth.ts (createAuth), session.guard.ts, public.decorator.ts, current-user.decorator.ts, me.controller.ts}
│      uploads/{uploads.controller.ts, uploads.service.ts, image-pipeline.ts}
│      health/health.controller.ts   scripts/smtp-check.ts
├─ packages/db/             # @usersaid/db (tsdown → dist)
│   └─ src/{schema/auth.ts, schema/uploads.ts, schema/index.ts, client.ts, migrate.ts}  migrations/ (+meta/_journal.json)  drizzle.config.ts
└─ packages/types/          # @usersaid/types: zod MeResponse, UploadResponse, error shape
```

### Pattern 1: Better Auth in Nest with a refresh-safe session guard
**What:** `AuthModule.forRoot({ auth, disableGlobalAuthGuard: true })` mounts Better Auth at `/api/auth` and handles body parsing. Your own global guard validates sessions without triggering a refresh.
**When to use:** every Nest route. This is the default-deny boundary.
**Verified facts:**
- The module excludes `basePath` and `${basePath}/*path` from the global prefix automatically, so `app.setGlobalPrefix('api/v1')` coexists [VERIFIED: nestjs-better-auth src/auth-module.ts:113-119].
- With `bodyParser: false`, the module re-adds the JSON and urlencoded parsers for non-auth routes. The default is enabled, and it is configurable (`bodyParser.json.limit` etc.) [VERIFIED: src/middlewares.ts:78-108, README "Basic Setup"]. Multipart is untouched. Multer in `FileInterceptor` parses it.
- Setting `trustedOrigins` as an array makes the module call `enableCors({origin: trustedOrigins, credentials: true})` app-wide [VERIFIED: src/auth-module.ts:188-197]. Same origin needs no CORS, so **do not set `trustedOrigins`**. `baseURL`'s origin is trusted implicitly. (Or set `disableTrustedOriginsCors: true` if you ever add origins.)
- The library guard calls `getSession({ headers })` with no `disableRefresh` [VERIFIED: src/auth-guard.ts:142-146]. Why that breaks D-04 is explained in Pitfall 2.
- `getSession` accepts `query: { disableRefresh?: boolean, disableCookieCache?: boolean }` [VERIFIED: better-auth@v1.7.7 packages/better-auth/src/api/routes/session.ts:281-296 `getSessionQuerySchema`].

### Pattern 2: RSC reads through cookie forwarding
**What:** `apiServer(path)` in `apps/web/lib/api-server.ts` uses `server-only`, reads `(await headers()).get('cookie')`, and fetches `process.env.API_INTERNAL_URL + path` with `cache: 'no-store'`. The root layout calls `/api/v1/me` wrapped in React `cache()`.
**Facts:**
- Cookie names come from `baseURL` at init: secure = `useSecureCookies` ?? (static baseURL `startsWith("https://")`) ?? `NODE_ENV==="production"` [VERIFIED: better-auth@v1.7.7 cookies/index.ts:66-76]. The name is read from the forwarded header no matter what protocol the hop uses, so **`__Secure-` over `http://api:4000` works**.
- Corollary: **always set `baseURL` explicitly per environment** (`PUBLIC_URL`). If it is omitted and `NODE_ENV=production`, the local `http://localhost` prod-smoke stack would issue `__Secure-` cookies, and the browser rejects those over plain http.
- Forward **only** `cookie` (and optionally `x-forwarded-for`). Never forward `host`. Never send cookies to any URL other than `API_INTERNAL_URL`.

### Pattern 3: `/login`, `?next=` and `proxy.ts`
**What:**
- `proxy.ts` matches `/dev/:path*` (and later `/dashboard/:path*`) and redirects to `/login?next=<pathname+search>` when `getSessionCookie(request)` returns null. That helper checks both the `__Secure-` and the plain names [VERIFIED: cookies/index.ts:559-591].
- `/login` validates `next` with `safeNext()` and calls `authClient.signIn.social({ provider, callbackURL: safe, errorCallbackURL: '/login' })`. `callbackURL` and `errorCallbackURL` are part of the social sign-in body schema [CITED: better-auth sign-in.ts via Context7].
- Linking failures come back as `?error=account_not_linked` and similar. `/login` maps them to human messages.

**Next 16 convention:** `export function proxy(request)` plus `export const config = { matcher }` [CITED: nextjs.org docs 16-proxy]. vinext lists `proxy.ts` as supported [VERIFIED: vinext@1.0.0 compatibility.md:46].

### Pattern 4: Upload pipeline (UPLD-01)
Order matters: **multer size limit → file-type allowlist → sharp decode with limits → resize/encode → atomic write → DB row**.
- `FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 } })`. When the limit is exceeded, multer aborts the stream and Nest raises 413. An exception filter maps it to the message "Images must be 2 MB or smaller."
- `fileTypeFromBuffer(buf)` must return a mime in {`image/png`, `image/apng`, `image/jpeg`, `image/webp`, `image/gif`}. file-type returns `{ext:'apng', mime:'image/apng'}` for animated PNG [VERIFIED: file-type@22.1.1 source/detectors/png.js:18-27], so APNG has to be allowed explicitly or a valid PNG gets rejected. SVG is text, so file-type returns `undefined`, and the upload is rejected with 415. Renamed files are rejected by content.
- `sharp(buf, { limitInputPixels: 40_000_000, failOn: 'warning', animated: false })`. `animated` defaults to false (first frame only, which satisfies D-06), and `failOn` defaults to `'warning'`, the documented setting for untrusted input [CITED: sharp constructor docs via Context7]. Then `.rotate()` (EXIF auto-orient), `.resize({ width: 1600, withoutEnlargement: true })`, `.webp({ quality: 80 })`. Metadata is stripped by default on output [CITED: sharp api-output docs].
- Set `sharp.concurrency(1)` and `sharp.cache(false)` at boot, and run encodes through a single in-process promise queue so a burst can't OOM the small VPS [ASSUMED: sizing judgment].
- **Path scheme:** `/uploads/{yyyy}/{mm}/{uuid}.webp` with `crypto.randomUUID()` (lowercase hex plus hyphens). It matches `^/uploads/[a-z0-9/-]+\.webp$` [VERIFIED: 01-CONTEXT.md:57]. Write to `${UPLOAD_DIR}/.tmp/<uuid>` and then `rename` to the final path (same filesystem, so the rename is atomic). `.tmp` is a dotfile directory, and `dotfiles: 'deny'` keeps it unserved.
- **Serving:** `app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads', immutable: true, maxAge: '365d', index: false, dotfiles: 'deny', fallthrough: false, setHeaders: res => { res.set('X-Content-Type-Options','nosniff'); res.set('Content-Security-Policy',"default-src 'none'"); } })`. The global guard does not apply to express static middleware, so uploads are public by unguessable key, as the architecture intends.
- **DB row:** an `uploads` table (`id uuid pk`, `storage_key text unique`, `uploader_id text fk user`, `bytes int`, `width int`, `height int`, `created_at`). Ship it as the **second** migration (`0001`). That doubles as the success-criterion-3 proof that "a newly added migration is applied at start".

### Pattern 5: Migrations at boot under an advisory lock (OPS-02)
Verified drizzle-orm 0.45.3 behavior (from the published tarball):
- `migrate(db, config: { migrationsFolder: string; migrationsTable?: string; migrationsSchema?: string })` [VERIFIED: drizzle-orm@0.45.3 migrator.d.ts:5-9].
- It reads `${migrationsFolder}/meta/_journal.json` and fails if that file is missing. **The Dockerfile must copy `migrations/meta/`** [VERIFIED: migrator.js:4-15].
- It creates `drizzle.__drizzle_migrations`, reads the single latest row, and applies every journal entry whose `folderMillis` is greater than the last `created_at`, all inside **one transaction**. **It takes no lock of its own** [VERIFIED: pg-core/dialect.js:44-72].
- So use a single `pg.Client` (not a Pool), which keeps the session-level advisory lock and the migration on the same connection: `connect → SELECT pg_advisory_lock($K) → migrate(drizzle(client)) → pg_advisory_unlock → end`. Exit non-zero on failure so the container restarts and the failure shows in Dokploy logs.
- `CMD ["sh","-c","node packages/db/dist/migrate.js && exec node apps/api/dist/main.js"]` plus `init: true` in compose, so signals reach Node.

### Pattern 6: Docker images (Node runtime, Bun as PM)
Use STACK.md's Dockerfile sketch with these corrections:
1. **Filters must include workspace dependencies:** `bun install --frozen-lockfile --filter '@usersaid/api...'` (and `'@usersaid/web...'`). `foo...` selects "`foo` and the workspaces it depends on, directly or transitively" [VERIFIED: bun@1.4.2 docs/pm/filter.mdx:31-37]. Plain `--filter api` would skip `packages/db`'s own dependencies (drizzle-orm, pg).
2. The root `package.json` is excluded from a filtered install unless selected. Tools needed at build time (typescript, tsdown) must be devDependencies **of the workspace that builds**, or you add `--filter './'`.
3. Prod deps: `bun install --frozen-lockfile --production --filter '@usersaid/api...'` in a separate stage. Fallback: `bun prune --production --filter '@usersaid/api'` after the build. `bun prune` landed in Bun 1.4.0, and a layout-detection fix landed on 2026-09-01 [VERIFIED: oven-sh/bun commits on docs/pm/cli/prune.mdx; release dates]. Which of the two works under the isolated linker is a **spike check**.
4. The `oven/bun` slim image puts the binary at `/usr/local/bin/bun`, uses the `x64-baseline` build on amd64, and is multi-arch [VERIFIED: oven-sh/bun dockerhub/debian-slim/Dockerfile:18,52-54]. `bunx` is a symlink that is **not** copied, so use `bun x`.
5. Web runtime: `ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 VINEXT_TRUST_PROXY=1`, `CMD ["node","server.js"]` from `dist/standalone`. `HOST`, not `HOSTNAME` [VERIFIED: vinext@1.0.0 docs/deploying/other-platforms.mdx]. `VINEXT_TRUST_PROXY` is read at module load from `process.env` [VERIFIED: vinext src/server/proxy-trust.ts], so it is a runtime env var.
6. API runtime: `RUN mkdir -p /data/uploads && chown -R node:node /data` **before** `USER node`. Mount the named volume at `/data/uploads`. At boot `main.ts` writes and deletes `.probe`, and refuses to start if the volume is not writable.
7. `.dockerignore` must exclude `.env*`. vinext's config hook runs `loadDotenv` at build [VERIFIED: vinext src/index.ts:2469-2477], so a stray `.env` would be read during the image build.

### Pattern 7: Compose shape, local dev, and Dokploy
- **`compose.yaml` (one file for local-prod, staging, and prod):**
  - Services `web`, `api` (both `build:` with `context: .` and `dockerfile: apps/*/Dockerfile`), and `postgres:18` with `volumes: [pgdata:/var/lib/postgresql]` and a `pg_isready` healthcheck. `api` uses `depends_on: postgres: condition: service_healthy`.
  - `mailpit` under `profiles: [mail]`; `caddy` under `profiles: [local]` publishing `80:80`.
  - No `container_name`. No host `ports` on web/api/postgres.
  - Env values come from `${VAR}` interpolation, which Dokploy writes to `.env` next to the compose file.
  - Staging sets `COMPOSE_PROFILES=mail` [ASSUMED: compose reads `COMPOSE_PROFILES` from the project `.env`; verify with Dokploy "Preview Compose"].
- **Local dev (`compose.dev.yaml`):** Postgres, Mailpit, and Caddy in containers. `bun run dev` for web (vite on :3000) and api (Nest on :4000) runs **natively on Windows**. `Caddyfile.dev` uses `http://localhost` (the `http://` prefix disables Caddy's automatic internal-CA HTTPS [CITED: caddyserver.com/docs/automatic-https]) with `@api path /api/* /uploads/*` → `reverse_proxy @api host.docker.internal:4000` and everything else → `host.docker.internal:3000`. `PUBLIC_URL=http://localhost`. OAuth dev apps use the callback `http://localhost/api/auth/callback/{google,github}`.
- **Local prod smoke (#2696 workaround):** `docker compose --profile local up --build` with `Caddyfile.local` routing to `api:4000`/`web:3000`. This is where the standalone build, persistence (`down && up`), and boot migration get verified on Linux.
- **Dokploy:**
  - Two Compose apps (staging and prod) from the same GitHub repo.
  - **Enable "Isolated Deployments" on both.** Dokploy then creates a per-app network and attaches Traefik to it [CITED: dokploy docs core/docker-compose/utilities].
  - Domains tab:
    - api service: `Host=<domain> Path=/api Port=4000 StripPath=off`
    - api service: `Host=<domain> Path=/uploads Port=4000 StripPath=off`
    - web service: `Host=<domain> Path=/ Port=3000`
  - Dokploy emits ``Host(`x`) && PathPrefix(`/api`)`` with no explicit priority, so Traefik's rule-length priority sends `/api` and `/uploads` to the API [VERIFIED: Dokploy packages/server/src/utils/docker/domain.ts:437].
  - Named volumes persist across redeploys and are eligible for Dokploy Volume Backups.

### Pattern 8: CI and deploy triggers
- **`ci.yml`** runs on `pull_request` and on `push` to `main`. Use `oven-sh/setup-bun@v2` (2.2.0) with `bun-version: 1.4.2` and `actions/setup-node@v7` (Node 24), then:
  1. `bun install --frozen-lockfile`. This runs on Linux from a lockfile written on Windows, which is itself a spike check.
  2. `bun run lint` (oxlint + local rules)
  3. `bun run typecheck`
  4. `bun run test`
  5. `bun run --filter @usersaid/web build` (vinext)
  6. `bun run --filter @usersaid/web build:next` (canary, `next build`)
  7. Optionally `docker compose build` to catch Dockerfile drift.
- **Staging:** Dokploy compose app with GitHub provider, branch `main`, Auto Deploy on, `triggerType: push`.
- **Prod (D-14):**
  - Dokploy compose app on branch **`release`**, Auto Deploy on push.
  - `release.yml` runs `on: push: tags: ['v*']`. It waits for or re-runs CI on the tagged SHA, then does `git push origin <tag-sha>:refs/heads/release --force-with-lease`. That needs `contents: write`, plus branch protection that lets only the Action push `release`.
  - Why not Dokploy's native tag trigger: the webhook handler deploys every compose app with `triggerType: "tag"` on **any** `refs/tags/*` push [VERIFIED: Dokploy apps/dokploy/pages/api/deploy/github.ts:115-172], and the clone step always runs `git clone --branch <configured branch> --depth 1` [VERIFIED: packages/server/src/utils/providers/github.ts:235]. It would deploy `main` HEAD, not the tag.
  - Alternative: the Action calls `POST /api/compose.deploy` with `x-api-key` [CITED: dokploy docs api/reference-compose]. That still builds the configured branch, so the `release` pointer is needed either way.

### Pattern 9: SMTP reachability probe (D-15, success criterion 4)
- `apps/api/src/scripts/smtp-check.ts` compiles to `dist/scripts/smtp-check.js`. It reads `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_USER`, and `SMTP_PASS` (the Brevo **SMTP key**, not the API key) from env.
- For each of `[ {port:587, secure:false, requireTLS:true}, {port:2525, secure:false, requireTLS:true}, {port:465, secure:true} ]` it runs `nodemailer.createTransport({...}).verify()` with `connectionTimeout: 10000`, prints a PASS/FAIL table, and exits 0 if any port passed.
- Run it on the VPS with `docker exec <prod-api> node dist/scripts/smtp-check.js`, or through the Dokploy terminal. Record the result in the phase SUMMARY and in an env default (`SMTP_PORT`) for Phase 3. Host settings: [CITED: developers.brevo.com/docs/node-smtp-relay-example].
- Also run a raw TCP check first (`nc -vz smtp-relay.brevo.com 587`) to separate network blocking from credential problems.

### Pattern 10: Lint rules that land this phase
- **oxlint `no-restricted-imports` with `overrides` per directory** (native rule, configurable `paths`/`patterns` with `message` [CITED: oxc.rs no-restricted-imports]):
  - `apps/web/**` bans `@usersaid/db`, `drizzle-orm`, `drizzle-orm/*`, `pg`, `sharp`, the `radix-ui` barrel, `next-auth`, `vinext`/`vinext/*`, and `better-auth` except `better-auth/react`, `better-auth/cookies`, and `better-auth/client`. Use a pattern group `["better-auth", "better-auth/*", "!better-auth/react", "!better-auth/cookies", "!better-auth/client"]`.
  - `apps/web/**` also bans the Vite query-suffix imports (`*?raw`, `*?url`, `*?inline`).
- **Local JS plugin** (`jsPlugins`, ESLint-compatible API; alpha and not semver-stable [CITED: oxc.rs js-plugins]) with two AST rules:
  - `usersaid/no-import-meta-env`: `MemberExpression` whose object is `import.meta` and property `env`, under `apps/web/**`.
  - `usersaid/no-exclusion-columns`: an object property `columns` whose value has any `false` literal, anywhere under `apps/api/**` and `packages/db/**`.
  - Add a fixture test that proves each rule fires. If JS plugins misbehave, fall back to a dependency-free `scripts/check-forbidden.mjs` regex check in CI.

### Anti-Patterns to Avoid
- **Relying on the library's global `AuthGuard` for sliding sessions:** the refresh is silently consumed server-side (Pitfall 2).
- **Setting `trustedProviders: ['google','github']`:** that bypasses the provider-verified-email check, and implicit linking then becomes an account-takeover vector. The defaults already satisfy D-01.
- **Setting `trustedOrigins` with the Nest module:** it turns on app-wide CORS with credentials, which nothing needs.
- **Trusting Dokploy's "tag" trigger to deploy a tag:** it deploys branch HEAD on any tag.
- **Running staging and prod without Isolated Deployments on one Docker host:** identical service names on `dokploy-network` cross-wire.
- **`--filter api` without `...`:** the image is missing `packages/db`'s dependencies and crashes on boot with `ERR_MODULE_NOT_FOUND`.
- **Calling `migrate()` inside Nest bootstrap, or with a `Pool` while holding an advisory lock:** the lock and the migration end up on different connections.
- **Bind-mounting the Windows repo into Linux dev containers:** wrong-platform native binaries, and no file watching.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flows, state/PKCE, account linking | Custom OAuth | Better Auth `socialProviders` | Linking rules and the verified-email gate are subtle (see link-account source) |
| Session cookie parsing/signing | Reading the `session` table by hand | `auth.api.getSession({ headers, query: { disableRefresh: true } })` | Cookie names, signatures, and cache semantics can't drift |
| Cookie presence check in `proxy.ts` | Regex on the cookie header | `getSessionCookie` from `better-auth/cookies` | Handles `__Secure-` and legacy names |
| Image type detection | Extension/MIME checks | `file-type` + sharp decode | Magic bytes; polyglots; APNG |
| Image decode/encode | ImageMagick shell-outs | sharp with `limitInputPixels`, `failOn` | Bomb protection built in |
| Migration bookkeeping | Custom migration table | drizzle `migrate()` + journal | Hashes and ordering are already handled. Add only the lock. |
| Multipart parsing and size limits | Manual stream counting | multer `limits.fileSize` (via `FileInterceptor`) | Aborts before buffering more than the limit |
| SMTP handshake test | Raw socket scripting | nodemailer `verify()` | Handles STARTTLS/implicit TLS and AUTH |
| Test sessions for E2E | Forged cookies | Better Auth `testUtils()` plugin in a **test-only** auth instance (`ctx.test.createUser/saveUser/getCookies/login`) [CITED: better-auth docs plugins/test-utils] | Correctly signed cookies. Keep it out of the production config. |
| TLS/routing locally | nginx config | Caddy `reverse_proxy` with matchers | Two lines; WebSocket (Vite HMR) passthrough is built in |

**Key insight:** every hand-rolled piece here sits on a security boundary: sessions, uploads, redirects. The libraries already encode the edge cases. The only custom code Phase 1 needs is glue: the guard, the advisory lock, the path scheme, and `safeNext`.

## Common Pitfalls

### Pitfall 1: Nest body parsing vs Better Auth
**What goes wrong:** with Nest's parser on, Better Auth gets a consumed stream and `/api/auth/*` POSTs hang or 400. With the parser off and no re-add, other routes get `undefined` bodies.
**How to avoid:** `NestFactory.create(AppModule, { bodyParser: false })`, and let `AuthModule` re-add the parsers (its default). Set `bodyParser.json.limit` explicitly (for example `'100kb'`). Add a spike test: `POST /api/v1/echo` with JSON still parses, and `POST /api/auth/sign-in/social` works.
**Warning signs:** `req.body` undefined; Better Auth "Invalid body".

### Pitfall 2: Sliding session silently stops sliding (D-04 / AUTH-03)
**What goes wrong:** the session refresh condition is `expiresAt - expiresIn + updateAge <= now`. On refresh, Better Auth updates the DB row and calls `setSessionCookie` on **that response** [VERIFIED: better-auth@v1.7.7 session.ts:324-395]. The library guard and RSC `/api/v1/me` calls perform that refresh, but their `Set-Cookie` never reaches the browser. The DB expiry moves; the browser cookie (Max-Age = `expiresIn` from sign-in) does not. The user is logged out 14 days after sign-in regardless of activity.
**How to avoid:**
- Use your own guard with `query: { disableRefresh: true }`.
- Mount a `SessionKeepAlive` client component in the header that calls `authClient.getSession()` (GET `/api/auth/get-session`, browser-originated) on mount and on `visibilitychange` → visible.
- Use `expiresIn: 1_209_600` (14 d) and `updateAge: 86_400` (1 d).
- Keep `cookieCache` off (default) so sign-out and revocation take effect immediately.

**Warning signs:** the `session.expires_at` column moves but the browser's cookie expiry doesn't. Test this in an integration test by stubbing the clock.

### Pitfall 3: `baseURL` omitted, or wrong per environment
**What goes wrong:** cookie Secure/prefix is decided by `NODE_ENV` instead of the real scheme. OAuth callbacks are built from an inferred host. You get `redirect_uri_mismatch`, or cookies the browser silently drops on the http prod-smoke stack.
**How to avoid:** `PUBLIC_URL` is a required env var, validated by Zod in `env.ts`. Pass it as `baseURL`. Each environment registers exactly `${PUBLIC_URL}/api/auth/callback/{google|github}`.

### Pitfall 4: Staging and prod cross-talk on one Docker host
**What goes wrong:** both stacks attach `dokploy-network`. `postgres` and `api` resolve to either stack, and staging may write to the prod DB.
**How to avoid:** turn Isolated Deployments on for both compose apps. As a belt-and-braces measure, give each environment distinct `POSTGRES_PASSWORD`s, so a mis-resolution fails auth instead of succeeding. Verify with `docker network inspect` on the VPS.

### Pitfall 5: Prod deploys the wrong commit
**What goes wrong:** the Dokploy tag trigger deploys `main` HEAD, on any tag (Pattern 8).
**How to avoid:** use a `release` branch moved only by the `v*` tag workflow after CI passes.

### Pitfall 6: OAuth app/console setup gaps
**What goes wrong:**
- A GitHub OAuth App has a single callback URL, so dev, staging, and prod each need their own app (D-11).
- A Google consent screen in "Testing" only admits listed test users.
- A Google redirect URI must match exactly, including scheme.

**How to avoid:**
- Create 3 GitHub OAuth Apps and 1–3 Google OAuth clients.
- Add the user's accounts as Google test users for Phase 1. Publishing the consent screen is already tracked as a launch concern in STATE.md.
- Request no extra scopes. GitHub defaults to `read:user user:email` [VERIFIED: better-auth@v1.7.7 social-providers/github.ts:75-77].

### Pitfall 7: Upload edge cases
**What goes wrong:**
- APNG rejected as "not PNG".
- SVG accepted because the extension was renamed.
- A 2 MB JPEG that decodes to a 60 MP image OOM-kills the API.
- Multer's 413 surfaces as an opaque "Payload Too Large".
- `EACCES` on a fresh volume.

**How to avoid:**
- Allowlist `image/apng`.
- Detect type by content.
- Use `limitInputPixels: 40_000_000` (about 7300×5470, which covers 24 MP phone photos; 48 MP originals are rejected with "too many pixels", an accepted tradeoff).
- Add an exception filter for clear messages.
- `chown` before `USER node`, plus a boot probe.

**Test fixtures:** a valid png/jpg/webp/gif (animated) under 2 MB; a 2.1 MB file; an `.svg`; a `.png` that is actually HTML; a decompression-bomb PNG (tiny file, huge declared dimensions).

### Pitfall 8: Drizzle journal ordering
**What goes wrong:** the migrator applies only entries whose timestamp is newer than the **last applied** one. A migration generated on a branch, with an older timestamp, is silently skipped after a newer one has been deployed [VERIFIED: pg-core/dialect.js:56-69].
**How to avoid:** generate migrations on up-to-date `main` only, never hand-edit `meta/_journal.json` timestamps, and run `drizzle-kit check` in CI.

### Pitfall 9: Windows dev box
**What goes wrong:**
- vinext's production server 404s nested static assets on Windows (#2696, open).
- `bun run` + `nest start` fails with "bun: unknown error" (#44242, open).
- Local Bun is 1.4.0, not 1.4.2.
- Docker Desktop is installed but its engine is not running.
- The `Ubuntu-24.04` WSL distro is WSL **1**.

**How to avoid:**
- Run production builds only in Docker.
- API dev script: `node ./node_modules/@nestjs/cli/bin/nest.js start --watch`.
- `bun upgrade` to 1.4.2.
- Start Docker Desktop, which uses its own WSL2 distro.

[VERIFIED: local probes; gh issue states 2026-10-01]

### Pitfall 10: Building images on a small VPS
**What goes wrong:**
- D-13 builds images on the VPS, and Dokploy itself requires ≥2 GB RAM [CITED: dokploy docs installation].
- `vite build` + `nest build` + two `bun install`s running in parallel can OOM a small instance and freeze it.
- On x64 KVM hosts whose CPUID hides SSE4.2/AVX, Bun 1.4.2 spins at 100% CPU (#43683, open). That would hang `RUN bun install`.

**How to avoid:**
- Probe the VPS first: `uname -m; nproc; free -h; grep -c -E 'sse4_2|avx2' /proc/cpuinfo`.
- If it is Ampere A1 (arm64), the AVX bug doesn't apply, and sharp and bun ship arm64 builds.
- Add swap (2–4 GB).
- Measure peak build memory in the spike.
- If builds still OOM, the escape is to build in GitHub Actions and push to GHCR. That contradicts D-13, so it would need the user's approval (see Open Questions).

### Pitfall 11: Tailwind under vinext
**What goes wrong:** CSS silently missing. #1128 is open: some config styles are ignored, and a global CSS import from `app/layout.tsx` produced no CSS. #3240 (open): a string-form PostCSS plugin failed with ENOENT on the `vinext init` path.
**How to avoid:** use exactly the `create-vinext-app@1.0.0` shape. `postcss.config.mjs` exports `{ plugins: { "@tailwindcss/postcss": {} } }`, `globals.css` starts with `@import "tailwindcss";`, and `tailwindcss`, `@tailwindcss/postcss`, and `postcss` are **direct** devDependencies of `apps/web` (needed for isolated-linker resolution) [VERIFIED: vinext@1.0.0 packages/create-vinext-app/src/index.ts:118,225-231,424-428; apps/web/postcss.config.mjs]. Spike check: the production HTML includes a hashed CSS link with Tailwind utilities, in both vinext and `next build` output. Fallback: add `@tailwindcss/vite` to `vite.config.ts`.

### Pitfall 12: Env vars baked at build
**What goes wrong:** vinext inlines only `NEXT_PUBLIC_*`, `next.config` `env`, `NODE_ENV`, and internal flags as `define`s. Every other `process.env.X` stays a runtime read [VERIFIED: vinext src/index.ts:2677-2691].
**How to avoid:** use no `NEXT_PUBLIC_*` and no `next.config.env` in Phase 1. Same-origin removes the need for client-side URLs. Spike check: change `API_INTERNAL_URL` in Dokploy, restart without a rebuild, and confirm it takes effect.

### Pitfall 13: Better Auth in the vinext dev server
**What goes wrong:** #2813 (open) describes RSC dependency re-optimization hanging Better Auth routes under vinext dev on Cloudflare. Phase 1 only imports `better-auth/react` (client) and `better-auth/cookies` (proxy), so the risk is lower.
**How to avoid:** if dev hangs or returns 500, add `optimizeDeps.include: ['better-auth/react','better-auth/cookies']` in the dev config [ASSUMED: mitigation adapted from the issue].

## Code Examples

### Better Auth factory (API)
```ts
// apps/api/src/auth/auth.ts  — Sources: better-auth options docs (Context7), cookies/index.ts@v1.7.7
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as authSchema from "@usersaid/db/schema/auth";
import type { Db } from "@usersaid/db";
import type { Env } from "../env.js";

export function createAuth(db: Db, env: Env, extraPlugins: any[] = []) {
  return betterAuth({
    baseURL: env.PUBLIC_URL,          // https://… in staging/prod, http://localhost in dev → decides __Secure- prefix
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,   // ≥32 chars, high entropy
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
      github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 }, // D-04
    // D-01/D-03: rely on defaults — accountLinking.enabled (true), disableImplicitLinking (false),
    // updateUserInfoOnLink (false), overrideUserInfoOnSignIn (unset). Do NOT set trustedProviders/trustedOrigins.
    plugins: extraPlugins,            // tests pass [testUtils()]; prod passes []
  });
}
```

### Refresh-safe global guard
```ts
// apps/api/src/auth/session.guard.ts — getSessionQuerySchema verified at better-auth@v1.7.7 session.ts:281-296
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { fromNodeHeaders } from "better-auth/node";
import { IS_PUBLIC } from "./public.decorator.js";
import { AUTH, type Auth } from "./auth.provider.js";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(AUTH) private readonly auth: Auth) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableRefresh: true },          // refresh only via browser GET /api/auth/get-session
    });
    req.session = session;
    req.user = session?.user ?? null;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    if (!session) throw new UnauthorizedException();
    return true;
  }
}
// app.module.ts: AuthModule.forRoot({ auth, disableGlobalAuthGuard: true }) + { provide: APP_GUARD, useClass: SessionGuard }
// main.ts: NestFactory.create(AppModule, { bodyParser: false }); app.setGlobalPrefix("api/v1"); app.set("trust proxy", 1)
```

### Migration runner with advisory lock
```ts
// packages/db/src/migrate.ts — MigrationConfig verified at drizzle-orm@0.45.3 migrator.d.ts:5-9
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";

const LOCK_KEY = 727_001; // any constant bigint, unique to this app
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)), // must contain meta/_journal.json
  });
  console.log("migrations: up to date");
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  await client.end();
}
```
(`import.meta.url` is fine here: this is Node ESM in `packages/db`, not web app code. The lint rule only bans `import.meta.env` in `apps/web`.)

### Image pipeline
```ts
// apps/api/src/uploads/image-pipeline.ts — sharp options per sharp docs; file-type mimes per file-type@22.1.1 source
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
const ALLOWED = new Set(["image/png", "image/apng", "image/jpeg", "image/webp", "image/gif"]);
sharp.concurrency(1); sharp.cache(false);

export async function toWebp(buf: Buffer) {
  const ft = await fileTypeFromBuffer(buf);
  if (!ft || !ALLOWED.has(ft.mime)) throw new UnsupportedImageError(); // → 415 "Only PNG, JPEG, WebP or GIF images"
  const { data, info } = await sharp(buf, { limitInputPixels: 40_000_000, failOn: "warning", animated: false })
    .rotate()                                            // apply EXIF orientation before stripping
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, bytes: info.size };
}
```

### Safe `?next=`
```ts
// apps/web/lib/safe-next.ts
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  try {
    const u = new URL(raw, "http://internal.invalid");
    if (u.origin !== "http://internal.invalid" || u.pathname.startsWith("/api/")) return fallback;
    return u.pathname + u.search + u.hash;
  } catch { return fallback; }
}
```

### RSC cookie-forwarding client
```ts
// apps/web/lib/api-server.ts
import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
export async function apiServer(path: string, init?: RequestInit) {
  const cookie = (await headers()).get("cookie") ?? "";
  return fetch(new URL(path, process.env.API_INTERNAL_URL), { ...init, headers: { ...init?.headers, cookie }, cache: "no-store" });
}
export const getMe = cache(async () => {
  const r = await apiServer("/api/v1/me");
  return r.ok ? ((await r.json()) as { user: { id: string; name: string; image: string | null } | null }) : { user: null };
});
```

### Caddyfile (dev)
```
http://localhost {
  @api path /api/* /uploads/*
  reverse_proxy @api host.docker.internal:4000
  reverse_proxy host.docker.internal:3000
}
```
(compose.dev.yaml: `extra_hosts: ["host.docker.internal:host-gateway"]` keeps this portable to Linux CI.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` / `export function middleware` | `proxy.ts` / `export function proxy` (Node runtime) | Next.js 16 | Use `proxy.ts`. vinext supports it. |
| class-validator DTOs | Nest 12 `StandardSchemaValidationPipe` + `@Body({ schema })`, `StandardSchemaSerializerInterceptor` + `@SerializeOptions({ schema })` | Nest 12 (2026-08) | Zod schemas from `@usersaid/types` are used directly [CITED: docs.nestjs.com validation/serialization] |
| Nest CJS + Jest | ESM (`"type":"module"`, `nodenext`) + Vitest + `unplugin-swc` | Nest 12 `nest new` default | file-type and better-auth are ESM. Relative imports need `.js` extensions. |
| Postgres image `VOLUME /var/lib/postgresql/data` | `VOLUME /var/lib/postgresql`, `PGDATA=/var/lib/postgresql/18/docker` | postgres:18 | Mount the parent directory (D-12) |
| Dokploy push-only auto deploy | `triggerType` enum `push \| tag` | Dokploy 0.2x–0.30 | Tag mode deploys branch HEAD on any tag. Don't rely on it. |
| Bun hoisted workspaces | Isolated linker default for new workspaces, `foo...` filter relations, `bun prune` | Bun 1.3–1.4 | Use `...` in Docker filters |

**Deprecated/outdated:** STACK.md's `--filter api` / `--filter web` lines (replace with `'@usersaid/api...'`); ARCHITECTURE.md's "Vite `server.proxy` for local dev" (superseded by D-10 Caddy); STACK.md's suggestion of `trustedOrigins: [PUBLIC_URL]` (drop it, see Pattern 1).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Docker Compose reads `COMPOSE_PROFILES` from the `.env` Dokploy writes, so `mailpit` runs only on staging | Pattern 7 | Mailpit missing on staging, or running on prod. Fall back to a separate `compose.staging.yaml` override or an explicit service toggle. |
| A2 | `sharp.concurrency(1)` + `cache(false)` + a single queue keeps memory acceptable on the VPS | Pattern 4 | OOM under burst. Measure in the spike. |
| A3 | `limitInputPixels: 40_000_000` is acceptable UX (48 MP originals rejected) | Pitfall 7 | Some phone photos are rejected. Raise to 50M if memory allows. |
| A4 | Bun `--production --filter '@usersaid/api...'` yields a working runtime `node_modules` under the isolated linker (else `bun prune`) | Pattern 6 | API image crashes at boot. Spike check with both strategies. |
| A5 | vinext's standalone copier follows Bun `.bun` store symlinks and produces exactly one `react` | Pattern 6 | 500s with "Incompatible React versions". Fall back to `linker = "hoisted"`. |
| A6 | The Oracle VPS is Ampere A1 (arm64) with enough RAM for Dokploy plus on-host builds | Pitfall 10 | x64 SSE4.2/AVX Bun hang, or build OOM. Probe before any deploy work. |
| A7 | Vite HMR works through Caddy without `server.hmr.clientPort` (the client defaults to the page's port) | Pattern 7 | HMR doesn't reconnect. Set `hmr.clientPort: 80`. |
| A8 | `optimizeDeps.include` mitigates #2813-style dev hangs for client-only Better Auth imports | Pitfall 13 | Dev-only friction |
| A9 | `next build` will add Next's TS plugin and `next-env.d.ts` to `apps/web/tsconfig.json` on first run | Pattern 8 | A CI-dirty tree. Commit the generated changes once. |
| A10 | Mailpit inline `MP_UI_AUTH` exists (only `MP_UI_AUTH_FILE` was confirmed in the docs) | Pattern 7 | Use `MP_UI_AUTH_FILE` |

## Open Questions

1. **VPS shape (blocking for deploy plans).**
   - What we know: Oracle free tier; "limited RAM"; Dokploy needs ≥2 GB.
   - What's unclear: arm64 (A1) or x64 (E2.1.Micro), the RAM size, and CPU flags.
   - Recommendation: the first deploy task is a human-run probe (`uname -m; nproc; free -h; grep -c -E 'sse4_2|avx2' /proc/cpuinfo; df -h`). If RAM is under 4 GB, add swap before the first Dokploy build.
2. **Build location vs D-13.**
   - What we know: on-host builds can OOM small instances.
   - What's unclear: whether the actual VPS copes.
   - Recommendation: keep D-13. If the spike shows OOM, ask the user to approve CI-built images pushed to GHCR (a decision change, not a planner choice).
3. **Domains and DNS.**
   - What we know: staging and prod each need their own domain (D-11).
   - What's unclear: the actual hostnames.
   - Recommendation: a human checkpoint collects them, points DNS A records at the VPS, and registers OAuth callbacks.
4. **GitHub repo.**
   - What we know: there is no git remote yet (`git remote -v` is empty).
   - What's unclear: the org or user and the visibility.
   - Recommendation: a human checkpoint creates the repo, protects `main` and `release`, and installs the Dokploy GitHub App.
5. **Gating staging on CI.**
   - What we know: Dokploy's native push deploys regardless of CI status.
   - What's unclear: whether the user wants gating.
   - Recommendation: native push for Phase 1. Revisit if a red build reaches staging.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All scripts, local dev | ✓ | 24.19.0 (images use 24.21.0) | — |
| Bun | Installs, scripts | ✓ (wrong version) | 1.4.0 → needs 1.4.2 | `bun upgrade` |
| `npm` (real) | Registry queries only | ✓ but shell alias `npm=bun` | npm.cmd present | Call `npm.cmd` explicitly |
| Docker Desktop / Compose | Local prod smoke, compose dev infra | Installed, **engine not running** | 27.2.0 / v2.29.2 | Start Docker Desktop (blocking for smoke tests) |
| WSL | Docker backend | `docker-desktop` (v2) ✓; `Ubuntu-24.04` is **WSL1** | — | Use Docker Desktop's distro; upgrade Ubuntu to WSL2 only if needed |
| git / gh CLI | CI, release branch | ✓ | 2.47.1 / 2.94.0 | — |
| GitHub remote repo | Actions, Dokploy provider | ✗ (no remote) | — | Human checkpoint: create the repo |
| Oracle VPS + Dokploy | Staging/prod, SMTP probe | Unknown from here | — | Human checkpoint: probe and install |
| Google/GitHub OAuth apps | AUTH-01/02 | ✗ (to be created per env) | — | Human checkpoint |
| Brevo account + SMTP key | SMTP probe | Unknown | — | Human checkpoint |

**Missing dependencies with no fallback:** the GitHub repo, OAuth apps, VPS access and domains, the Brevo SMTP key. All are human-provided and should be grouped into one early `checkpoint:human-action`.
**Missing dependencies with fallback:** the Bun version (upgrade) and the Docker engine (start it).

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth OAuth (Google/GitHub). No passwords. Implicit linking only with provider-verified **and** locally verified email (defaults). |
| V3 Session Management | yes | DB sessions; HttpOnly, SameSite=Lax, Secure + `__Secure-` prefix on https; 14 d sliding; sign-out deletes the row; `cookieCache` off |
| V4 Access Control | yes | Global default-deny `SessionGuard`, with explicit `@Public()` only on `/health` and `/me` (`/me` returns `{user:null}` when anonymous). The dev upload page needs a session. Uploads are served publicly by unguessable key (by design). |
| V5 Input Validation | yes | Zod (Standard Schema pipe) for JSON; multer limits + file-type + sharp for files; `safeNext` + Better Auth `callbackURL` validation for redirects |
| V6 Cryptography | yes (config only) | `BETTER_AUTH_SECRET` ≥32 random chars per environment, from Dokploy env. No hand-rolled crypto. |
| V12 Files & Resources | yes | Server-generated UUID paths, atomic writes, `dotfiles:'deny'`, `nosniff`, `CSP default-src 'none'` on `/uploads`, no originals stored |
| V14 Configuration | yes | `.env*` excluded from images; secrets only in Dokploy env; Mailpit UI not publicly routed (or behind `MP_UI_AUTH_FILE`); the SMTP probe is CLI-only; helmet on the API |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `?next=` / `callbackURL` | Spoofing | `safeNext` (relative, not `//`, same origin) + Better Auth `callbackURL` trust check |
| Account takeover through implicit linking on an unverified email | Elevation | Keep defaults; never add `trustedProviders`; GitHub verified flag from `/user/emails` |
| Login CSRF / cross-site POST to `/api/v1/*` | Tampering | SameSite=Lax cookie; Better Auth origin check on auth routes; add a small `OriginGuard` that rejects non-GET `/api/v1` requests whose `Origin` ≠ `PUBLIC_URL` |
| Decompression bomb / polyglot / SVG XSS | DoS / Tampering | `limitInputPixels`, `failOn:'warning'`, magic-byte allowlist, re-encode only, `nosniff` |
| Path traversal in uploads | Tampering | Never use `originalname`; UUID keys; `path.resolve` prefix assertion |
| Cross-environment DB access on a shared host | Info disclosure | Dokploy Isolated Deployments; distinct DB credentials |
| Host-header / `X-Forwarded-*` spoofing | Spoofing | Static `baseURL`; `VINEXT_TRUST_PROXY=1` only behind Traefik; Express `trust proxy` = 1 hop |
| Secrets baked into images | Info disclosure | `.dockerignore .env*`; no `NEXT_PUBLIC_*` secrets; build args carry no secrets |

## Sources

### Primary (HIGH confidence, read at tagged versions this session)
- better-auth@v1.7.7 source: `packages/better-auth/src/cookies/index.ts` (cookie naming, `getSessionCookie`), `api/routes/session.ts` (refresh logic, `getSessionQuerySchema`), `oauth2/link-account.ts` (implicit linking gate), `packages/core/src/social-providers/github.ts` (scopes, `emailVerified`)
- ThallesP/nestjs-better-auth@v2.8.0: `README.md`, `src/auth-module.ts`, `src/auth-guard.ts`, `src/middlewares.ts`, `src/auth-module-definition.ts`
- cloudflare/vinext@1.0.0: `packages/create-vinext-app/src/index.ts`, `apps/web/postcss.config.mjs` + `vite.config.ts` + `package.json`, `docs/deploying/other-platforms.mdx`, `packages/vinext/src/index.ts` (dotenv + defines), `src/server/proxy-trust.ts`, `.agents/skills/migrate-to-vinext/references/compatibility.md`; issue states for #1128, #2696, #2813, #3240, #3443, #3444, #3446, #3483, #3604, #3624; PR #3239 (unmerged)
- drizzle-orm@0.45.3 npm tarball: `migrator.d.ts`, `migrator.js`, `node-postgres/migrator.js`, `pg-core/dialect.js`
- file-type@22.1.1 npm tarball: `source/index.d.ts`, `source/detectors/png.js`, `source/index.js`
- oven-sh/bun@bun-v1.4.2 `docs/pm/filter.mdx`; `dockerhub/debian-slim/Dockerfile`; issues #43683, #44120, #44242, #29944; release dates
- Dokploy/dokploy (main, v0.30.8): `packages/server/src/db/schema/shared.ts` (`triggerType`), `apps/dokploy/pages/api/deploy/github.ts`, `packages/server/src/utils/providers/github.ts`, `packages/server/src/utils/docker/domain.ts`
- docker-library/postgres `18/bookworm/Dockerfile`
- npm registry (versions, peers, engines, scripts), nodejs.org dist index, GitHub releases (setup-bun, checkout, setup-node, caddy, mailpit)

### Secondary (MEDIUM confidence)
- Context7 `/better-auth/better-auth` (session options, accountLinking options, provider notes, testUtils plugin, env vars, drizzle adapter, CLI)
- Context7 `/nestjs/docs.nestjs.com` (Standard Schema validation/serialization, ESM migration, file upload, SWC + Vitest)
- Context7 `/lovell/sharp` (constructor options, resize, webp, metadata stripping)
- Context7 `/oven-sh/bun` (filter, prune, catalogs, isolated layout), `/dokploy/website` (auto-deploy, compose domains, isolated deployments, API), `/websites/oxc_rs_guide_usage` (no-restricted-imports, overrides, jsPlugins), `/vercel/next.js` (proxy.ts)
- developers.brevo.com Node SMTP example (host and port); caddyserver.com automatic-https; mailpit runtime options

### Tertiary (LOW confidence)
- Web search aggregate pages on Brevo port semantics (587/2525 STARTTLS, 465 TLS), used only as corroboration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions, peers, and engines were checked against the registry today. The stack is locked by the user.
- Architecture: MEDIUM-HIGH. Every critical integration fact was read in primary source, but the combination is unproven until the spike.
- Pitfalls: HIGH for the source-derived ones (2, 4, 5, 6, 7, 8, 11, 12), MEDIUM for the environment-dependent ones (9, 10, 13).

**Research date:** 2026-10-01
**Valid until:** 2026-10-15. vinext 1.0.x, Bun 1.4.x, and Dokploy 0.30.x all move weekly. Re-check issue states (#3443, #3483, #43683, #44242) before execution.
