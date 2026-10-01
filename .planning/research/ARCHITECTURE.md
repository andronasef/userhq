# Architecture Research

**Domain:** Multi-tenant customer feedback, public roadmap, changelog and FAQ SaaS (Canny / Featurebase / Productboard-portal class)
**Researched:** 2026-10-01
**Confidence:** HIGH for structure and data model; MEDIUM for the vinext/NextAuth integration (unverified in this stack, must be proven in Phase 1)

> Locked inputs (PROJECT.md): pnpm monorepo `apps/web` (Next.js 16 built by vinext), `apps/api` (NestJS), `packages/db` (Prisma), `packages/types`; Postgres; NextAuth OAuth-only; WebP via sharp in the API only; local-disk uploads on a Docker volume; two Docker images on Dokploy. This document does not reopen those choices.

---

## Standard Architecture

### System Overview

One public origin. Traefik (managed by Dokploy) routes by path, so the browser sees one site and the NextAuth session cookie reaches both the web and API containers with no CORS and no cross-domain cookie setup.

```
                           Browser  (https://userhq.app)
                                │
┌───────────────────────────────┴──────────────────────────────────────────┐
│                     Traefik (Dokploy-managed), path routing               │
│   /api/v1/*  ──► api:4000        /uploads/*  ──► api:4000                 │
│   everything else (incl. /api/auth/*)  ──► web:3000                       │
└───────────┬───────────────────────────────────────────┬──────────────────┘
            │                                           │
┌───────────┴──────────────────────┐      ┌─────────────┴────────────────────────────┐
│ apps/web (vinext → Node/Nitro)   │      │ apps/api (NestJS)                        │
│                                  │      │                                          │
│  Portal routes  /[ws]/[product]  │ RSC  │  SessionGuard (cookie/Bearer → Session)  │
│  Admin routes   /dashboard/...   │─────►│  Tenancy guards (member / portal)        │
│  NextAuth  /api/auth/*           │ http │  ┌─────────────┐  ┌──────────────────┐   │
│  TenantLocator + portalHref()    │ (int │  │ admin/*     │  │ public/*         │   │
│                                  │ net) │  │ controllers │  │ controllers      │   │
│  Prisma use: NextAuth adapter    │      │  │ full DTOs   │  │ allowlist select │   │
│  ONLY (auth tables)              │      │  └──────┬──────┘  └────────┬─────────┘   │
└───────────┬──────────────────────┘      │         └────────┬─────────┘             │
            │                             │   Domain services (productId-scoped)     │
            │                             │   UploadService (multer → sharp → disk)  │
            │                             └──────────┬──────────────────┬────────────┘
            │                                        │                  │
┌───────────┴────────────────────────────────────────┴───┐   ┌──────────┴──────────┐
│ PostgreSQL (Docker volume: pgdata)                      │   │ Volume: uploads     │
│  auth tables · tenancy · feedback · roadmap · changelog │   │ /data/uploads/...   │
│  · faq · uploads metadata                               │   │ (API container only)│
└─────────────────────────────────────────────────────────┘   └─────────────────────┘
```

### Component Responsibilities

| Component | Responsibility (owns) | Implementation |
|-----------|----------------------|----------------|
| **Traefik (Dokploy)** | TLS, path routing to two containers | Dokploy domain entries with `Path` per app (`/api/v1`, `/uploads` → api; `/` → web). Do **not** enable Strip Path for the API; Nest uses global prefix `api/v1`. |
| **apps/web — portal** | End-user pages: board, post detail, roadmap, changelog, FAQ, product list | App Router under `app/[workspace]/[product]/...`, RSC fetches from public API endpoints only |
| **apps/web — dashboard** | Admin UI: workspace/product settings, members, invites, triage, Kanban, changelog editor, FAQ editor | App Router under `app/dashboard/[workspace]/[product]/...`, fetches admin endpoints |
| **apps/web — auth** | OAuth sign-in, session cookie issuance, User/Account/Session rows | NextAuth with Prisma adapter, **database session strategy**. The only place web imports `packages/db`. |
| **apps/web — TenantLocator** | Map request (host + path) → `{workspaceSlug, productSlug}`; build portal links | `lib/tenant.ts` + `portalHref()`; the single seam for future subdomains |
| **apps/api — SessionGuard** | Authenticate every request: read session cookie (browser) or forwarded cookie/Bearer (RSC), look up `Session`, attach `user` | Global guard; `@Public()` opt-out for anonymous portal reads |
| **apps/api — Tenancy guards** | Resolve product/workspace from route, check Membership (admin routes) or visibility (portal routes), attach `ProductContext` to `req` | `WorkspaceMemberGuard`, `ProductAdminGuard`, `PortalGuard` + `@CurrentProduct()` param decorator |
| **apps/api — admin controllers** | All authenticated admin writes and reads, full fields | Per feature: `feature/admin/*.controller.ts` |
| **apps/api — public controllers** | Anonymous/end-user reads, plus end-user writes (post, vote, comment) | Per feature: `feature/public/*.controller.ts`, each read uses an exported allowlist `select` + explicit mapper |
| **apps/api — domain services** | Business rules: status sync, vote counting, status deletion w/ reassignment, invites | Plain singleton Nest providers taking `productId` explicitly |
| **apps/api — UploadService** | Validate, re-encode to WebP, write to volume, record `Upload` row, serve `/uploads/*` | Multer memory storage → sharp → atomic write; `express.static` on the volume |
| **packages/db** | Prisma schema, migrations, generated client, client factory, seed | Prisma 7 `prisma-client` generator with explicit `output`, `@prisma/adapter-pg` |
| **packages/types** | Shared zod schemas (request DTOs), public response types, constants (reserved slugs, default statuses) | Plain TS, no runtime deps beyond zod |
| **PostgreSQL** | All state except image bytes | Docker volume, `pg_dump` backups |
| **Uploads volume** | Image bytes | Mounted into API container only |

---

## Recommended Project Structure

