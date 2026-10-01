# Phase 1: Walking Skeleton - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the unproven stack end to end in Docker, on two environments (staging and prod) on the Oracle VPS:
- Google and GitHub sign-in through Better Auth inside NestJS, with a session that survives refreshes and can be ended from any page
- Image uploads re-encoded to WebP and stored on a named volume, served from `/uploads/*`
- Drizzle migrations applied automatically when the API boots
- data and uploads that survive a redeploy
- Brevo SMTP reachability from the VPS, with the working port recorded
- vinext standalone serving the web app, plus a `next build` canary in CI

Requirements: AUTH-01, AUTH-02, AUTH-03, UPLD-01, OPS-01, OPS-02. Workspaces, products, and real upload consumers (logos) belong to Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Sign-in & accounts
- **D-01:** Same-email accounts **auto-link**. Keep Better Auth's default implicit linking: when a user signs in with Google and later with GitHub and both report a verified email, it is one user with two `account` rows. Do not set `disableImplicitLinking`. Phase 2's teammate invites depend on one verified email mapping to one user. — **Reversibility:** costly — un-merging linked users later means splitting `account` rows and reassigning user-owned data.
- **D-02:** Sign-in lives on a dedicated **`/login` page** with Google and GitHub buttons and a `?next=` return path (validated as a same-origin relative path, so it can't be used as an open redirect). There is no modal. Phase 3's "prompt sign-in, then return to the same spot" reuses this page.
- **D-03:** Display name and avatar are **copied from the provider at first sign-in** and never auto-synced afterwards. Keep `updateUserInfoOnLink` false, so linking a second provider doesn't overwrite them.
- **D-04:** Sessions last **14 days, sliding**: the expiry renews while the session is in use. The user said "14 days", and sliding is recorded as the interpretation. In Better Auth terms: `session.expiresIn` = 14 days, with an `updateAge` that refreshes it (for example 1 day).

### Upload rules
- **D-05:** Max upload size is **2 MB**. Enforce it in the multipart parser before sharp touches the bytes, and return a clear error when it's exceeded.
- **D-06:** Uploads are **static only**. Animated GIFs are flattened to their **first frame**, which saves VPS disk. Users who want animation or large images are expected to use external image URLs in content; that is a Phase 5 decision (see Deferred).
- **D-07:** Resizing is **cap only**: every upload becomes one WebP, downscaled to at most **1600px wide** (never upscaled), with EXIF stripped. There are no srcset widths and no per-purpose presets (logo vs content). The upload API takes no `purpose` parameter. Pick a sane `limitInputPixels` for decompression-bomb protection.
- **D-08:** Allowed inputs are PNG, JPEG, WebP, and GIF, detected by magic bytes (`file-type`) rather than by extension or MIME header. SVG, renamed non-images, and oversized files are rejected with a clear message (UPLD-01).
- **D-09:** Phase 1's upload UI is a **dev-only test page**, available only when signed in, that proves the pipeline. Phase 2 builds the real upload controls for logos. Hide or remove the test page before launch.

### Environments & deploy
- **D-10:** Local dev uses **Caddy in the dev docker compose** for a single origin. It routes `localhost/api/*` and `/uploads/*` to Nest and everything else to the web dev server, mirroring prod's Traefik path routing so cookie and redirect bugs show up locally. This is not a Vite dev proxy.
- **D-11:** The VPS runs **staging and prod**, each with its own domain, Postgres, uploads volume, secrets, and Google/GitHub OAuth apps (or registered callbacks). The free VPS has limited RAM, so keep the footprint per environment small.
- **D-12:** Each environment is **one Dokploy compose app** (web, api, postgres) with Traefik path labels: `/api` and `/uploads` go to the api container, everything else to web. The same compose shape is used locally. Postgres 18 data is mounted at `/var/lib/postgresql`.
- **D-13:** CI is **GitHub Actions**. It runs lint (including the Phase 1 lint rules), tests, the vinext build, and the `next build` canary on PRs and on main. Images are built by Dokploy on deploy; there is no registry push.
- **D-14:** Deploy triggers: **a merge to main auto-deploys staging, and a release tag (`v*`) deploys prod**.
- **D-18:** The VPS is an **Oracle Ampere A1 (arm64)**. Images run on `linux/arm64` (Docker on the VPS builds natively). Because the VPS is not x64, the Bun 1.4.2 SSE4.2 hang does not apply there. D-13 stays as is: images are built on the VPS by Dokploy. If a build runs out of memory, the user has **deferred** that problem. Do not plan a GHCR or CI-build path now. A swap file may be added if needed.
- **D-15:** **Staging catches mail in Mailpit.** Only prod sends through Brevo, so staging never emails real people or uses up the 300/day quota. The Brevo port reachability check (587, then 2525/465) still runs once from the VPS, and the working port is recorded for Phase 3.

### Skeleton UI fidelity
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope & requirements
- `.planning/PROJECT.md`: tenancy model, constraints, and Key Decisions (auth in Nest, sharp in the API only, vinext standalone, Bun as PM on a Node runtime)
- `.planning/REQUIREMENTS.md`: AUTH-01..03, UPLD-01, OPS-01, OPS-02
- `.planning/ROADMAP.md` § Phase 1: success criteria 1–5, research flags, and the lint rules that land in this phase

### Stack & architecture research
- `.planning/research/STACK.md`: pinned versions, the vinext verdict, Bun linker notes, Dockerfile sketch, Better Auth in Nest (`bodyParser: false`), and the migration runner with an advisory lock
- `.planning/research/ARCHITECTURE.md`: web↔API auth seam (`apiServer()` cookie forwarding, `proxy.ts` optimistic redirect) and path routing
- `.planning/research/PITFALLS.md`: `__Secure-` cookies over internal http, Postgres 18 volume path, Windows build issues, and others
- `.planning/research/SUMMARY.md`: a condensed digest of the above
- `.claude/CLAUDE.md`: the project's locked technology constraints and "What NOT to Use"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. The repo is greenfield (only planning docs and `.claude/CLAUDE.md`).

### Established Patterns
- None yet. This phase establishes them: the Bun workspace layout `apps/web`, `apps/api`, `packages/db`, `packages/types`.

### Integration Points
- Everything starts here. Phase 2 builds on the header shell (D-16), the `/login` page (D-02), the upload endpoint (D-07), and the compose/Caddy routing (D-10, D-12).

</code_context>

<specifics>
## Specific Ideas

- The user wants VPS disk usage kept low. This drove the 2 MB cap, static-only uploads, and a single stored size.
- External image URLs are the user's intended answer for animated or large images.

</specifics>

<deferred>
## Deferred Ideas

- **External `https:` image URLs in rich text (changelog/FAQ). Decide in Phase 5.** The user wants people to be able to paste outside image URLs, and that is why uploads are static only. It conflicts with the current XSS allowlist (`image.src` must match `^/uploads/...\.webp$`), and hotlinked images expose visitor IPs to third parties, allow tracking pixels, and break when the external host removes them. Phase 5 must decide whether to allow them and under what restrictions.
- Srcset widths and per-purpose presets for uploads: add them if changelog pages feel heavy on mobile.
- Dark mode: tokens are ready; add it later.

</deferred>

---

*Phase: 01-walking-skeleton*
*Context gathered: 2026-10-01*
