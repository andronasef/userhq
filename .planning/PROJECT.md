# UserHQ

## What This Is

UserHQ is a centralized customer feedback and product management platform. It gives B2B SaaS companies, agencies, and creators a clean, branded portal where their customers can submit and upvote ideas, watch a public roadmap, read release notes, and self-serve answers from an FAQ — while the product team plans privately behind the same data.

The core philosophy is to bridge the gap between what users want and what the product team actually builds, without the noise of traditional support tickets.

## Core Value

An admin can see what their users actually want, ranked by demand, and close the loop publicly — feedback in, roadmap out, changelog shipped.

## Business Context

- **Customer**: B2B SaaS companies, agencies, and creators — the Admin persona is a product manager or workspace owner who pays; their end-users use it for free.
- **Revenue model**: Not defined for MVP. No billing, plans, or metering in v1 — the workspace model leaves room for it.
- **Success metric**: Admin retention measured as roadmap-item moves + changelog entries published per workspace per month. That is the signal the platform delivers real product-management value rather than being a write-only suggestion box.
- **Strategy notes**: None yet.

## Personas

**The Platform Owner (operator of UserHQ itself)** — runs the platform. Decides who may create a workspace (invite-only at launch), can see every workspace, product, and user, and can suspend workspaces or ban users when something goes wrong. Identified by email in server configuration, never by an in-app setting.

**The Admin (Workspace Owner / Product Manager)** — wants to gather user feedback, filter out noise, plan the development cycle privately, and showcase product progress publicly.

**The End-User (Customer)** — wants to suggest ideas, vote on existing suggestions, see what the company is building, and find quick answers to common issues without waiting for support.

## Tenancy Model

Three levels, settled during questioning:

```
User (global platform account, OAuth)
  └─ Workspace — the company: name, slug, logo, team members
       └─ Product — a full portal of its own
            ├─ Feedback board
            ├─ Roadmap (internal + public layers)
            ├─ Changelog
            ├─ FAQ
            └─ Statuses (seeded defaults, admin-editable)
```

- A **user account is global**: one Google/GitHub sign-in participates in any company's portal on the platform. No per-workspace or per-product re-registration.
- **Creating a workspace is invite-only at launch.** The platform owner issues a single-use, expiring invite link tied to one email; only its holder can create a workspace. End-users are not gated: anyone can sign in to post, vote, and comment on any portal.
- Above all workspaces sits the **platform owner**, with a separate dashboard to manage platform invites, browse all tenants, and suspend workspaces or ban users.
- A **workspace** holds the company identity and team. It owns no feedback content directly.
- A **product** is the unit that end-users actually visit. One company with three apps runs three independent portals under one workspace and one team.
- **Every product portal is publicly readable in v1.** Anyone can browse feedback, the public roadmap, the changelog, and the FAQ. Signing in is required only to post, vote, or comment. There is no private/login-required portal in v1 (see Out of Scope).
- **Routing is path-based and product-rooted**: `/{workspace}/{product}` is the portal home, `/{workspace}` lists that company's products. Path-based only — chosen for development simplicity, with the tenant resolver kept behind one abstraction so subdomains and custom domains can be added later without rewriting routing.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Platform Owner**

- [ ] Platform owner (identified by email in server config) has a dashboard to issue and revoke workspace-creation invites
- [ ] Platform owner can browse all workspaces, products, and users
- [ ] Platform owner can suspend a workspace or ban a user, and reverse either

**Workspace, Product & Auth**

- [ ] User can sign in with Google or GitHub (OAuth only in v1)
- [ ] User holding a platform invite can create a workspace with a name, slug, and uploaded logo
- [ ] Admin can create multiple products inside one workspace, each with its own name, slug, and logo
- [ ] Admin can invite teammates to a workspace via a shareable invite link, accepted by signing in with a matching verified email (no email is sent)
- [ ] Portal resolves by path at `/{workspace}/{product}`

**Feedback Board**

- [ ] End-user can submit a post with title, description, and category
- [ ] End-user can upvote a post, limited to one vote per user per post
- [ ] End-user and admin can comment on a post; admin comments carry a visible Admin badge
- [ ] End-user can filter posts by category and sort by Top Voted or Newest
- [ ] Post displays its current public status

**Dual-Layer Roadmap**

- [ ] Admin can create roadmap items on a Kanban board and move them between statuses
- [ ] Admin can link a roadmap item to one or more feedback posts, which updates those posts' status
- [ ] Admin can record internal-only data on an item: assignee, internal notes, target deadline
- [ ] Admin can toggle any item's Make Public switch
- [ ] Public roadmap shows only public items, and only their public title, public description, and status
- [ ] Public roadmap leaks no internal notes, deadlines, or assignees