```
userhq/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── page.tsx                         # marketing / landing
│   │   │   ├── signin/                          # OAuth buttons
│   │   │   ├── api/auth/[...nextauth]/route.ts  # NextAuth handlers (web-owned)
│   │   │   ├── invite/[token]/                  # invite acceptance
│   │   │   ├── dashboard/                       # ADMIN app (member-only)
│   │   │   │   ├── page.tsx                     # my workspaces
│   │   │   │   ├── new/                         # create workspace
│   │   │   │   └── [workspace]/
│   │   │   │       ├── settings/  members/
│   │   │   │       └── [product]/
│   │   │   │           ├── feedback/  roadmap/  changelog/  faq/  settings/
│   │   │   └── [workspace]/                     # PUBLIC portal
│   │   │       ├── page.tsx                     # product list
│   │   │       └── [product]/
│   │   │           ├── page.tsx                 # feedback board
│   │   │           ├── posts/[postId]/
│   │   │           ├── roadmap/  changelog/  faq/
│   │   ├── lib/
│   │   │   ├── tenant.ts                        # TenantLocator, portalHref()
│   │   │   ├── api/server.ts                    # RSC fetch → API_INTERNAL_URL, forwards cookie
│   │   │   ├── api/browser.ts                   # client fetch → same-origin /api/v1
│   │   │   └── auth.ts                          # NextAuth config (only packages/db importer)
│   │   └── proxy.ts                             # (Next 16 middleware) — future subdomain rewrite lives here
│   └── api/
│       └── src/
│           ├── main.ts                          # global prefix api/v1, static /uploads
│           ├── prisma/prisma.service.ts
│           ├── auth/                            # SessionGuard, @CurrentUser, @Public
│           ├── tenancy/                         # guards, @CurrentProduct, ProductContext, slug resolver
│           ├── workspaces/  members/  invites/
│           ├── products/                        # create (+ seed statuses), visibility toggle
│           ├── statuses/  categories/
│           ├── feedback/    { admin/, public/, feedback.service.ts, votes.service.ts }
│           ├── roadmap/     { admin/, public/, roadmap.service.ts, status-sync.service.ts }
│           ├── changelog/   { admin/, public/, changelog.service.ts, html-sanitizer.ts }
│           ├── faq/         { admin/, public/, faq.service.ts }
│           └── uploads/     { uploads.controller.ts, uploads.service.ts }
├── packages/
│   ├── db/        { prisma/schema.prisma, prisma/migrations/, prisma.config.ts, src/index.ts, seed.ts }
│   └── types/     { src/dto/*.ts (zod), src/public/*.ts (response types), src/reserved-slugs.ts, src/default-statuses.ts }
├── docker/        { web.Dockerfile, api.Dockerfile }
└── pnpm-workspace.yaml
```

### Structure Rationale

- **`dashboard/` and `[workspace]/` are sibling route trees, not nested.** The admin app never shares layouts or data loaders with the portal, so a public page cannot accidentally render admin-fetched data. It also means that when portals move to subdomains later, only the portal tree moves; the dashboard stays on the main host.
- **`admin/` vs `public/` subfolders per feature in the API.** Keeps domain cohesion (roadmap code stays together) while making the audience boundary visible in the file path, which is what an ESLint `no-restricted-imports` rule can enforce (`**/public/**` may not import `**/admin/**`).
- **`packages/types` holds zod request schemas and explicit public response types.** The web forms and the API pipe validate with the same schema; public response types are hand-written interfaces (not Prisma-derived) so adding a column to the database never widens a public type.
- **web imports `packages/db` in exactly one file (`lib/auth.ts`).** The NextAuth Prisma adapter needs it; nothing else in web touches the database. Enforce with `no-restricted-imports`.

---

## 1. Prisma Data Model

Conventions: `String @id @default(cuid())` everywhere (matches the Auth.js adapter schema); every tenant-owned table carries `productId` directly (denormalized where it could be derived via a join) so every scoped query is a single-column filter; `onDelete` chosen deliberately per relation (Restrict where silent loss would hurt).

