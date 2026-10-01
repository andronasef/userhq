# UserSaid

## What This Is

UserSaid is a centralized customer feedback and product management platform. It gives B2B SaaS companies, agencies, and creators a clean, branded portal where their customers can submit and upvote ideas, watch a public roadmap, read release notes, and self-serve answers from an FAQ — while the product team plans privately behind the same data.

The core philosophy is to bridge the gap between what users want and what the product team actually builds, without the noise of traditional support tickets.

## Core Value

An admin can see what their users actually want, ranked by demand, and close the loop publicly — feedback in, roadmap out, changelog shipped.

## Business Context

- **Customer**: B2B SaaS companies, agencies, and creators — the Admin persona is a product manager or workspace owner who pays; their end-users use it for free.
- **Revenue model**: Not defined for MVP. No billing, plans, or metering in v1 — the workspace model leaves room for it.
- **Success metric**: Admin retention measured as roadmap-item moves + changelog entries published per workspace per month. That is the signal the platform delivers real product-management value rather than being a write-only suggestion box.
- **Strategy notes**: None yet.

## Personas

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
            ├─ Statuses (seeded defaults, admin-editable)
            └─ Public/private toggle
```

- A **user account is global**: one Google/GitHub sign-in participates in any company's portal on the platform. No per-workspace or per-product re-registration.
- A **workspace** holds the company identity and team. It owns no feedback content directly.
- A **product** is the unit that end-users actually visit. One company with three apps runs three independent portals under one workspace and one team.
- **Routing is path-based and product-rooted**: `/{workspace}/{product}` is the portal home, `/{workspace}` lists that company's products. Path-based only — chosen for development simplicity, with the tenant resolver kept behind one abstraction so subdomains and custom domains can be added later without rewriting routing.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Workspace, Product & Auth**

- [ ] User can sign in with Google or GitHub (OAuth only in v1)
- [ ] User can create a workspace with a name, slug, and uploaded logo
- [ ] Admin can create multiple products inside one workspace, each with its own name, slug, and logo
- [ ] Admin can invite teammates to a workspace by email
- [ ] Admin can toggle a product's portal between public-read and login-required
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

### Out of Scope

- **AI chat assistant and automated duplicate detection** — explicitly deferred in the PRD; the MVP must prove the manual loop works first.
- **Email notifications of any kind** — MVP relies purely on in-app status; avoids taking an email-provider dependency (Resend is also out of scope).
- **Third-party integrations (Jira, Slack, GitHub issues)** — deferred; none are needed to validate the core loop.
- **External cloud storage (S3 and similar)** — local server storage on a Docker volume is sufficient at MVP scale and keeps hosting costs flat.
- **Email+password and magic-link sign-in** — OAuth-only in v1. The auth schema must leave room for both; adding them is a v2 provider addition, not a rewrite.
- **Subdomain and custom-domain portals** — path-based routing only for v1, for development simplicity. The tenant resolver is abstracted so this is additive later.
- **Role permission matrix** — the membership model carries a role enum, but v1 issues exactly one role (admin) to every invited member. Owner/admin/viewer splits come later without a migration.
- **Billing, plans, and usage metering** — no revenue model defined for MVP.

## Context

- Greenfield project. Empty directory, fresh git repo, no existing code to integrate with.
- The PRD arrived unusually complete: scope, stack, personas, user flows, and explicit exclusions were all specified up front. Questioning filled gaps the PRD left open rather than discovering the product.
- The stack is pre-decided by the PRD and is not an open question for planning: Next.js, Tailwind CSS, Radix UI, NestJS, PostgreSQL via Prisma, NextAuth.js, local file storage with WebP optimization, Docker + Dokploy with volumes for persistence.
- Admin-editable statuses mean status cannot be a Postgres enum or hardcoded union — statuses are per-product rows. Every status reference is a foreign key, and deleting a status needs a defined fallback for posts and items sitting in it.
- The dual-layer roadmap is the main privacy-correctness risk in the product. Internal fields must never be serialized into a public response. This wants enforcement at the query/DTO boundary, not a conditional in the UI.

## Constraints

- **Tech stack**: Next.js + Tailwind + Radix UI (web), NestJS (API), PostgreSQL + Prisma, NextAuth.js — Specified in the PRD as locked for v1; decoupled frontend/backend is a deliberate scalability choice.
- **Repo shape**: pnpm monorepo, two Docker images — `apps/web`, `apps/api`, `packages/db` (Prisma schema + client), `packages/types` (shared DTOs). Shared schema and types without publishing packages; independent deploys as two Dokploy apps.
- **File storage**: Local server storage on a Docker volume, images converted to WebP — Cost-efficiency for V1; no cloud storage dependency.
- **Infrastructure**: Docker + Dokploy, Docker volumes for persistence — Self-hosted deployment target; uploads and Postgres data must survive container replacement.
- **Auth**: OAuth providers only (Google, GitHub) — No password storage or email sending in v1, which is consistent with email notifications being out of scope.
- **Privacy**: Internal roadmap fields must be unreachable from any public endpoint — Core trust guarantee of the dual-layer roadmap; a leak here is the product's worst failure mode.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Three-level tenancy: User → Workspace → Product | One company commonly ships several apps; each needs its own portal, but they share a team and company identity | — Pending |
| Global platform user accounts | A single OAuth sign-in participates in any company's portal; avoids re-registration friction per product | — Pending |
| Path-based, product-rooted routing (`/{workspace}/{product}`) | No wildcard DNS or TLS work during development; resolver abstracted so subdomains are additive later | — Pending |
| OAuth-only auth for both admins and end-users | One NextAuth config, one User table, no password or email infrastructure; credentials and magic link planned for v2 | — Pending |
| Role enum present, single role issued in v1 | Invited members are all admins now; owner/admin/viewer splits need no schema migration later | — Pending |
| Statuses as per-product editable rows, shared by posts and roadmap items | Admin-definable Kanban columns are required, and a shared set makes post↔item status sync fall out for free instead of needing a mapping table | — Pending |
| Public/private portal toggle scoped to the product | A company may run one public portal and one private beta portal under the same workspace | — Pending |
| pnpm monorepo, two Docker images | Shared Prisma schema and TS types across web and api without package publishing; still independent deploys | — Pending |

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
*Last updated: 2026-10-01 after initialization*