**Statuses**

- [ ] Each product is seeded with default statuses on creation
- [ ] Admin can rename, reorder, add, and delete a product's statuses
- [ ] Statuses are shared by feedback posts and roadmap items, so linking syncs status

**Changelog**

- [ ] Admin can write a changelog entry with formatted rich text
- [ ] Admin can upload images into an entry, optimized to WebP automatically
- [ ] Admin can tag an entry (e.g. New Feature, Improvement) and publish it
- [ ] End-user sees a reverse-chronological feed of published entries

**FAQ**

- [ ] Admin can create Q&A pairs grouped into categories
- [ ] End-user can browse FAQ categories
- [ ] End-user can search FAQ questions

**Email Notifications**

- [ ] User receives an email when someone else comments on a post they created or commented on, and can turn these emails off

Research surfaced further table-stakes features (own-vote removal, post editing, admin moderation, duplicate merge, post status timeline, "My activity", changelog drafts). These are scoped in REQUIREMENTS.md, not here.

### Out of Scope

- **AI chat assistant and automated duplicate detection** — explicitly deferred in the PRD; the MVP must prove the manual loop works first.
- **Email beyond comment notifications** — Amended from the PRD by user decision: v1 sends exactly one email type (someone commented on your post) because email is reserved for important notifications. Sign-in, invite, status-change, and digest emails are out; the in-app bell and "My activity" cover status changes. Teammate invites remain link-based.
- **Self-hosted mail server** — Oracle Cloud blocks outbound port 25 for tenancies created after June 2021 (platform-level, not overridable by egress rules), and mail from cloud IPs has poor deliverability. Email is relayed through Brevo over SMTP instead.
- **Third-party integrations (Jira, Slack, GitHub issues)** — deferred; none are needed to validate the core loop.
- **External cloud storage (S3 and similar)** — local server storage on a Docker volume is sufficient at MVP scale and keeps hosting costs flat.
- **Email+password and magic-link sign-in** — OAuth-only in v1. Better Auth supports both natively, so adding them is a configuration change, not a rewrite.
- **Private / login-required product portals** — dropped from v1 by user decision. With global OAuth accounts, "login-required" would not actually be private (anyone with a Google account could get in), and a real email/domain allowlist was judged not worth the v1 cost. All portals are publicly readable. A proper allowlist is a v2 candidate.
- **Subdomain and custom-domain portals** — path-based routing only for v1, for development simplicity. The tenant resolver is abstracted so this is additive later.
- **Role permission matrix** — the membership model carries a role enum, but v1 issues exactly one role (admin) to every invited member. Owner/admin/viewer splits come later without a migration.
- **Billing, plans, and usage metering** — no revenue model defined for MVP.

## Context