```prisma
generator client {
  provider = "prisma-client"            // Prisma 7: Rust-free client, output required
  output   = "../src/generated/prisma"
}
datasource db { provider = "postgresql" } // URL lives in prisma.config.ts (Prisma 7)

enum Role              { ADMIN }          // OWNER / VIEWER added later = additive enum values
enum ProductVisibility { PUBLIC PRIVATE }  // PRIVATE = login required to view portal
enum UploadPurpose     { WORKSPACE_LOGO PRODUCT_LOGO CHANGELOG_IMAGE }

// ───────────── Auth.js (NextAuth) adapter tables — shape dictated by @auth/prisma-adapter ─────────────
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())

  accounts    Account[]
  sessions    Session[]
  memberships Membership[]
  posts       Post[]
  votes       Vote[]
  comments    Comment[]
  assignedRoadmapItems RoadmapItemInternal[]
}

model Account {                       // one row per OAuth identity (Google, GitHub; credentials in v2)
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {                       // database strategy: API validates by looking this up
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model VerificationToken {             // unused in v1; present so magic-link in v2 is a provider add, not a migration
  identifier String
  token      String
  expires    DateTime
  @@unique([identifier, token])
}

// ───────────── Tenancy ─────────────
model Workspace {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique              // validated against RESERVED_SLUGS
  logoUploadId String?
  createdAt    DateTime @default(now())

  logo        Upload?      @relation("WorkspaceLogo", fields: [logoUploadId], references: [id], onDelete: SetNull)
  memberships Membership[]
  invites     Invite[]
  products    Product[]
  uploads     Upload[]
}

model Membership {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        Role     @default(ADMIN)
  createdAt   DateTime @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, userId])     // the membership check is a unique lookup
  @@index([userId])                   // "my workspaces"
}

model Invite {                        // no email sending in v1: link is copied by admin AND auto-matched on sign-in
  id          String    @id @default(cuid())
  workspaceId String
  email       String                  // lowercased on write
  role        Role      @default(ADMIN)
  tokenHash   String    @unique       // store sha256(token), never the raw token
  invitedById String?
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@unique([workspaceId, email])      // re-invite = upsert (new token, new expiry)
  @@index([email])                    // auto-accept lookup at sign-in
}

model Product {
  id           String            @id @default(cuid())
  workspaceId  String
  name         String
  slug         String
  visibility   ProductVisibility @default(PUBLIC)
  logoUploadId String?
  createdAt    DateTime          @default(now())

  workspace  Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  logo       Upload?   @relation("ProductLogo", fields: [logoUploadId], references: [id], onDelete: SetNull)
  statuses   Status[]
  categories Category[]
  posts      Post[]
  roadmapItems     RoadmapItem[]
  changelogEntries ChangelogEntry[]
  changelogTags    ChangelogTag[]
  faqCategories    FaqCategory[]
  faqItems         FaqItem[]
  @@unique([workspaceId, slug])       // portal resolution: (workspace.slug, product.slug)
}

// ───────────── Shared statuses ─────────────
model Status {
  id            String   @id @default(cuid())
  productId     String
  name          String
  color         String                // hex token
  position      Int                   // column order; small list, renumber on reorder
  isDefault     Boolean  @default(false) // new posts land here; exactly one per product
  showOnRoadmap Boolean  @default(true)  // lets "Open"/"Closed" exist for posts without being Kanban columns
  createdAt     DateTime @default(now())

  product      Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  posts        Post[]
  roadmapItems RoadmapItem[]
  @@unique([productId, name])
  @@index([productId, position])
  // + raw-SQL migration: CREATE UNIQUE INDEX ... ON "Status"("productId") WHERE "isDefault";
  //   (or Prisma 7.4+ `partialIndexes` preview: @@unique([productId], where: { isDefault: true }))
}

// ───────────── Feedback ─────────────
model Category {
  id        String @id @default(cuid())
  productId String
  name      String
  position  Int    @default(0)
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  posts   Post[]
  @@unique([productId, name])
}

model Post {
  id            String   @id @default(cuid())
  productId     String
  authorId      String?                  // SetNull: deleting a user must not delete feedback
  categoryId    String?
  statusId      String
  roadmapItemId String?                  // the item↔post link (see §4)
  title         String
  body          String   @db.Text
  voteCount     Int      @default(0)     // denormalized (see §5)
  commentCount  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  product     Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  author      User?        @relation(fields: [authorId], references: [id], onDelete: SetNull)
  category    Category?    @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  status      Status       @relation(fields: [statusId], references: [id], onDelete: Restrict)
  roadmapItem RoadmapItem? @relation(fields: [roadmapItemId], references: [id], onDelete: SetNull)
  votes       Vote[]
  comments    Comment[]

  @@index([productId, voteCount(sort: Desc), createdAt(sort: Desc)]) // Top Voted
  @@index([productId, createdAt(sort: Desc)])                          // Newest
  @@index([productId, categoryId])
  @@index([statusId])
  @@index([roadmapItemId])
}

model Vote {
  userId    String
  postId    String
  createdAt DateTime @default(now())
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([userId, postId])              // composite PK IS the one-vote-per-user rule
  @@index([postId])
}

model Comment {
  id            String   @id @default(cuid())
  productId     String                 // denormalized for uniform scoping
  postId        String
  authorId      String?
  body          String   @db.Text
  authorIsAdmin Boolean  @default(false) // snapshot of membership at write time → Admin badge
  createdAt     DateTime @default(now())
  post   Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  author User? @relation(fields: [authorId], references: [id], onDelete: SetNull)
  @@index([postId, createdAt])
  @@index([productId])
}

// ───────────── Roadmap (dual-layer, split tables — see §3) ─────────────
model RoadmapItem {                   // PUBLIC-SAFE columns only
  id                String    @id @default(cuid())
  productId         String
  statusId          String
  position          String               // fractional index within a status column
  isPublic          Boolean   @default(false)
  publicTitle       String?              // required when isPublic (CHECK constraint)
  publicDescription String?   @db.Text
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  product  Product              @relation(fields: [productId], references: [id], onDelete: Cascade)
  status   Status               @relation(fields: [statusId], references: [id], onDelete: Restrict)
  internal RoadmapItemInternal?
  posts    Post[]
  @@index([productId, statusId, position])
  @@index([productId, isPublic])
  // raw-SQL migration: ALTER TABLE "RoadmapItem" ADD CONSTRAINT public_needs_title
  //   CHECK (NOT "isPublic" OR "publicTitle" IS NOT NULL);
}

model RoadmapItemInternal {           // ADMIN-ONLY columns, 1:1, never selected by public code
  itemId        String    @id
  title         String               // internal working title shown on the Kanban card
  notes         String?   @db.Text
  assigneeId    String?              // must be a workspace member (validated in service)
  targetDate    DateTime?
  item     RoadmapItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  assignee User?       @relation(fields: [assigneeId], references: [id], onDelete: SetNull)
}

// ───────────── Changelog ─────────────
model ChangelogEntry {
  id          String    @id @default(cuid())
  productId   String
  authorId    String?
  title       String
  slug        String
  contentJson Json                    // editor document — source of truth for editing
  contentHtml String    @db.Text      // sanitized in the API on every write — what the portal renders
  publishedAt DateTime?               // null = draft
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  product Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  tags    ChangelogTag[]              // implicit m2m is fine for plain tagging
  @@unique([productId, slug])
  @@index([productId, publishedAt(sort: Desc)])
}

model ChangelogTag {
  id        String @id @default(cuid())
  productId String
  name      String                    // seeded: New Feature, Improvement, Fix
  color     String
  product Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  entries ChangelogEntry[]
  @@unique([productId, name])
}

// ───────────── FAQ ─────────────
model FaqCategory {
  id        String @id @default(cuid())
  productId String
  name      String
  slug      String
  position  Int    @default(0)
  product Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  items   FaqItem[]
  @@unique([productId, slug])
}

model FaqItem {
  id         String   @id @default(cuid())
  productId  String
  categoryId String
  question   String
  answer     String   @db.Text        // rendered (sanitized HTML or markdown)
  answerText String   @db.Text        // plain-text projection for search
  position   Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  category FaqCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  product  Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  @@index([productId, categoryId, position])
}

// ───────────── Uploads ─────────────
model Upload {
  id          String        @id @default(cuid())
  workspaceId String
  productId   String?
  uploaderId  String?
  purpose     UploadPurpose
  storageKey  String        @unique   // relative path on the volume, e.g. ws_abc/2026/10/<cuid>.webp
  width       Int
  height      Int
  bytes       Int
  createdAt   DateTime      @default(now())
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceLogoFor Workspace[] @relation("WorkspaceLogo")
  productLogoFor   Product[]   @relation("ProductLogo")
  @@index([workspaceId])
}
```

