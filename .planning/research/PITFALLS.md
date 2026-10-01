# Pitfalls Research

**Domain:** Multi-tenant customer feedback board + dual-layer roadmap + changelog SaaS (User -> Workspace -> Product), Next.js 16 built with vinext, NestJS API, Postgres/Prisma, OAuth-only auth, local-disk uploads, Docker + Dokploy
**Researched:** 2026-10-01
**Confidence:** MEDIUM-HIGH overall. The vinext findings come from the cloudflare/vinext repo itself: its README, its `check.ts` library table, its source, and its issue tracker, all read on 2026-10-01. Treat those as HIGH. Next.js, Prisma, sharp, and Better Auth behaviour comes from official docs via Context7, which the classify seam rates MEDIUM, though these are first-party docs. Domain and anti-pattern items are mostly experience-based and are marked where inferred.

> **Headline finding that changes a locked decision:** vinext's own compatibility checker (`packages/vinext/src/check.ts`) marks **`next-auth` and `@auth/nextjs` as `status: "unsupported"`** with the note "relies on Next.js API route internals; consider migrating to better-auth". **`better-auth` is marked `supported`** and has an ecosystem test fixture in the vinext repo (`tests/fixtures/ecosystem/better-auth`). Auth.js has been maintained by the Better Auth team since September 2025 and is in maintenance mode. `next-auth@5` is still `5.0.0-beta.32` on npm, and v4 latest is `4.24.15`. The roadmap should treat "NextAuth.js" in the PRD as **"OAuth via an Auth.js-lineage library", which in practice means Better Auth**. If NextAuth stays, it has to be a gating spike, not an assumption. See Pitfall 1.

> **Second correction to PROJECT.md:** vinext is **no longer pre-1.0**. `vinext@1.0.0` was published 2026-09-28 and is the npm `latest` tag. The README still carries the "under active development / expect compatibility gaps" banner and the ~94% API-coverage figure. Several standalone and Nitro bugs that matter for Docker remain open (Pitfall 2).

---

## Critical Pitfalls

### Pitfall 1: Building auth on NextAuth under vinext, then discovering it is unsupported

**What goes wrong:**
The team wires NextAuth (v4 or v5 beta) into the vinext app, and it half-works in dev. Then cookie handling, the catch-all `[...nextauth]` route, or `auth()` in middleware and RSC fails in subtle ways, usually in production. That happens after tenancy, sessions, and the NestJS session bridge have all been built on its token format.

**Why it happens:**
- vinext's `vinext check` table lists `next-auth` and `@auth/nextjs` as **unsupported** because they rely on Next.js internals. Source: `packages/vinext/src/check.ts`, lines ~475-487 on `main`.
- A maintainer (james-elicx) said in issue #727: "I would recommend using Better Auth... we run tests with their library. Next Auth / Auth.js joined Better Auth last year and recommend using Better Auth for projects instead of Next Auth."
- vinext has already had to fix next-auth-specific cookie breakage. Issue #2688 (closed): `getHeader("Set-Cookie")` returned a live array that `setHeader` cleared, which dropped every cookie set by next-auth v4. More bugs like this are likely.
- Better Auth is not trouble-free under vinext either. Issue #2813 (open) reports that dev-mode RSC dependency re-optimisation makes the Better Auth route hang or return 500. It was seen on the Cloudflare dev path, and the workaround is to prebundle `better-auth`, `better-auth/next-js`, and `better-auth/plugins` in `environments.rsc.optimizeDeps.include`.

**How to avoid:**
- **Recommendation: use Better Auth**, with the Google and GitHub social providers, a Prisma adapter, and **database sessions**. It satisfies every PRD intent: OAuth-only in v1, room for email/password and magic link in v2 with no rewrite, and a single User table. Record it in Key Decisions as "NextAuth.js -> Better Auth (Auth.js successor; NextAuth unsupported by vinext)".
- If the user insists on NextAuth, make **Phase 0 a hard spike**. Run sign-in, callback, `auth()` in an RSC, a protected Server Action, and sign-out on the **standalone production build inside Docker behind a reverse proxy**, not just `vite dev`. Any failure triggers the switch.
- Whichever library you pick, add the #2813 `optimizeDeps.include` workaround pre-emptively. It is harmless.

**Warning signs:**
- `vinext check` output lists next-auth as unsupported (it will).
- The session cookie is missing after the OAuth callback.
- `auth()` returns null in an RSC but works in a route handler.
- Behaviour works in `vite dev` and breaks in `node dist/standalone/server.js`.

**Phase to address:** Foundation/Auth, as the first item: auth library choice plus a production-build spike.

---

### Pitfall 2: Assuming vinext's Node self-hosting output is as mature as its Workers path

**What goes wrong:**
The Docker image builds, but the server boots with dev React, crashes with "Incompatible React versions", or returns 500 on every route. Other symptoms: the build hangs indefinitely, or tabs left open across a deploy have dead buttons.

**Why it happens:** the README says plainly that "Cloudflare Workers has the deepest integration; Node.js and other platforms are available with different levels of support." Open issues that hit this exact stack (pnpm monorepo, Radix, Docker):

| Issue | State | Impact on UserSaid |
|---|---|---|
| #3444: standalone `server.js` does not default `NODE_ENV=production` | open (fix PR #3466 open) | React dev bundle in prod, which is slow and noisy, if the Dockerfile forgets `ENV NODE_ENV=production` |
| #3443: standalone copies the **wrong package version** when several are installed in a monorepo | open (fix PR #3576 open) | If any workspace package pins a different `react`, every page returns 500 with "Incompatible React versions" |
| #3486 / #3485: standalone omits `react` when bundled; react/react-dom are hard-coded SSR externals | open | Do not try to bundle React into the server, and keep `node_modules` in the image |
| **#3483: `vinext build` hangs forever** analysing client references when importing the **`radix-ui` barrel under pnpm** (the standard shadcn pattern) | open (fix PR #3516 open) | Directly hits this stack: pnpm + Radix |
| #3478: **Nitro** build with server code-splitting emits undeclared `rsc_exports`/`ssr_exports`, giving a 500 on every route once the app grows past the split threshold | open | A time bomb that goes off once the app is "big enough" |
| #3431 / #3427 / #3439: Nitro builds skip prerendering, don't serve rewrites to `public/`, and fail ESM-externals | open | More reasons to avoid the Nitro path |
| #3446: Node prod server ignores `setImageOptimizer()`, so `/_next/image` serves originals unresized | open | `next/image` does no optimisation on Node, which confirms the API-side WebP decision |
| #3604 + #3626: tabs opened before a deploy can't run Server Actions until they reload, because client chunk hashes change on every build even with `deploymentId` pinned | open | Admins with a Kanban tab open lose drag/drop saves after every deploy, silently |
| #3217: middleware does not run for static-asset requests covered by its matcher | open | Never rely on middleware to guard files |

Nitro itself is still beta: `nitro@3.0.260903-beta` is npm `latest`.