- Greenfield project. Empty directory, fresh git repo, no existing code to integrate with.
- The PRD arrived unusually complete: scope, stack, personas, user flows, and explicit exclusions were all specified up front. Questioning filled gaps the PRD left open rather than discovering the product.
- The PRD's stack has been amended by user decision after research. Final stack: Next.js app built with vinext, Tailwind CSS, Radix UI, NestJS, PostgreSQL via **Drizzle ORM** (drizzle-kit migrations), **Better Auth**, local file storage with WebP optimization, Docker + Dokploy with volumes, **Bun as package manager** with Node 24 LTS as the runtime. Prisma, NextAuth.js, and pnpm from the original PRD are replaced.
- **The web app is built with [vinext](https://github.com/cloudflare/vinext), not Next.js's own compiler.** vinext is a Cloudflare Vite plugin that reimplements the Next.js API surface on top of Vite. The app is still written as a Next.js app — App Router, React Server Components, route handlers, middleware, `next/link`, `next/image`, `next/navigation`, Metadata API all remain available. vinext reached 1.0.0 on 2026-09-28. This pins the project to Next.js 16.x and Vite 8+, and rules out Turbopack/webpack config.
- vinext still carries adoption risk on the self-hosted Node path this project uses. Open issues at research time (2026-10-01) that hit this stack: the `radix-ui` barrel package hangs the build (use individual `@radix-ui/react-*` packages); standalone output can copy the wrong React version in a monorepo; standalone `server.js` does not default `NODE_ENV`; the Nitro preset returns 500 on every route once the server bundle splits. vinext also lists `sharp` (native modules) as a gap in App Router.
- **Fallback to `next build` must stay cheap.** App code imports only `next/*`, `react`, and npm packages — no `import.meta.env`, `vinext/*`, `cloudflare:workers`, or Vite `?raw`/`?url` imports. A lint rule enforces this. Estimated fallback cost if vinext blocks: about half a day to a day.
- **Auth lives in the NestJS API.** Better Auth runs inside NestJS and owns OAuth, sessions, and all database access. The web app never imports the database package and holds no database credentials; it forwards the session cookie to the API (server components call the API over the internal network). Dokploy/Traefik serves one domain: `/api/*` and `/uploads/*` go to NestJS, everything else to the web app, so cookies need no CORS configuration. This also keeps OAuth redirects off vinext, where Better Auth's OAuth flow is untested.
- **All image processing happens in the NestJS API, never in the web app.** The web app uploads to the API; the API validates, converts to WebP with `sharp`, writes to the Docker volume, and serves files at `/uploads/*`. This sidesteps vinext's `sharp` gap and keeps uploads in one hardened place.
- Admin-editable statuses mean status cannot be a Postgres enum or hardcoded union — statuses are per-product rows. Research found each status also needs a fixed underlying type (e.g. reviewing / planned / active / completed / canceled) so the system knows which renamed status means "shipped" or "closed". Every status reference is a foreign key, and deleting a status requires reassigning its posts and items.
- The dual-layer roadmap is the main privacy-correctness risk in the product. Internal fields live in a separate 1:1 table, and public endpoints read through explicit column allowlists (Drizzle core `select()` with named columns) mapped to hand-written public types. Never use exclude-a-column patterns or schema-derived DTOs on public paths: they leak any internal column added later. A contract test asserts the exact key set of every public response.

## Constraints

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three-level tenancy: User → Workspace → Product | One company commonly ships several apps; each needs its own portal, but they share a team and company identity | — Pending |
| Global platform user accounts | A single OAuth sign-in participates in any company's portal; avoids re-registration friction per product | — Pending |
| Path-based, product-rooted routing (`/{workspace}/{product}`) | No wildcard DNS or TLS work during development; resolver abstracted so subdomains are additive later | — Pending |
| OAuth-only auth for both admins and end-users | No password or email infrastructure in v1; Better Auth adds credentials and magic link later by configuration | — Pending |
| Role enum present, single role issued in v1 | Invited members are all admins now; owner/admin/viewer splits need no schema migration later | — Pending |
| Link-based teammate invites, matched to verified OAuth email | Email sending is out of scope; an invite link plus email match on sign-in needs no mail provider | — Pending |
| Statuses as per-product editable rows with a fixed underlying type, shared by posts and roadmap items | Admin-definable Kanban columns are required; a shared set makes post↔item status sync automatic; the fixed type lets filters and loop-closing know what "shipped" means after renames | — Pending |
| All portals publicly readable; private toggle dropped from v1 | "Login-required" with global OAuth accounts is not real privacy; an allowlist was not worth v1 cost | — Pending |
| Bun-workspace monorepo, two Docker images | Shared schema and types without package publishing; independent deploys | — Pending |
| Build the web app with vinext instead of Next.js's own toolchain | User decision. Vite-based dev/build while keeping the Next.js API surface; accepted trade-off is open self-hosting bugs and ~94% API coverage; `next build` fallback kept cheap by lint rule | ⚠️ Revisit if a blocking compatibility gap appears |
| Deploy vinext via native standalone output on Node in Docker | PRD mandates Docker + Dokploy with local volume storage, which Workers cannot provide; Nitro preset has a blocking 500 bug | — Pending |
| Better Auth instead of NextAuth.js | vinext's own checker marks next-auth unsupported and Better Auth supported; NextAuth v5 is still beta and in security-only maintenance | — Pending |
| Auth hosted in NestJS, web forwards cookies | API owns sessions and DB; web image has no DB credentials; OAuth redirects avoid vinext's untested path | — Pending |
| Drizzle ORM + drizzle-kit instead of Prisma | User decision. Explicit column lists in core `select()` also make public-response allowlists natural | — Pending |
| Bun as package manager only, Node 24 LTS runtime | User decision. Bun runtime has open bugs hitting NestJS decorator metadata and cheap-VPS CPUs; vinext does not test on Bun | — Pending |
| Invite-only workspace creation, issued by the platform owner as copy-able links | User decision: controlled onboarding at launch; links keep email reserved for notifications. Open self-serve sign-up is a v2 candidate | — Pending |
| Platform owner identified by email in server configuration | No in-app path can grant the highest-privilege role, so it cannot be escalated through a bug or a compromised admin account | — Pending |
| Email for comment notifications only, via Brevo SMTP | User decision: email reserved for important notifications; Oracle free VPS blocks port 25 so self-hosting a mail server is not viable; plain SMTP keeps the provider swappable | — Pending |
| All image processing (WebP via sharp) in NestJS API | sharp is a listed vinext gap; centralizing uploads in the API is also the cleaner decoupled design | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-01 after requirements scoping (comment emails, platform owner, invite-only workspaces)*