**Design notes that matter for the roadmap:**

- **Store `storageKey`, never a full URL.** The URL is built at read time (`/uploads/${key}`). This is the one cheap seam that makes a later move to S3-compatible storage a config change rather than a data migration.
- **Invites without email:** since email is out of scope, an invite is (a) a copyable link with a one-time token and (b) auto-accepted at sign-in when the OAuth identity's **verified** email matches a pending invite. Only trust verified emails (GitHub may return a private or unverified address).
- **Reserved slugs:** `Workspace.slug` lives at the URL root, so it must reject `dashboard`, `api`, `uploads`, `signin`, `invite`, `_next`, `assets`, `favicon.ico`, `robots.txt`, `sitemap.xml`, etc. Keep the list in `packages/types/reserved-slugs.ts` and use it in both the zod schema and the route tree review.
- **Seed on product creation**, inside the same transaction: default statuses (from `packages/types/default-statuses.ts`, one `isDefault`), default changelog tags, optionally a "General" category.

---

## 2. Multi-Tenant Isolation

**Recommendation: route-scoped guards that resolve and authorize the tenant once per request, plus a hard rule that every tenant-owned query filters by `productId` (or `workspaceId`) taken from that resolved context — enforced by a cross-tenant e2e test suite.** No Postgres RLS, no auto-injecting Prisma extension, no REQUEST-scoped providers in v1.

### How it works

```
GET /api/v1/products/:productId/posts/:postId
  │
  ├─ SessionGuard        → req.user                       (401 if no valid session)
  ├─ ProductAdminGuard   → load Product by :productId
  │                        check Membership(workspaceId, user.id) via @@unique lookup
  │                        → req.product = { id, workspaceId, slug, visibility }   (404 if not member)
  └─ Controller          → service.getPost(ctx.productId, postId)
                             prisma.post.findFirst({ where: { id: postId, productId } })   (404 if other tenant)
```

```typescript
// tenancy/current-product.decorator.ts
export const CurrentProduct = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ProductContext => ctx.switchToHttp().getRequest().product,
);

// feedback/admin/posts.admin.controller.ts
@Controller('products/:productId/posts')
@UseGuards(ProductAdminGuard)
export class PostsAdminController {
  @Patch(':postId')
  update(@CurrentProduct() p: ProductContext, @Param('postId') postId: string, @Body() dto: UpdatePostDto) {
    return this.posts.update(p.id, postId, dto);       // service signature forces productId first
  }
}

// feedback/feedback.service.ts — the invariant: no child id without productId
async update(productId: string, postId: string, dto: UpdatePostDto) {
  const { count } = await this.prisma.post.updateMany({ where: { id: postId, productId }, data: dto });
  if (count === 0) throw new NotFoundException();
}
```

Three guards cover every route:

| Guard | Routes | Resolves from | Authorizes |
|-------|--------|---------------|------------|
| `WorkspaceMemberGuard` | `/workspaces/:workspaceId/...` | `:workspaceId` | Membership exists |
| `ProductAdminGuard` | `/products/:productId/...` | `:productId` → product → workspace | Membership in product's workspace |
| `PortalGuard` | `/portal/:workspaceSlug/:productSlug/...` | slugs → product | `visibility = PUBLIC`, or a signed-in user if `PRIVATE` |

### Why this and not the alternatives

| Option | Verdict | Reason |
|--------|---------|--------|
| **Guards + explicit `productId` in every query** | **Recommended** | Explicit, debuggable, zero magic, no per-query overhead. Tenant is visible in every service signature, so code review and tests can check it. Works for both admin (id-based) and portal (slug-based) routes. |
| Nest REQUEST-scoped tenant provider | Reject | Nest docs: a request-scoped provider makes every consumer up the injection chain request-scoped, so controllers and services get re-instantiated per request. Pure cost, no extra safety over passing `productId`. |
| `nestjs-cls` (AsyncLocalStorage) tenant context | Not needed in v1 | Fine and cheap, but it hides the tenant again; explicit parameters are simpler at this size. Adopt later only if a deep call chain makes threading `productId` painful. |
| Prisma client extension auto-injecting `where.productId` | Reject | Looks safe, isn't: `findUnique` only accepts unique fields, nested writes/relation filters and `$queryRaw` bypass it, and global tables (User, Workspace, Session) need exemptions. Creates false confidence. |
| Postgres RLS via extension + `set_config` | Defer (v2 hardening option) | Strongest guarantee, but every query becomes a transaction with `set_config`, Prisma documents that extensions calling client-level methods ignore enclosing interactive transactions, the portal must read across tenants by slug before a tenant is known (bypass policy), and migrations need a separate owner role. Too much machinery for a two-level `productId` filter. |

### What makes the rule enforceable

1. **Schema:** `productId` on every tenant-owned table (including `Comment`), so the filter is always one column, never a join someone forgets.
2. **Signatures:** services take `(productId, childId, ...)`. A child id alone is never accepted.
3. **Writes use `updateMany`/`deleteMany` with `{ id, productId }`** and treat `count === 0` as 404, which avoids find-then-update race windows.
4. **Cross-tenant e2e suite, built in the tenancy phase and grown with every feature:** seed two workspaces A and B; for every admin route, call as an A-member with B's ids and assert 404; for every portal route, call product B's PRIVATE portal anonymously and assert 401. This test is the actual enforcement mechanism; the rules above make it pass.

---

## 3. Dual-Layer Roadmap Privacy

**Recommendation: a "public read model" pattern — internal fields live in a separate 1:1 table (`RoadmapItemInternal`), public controllers live in `public/` folders and query only through an exported allowlist `select` plus an explicit mapper to a hand-written public response type, and a contract test asserts the exact key set of every public response.**

The structural part is the table split: Prisma returns all **scalar** fields when no `select` is given, but **never** returns relations unless asked. With internal data in a relation, a lazy `findMany()` in a public code path cannot leak notes, assignee, or deadline. The leak requires someone to write `include: { internal: true }` in a `public/` file, which is greppable and lintable.