**How to avoid:**
- **Use vinext's native `output: "standalone"`** (`dist/standalone/server.js`), **not the Nitro `node` preset**. Standalone has fewer open bugs, needs no extra beta dependency, and maps 1:1 onto Next.js's own standalone, which keeps the fallback cheap (Pitfall 3). PROJECT.md's wording "Node/Nitro path" should become "vinext standalone Node server".
- Dockerfile: set `ENV NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=3000`. vinext uses `HOST`, **not** Next's `HOSTNAME`, because Linux sets `HOSTNAME` itself.
- Pin a **single React version across the whole monorepo** with a pnpm `catalog:` or `overrides`. Only `apps/web` should depend on React, and `packages/types` must not pull it in. Add a CI check of `pnpm why react`.
- Import Radix primitives from **individual `@radix-ui/react-*` packages, not the `radix-ui` barrel**, until PR #3516 ships. This applies to shadcn generator output too.
- Behind Dokploy/Traefik, set `VINEXT_TRUST_PROXY=1` (or `VINEXT_TRUSTED_HOSTS`). Without it, `X-Forwarded-Proto` is ignored and request URLs look like `http://`, which breaks OAuth redirect URIs and secure-cookie logic. The variable names come from `packages/vinext/src/server/proxy-trust.ts`.
- Make every client mutation path tolerate chunk-load failure (#3604). Show "A new version is available, reload". Do not let buttons fail silently.
- Pin `vinext`, `vite`, and `@vitejs/plugin-rsc` to exact versions. Upgrade on purpose, re-running the Docker smoke test each time.

**Warning signs:** the build sits in `[1/5] analyze client references` for more than about 2 minutes; React "development mode" warnings show in prod logs; "Incompatible React versions" appears; OAuth `redirect_uri_mismatch` reports `http://`.

**Phase to address:** Foundation, with a Phase 0 "walking skeleton". That means a vinext standalone build of one RSC page, one Server Action, OAuth sign-in, and one call to NestJS, deployed through Dokploy, **before any feature work**.

---

### Pitfall 3: Writing code that only vinext can build, which makes the `next build` escape hatch expensive

**What goes wrong:**
A blocking vinext gap appears mid-project, such as Pitfall 1 or 2, or a future App Router regression. Falling back to `next build` then turns out to mean rewriting env access, CSS wiring, the Dockerfile, and any code that imported Vite or vinext APIs.

**Why it happens:** vinext invites Vite-isms: `import.meta.env`, `VITE_*` vars, Vite plugins carrying app logic, `vinext/*` imports, `cloudflare:workers`, and Tailwind wired as `@tailwindcss/vite`.

**How cheap the fallback is (assessment, partly inferred):** if the code stays on the public Next.js API surface, the fallback costs **about half a day to a day**. It amounts to:
1. Keep the `next` package installed. vinext uses Next's types when it is present, per the README FAQ.
2. Swap scripts from `vite build` / `vinext start` to `next build` / `next start`, and delete `vite.config.ts`.
3. Swap Tailwind v4 wiring from `@tailwindcss/vite` to `@tailwindcss/postcss` with a `postcss.config.mjs`.
4. Update the Dockerfile: `dist/standalone/server.js` becomes `.next/standalone/server.js`, plus copy `.next/static` and `public`, and `HOST` becomes `HOSTNAME`.
5. Re-test middleware/proxy and Server Actions.

It gets **expensive (multiple days)** if the code uses `import.meta.env`, `VITE_*`, vinext cache adapters, Vite-specific `?raw`/`?url` imports, or `cloudflare:workers`, or if it depends on vinext-specific behaviour such as its `"use cache"` semantics.

**How to avoid:**
- Rule: **app code may only import `next/*`, `react`, and npm libraries.** No `import.meta.env`, no `vinext/*`, no Vite query-suffix imports. Enforce it with an ESLint `no-restricted-imports` / `no-restricted-syntax` rule.
- Use `process.env.X` for server env and `NEXT_PUBLIC_X` for client env, which both toolchains support.
- Tailwind v4 under vinext: use `@tailwindcss/vite`. Issue #3240 (open) says string-form `postcss.config.mjs` plugins fail under Vite with ENOENT, and #1128 (open) reports several Tailwind config styles silently not applying. Keep a commented `postcss.config.mjs` in the repo for the fallback.
- Keep `next.config.ts` as the single source of route config (`output: "standalone"`, headers, redirects), since vinext reads it.
- Optionally run a CI job that executes `next build` (type-check plus build only). It keeps the escape hatch warm, roughly 2-4 minutes of CI per run.

**Warning signs:** a grep for `import.meta.env|from "vinext|cloudflare:workers|\?raw` returns hits in `apps/web/src`.

**Phase to address:** Foundation, covering the lint rules and repo conventions, plus the CI `next build` canary.

---

### Pitfall 4: Cross-tenant IDOR, where the URL says workspace A but the ID belongs to workspace B

**What goes wrong:**
- An admin of workspace A calls `PATCH /posts/:id`, `DELETE /statuses/:id`, or `POST /roadmap-items/:id/links` with IDs from workspace B and succeeds.
- An end-user votes on or comments against a post in a private product by posting its ID directly.
- A roadmap item in product A gets linked to a post in product B. That moves B's post status and exposes A's item on B's board.

**Why it happens:**
- Handlers load the entity by primary key and only check "is the caller an admin of *some* workspace", or only check the `{workspace}` slug in the URL.
- The tenant is resolved from the URL slug in the web app and then trusted when the client sends back a `productId` in the body.
- Foreign keys enforce existence, not tenancy. `post.statusId` can point at another product's status row and Postgres will accept it.

**How to avoid:**
- **One tenant resolver in NestJS.** A guard reads `:workspaceSlug/:productSlug` (or the entity's parent), loads the product, and checks `Membership(userId, workspaceId)`. It attaches `req.tenant = { workspaceId, productId, role }`. Handlers never accept `workspaceId` or `productId` from the body.
- **Every query includes the tenant scope**: use `where: { id, productId: req.tenant.productId }`, not `findUnique({ id })` followed by a check. A miss returns 404, never 403, so existence doesn't leak.
- **Composite foreign keys for same-product invariants.** Give `Status`, `Category`, `Post`, and `RoadmapItem` a `@@unique([id, productId])`, and reference them with `(statusId, productId)`. A post can then never point at another product's status, and a cross-product link is impossible at the DB level. Prisma supports compound relations with `fields: [statusId, productId], references: [id, productId]`.
- Linking endpoint: verify in one query that **all** submitted post IDs belong to `req.tenant.productId`. If any don't, reject the whole request.
- **Automated cross-tenant test matrix.** Seed two workspaces, then call every admin endpoint as A's admin using B's IDs and assert 404. Make it a CI gate. It is cheap and catches regressions forever.
- Prefer this explicit scoping over Prisma client extensions that auto-inject `productId`. Those don't cover `$queryRaw` or every nested write, and they create false confidence. Postgres RLS is defensible later but heavy with pooled Prisma connections.
- **Global accounts add a twist:** workspace A's admin must never be able to enumerate users or activity outside A. A "user search" or "voters" endpoint has to be scoped to users who interacted with A's products.

**Warning signs:**
- `findUnique({ where: { id } })` appears in a service method without a `productId` in scope.
- DTOs contain `workspaceId` or `productId` fields.
- No test seeds a second workspace.

**Phase to address:** Foundation/Tenancy builds the resolver, guard, composite keys, and test harness. The matrix then extends in **every** later phase: board, roadmap, statuses, changelog, FAQ.

---

### Pitfall 5: Internal roadmap fields leaking through JSON, RSC payloads, or linked-post responses

**What goes wrong:** the public roadmap UI hides assignee, notes, and deadline, but:
- the public API response still contains `internalNotes`, `assigneeId`, `targetDate` (visible in DevTools);
- a Server Component passes the full Prisma row to a `"use client"` Kanban/card component, and the **whole object is serialized into the RSC payload** in the HTML;
- `GET /posts/:id` includes `roadmapItems: true` and drags the linked item's internal fields onto the public post page;
- a NestJS `@Exclude()` on a DTO class does nothing because Prisma returns plain objects, not class instances. `ClassSerializerInterceptor` only strips fields on class instances, so this is a classic false sense of security (inferred from NestJS / class-transformer semantics);
- the item's **internal title** is shown when the "public title" is empty.

**Why it happens:** the default is "fetch the row, hide in UI". React taint APIs (`experimental_taintObjectReference`) would be a backstop, but they need React's experimental channel. vinext issue #2109 shows that support for the experimental-React config is still being tracked, so **do not rely on taint under vinext**. Next.js's own data-security guide states that page-level auth does not protect Server Actions and recommends a server-only Data Access Layer returning minimal DTOs.

**How to avoid:**
- **Split the schema.** Put internal fields in a 1:1 `RoadmapItemInternal` table (assignee, notes, deadline, internal title). A public query cannot include what is not on the row. This is the strongest structural guarantee and costs one join on admin views.
- **Separate public and admin controllers/modules in NestJS** (`/public/...` vs `/admin/...`). Public services use explicit Prisma `select` objects defined once (`publicRoadmapItemSelect`) and map through a pure `toPublicRoadmapItem()` function. Never use `include`. Never spread (`...item`).
- Response-shape contract tests: for every public endpoint, assert that the JSON keys are **exactly** the allowed set (snapshot of keys) and that a canary string seeded into `internalNotes` appears nowhere in the response body. Also fetch the rendered public portal HTML (including the RSC payload) and assert the canary is absent.
- Web app: public portal pages call **only** public API endpoints. Mark admin fetchers `import "server-only"` and keep them under an `app/(admin)` boundary.
- Decide explicitly: **does linking a private (non-public) roadmap item to a public post change the post's public status?** With a shared status set it will, and "In Progress" on a public post then reveals an unannounced plan. See Pitfall 7 for the status-visibility fix.

**Warning signs:** public DTO types are `Omit<RoadmapItem, ...>` (a denylist) rather than `Pick` or an explicit type (an allowlist); `include:` appears in any `public` service; a client component prop is typed as a Prisma model.

**Phase to address:** Roadmap phase (core). Lay the public/admin module split in Foundation so the pattern exists before roadmap code is written.

---

### Pitfall 6: A "private" (login-required) product that isn't actually private

**What goes wrong:**
1. **Semantics.** Accounts are global and any Google/GitHub user can sign up, so "login-required" equals "anyone with a Google account". A company running a "private beta portal" believes it is restricted. *(Inferred domain risk, and arguably the biggest trust gap in the current requirement wording.)*
2. **API.** Portal pages check auth, but `GET /public/:ws/:product/posts`, the changelog, FAQ search, and the roadmap endpoints don't check `product.visibility`.
3. **Metadata.** `generateMetadata` fetches the post title for `<title>` and OG tags without the access check, so link unfurlers (Slack, X) and crawlers get the content. `opengraph-image` routes are separate routes and need their own check. vinext has had metadata quirks: #2725 (fixed), where `notFound()` in generateMetadata returned 200, and #2007 (open), where async metadata renders into the body.
4. **Sitemap/robots/RSS.** `sitemap.ts` enumerates all products, and the changelog RSS feed ignores visibility.
5. **Uploads.** Changelog images live at `/uploads/<uuid>.webp` with no auth. They are unguessable but freely shareable, and they remain reachable after the product is made private.
6. **Caching.** A cached render or `"use cache"` result for a private product is served without re-checking the session. vinext's caching semantics changed right up to 1.0.0, which only then stopped storing renders that used dynamic APIs. Issues #1453, #1937, and #3641 show `"use cache: private"` still in flux.

**How to avoid:**
- **Clarify the toggle before building it.** Options are (a) relabel it honestly as "Require sign-in (any account)", or (b) add an access list: invited end-user emails and/or allowed email domains such as `@customer.com`. (b) is what "private beta portal" implies. At minimum ship (a) with an honest label and leave a schema slot for (b).
- One `assertCanViewProduct(user, product)` in the API, called by **every** public endpoint and by the web `generateMetadata`, `opengraph-image`, `sitemap`, and RSS handlers. Private products return 404 to unauthorised viewers.
- Private products get `robots: { index: false }` and are excluded from the sitemap entirely.
- **v1 rule: every portal and admin route is dynamic** (`export const dynamic = "force-dynamic"`). No ISR, no `"use cache"` on anything that is tenant- or session-dependent. Revisit only after vinext caching settles. The performance cost is negligible at MVP scale.
- Uploads: choose either a **capability-URL model** (UUIDv4 names, no directory listing, documented as "image links are shareable") or an **auth-checked image route** (`GET /files/:id` that resolves the owning product and checks visibility). Recommended for v1: the auth-checked route for changelog images of private products, with workspace/product logos left public.

**Warning signs:** `visibility` is checked in a web layout but nowhere in `apps/api`; a `curl` without cookies to a private product's API returns 200; Slack unfurls a private post's title.

**Phase to address:** Foundation/Tenancy (decide semantics, build `assertCanViewProduct`), then verified again in Board, Roadmap, Changelog, FAQ, and Deploy (sitemap/robots).

---

### Pitfall 7: Fully free-form statuses with no semantics, plus orphaning on delete

**What goes wrong:**
- Deleting a status either fails with an FK error the UI can't explain, cascades and **deletes all posts in it** (`onDelete: Cascade`), or nulls `statusId` and leaves posts invisible on a board that groups by status.
- Deleting the status used as the default for new posts breaks post creation.
- An admin creates an internal-only column like "Blocked - legal". Because statuses are shared, it then appears **publicly on linked posts**.
- Because statuses are pure user-defined rows, the app can't know which ones mean "done" (for "Shipped" badges, hiding closed posts, or changelog linking) or which are public roadmap columns.

**How to avoid:**
- Status row: `id, productId, name, color, position, category, isPublic, isDefault`. **`category` is a fixed enum** (for example `OPEN | PLANNED | IN_PROGRESS | DONE | CLOSED`), while `name` stays freely editable. This is the Linear "workflow state type" pattern. The app's behaviour keys off `category`, and the UI label is `name`.
- `isPublic=false` statuses: posts in them display the nearest public status, or "Under review", on the portal. This also fixes the private-item-linking leak from Pitfall 5.
- FK `onDelete: Restrict`. `DELETE /statuses/:id` **requires `reassignToStatusId`** (same product, validated through the composite FK) and moves posts and items in one transaction before deleting. Block deleting the last status, the last status of a required category, or the `isDefault` status until another default is set.
- Reorder by `position`. Use fractional or gap-based positions for Kanban cards so concurrent drags don't renumber whole columns.
- Seed defaults inside the same transaction as product creation. A product without statuses is a broken product.

**Warning signs:** `onDelete: Cascade` on `Post.status`; a status delete endpoint with no body; "Done" logic matching on `name === "Done"`.

**Phase to address:** Statuses. Model them before Board and Roadmap, since both depend on them.

---

### Pitfall 8: Vote integrity, covering double-click races, counter drift, and toggle semantics

**What goes wrong:**
- A double-click fires two `POST /vote` requests. Without a unique constraint you get two votes. With one, the second request returns a 500 (Prisma `P2002`) and the UI shows an error.
- A "toggle" endpoint plus a double-click equals vote then unvote, so the user ends up not voted.
- A denormalised `voteCount` is incremented in app code (`read`, `+1`, `write`), so concurrent votes are lost. Or the count increments even when the insert was a duplicate, so the count drifts from `COUNT(*)`.
- Merging duplicate posts double-counts users who voted on both.

**How to avoid:**
- `@@unique([postId, userId])` on `Vote`. Make the API **idempotent and explicit**: `PUT /posts/:id/vote` (ensure voted) and `DELETE /posts/:id/vote` (ensure not voted). Never use a toggle.
- Insert with `ON CONFLICT DO NOTHING` (`createMany({ skipDuplicates: true })`, or catch `P2002` and treat it as success). Only if a row was actually inserted, run `UPDATE post SET vote_count = vote_count + 1` **in the same transaction** (atomic `increment`). Same for delete.
- Keep a nightly or admin-triggered reconcile, `vote_count = (SELECT COUNT(*) ...)`, plus a test asserting no drift after 50 concurrent vote calls.
- Client: optimistic UI, with the button disabled while the request is in flight.
- Merge posts: `INSERT ... SELECT ... ON CONFLICT DO NOTHING` into the target, then recount.
- **Vote stuffing via multiple OAuth accounts** can't be prevented in an OAuth-only world, since GitHub accounts are free. Mitigate rather than prevent: rate-limit votes per user and IP (`@nestjs/throttler`), show admins the voter list with account age and provider, and let admins remove votes. Don't build fraud detection in v1. *(Domain judgement.)*

**Warning signs:** no unique index on `Vote`; a `toggleVote` function; `voteCount: post.voteCount + 1` in code.

**Phase to address:** Feedback Board.

---

### Pitfall 9: Rich-text changelog XSS

**What goes wrong:** an admin (or a compromised admin account) stores `<img src=x onerror=...>` or a `javascript:` link in a changelog entry. It renders via `dangerouslySetInnerHTML` on the **public** portal and runs in every visitor's session on the shared platform origin. All tenants share one origin (path-based routing), so one workspace's stored XSS can act against users' sessions **for every workspace**. That makes it a cross-tenant issue, not merely a self-XSS.

**Why it happens:** devs reason that "only admins write changelogs", forgetting that admins are untrusted relative to other tenants and to end-users. Also, editor link extensions have historically accepted `javascript:` URIs (inferred / MEDIUM).

**How to avoid:**
- Store the editor's **structured JSON** (Tiptap/ProseMirror) as the source of truth, and render it to HTML **server-side through a strict allowlist**: tags `p, h2-h4, ul, ol, li, a, strong, em, code, pre, blockquote, img`; `a[href]` only `https:`/`mailto:`, with `rel="noopener nofollow ugc"`; `img[src]` only from your own upload origin.
- If you store HTML, sanitise **on write and on render** with `sanitize-html` or DOMPurify (via jsdom on the server), using the same allowlist.
- Ship a CSP for portal pages: no `unsafe-inline` scripts, `img-src 'self' <upload-origin>`, `object-src 'none'`, `base-uri 'none'`. vinext issue #3205 (open) says CSP nonces aren't yet applied to all segment script tags, so test the CSP on the vinext build specifically.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`.

**Warning signs:** `dangerouslySetInnerHTML` without a sanitiser call adjacent to it; HTML stored in DB with no sanitiser in the write path; no CSP header.

**Phase to address:** Changelog. Set the CSP baseline in Foundation.

---

### Pitfall 10: Image upload attacks against the sharp pipeline and the volume

**What goes wrong:**
- **Decompression bomb.** A 50 KB PNG declares 30000x30000 pixels, and sharp/libvips allocates gigabytes and OOM-kills the API container, which also serves every other tenant.
- **Animated bomb.** A GIF or WebP with thousands of frames, when processed with `animated: true`.
- **Polyglot / content sniffing.** A file that is a valid image header plus HTML/JS gets served with the original bytes or extension and is rendered as HTML.
- **SVG.** Accepting `.svg` "because logos" means stored XSS if served raw. sharp rasterises SVG to PNG by default, which is safe, but only if you never serve the original.
- **Path traversal.** Using the client filename, such as `../../app/dist/main.js` or `..\\`, in the write path.
- **Oversized uploads** fill the volume or memory, because Multer buffers in memory with no `limits.fileSize`.
- **EXIF orientation.** sharp strips metadata on output by default, which is good for GPS privacy, but without `.rotate()` phone photos come out sideways.

**How to avoid (sharp facts from official docs):**
- `sharp(input, { limitInputPixels: 40_000_000, failOn: "warning", animated: false })`. The default limit is 268,402,689 px (0x3FFF^2), which is too generous for a shared API, and `failOn: "warning"` is the documented setting for untrusted input. Call `.rotate()` (auto-orient) then `.resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 80 })`.
- Multer/Nest: set `limits: { fileSize: 5 * 1024 * 1024, files: 1 }`. Allowlist **by decoded format** (`(await sharp(buf).metadata()).format` in `jpeg|png|webp|gif`), never by extension or client MIME. Reject SVG for changelog images. For logos, either reject SVG or rasterise it, and never store or serve the original.
- **Always re-encode and store only the WebP output.** Filename = server-generated UUID + `.webp`, under a fixed `UPLOAD_DIR`. After `path.resolve`, assert the path starts with `UPLOAD_DIR`.
- Serve with `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, and `Cache-Control: public, max-age=31536000, immutable` (for public assets). Ideally serve uploads from a separate host or subdomain so even a mistake can't execute on the app origin.
- Limit concurrency: `sharp.concurrency(1-2)` plus a small in-process queue, rate-limited per user, so a burst of uploads can't starve the API.
- Store an `Upload` row (id, productId, uploaderId, bytes, width, height) so files are tenant-attributable, quota-able, and garbage-collectable when entries are deleted.

**Warning signs:** `file.originalname` used in a path; no `limitInputPixels`; uploads served by `express.static` with default MIME guessing; API container restarts with exit 137 (OOM).

**Phase to address:** Changelog (uploads). Workspace/product logos in Foundation reuse the same pipeline, so build the pipeline in Foundation, hardened.

---

### Pitfall 11: Decoupled web/API auth, where NestJS trusts the web app blindly or can't read the session

**What goes wrong:**
- NestJS accepts an `x-user-id` header "because only the web server calls it". The API port is reachable (a Dokploy-exposed domain or a misconfigured network), so anyone can impersonate anyone.
- Or the API tries to decode the auth library's JWE session cookie and fails. NextAuth v5 encrypts JWTs with a key derived from `AUTH_SECRET` and the cookie name as salt (inferred from Auth.js internals; MEDIUM).
- Browser-to-API calls on a different origin need CORS with credentials, `SameSite` and cookie-domain gymnastics, and CSRF protection.

**How to avoid:**
- Use **database sessions** (Better Auth default with the Prisma adapter). NestJS validates by looking up the session token in the shared `Session` table through `packages/db`, or by mounting Better Auth inside NestJS for verification. One source of truth, and revocable.
- **Backend-for-frontend shape (recommended).** The browser talks only to the web origin, through RSC, Server Actions, and route handlers. The web server calls NestJS server-to-server, forwarding the session cookie or token. Keep the API internal on the Docker network, or expose it only under the same origin at `/api` via Traefik. This removes CORS and cross-site cookie issues entirely.
- Server Actions: vinext enforces the Next.js-style CSRF Origin-vs-Host check (`validateCsrfOrigin` in `request-pipeline.ts`, which deliberately ignores `X-Forwarded-Host`). Traefik preserves `Host` by default, so this works. If you ever proxy web through another hop that rewrites `Host`, every Server Action returns 403 until `experimental.serverActions.allowedOrigins` is set.
- Every Server Action and every NestJS handler re-checks auth and tenancy. Page-level checks don't protect actions, as Next.js's data-security guide states explicitly.

**Warning signs:** an `x-user-id`, `x-workspace-id`, or `x-internal` header trusted by NestJS; the API published on a public domain with no auth guard on some controller; CORS `origin: true, credentials: true`.

**Phase to address:** Foundation/Auth.

---

### Pitfall 12: Uploads and data lost or unwritable on Dokploy redeploy

**What goes wrong:**
- Uploads were written to the container filesystem because the volume was mounted at `/app/uploads` while the code writes to `process.cwd()/uploads` = `/app/apps/api/uploads`. The first redeploy wipes every image.
- A bind mount uses an **absolute host path**, which Dokploy's docs warn "will be cleaned up during deployments". For Compose deploys, use `../files`.
- A mount points at a path inside the git checkout. Dokploy re-clones on each deploy, so the path is wiped.
- The container runs as `node` (uid 1000), but the volume directory is root-owned, so every upload fails with `EACCES`. Docker seeds an empty **named volume** with the image directory's contents and ownership; bind mounts keep host ownership. *(Docker behaviour; MEDIUM.)*
- Only Postgres is backed up. Dokploy's Volume Backups work **only for named volumes**, not bind mounts, so uploads have no backup, or the DB and upload backups are taken at different times and disagree.
- Scaling the API to 2+ replicas on Swarm across nodes puts each replica on a different local volume. *(Inferred.)*

**How to avoid:**
- Use a **named volume** (for example `usersaid_uploads`) mounted at a fixed absolute container path. The code reads `UPLOAD_DIR=/data/uploads` from env and fails fast at boot if the path is missing or unwritable: write a probe file on startup.
- Dockerfile: `RUN mkdir -p /data/uploads && chown -R node:node /data` **before** `USER node`, so a freshly created named volume inherits the ownership.
- Enable Dokploy Volume Backups for the uploads volume plus Postgres backups, on the same schedule. Document a restore drill.
- Run a single API replica in v1, and say so in the deploy docs.
- Add an E2E deploy check: upload, redeploy, then confirm the image still serves.

**Warning signs:** `docker volume ls` shows no uploads volume; uploads are 404 after deploy; `EACCES` in API logs; the backup dashboard lists only the database.

**Phase to address:** Deploy, but the `UPLOAD_DIR`, ownership, and fail-fast boot check belong in the Foundation walking skeleton (Pitfall 2's Phase 0).

---

### Pitfall 13: Prisma migrations at container start

**What goes wrong:**
- `prisma migrate deploy` in the API `CMD` fails because the `prisma` CLI was a devDependency and got pruned. The Prisma docs call this out explicitly.
- Prisma 7 **no longer loads `.env` automatically** and needs `prisma.config.ts` (with `dotenv/config` or real env), so the migrate command can't find `DATABASE_URL` in the container.
- Prisma 7's `prisma-client` generator **requires an explicit `output`** and no longer generates into `node_modules`. In a pnpm monorepo (`packages/db`), the Docker build forgets to run `prisma generate` or to copy the generated folder, and the API crashes on import.
- A slow migration makes the health check fail, so Dokploy/Swarm kills and restarts the container mid-migration. Two containers (rolling update) both try to migrate: advisory lock with a **10 s non-configurable timeout**, after which the loser exits.
- A failed migration leaves `P3009` state, and every subsequent boot refuses until `prisma migrate resolve`.
- The web container also runs migrations, causing a race with the API.

**How to avoid:**
- **Only the API image runs migrations**, either as a separate one-shot step before switching traffic (Dokploy pre-deploy command, or an entrypoint script that runs `prisma migrate deploy` then `exec node dist/main.js`). The web image never contains the Prisma CLI.
- Put `prisma` in `dependencies` of `packages/db`, or in a dedicated migrate stage. Make `prisma.config.ts` read `process.env.DATABASE_URL` and not depend on an `.env` file being present.
- Prisma 7: use the `prisma-client` generator with `output` inside `packages/db/src/generated`, the `@prisma/adapter-pg` driver adapter, and `prisma generate` in the Docker build stage. Verify the generated client is in the final image.
- pnpm monorepo Docker: use `pnpm deploy --filter api --prod` (or `turbo prune`) to produce a self-contained `node_modules`. Recent pnpm versions require `inject-workspace-packages=true` (or `--legacy`) for `pnpm deploy`; verify against the installed pnpm major *(MEDIUM, verify in Phase 0)*.
- Health check grace period longer than the expected migration time. Migrations must be additive and backward-compatible (expand, then contract), because old and new containers overlap during a deploy.

**Warning signs:** `Cannot find module '.prisma/client'` or the generated path at boot; `P1001`/`P3009` in logs; the container restart-loops right after deploy.

**Phase to address:** Foundation (Prisma 7 setup in `packages/db`, Docker build) and Deploy (migration step, health checks).

---

### Pitfall 14: OAuth account linking and per-environment callback URLs

**What goes wrong:**
- A user signs up with Google as `jane@acme.com`, later clicks "Sign in with GitHub" (same email), and gets `OAuthAccountNotLinked` in NextAuth, or `account_not_linked` in Better Auth when the email is unverified or implicit linking is disabled. They conclude the product is broken, or create a second account, which **splits their votes and admin membership**.
- The opposite failure: implicit linking on an **unverified** provider email lets an attacker who controls a GitHub account with an unverified `victim@company.com` take over the victim's account, including their workspace admin rights.
- **Workspace invites by email + OAuth.** An invite to `jane@acme.com` is accepted by whoever holds the link, or can't be accepted because Jane's GitHub primary email is `jane@gmail.com`.
- **Callback URLs.** A GitHub OAuth App allows **one** callback URL, so dev, staging, and prod each need their own app. Google allows several redirect URIs but enforces exact scheme and host matches. Behind Traefik without proxy trust, the callback is built as `http://`, producing `redirect_uri_mismatch` (see Pitfall 2, `VINEXT_TRUST_PROXY`).
- A Google OAuth consent screen left in **"Testing"** publishing status only lets listed test users sign in, which blocks launch day. *(MEDIUM, widely reported Google behaviour.)*

**How to avoid:**
- Better Auth: keep implicit linking only for providers whose `email_verified` is trusted. Its default already requires a verified provider email and a verified local email (`requireLocalEmailVerified` defaults true), and the docs describe this as preventing "unverified email hijacking via social login". Put `google` and `github` in `trustedProviders` only after confirming the GitHub provider returns the **verified primary** email. Add an explicit "Link GitHub" button in account settings (`linkSocial()`).
- Invites: an invite token is single-use, expires, and on accept **requires the signed-in user's verified email to equal the invited email**. Otherwise show "This invite was sent to j***@acme.com; sign in with that account".
- Per-environment OAuth apps, with client IDs and secrets in Dokploy env. Set `BETTER_AUTH_URL` (or `AUTH_URL`) explicitly per environment instead of inferring it from the request.
- Publish the Google consent screen early in the Deploy phase.

**Warning signs:** duplicate `User` rows sharing an email; support reports of "my votes disappeared"; `redirect_uri_mismatch` on staging only.

**Phase to address:** Foundation/Auth (linking policy, env config, invites) and Deploy (production OAuth apps and consent-screen publishing).

---

### Pitfall 15: Domain anti-pattern, where the board becomes a graveyard and loops never close

**What goes wrong:** this is the dominant failure mode of feedback tools *(domain experience, inferred)*:
- Posts pile up in "Under review" forever.
- Duplicates fragment votes ("dark mode" x 7).
- Voters never learn the outcome, so they stop coming back, and the board reads as a suggestion-box graveyard.
- Vote count becomes the sole prioritisation signal, though it is biased toward loud or free users.
- UserSaid **excludes email notifications in v1**, which removes the standard loop-closing channel (the "your idea shipped" email). Without a replacement, the stated Core Value ("close the loop publicly") and the success metric (roadmap moves + changelog entries) are undermined.

**How to avoid (all within v1 scope):**
- **Manual merge duplicates** (moving votes with dedupe, per Pitfall 8, and leaving a redirect stub). AI dedupe is out of scope, so manual merge is the substitute and should be table stakes.
- **Loop-closing without email:**
  - a post timeline showing status changes with an optional admin note;
  - a "Shipped" state (category `DONE`) that links to the changelog entry;
  - changelog entries that link back to the posts and roadmap items they resolve;
  - an in-app "My feedback" view, or a badge showing that posts you voted on changed status since your last visit (needs a `lastSeenAt` per user and product).
- Admin triage view: "New since last visit", "No status change in 30+ days", "Most votes, still open". This directly drives the success metric.
- Show admins **who** voted (name, email, provider, account age), not just the count. B2B admins weigh voters by customer.
- Moderation basics: admin delete or hide post, lock comments, rate limits on post creation.
- Empty-state guidance so admins seed the first 5-10 posts. A cold, empty board kills participation.

**Warning signs:** a high ratio of posts in the default status; zero changelog entries linked to posts; the median post age in "open" categories keeps rising.

**Phase to address:** Feedback Board (merge, timeline, moderation), Roadmap (link-to-post status sync), and Changelog (link back to posts). Add the "My feedback" view to the requirements explicitly.

---

## Moderate Pitfalls

### Slug collisions with app routes and slug changes
**What goes wrong:** with `/{workspace}` at the URL root, a workspace named `api`, `admin`, `login`, `settings`, `uploads`, `_next`, `sitemap.xml`, `robots.txt`, `favicon.ico`, or `new` shadows or breaks routes. Changing a slug breaks every shared link. Case variants (`Acme` vs `acme`) can create duplicates.
**Prevention:** a reserved-slug denylist enforced in the API; lowercase `[a-z0-9-]` slugs with a unique index on the lowercased value; a `SlugHistory` table with 301 redirects from old slugs. Consider moving app routes under a prefix (`/app/...`) so the root namespace belongs to tenants. **Phase:** Foundation/Tenancy.

### Global accounts leak identity across tenants
**What goes wrong:** a user's Google name and avatar show on every company's portal they comment on. Admin views reveal emails. An admin "user lookup" accidentally searches all platform users.
**Prevention:** public portal shows display name and avatar only, never email. Admin views show email only for users who interacted with that workspace. No global user search. **Phase:** Foundation + Board.

### Single "admin" role means any invited member can remove the creator or delete the workspace
**Prevention:** even with a single role in v1, store `workspace.ownerId` and block removing or demoting the owner and deleting the workspace by non-owners. Destructive actions need a typed-slug confirmation. **Phase:** Foundation/Tenancy.

### `NEXT_PUBLIC_*` values baked at build time
**What goes wrong:** `NEXT_PUBLIC_API_URL` is inlined into client bundles at build (vinext README: "NEXT_PUBLIC_* variables are inlined"), so the same image can't move between staging and prod.
**Prevention:** the BFF pattern (Pitfall 11) removes the need for any client-side API URL. Keep server-only env read at runtime via `process.env`, and **verify in Phase 0 that a server env var changed in Dokploy takes effect without a rebuild** (inferred behaviour for vinext standalone). **Phase:** Foundation.

### Kanban drag/drop write storms and lost updates
**Prevention:** fractional indexing for `position`. Use one `PATCH /roadmap-items/:id/move { statusId, beforeId, afterId }` per drop. Use optimistic UI with rollback, plus an `updatedAt` precondition to avoid two admins clobbering each other. **Phase:** Roadmap.

### FAQ search with `LIKE '%q%'`
**Prevention:** use Postgres full-text search (`tsvector` + GIN index) scoped by `productId`, or `pg_trgm` for typo tolerance. Sanitise the query to `plainto_tsquery`/`websearch_to_tsquery`. **Phase:** FAQ.

### Comment and post spam on public, sign-in-only boards
**Prevention:** `@nestjs/throttler` per user and IP on create endpoints, max lengths, admin hide/delete, and an admin badge rendered from server-side membership, never from client input. **Phase:** Board.

---

## Minor Pitfalls

- **`__VINEXT_LINK_PREFETCH_ROUTES__` ships every route pattern, including `route.ts` handlers, to every browser** (vinext #3624, open). Don't put secrets or "hidden" admin paths in route names, and enforce auth regardless. **Phase:** Foundation.
- **Malformed URLs return 500 instead of 400** on the Nitro/h3 path (#3218). This is one more reason to use standalone, and to make sure error monitoring doesn't page on them. **Phase:** Deploy.
- **`next/image` on the Node server does no resizing** (#3446). Serve the API's pre-sized WebP variants with plain `<img>` or `next/image unoptimized`, and generate 2-3 widths at upload time if needed. **Phase:** Changelog.
- **`next/font/google` loads from the Google CDN at runtime** under vinext rather than self-hosting it. This has privacy and GDPR implications for EU customers' portals; use `next/font/local` or a self-hosted font file. **Phase:** Foundation (design system).
- **Timezones for the internal deadline field.** Store dates as `date` (not `timestamp`) when they mean a calendar day. **Phase:** Roadmap.
- **Changelog "publish" without a draft state, or scheduled publishing implemented with `publishedAt > now()` but cached.** All routes are dynamic in v1 (Pitfall 6), which avoids the stale case. **Phase:** Changelog.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep NextAuth because "the PRD says so" | No decision churn | Unsupported under vinext; maintenance-mode library; possible mid-project auth rewrite | Never without a passing production-build spike |
| Nitro `node` preset instead of `output: "standalone"` | "Officially multi-platform" | Beta dependency; open 500-on-every-route chunk-split bug (#3478) | Never for v1 |
| Fetch full Prisma rows and hide fields in the UI | Faster to write | Privacy leak of internal roadmap fields, the product's worst failure | Never for public endpoints |
| Tenant check by URL slug only | Simple guards | IDOR across workspaces | Never |
| `onDelete: Cascade` on status FKs | Deleting statuses "just works" | Silent mass deletion of posts | Never |
| Denormalised `voteCount` with no reconcile | Fast sorting | Drift and wrong "Top Voted" order | OK if the increment is transactional and a reconcile job exists |
| `force-dynamic` everywhere, no caching | Removes a whole class of cache-leak bugs on a moving vinext cache implementation | Higher DB load | Acceptable for all of v1 (MVP scale) |
| Capability-URL (unguessable) uploads with no auth | Simple static serving | Private-product images shareable forever | Acceptable for logos; not for private-product changelog images |
| Single API replica | Local volume just works | No horizontal scale | Acceptable for v1; move to S3-compatible storage before scaling out |
| "Login-required" = any OAuth user | Trivial to build | Customers misunderstand it as private | Only with honest labelling; plan an access list |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| vinext standalone in Docker | Using `HOSTNAME`; forgetting `NODE_ENV` | `HOST=0.0.0.0`, `PORT`, `NODE_ENV=production` (#3444) |
| vinext behind Traefik (Dokploy) | Not trusting `X-Forwarded-Proto`, so `http://` callback URLs | `VINEXT_TRUST_PROXY=1` or `VINEXT_TRUSTED_HOSTS=<domain>` |
| vinext + pnpm + Radix | `import { Slot } from "radix-ui"` barrel, so the build hangs | Import `@radix-ui/react-slot` etc. directly until PR #3516 lands |
| vinext + Tailwind v4 | PostCSS string-form plugin config | `@tailwindcss/vite` in `vite.config.ts` (#3240, #1128) |
| vinext + Better Auth (dev) | RSC dep re-optimisation causing hang or 500 | `environments.rsc.optimizeDeps.include: ["better-auth", "better-auth/next-js", "better-auth/plugins"]` (#2813) |
| Prisma 7 | Expecting auto `.env` loading and `node_modules` client | `prisma.config.ts`, explicit generator `output`, `@prisma/adapter-pg`, `prisma generate` in the Docker build |
| Prisma migrate in prod | CLI in devDependencies; migrating from both containers | CLI as a prod dependency in the migrate step; API-only, pre-start, additive migrations |
| GitHub OAuth | One app for all environments | One OAuth App per environment (single callback URL each) |
| Google OAuth | Consent screen left in Testing | Publish before launch; exact redirect URIs per environment |
| Dokploy mounts | Absolute host bind paths, repo-relative mounts | Named volumes (backup-able) or `../files` for Compose |
| sharp | Default pixel limit, extension-based type checks | `limitInputPixels`, `failOn: "warning"`, format from decoded metadata, `.rotate()` |
| NestJS serialization | `@Exclude()` on DTO classes with Prisma plain objects | Explicit `select` + mapper functions + key-set contract tests |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `COUNT(*)` votes per post on every board render | Slow "Top Voted" list | Transactional `voteCount` column + index `(productId, voteCount DESC)` | ~10k votes per product |
| N+1 on board (status, category, author, myVote per post) | Board loads in seconds | Single query with `select`; `myVote` via one `IN` query | ~100 posts per page |
| Synchronous sharp in the request path, unbounded | API latency spikes, OOM | Concurrency cap + queue + pixel limit | A few concurrent large uploads |
| `force-dynamic` + no DB pooling | Connection exhaustion | Prisma pg adapter pool sized for the API, web never touching DB directly (BFF) | ~50 concurrent requests |
| FAQ `ILIKE '%q%'` | Slow search | `tsvector` GIN index | ~5k FAQ rows (unlikely in v1) |
| Kanban reorder renumbering entire columns | Write amplification, conflicts | Fractional indexing | Columns with 100+ items |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tenant derived from client body or slug only | Cross-workspace read/write | Server-side tenant resolver + scoped queries + composite FKs |
| Public endpoints using `include`/spread | Internal roadmap data leak | Separate internal table, allowlisted `select`, canary-string tests |
| Unsanitised changelog HTML on a shared origin | Stored XSS across **all** tenants | Structured JSON + server allowlist render + CSP |
| Serving uploaded originals / client filenames | Polyglot XSS, path traversal | Re-encode to WebP, UUID names, `nosniff`, separate upload origin |
| Trusting `x-user-id` from the web app | Full impersonation | DB sessions validated in NestJS; API internal-only |
| Implicit OAuth linking on unverified email | Account takeover incl. admin rights | Verified-email-only linking; explicit link flow |
| "Private" product = any signed-in user | Confidential beta roadmap visible to the world | Honest label now; email/domain access list |
| Metadata/OG/sitemap bypassing access checks | Private titles unfurled publicly | `assertCanViewProduct` in every metadata route |
| Invite links as bearer tokens with no email match | Stranger becomes workspace admin | Invite accept requires matching verified email; single-use, expiring |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loop-closing without email | Voters never learn outcomes and stop engaging | Post timeline, "Shipped in <changelog>", "My feedback" status-change badge |
| No duplicate merge | Votes fragmented; admins can't rank demand | Manual merge with vote dedupe + redirect |
| `OAuthAccountNotLinked` dead end | Users think login is broken, create duplicate accounts | Clear message naming the original provider + explicit linking in settings |
| Toggle vote with no in-flight lock | Flicker, lost votes | Idempotent PUT/DELETE + disabled button during the request |
| Statuses only as names | "Done" logic breaks on rename | Fixed category enum behind editable names |
| Deleting a status with no reassignment UI | Fear of deleting, cluttered columns | Delete dialog with a required "move items to..." select |
| Public roadmap with dates | Customers treat dates as promises | Keep deadlines internal (already planned); show only columns |

## "Looks Done But Isn't" Checklist

- [ ] **Auth:** works in `vite dev` but untested in the `dist/standalone` Docker build behind Traefik. Verify sign-in, callback, RSC `auth()`, a protected Server Action, and sign-out in the deployed container.
- [ ] **Tenancy:** guards exist but there is no second-workspace test. Verify that the cross-tenant matrix test calls every admin endpoint with foreign IDs and gets 404.
- [ ] **Public roadmap:** the UI hides fields, but verify that a canary string in `internalNotes` is absent from the public JSON **and** from the rendered portal HTML/RSC payload.
- [ ] **Linked posts:** verify that a public post page linked to a **non-public** roadmap item reveals neither the item nor a private status.
- [ ] **Private product:** verify that `curl` (no cookie) to every public API route, `/sitemap.xml`, the OG image route, and the RSS feed returns 404 or excludes it.
- [ ] **Votes:** verify that 50 parallel `PUT /vote` calls from one user leave exactly 1 row and `voteCount` equals `COUNT(*)`.
- [ ] **Status delete:** verify that deleting a status with posts requires reassignment, that the default and last statuses are protected, and that no posts are orphaned.
- [ ] **Changelog XSS:** verify that `<img src=x onerror=alert(1)>` and `[x](javascript:alert(1))` are neutralised when saved and rendered, and that the CSP header is present on the vinext build.
- [ ] **Uploads:** verify that a 30000x30000 PNG is rejected without OOM, that SVG and HTML disguised as `.png` are rejected, that the stored file is `<uuid>.webp`, and that it is served with `nosniff`.
- [ ] **Uploads persistence:** verify that uploads survive a Dokploy redeploy and container recreation, that the volume is in Dokploy Volume Backups, and that the restore drill was done once.
- [ ] **Migrations:** verify that the API boots from a fresh DB, that a second deploy with a new migration works, and that the web image contains no Prisma CLI.
- [ ] **OAuth envs:** verify separate GitHub OAuth apps per environment and that the Google consent screen is published.
- [ ] **Invites:** verify that an invite cannot be accepted by a user whose verified email differs.
- [ ] **Escape hatch:** verify that `next build` still succeeds in CI (canary job), and that no `import.meta.env` or `vinext/*` imports exist in app code.
- [ ] **Deploy skew:** verify that an admin tab open across a deploy gets a "reload" prompt instead of silently failing Server Actions (#3604).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth library unsupported mid-project | HIGH if sessions are JWT-coupled to NestJS; MEDIUM with DB sessions | Swap to Better Auth with the same User/Account tables (its schema maps closely to Auth.js's), migrate sessions by forcing re-login |
| vinext blocking gap | LOW-MEDIUM (0.5-1 day) if Pitfall 3 rules were followed | Switch to `next build` + `.next/standalone`, Tailwind to PostCSS, update Dockerfile env (`HOSTNAME`) |
| Internal field leaked publicly | HIGH (trust) | Hotfix the endpoint allowlist, purge any CDN or proxy cache, audit access logs, notify affected workspaces |
| Cross-tenant IDOR found | HIGH | Patch with scoped queries, add a matrix test, audit logs for foreign-ID access |
| Uploads lost on redeploy | HIGH (data gone) unless backups exist | Restore from volume backup; fix the mount path + boot probe |
| Vote count drift | LOW | Run the reconcile job |
| Status delete orphaned posts | MEDIUM | Reassign `statusId IS NULL` (or broken FK) rows to the product's default status; add Restrict FK |
| Failed migration (P3009) | LOW-MEDIUM | Fix the migration, then `prisma migrate resolve --rolled-back <name>`, then redeploy |
| Duplicate users from unlinked OAuth | MEDIUM | Admin merge tool: move accounts, votes (dedupe), comments, memberships to the surviving user |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. NextAuth unsupported under vinext | Foundation/Auth (Phase 0 spike) | Auth flow passes in the deployed standalone container |
| 2. vinext Node output immaturity | Foundation (walking skeleton) + Deploy | Dokploy-deployed skeleton: RSC page, Server Action, OAuth, API call |
| 3. Expensive `next build` fallback | Foundation (lint rules, CI canary) | CI `next build` job green; restricted-import lint passes |
| 4. Cross-tenant IDOR | Foundation/Tenancy, then every feature phase | Cross-tenant matrix test in CI |
| 5. Roadmap internal-field leak | Foundation (public/admin module split) + Roadmap | Canary-string tests on JSON and HTML |
| 6. Private portal leaks | Foundation/Tenancy (semantics + `assertCanViewProduct`), then Board/Roadmap/Changelog/FAQ/Deploy | Unauthenticated curl suite against a private product |
| 7. Status semantics and deletion | Statuses (before Board and Roadmap) | Delete-with-reassign tests; category-driven "Done" logic |
| 8. Vote integrity | Feedback Board | Concurrency test: 50 parallel votes leave 1 row, no drift |
| 9. Changelog XSS | Changelog (CSP baseline in Foundation) | XSS payload tests + CSP header check |
| 10. Upload attacks | Foundation (pipeline for logos) + Changelog | Bomb, polyglot, SVG, and traversal test files |
| 11. Web/API auth trust | Foundation/Auth | API unreachable publicly or rejects forged headers; session validated against DB |
| 12. Volume persistence and permissions | Foundation (UPLOAD_DIR, chown, probe) + Deploy | Upload, redeploy, image still served; backup configured |
| 13. Prisma migrations at start | Foundation (Prisma 7 setup) + Deploy | Fresh-DB boot + second-migration deploy succeed |
| 14. OAuth linking and callbacks | Foundation/Auth + Deploy | Same-email cross-provider test; per-env OAuth apps |
| 15. Graveyard boards / no loop closing | Board (merge, timeline), Roadmap (sync), Changelog (link back) | "My feedback" shows status changes; changelog entries link posts |

## Sources

**vinext primary sources (HIGH; read 2026-10-01 via `gh` against cloudflare/vinext):**
- README: known gaps, standalone output, `HOST` vs `HOSTNAME`, env var inlining, Nitro section, API coverage table. https://github.com/cloudflare/vinext
- Release `vinext@1.0.0` (2026-09-28): https://github.com/cloudflare/vinext/releases/tag/vinext%401.0.0
- `packages/vinext/src/check.ts`: next-auth and @auth/nextjs "unsupported"; better-auth "supported"; prisma and tailwindcss "supported"
- `packages/vinext/src/server/request-pipeline.ts`: `validateCsrfOrigin` for Server Actions
- `packages/vinext/src/server/proxy-trust.ts`: `VINEXT_TRUST_PROXY`, `VINEXT_TRUSTED_HOSTS`
- `tests/fixtures/ecosystem/better-auth`: Better Auth ecosystem test fixture
- Issues: #727 (auth guidance, maintainer recommends Better Auth), #2688 (next-auth Set-Cookie bug), #2813 (Better Auth dev hang), #3444, #3443, #3486, #3485 (standalone), #3483 + PR #3516 (radix-ui barrel under pnpm hangs build), #3478, #3431, #3427, #3439 (Nitro), #3446 (Node image optimizer), #3604, #3626 (deploy skew and Server Actions), #3217 (middleware vs static assets), #3218 (malformed URL 500), #3240, #1128 (Tailwind v4), #3205 (CSP nonces), #3624 (route patterns shipped to browser), #2109 (experimental React / taint), #1453, #1937, #3641 (`use cache` private semantics), #2725, #2007 (metadata)

**Auth ecosystem:**
- Auth.js is now part of Better Auth: https://better-auth.com/blog/authjs-joins-better-auth and https://github.com/nextauthjs/next-auth/discussions/13252 (MEDIUM, cross-verified)
- npm registry dist-tags (2026-10-01): `next-auth` latest 4.24.15, beta 5.0.0-beta.32; `better-auth` latest 1.7.7; `vinext` latest 1.0.0; `next` latest 16.3.8; `@prisma/client` latest 7.10.0; `sharp` 0.35.5; `nitro` 3.0.260903-beta (HIGH)
- Better Auth account-linking docs and source (`link-account.ts`, options reference): trustedProviders, requireLocalEmailVerified, disableImplicitLinking (MEDIUM via Context7)

**Official docs via Context7 (MEDIUM per seam, first-party):**
- Next.js data security guide: DAL, DTOs, Server Actions as separate entry points, `server-only`
- Prisma 7 upgrade guide: required generator `output`, `prisma.config.ts`, no auto `.env`, driver adapters; deploy docs: CLI must be available in prod; advisory lock with a 10 s timeout; `migrate resolve` for P3009
- sharp constructor docs: `limitInputPixels` default 268402689, `failOn: "warning"` for untrusted input, SVG to PNG default

**Dokploy:**
- https://docs.dokploy.com/docs/core/docker-compose: absolute paths cleaned on deploy, `../files`, named volumes required for Volume Backups (MEDIUM)
- https://docs.dokploy.com/docs/core/applications/advanced: bind, volume, and file mounts (MEDIUM)
- Community reports of volume persistence issues: https://github.com/Dokploy/dokploy/issues/245, https://github.com/Dokploy/dokploy/issues/2171, https://github.com/Dokploy/dokploy/discussions/2395 (LOW-MEDIUM)

**Inferred / experience-based (flagged inline):** NestJS `@Exclude` vs Prisma plain objects; Docker named-volume ownership seeding; the "login-required is not private" semantics; feedback-board graveyard dynamics; GitHub OAuth single-callback limit; Google Testing-mode restriction; the `pnpm deploy` inject-workspace-packages requirement; vinext runtime env behaviour in standalone (verify in Phase 0).

---
*Pitfalls research for: multi-tenant customer feedback / public roadmap / changelog SaaS on vinext + NestJS + Prisma + Dokploy*
*Researched: 2026-10-01*
