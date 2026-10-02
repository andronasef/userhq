# Phase 2: Workspaces, Products & Platform Owner - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The platform owner admits companies through single-use invite links. Invited admins set up a workspace (name, slug, logo), a team (email-bound teammate invite links), products (each with a branded public portal shell at `/{workspace}/{product}`), and per-product statuses. The owner can browse every tenant and suspend workspaces or ban users.

Requirements: PLAT-01–07, WORK-01–06, PROD-01–05, STAT-01–05. Feedback, roadmap, changelog, and FAQ content arrive in Phases 3–5; Phase 2 only builds the portal shell they plug into.

</domain>

<decisions>
## Implementation Decisions

### Admin area & URLs
- **D-01:** The admin dashboard is a separate tree: `/dashboard/{ws}/...` holds workspace pages (Settings, Team, Products), and `/dashboard/{ws}/{product}/...` holds product pages (Statuses now; Board, Roadmap, Changelog, and FAQ in later phases). Public portal routes (`/{ws}`, `/{ws}/{product}`) contain no admin UI. — **Reversibility:** costly — every later phase adds pages under this tree, and moving it means rewriting routes and links.
- **D-02:** Landing after sign-in when there is no `?next=`: a user with 0 workspaces stays on home (with a "Create workspace" CTA if they hold a valid platform invite or are the owner, otherwise an invite-only note); a user with 1 workspace goes to `/dashboard/{ws}`; a user with 2+ goes to a `/dashboard` picker list.
- **D-03:** The workspace switcher is a dropdown in the dashboard header, showing the current workspace's logo and name. It reuses the existing Radix DropdownMenu, lists the user's workspaces, and offers "Create workspace" when allowed.
- **D-04:** Dashboard navigation is a left sidebar with a workspace section and a per-product section, so it scales through Phase 5.
- **D-05:** The platform owner console lives at `/platform` (invites, workspaces, users) and is linked only from the owner's user menu. Add `platform` to the reserved slugs. Non-owners get the app's normal 404, from both the page and its API (PLAT-07).
- **D-06:** The platform owner is also a normal user: they sign in the same way, can create workspaces without an invite, and can post and vote on portals. Console access is an extra capability derived from the config email.

### Portal shell & branding
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

### Invite links (platform + teammate)
- **D-13:** One route, `/invite/{token}`, serves both kinds from one invites table with a `kind` (`platform` | `workspace`). Accepting a platform invite leads to the "Create your workspace" form; accepting a workspace invite joins the user as admin and lands on `/dashboard/{ws}`.
- **D-14:** Every invite is bound to **one specific email**, is single-use, and **expires after 7 days**. The token is cryptographically random and stored only as a hash; the raw token appears only in the link. **No email is sent**: the inviter copies the link and shares it themselves (v1 email is reserved for comment notifications). — **Reversibility:** costly — a hashed token can't be recovered, so a later "show the link again" means regenerating it.
- **D-15:** A signed-out visitor opening an invite link goes **straight to `/login?next=/invite/{token}`** with no preview page. The invite is accepted on return.
- **D-16:** **Strict email match** (WORK-04): the user's verified OAuth email must equal the invite email (case-insensitive). On mismatch, show a plain page ("This invite is for another email address", with the email masked) and an option to sign out and use another account. The invite stays unused. Expired, used, and revoked links each get a clear message telling the user to ask for a new link.
- **D-17:** The invite list shows each invite's state (pending, used and by whom, expired, revoked), with revoke for unused invites (PLAT-03, and the same for teammate invites).

### Defaults for areas not discussed (user accepted)
- **D-18:** Product delete is a soft delete. The slug stays reserved within the workspace and is never reused, and there is no restore UI in v1. The admin confirms by typing the product name. The deleted portal and its `/{ws}` card disappear.
- **D-19:** A ban revokes all of the user's sessions immediately and blocks new sign-ins (checked in the shared guard and at sign-in). The user's content stays.
- **D-20:** A suspended workspace shows its admins an "unavailable" notice in place of the dashboard, and its portals show the public "unavailable" page. No suspension reason is shown in v1.
- **D-21:** The status editor reorders with drag handles. Colors come from a preset palette plus a free hex input.

### Claude's Discretion
- How reorder is implemented: @dnd-kit/react (already chosen for the Phase 4 Kanban), or a lighter approach if that's simpler.
- The preset palette values, the contrast algorithm for accent text, and the slug format rules (length, charset).
- How the "coming soon" body looks, and the copy for invite error pages.
- How the `/dashboard` picker and the empty home state look.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` § Phase 2: goal, success criteria, notes (cross-tenant 404 suite, public/admin controller split, contract-test scaffold, `portalHref()` tenant resolver seam, status reassignment transaction)
- `.planning/REQUIREMENTS.md`: PLAT-01–07, WORK-01–06, PROD-01–05, STAT-01–05; Out of Scope table (email policy)
- `.planning/PROJECT.md`: tenancy model, personas, key decisions (platform owner by config email, invite-only creation, link-based invites)

### Prior phase
- `.planning/phases/01-walking-skeleton/01-CONTEXT.md`: D-01 email auto-linking, D-02 `/login?next=`, D-05–D-08 upload rules, D-16/17 shell and light mode

### Research
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`: tenant isolation and public DTO allowlist patterns
- `.claude/CLAUDE.md`: stack constraints (explicit `select()` column maps for public responses, no `columns: {x:false}`, Zod public schemas)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/auth/guards.ts`: `SessionGuard` and `OriginGuard`. Ban and suspension checks, and workspace-membership and owner guards, extend this layer.
- `apps/api/src/auth/decorators.ts`: `@Public()` and `@CurrentUser()`.
- `apps/api/src/uploads/*`: upload pipeline (2 MB, WebP, `uploads` table). Logos reference upload rows.
- `apps/web/components/ui/{button,avatar,dropdown-menu,alert}.tsx`, `header.tsx`, `user-menu.tsx`: the shell to extend (switcher, `/platform` link).
- `apps/web/lib/safe-next.ts`: same-origin `next` validation for the invite → login round trip.
- `apps/web/lib/api-server.ts`: RSC cookie-forwarding fetch (`getMe`).
- `apps/web/proxy.ts`: optimistic redirect for `/dashboard`, `/platform`, and `/invite`.

### Established Patterns
- Drizzle schema in `packages/db/src/schema/*.ts`, with committed SQL in `packages/db/migrations/`.
- `ApiException` and the error filter (`apps/api/src/common/api-error.filter.ts`) for typed error codes.
- Vitest unit tests plus an e2e config in `apps/api/test/`.

### Integration Points
- New tables: workspaces, members (with a role enum), products, statuses, invites. Status seeding runs in the product-creation transaction.
- The reserved-slug list is shared between the API validation and the web route tree (`api`, `dashboard`, `login`, `uploads`, `platform`, `invite`, `dev`).

</code_context>

<specifics>
## Specific Ideas

- The user wanted "full branding as it could be useful", which was scoped to the D-08 set and not to theme editors.
- The user explicitly simplified invites to "a link for a specific email" to avoid mismatch complexity.

</specifics>

<deferred>
## Deferred Ideas

- **Inviter/owner approval of an email-mismatched invite claim.** This covers approval requests, locking the invite to the requester, and pending badges on the invite list. The user wants it eventually, but not now.
- Restoring a deleted product, and showing a suspension reason. Revisit if admins ask.
- Custom domains, custom CSS, and a dark theme for portals.

</deferred>

---

*Phase: 02-workspaces-products-platform-owner*
*Context gathered: 2026-10-02*