```typescript
// roadmap/public/public-roadmap.select.ts — the ONLY shape public code may read
export const publicRoadmapItemSelect = {
  id: true,
  publicTitle: true,
  publicDescription: true,
  status: { select: { id: true, name: true, color: true, position: true } },
  _count: { select: { posts: true } },
} satisfies Prisma.RoadmapItemSelect;

// packages/types/src/public/roadmap.ts — hand-written, not derived from Prisma
export interface PublicRoadmapItem {
  id: string; title: string; description: string | null;
  status: { id: string; name: string; color: string };
  linkedPostCount: number;
}

// roadmap/public/roadmap.public.controller.ts
@Public() @UseGuards(PortalGuard)
@Get('portal/:workspaceSlug/:productSlug/roadmap')
async list(@CurrentProduct() p: ProductContext): Promise<PublicRoadmapItem[]> {
  const rows = await this.prisma.roadmapItem.findMany({
    where: { productId: p.id, isPublic: true, status: { showOnRoadmap: true } },
    select: publicRoadmapItemSelect,
    orderBy: { position: 'asc' },
  });
  return rows.map(toPublicRoadmapItem);   // explicit field-by-field copy = allowlist
}
```

Layers, each catching a different mistake:

| Layer | Catches |
|-------|---------|
| Split table (`RoadmapItemInternal`) | Lazy `findMany()` without `select` |
| `public/` folder + ESLint `no-restricted-imports` (public may not import admin services/selects; no `internal` in public selects) | Reusing an admin service method in a public controller |
| Allowlist `select` + explicit mapper to `PublicRoadmapItem` | New columns added later silently widening responses |
| Contract test: `expect(Object.keys(body[0]).sort()).toEqual([...])` per public endpoint | Anything that slips past the above |
| DB `CHECK (NOT "isPublic" OR "publicTitle" IS NOT NULL)` | Making an item public with no public title, which tempts a fallback to the internal title |

**Do not** use `ClassSerializerInterceptor` + `@Exclude()` as the privacy mechanism. It is a denylist: every new internal field must remember to opt out, and forgetting means a leak. Allowlists fail closed.

**Other leak vectors to close in the same phase:**
- **Post → roadmap item:** a public post response must not embed its linked item. If later wanted, embed only `{ id, publicTitle }` and only when `isPublic`.
- **Admin pages in web:** dashboard RSC pages may pass full admin objects to client components, which serializes them into the HTML. That is acceptable only because dashboard routes are member-gated; portal routes must call `/portal/*` endpoints only.
- **Caching:** never put a cookie-authenticated admin fetch behind any shared cache. Portal fetches are `no-store` in v1 (they also carry per-user `hasVoted`).

---

## 4. Status Sync and Status Deletion

### Link model: `Post.roadmapItemId` (nullable FK), not a join table

An item has many posts; a post links to **at most one** item. A many-to-many link would make a post's status ambiguous when two linked items sit in different columns. One FK gives one source of truth and makes sync a single `updateMany`.

### Sync rule: write-through, item is authoritative while linked

| Event | Effect (one transaction) |
|-------|--------------------------|
| Link post → item | `post.roadmapItemId = item.id`, `post.statusId = item.statusId` |
| Item status changes (Kanban move) | update item `statusId`, `position`; `post.updateMany({ where: { roadmapItemId: item.id, productId }, data: { statusId } })` |
| Admin edits status of a **linked** post directly | Rejected with 409 ("status follows linked roadmap item: unlink first"). UI shows the status as read-only with the item name. |
| Unlink post | `roadmapItemId = null`; post **keeps** its current status |
| Item deleted | FK `SetNull` unlinks posts; posts keep their last status |
| Item made private/public | No effect on posts (post status is not secret; it closes the loop for voters) |

Why write-through rather than deriving status at read time (`post.roadmapItem?.statusId ?? post.statusId`): the board filters and displays by status on every list query; a stored `statusId` keeps those queries a plain indexed column with no join, and the sync code lives in exactly one service method (`StatusSyncService.moveItem`).

### Deleting a status: mandatory reassignment

`DELETE /products/:productId/statuses/:statusId?moveTo=:targetStatusId`

1. Reject if it is the product's last status, or if `moveTo` is missing while the status has posts or items. The UI always asks "Move N posts and M items to…".
2. In one transaction: `post.updateMany({ statusId → target })`, `roadmapItem.updateMany({ statusId → target })` (items get positions appended to the end of the target column), then delete the status.
3. If the deleted status was `isDefault`, the target becomes default in the same transaction.
4. Safety net: both FKs are `onDelete: Restrict`, so a buggy code path errors instead of orphaning rows.

Because linked posts already share their item's status, moving both sets to the same target keeps the sync invariant intact without extra logic.

---

## 5. Vote Counting

**Recommendation: denormalized `Post.voteCount`, maintained in the same transaction as the `Vote` insert/delete, with the `Vote` composite primary key as the idempotency guard.**

```typescript
async vote(productId: string, postId: string, userId: string) {
  await this.assertPostInProduct(productId, postId);
  try {
    await this.prisma.$transaction([
      this.prisma.vote.create({ data: { userId, postId } }),
      this.prisma.post.update({ where: { id: postId }, data: { voteCount: { increment: 1 } } }),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return;            // P2002: already voted, whole tx rolled back, counter untouched
    throw e;
  }
}

async unvote(productId: string, postId: string, userId: string) {
  await this.prisma.$transaction(async (tx) => {
    const { count } = await tx.vote.deleteMany({ where: { userId, postId, post: { productId } } });
    if (count === 1) await tx.post.update({ where: { id: postId }, data: { voteCount: { decrement: 1 } } });
  });
}
```

- **Why not `COUNT()`:** "Top Voted" is the default sort of the main page. Ordering by an aggregate means grouping the `Vote` table on every page view and cannot use an index for `ORDER BY ... LIMIT`. With a column, the sort is served directly by `@@index([productId, voteCount(sort: Desc), createdAt(sort: Desc)])`.
- **Correctness:** `increment` compiles to `SET "voteCount" = "voteCount" + 1` (atomic in Postgres); a double-click race produces one success and one P2002 that rolls back its own increment.
- **Repair:** keep a one-line admin/maintenance SQL (`UPDATE "Post" p SET "voteCount" = (SELECT count(*) FROM "Vote" v WHERE v."postId" = p.id)`) for drift after manual data fixes. No cron needed.
- **`hasVoted` for list pages:** one extra query per page, `vote.findMany({ where: { userId, postId: { in: pageIds } } })`, never N+1.
- **Pagination:** offset/limit for v1. Keyset pagination on a mutable sort key (`voteCount`) skips/duplicates rows anyway, and boards are small.
- Same pattern for `commentCount`.

---

## 6. Upload Pipeline

**Recommendation: browser → same-origin multipart POST to the API → multer memory storage with hard limits → sharp re-encodes to WebP → atomic write to the volume → `Upload` row → served by the API itself via `express.static` at `/uploads/*` with immutable caching.** Traefik cannot serve files from a volume (it is a proxy, not a file server), and a separate nginx/Caddy container is unnecessary at this scale.

```
Admin browser (changelog editor / logo picker)
   │  POST /api/v1/workspaces/:wsId/uploads   multipart, field "file", ?purpose=CHANGELOG_IMAGE&productId=...
   ▼
SessionGuard → WorkspaceMemberGuard
   ▼
FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 MB, files: 1 } })
   ▼
UploadsService
   1. sharp(buffer, { limitInputPixels: 40e6, animated: true }).metadata()  ← validates real content;
      allow jpeg/png/webp/gif/avif; never trust client mimetype; reject SVG (script vector)
   2. .rotate()                                       ← apply EXIF orientation, strips metadata
      .resize({ width: purpose===LOGO ? 256 : 2000, withoutEnlargement: true })
      .webp({ quality: 80 })
   3. key = `${workspaceId}/${yyyy}/${mm}/${cuid()}.webp`
      write to `${key}.tmp` then rename → atomic, no half-written files served
   4. prisma.upload.create({ storageKey: key, width, height, bytes, purpose, ... })
   ▼
201 { id, url: "/uploads/<key>", width, height }
   ▼
Editor inserts <img src="/uploads/<key>"> (relative path, host-independent)

Serving: main.ts
   app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads', immutable: true, maxAge: '365d',
                                     index: false, dotfiles: 'deny', fallthrough: false })
   + X-Content-Type-Options: nosniff
```

Notes:
- Keys are content-unique (cuid), so `immutable` caching is safe; replacing a logo creates a new key.
- `/uploads` is its own top-level path (not under `/api/v1`) so image URLs embedded in changelog HTML never depend on API versioning.
- On the web side, render with plain `<img>` or `next/image` with `unoptimized`. Images are already resized WebP, and vinext's build-time image optimization is a documented gap.
- Uploads in a PRIVATE product are reachable by anyone holding the URL (unguessable key). Acceptable for v1; document it.
- Orphans (images removed from a draft) are tolerated in v1. A later sweep can delete `Upload` rows not referenced by any entry or logo.
- Volume `uploads` is mounted into the API container only. Back it up alongside `pg_dump`.

---

## 7. Tenant Resolution (`/{workspace}/{product}`)

**Recommendation: tenant identity is slugs, resolved in two places with one shape each. Web: a `TenantLocator` plus a `portalHref()` link builder. API: portal endpoints keyed by slugs, `PortalGuard` resolves to a `ProductContext`.**

```typescript
// apps/web/lib/tenant.ts — the ONLY place that knows how portals are addressed
export type PortalTenant = { workspaceSlug: string; productSlug: string };

export function portalHref(t: PortalTenant, path = ''): string {
  return `/${t.workspaceSlug}/${t.productSlug}${path}`;   // later: host-aware for subdomains
}
// Every portal <Link> uses portalHref(); no component concatenates slugs by hand.
```

- **v1 (path-based):** the App Router params `[workspace]/[product]` are the tenant. Layout `app/[workspace]/[product]/layout.tsx` calls `GET /api/v1/portal/:ws/:product` once (name, logo, visibility, statuses, categories) and passes it down; 404 if unknown, sign-in redirect if PRIVATE and anonymous.
- **Later (subdomains/custom domains):** `proxy.ts` (Next 16's middleware) reads the `Host`, looks up the tenant, and **rewrites** `acme.userhq.app/app1/roadmap` → `/acme/app1/roadmap` internally. The route tree, data loaders, and API stay unchanged; only `portalHref()` becomes host-aware and a `Domain` table is added. That is the whole abstraction. Do not build more now.
- **API portal routes:** `/api/v1/portal/:workspaceSlug/:productSlug/{posts,roadmap,changelog,faq}`. `PortalGuard` does one query: `product.findFirst({ where: { slug: productSlug, workspace: { slug: workspaceSlug } } })` via the `@@unique([workspaceId, slug])` + `Workspace.slug @unique` indexes. Optional in-process LRU (60 s TTL) if it ever shows up in profiles.
- **Admin routes use ids, not slugs** (`/products/:productId/...`), so renaming a slug never breaks the dashboard. Slug renames break public links in v1; a `SlugRedirect` table is a later additive fix.

---

## 8. FAQ Search

**Recommendation: case-insensitive `contains` (ILIKE) on `question` and `answerText`, scoped by `productId`, for v1.**

```typescript
prisma.faqItem.findMany({
  where: { productId, OR: [
    { question:   { contains: q, mode: 'insensitive' } },
    { answerText: { contains: q, mode: 'insensitive' } },
  ]},
  orderBy: [{ categoryId: 'asc' }, { position: 'asc' }],
  take: 20,
});
```

- **Why it's enough:** a product's FAQ is tens to low hundreds of rows. The `productId` index narrows to that set; scanning it with ILIKE costs well under a millisecond. ILIKE is also language-agnostic, while `to_tsvector('english', ...)` stems wrongly for non-English portals.
- **Why not Prisma's built-in `search`:** full-text search on Postgres is still a **preview** feature in Prisma (`fullTextSearchPostgres`), and it offers no ranking control.
- **Upgrade path (when a portal has thousands of entries or wants ranking):** raw SQL migration adds a generated `tsvector` column (`setweight(question,'A') || setweight(answerText,'B')`) with a GIN index, queried through `$queryRaw` with `websearch_to_tsquery` and `ts_rank`; add `pg_trgm` for typo tolerance. This is additive: same endpoint, different query.
- Keep `answerText` (plain text) separate from the rendered `answer` so search never matches HTML tags.

---

## 9. Auth Bridge (web ↔ api)

Not asked directly, but every component depends on it, and it is the highest-risk integration.

**Recommendation: NextAuth with the Prisma adapter and `session: { strategy: 'database' }`; the API authenticates by looking up the session token in the shared `Session` table.**

```
Browser ──cookie: authjs.session-token──► Traefik ──► api  (same origin, cookie sent automatically)
RSC in web ──fetch(API_INTERNAL_URL, { headers: { cookie } })──► api  (Docker network, forwards cookie)

SessionGuard:
  token = cookie['__Secure-authjs.session-token'] ?? cookie['authjs.session-token'] ?? bearer
  session = prisma.session.findUnique({ where: { sessionToken: token }, include: { user: true } })
  if (!session || session.expires < now) → 401 (or anonymous on @Public routes)
```

- **Why database sessions over JWT:** the API needs no copy of `AUTH_SECRET` and no knowledge of Auth.js's JWE format; revocation is a row delete; and the bridge is library-agnostic. This matters because Auth.js is now maintained by the Better Auth team in **security-only mode** and `next-auth` v5 has never left beta. If NextAuth fails under vinext in Phase 1, swapping to Better Auth (also DB-session-based) changes only `lib/auth.ts` and the table the guard reads.
- **CSRF:** cookie-authenticated API with same-origin browser calls. The session cookie is `SameSite=Lax` (Auth.js default), and a global guard rejects non-GET requests whose `Origin` is not the app origin.
- **Local dev without Traefik:** use Vite's `server.proxy` in the vinext config to forward `/api/v1` and `/uploads` to `localhost:4000`, which keeps cookies same-origin. Verify this works under vinext in Phase 1.
- Rate limit public writes (post, vote, comment) with `@nestjs/throttler`.

---

## Data Flow

### Request Flow (portal page)

```
GET /acme/app1  (browser)
    ↓ Traefik → web
app/[workspace]/[product]/layout.tsx (RSC)
    ↓ fetch API_INTERNAL_URL/api/v1/portal/acme/app1           (forwards cookie)
API: SessionGuard(optional) → PortalGuard(slug→ProductContext, visibility) → controller
    ↓ prisma (allowlist select, productId filter)
Postgres
    ↑ rows → mapper → Public* type
RSC renders HTML; client components (vote button) call same-origin /api/v1/... directly
```

### Key Data Flows

1. **Sign-in + invite acceptance:** OAuth → NextAuth creates User/Account/Session → `events.signIn` (or first dashboard load) calls `POST /api/v1/invites/claim` → API matches pending invites by verified email → creates Membership, sets `acceptedAt`.
2. **Create workspace/product:** dashboard form → `POST /workspaces` (creates Workspace + Membership(ADMIN) in one tx) → `POST /workspaces/:id/products` (creates Product + seeded Statuses + Tags in one tx).
3. **Submit post:** portal form → `POST /portal/:ws/:p/posts` (signed-in) → status = product's `isDefault` status.
4. **Vote:** button → `POST /portal/:ws/:p/posts/:id/vote` → Vote insert + counter increment in one tx → optimistic UI reconciles with response.
5. **Kanban move:** drag → `PATCH /products/:pid/roadmap/:itemId { statusId, position }` → `StatusSyncService` updates item + linked posts in one tx.
6. **Changelog publish:** editor → upload images (§6) → `PUT /products/:pid/changelog/:id { contentJson, contentHtml }` → API **re-sanitizes** HTML with an allowlist (never trusts client HTML) → `publishedAt = now()`.
7. **Public roadmap read:** `GET /portal/:ws/:p/roadmap` → allowlist select on `RoadmapItem` (never `internal`) → mapper → `PublicRoadmapItem[]`.

Direction is strictly **web → api → db/volume**. The API never calls the web app; web never reads the uploads volume; web touches the database only through the NextAuth adapter.

---

## Build Order (dependency-driven)

| # | Phase | Builds | Depends on | Why here |
|---|-------|--------|------------|----------|
| 1 | **Foundation & risk retirement** | pnpm monorepo; `packages/db` with auth + Workspace/Membership/Product/Status tables; vinext app with NextAuth sign-in; Nest API with `SessionGuard` reading the DB session; `GET /api/v1/me`; both Dockerfiles; Dokploy path routing on one domain; upload volume smoke test | — | Retires the three unverified risks (NextAuth under vinext, vinext Node build in Docker, same-origin cookie bridge) before any feature work depends on them |
| 2 | **Tenancy & portal shell** | Workspace/product CRUD, reserved slugs, status/tag seeding, membership guards, invites (link + auto-claim), visibility toggle, `PortalGuard`, `TenantLocator`/`portalHref`, **upload pipeline** (logos need it), **cross-tenant e2e harness** | 1 | Every feature hangs off `ProductContext`; the isolation test harness must exist before the features it protects |
| 3 | **Feedback board** | Categories, posts, votes (counter), comments (admin badge), sort/filter, status display, admin triage | 2 | Core value input; establishes the admin/public controller split on a simpler domain first |
| 4 | **Roadmap + status management** | Split-table items, Kanban (fractional positions), public roadmap with allowlist + contract tests, post linking + `StatusSyncService`, status CRUD/reorder/delete-with-reassign | 3 (posts to link) | Highest privacy risk; needs posts to exist. Status editing lands here because statuses are the Kanban columns. |
| 5 | **Changelog** | Rich-text editor, API-side HTML sanitization, inline image upload (reuses §6), tags, draft/publish, public feed | 2 (uploads) | Independent of 3–4; ordered after them by core-value priority. Can run parallel with 6. |
| 6 | **FAQ** | Categories, items, ILIKE search, public browse | 2 | Smallest, independent; can run parallel with 5 |
| 7 | **Hardening** | Rate limiting, Origin check audit, backup/restore drill for pgdata + uploads volumes, noindex on PRIVATE portals | all | Close out operational risks |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k workspaces | One web + one API container, one Postgres. Everything above as written. |
| 1k–100k end-users | Add Postgres connection limit tuning (Prisma pool per container); portal slug→product LRU cache; consider short `s-maxage` caching for anonymous portal reads that don't need `hasVoted`. |
| Beyond | The local-disk volume pins the API to one replica. Move uploads to S3-compatible storage (key-based model already supports it), then scale API horizontally. Consider RLS as defense-in-depth. |

### Scaling Priorities

1. **First bottleneck: the uploads volume prevents a second API replica.** Fix by moving to object storage; `storageKey` + URL-at-read-time makes this a service swap.
2. **Second: sharp CPU on large uploads.** sharp runs on libuv's threadpool (doesn't block the event loop) but competes for cores; the 10 MB / 40 MP limits bound it. Offload to a queue only if uploads become frequent.

---

## Anti-Patterns

### Anti-Pattern 1: Denylist serialization for private fields
**What people do:** Return full Prisma rows and hide internals with `@Exclude()` / `delete obj.notes` / UI conditionals.
**Why it's wrong:** Every new internal column is public by default. One forgotten decorator is the product's worst failure mode.
**Do this instead:** Split table + allowlist `select` + explicit mapper + key-set contract test (§3).

### Anti-Pattern 2: Looking up child resources by id alone
**What people do:** `prisma.post.findUnique({ where: { id } })` after checking the user is a member of *some* product.
**Why it's wrong:** An admin of workspace A can read or modify workspace B's data by guessing or harvesting ids (IDOR).
**Do this instead:** `findFirst/updateMany/deleteMany({ where: { id, productId } })` with `productId` from the guard-resolved context (§2).

### Anti-Pattern 3: `COUNT(*)` for the default sort
**What people do:** `orderBy: { votes: { _count: 'desc' } }` on the board's main query.
**Why it's wrong:** Aggregates the whole Vote table per page view; unindexable sort.
**Do this instead:** Transactional `voteCount` column (§5).

### Anti-Pattern 4: Status as an enum or hardcoded union
**What people do:** `enum PostStatus { OPEN PLANNED ... }`.
**Why it's wrong:** Admins must rename/add/delete statuses per product; enums require migrations.
**Do this instead:** Per-product `Status` rows, FK with `Restrict`, delete-with-reassign (§4).

### Anti-Pattern 5: Hand-concatenated portal URLs
**What people do:** `` href={`/${ws}/${product}/roadmap`} `` scattered across components.
**Why it's wrong:** Adding subdomains later means finding and rewriting every link.
**Do this instead:** `portalHref()` everywhere (§7).

### Anti-Pattern 6: Image processing or file I/O in the web app
**What people do:** Use a Next route handler + sharp to accept uploads.
**Why it's wrong:** sharp is a documented vinext gap; the web container doesn't mount the volume.
**Do this instead:** Browser posts directly to the API (same origin) (§6).

### Anti-Pattern 7: Trusting client-produced rich-text HTML
**What people do:** Store whatever HTML the editor sends and render it with `dangerouslySetInnerHTML` on public pages.
**Why it's wrong:** Stored XSS on every portal visitor, from any compromised admin session.
**Do this instead:** Sanitize with an allowlist in the API on every write; store sanitized `contentHtml` alongside `contentJson`.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google / GitHub OAuth | NextAuth providers in web | GitHub needs `user:email` scope; only auto-claim invites on verified email |
| Traefik (Dokploy) | Path-based domain entries per app | Two path rules to API (`/api/v1`, `/uploads`), root to web; no strip-path |
| Docker volumes | `pgdata` (postgres), `uploads` (api only) | Both must survive redeploys; back both up |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| browser ↔ api | Same-origin HTTPS, session cookie | Mutations: Origin check + SameSite=Lax |
| web (RSC) ↔ api | HTTP over Docker network, forwarded cookie | `API_INTERNAL_URL`; never forward cookies to any other host |
| web ↔ db | NextAuth Prisma adapter only | ESLint-enforced single import site |
| api public ↔ api admin code | Import restriction | `public/**` cannot import `admin/**` |
| api ↔ uploads volume | Filesystem | `UPLOAD_DIR` env; atomic temp+rename writes |
| web ↔ packages/types | Build-time import | zod request schemas, public response interfaces, constants |

---

## Sources

- Prisma docs, Client Extensions / RLS example via `set_config` and extension-in-transaction limitation (prisma/orm#20678) — Context7 `/prisma/web` — HIGH (official)
- Prisma 7 upgrade guide: `prisma-client` generator, required `output`, `@prisma/adapter-pg`, middleware removed — Context7 `/prisma/web` — HIGH
- Prisma 7.4 release notes: `partialIndexes` preview — Context7 `/prisma/web` — HIGH
- Prisma upgrade to v6: `fullTextSearchPostgres` still preview; Prisma blog on tsvector + GIN + pg_trgm — Context7 `/prisma/web` — HIGH
- Prisma referential actions (`Restrict`, `SetNull`) — Context7 `/prisma/web` — HIGH
- NestJS docs, Injection scopes / durable providers (request scope bubbles up the chain) — Context7 `/nestjs/docs.nestjs.com` — HIGH
- nestjs-cls docs (middleware setup, transactional Prisma adapter) — Context7 `/papooch/nestjs-cls` — HIGH (considered, not recommended for v1)
- Auth.js Prisma adapter schema and session strategy defaults — Context7 `/websites/authjs_dev` — HIGH
- [Auth.js is now part of Better Auth](https://better-auth.com/blog/authjs-joins-better-auth), [GitHub discussion #13252](https://github.com/nextauthjs/next-auth/discussions/13252), [Auth.js security update: July 2026](https://better-auth.com/blog/security-update-july-2026) — MEDIUM (maintenance-mode status and v5-beta claims come from vendor blog plus third-party reviews)
- [Dokploy Domains docs](https://docs.dokploy.com/docs/core/domains) — path, internal path, strip path options — MEDIUM
- Vote counter, status sync, tenancy guard design — reasoning from established multi-tenant SaaS practice plus the above primitives — MEDIUM-HIGH

---
*Architecture research for: multi-tenant customer feedback & public roadmap SaaS (UserHQ)*
*Researched: 2026-10-01*
