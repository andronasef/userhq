# Phase 3: Feedback Board & Conversations - Pattern Map

**Mapped:** 2026-10-03
**Files analyzed:** ~75 new/modified (grouped by role)
**Analogs found:** all groups except email worker/outbox, throttler guard, HMAC tokens, nuqs toolbar, infinite list (see No Analog Found)

Updates `02-PATTERNS.md` rather than re-deriving it. Phase 2 sections still apply (schema conventions, ESM `.js` imports, `ApiException`, DI tokens, test harness, `components/ui/*` shapes). Phase 2 built real analogs that are closer than the Phase 1 ones `02-PATTERNS` pointed at, so prefer the analogs below. Every analog path is git-tracked (checked with `git ls-files`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/db/src/schema/feedback.ts` (categories, posts, votes, comments, post_activity, post_mutes, comment_email_batches/items) | model | CRUD | `packages/db/src/schema/tenancy.ts` `statuses` (lines 65-95) | exact |
| `packages/db/src/schema/auth.ts` (+`deletedAt`, `commentEmails`), `tenancy.ts` (+`workspaces.deletedAt`, `products.nextPostNumber`) | model | — | `bannedAt` added in Phase 2 (`0006_ban.sql`) | exact |
| `packages/db/src/index.ts` (register feedback) | config | — | itself lines 7-19 | exact |
| `packages/db/migrations/0007_feedback.sql` (generated), `0008_backfill_categories.sql` (`--custom`) | migration | batch | `0005_statuses.sql` | exact / partial (custom) |
| `packages/types/src/feedback.ts` + `index.ts` re-export, `API_ERROR_CODES` additions, `slugs.ts` `slugify(name, max)` | utility/schema | transform | `packages/types/src/tenancy.ts` (Status*, PublicPortalProduct*) | exact |
| `packages/types/src/tenancy.ts` `PublicPortalProductSchema` (+statuses[], categories[]) | schema | — | itself lines 6-20 | exact |
| `apps/api/src/feedback/portal-posts.controller.ts`, `portal-comments.controller.ts` | controller | request-response + CRUD | `apps/api/src/portal/portal.controller.ts` (public reads) + `products/statuses.controller.ts` (tx writes) | role-match |
| `apps/api/src/feedback/admin-posts.controller.ts`, `categories.controller.ts` | controller | CRUD | `apps/api/src/products/statuses.controller.ts` | exact |
| `apps/api/src/feedback/feedback.service.ts` | service | CRUD (transactions) | `apps/api/src/invites/invites.service.ts` + `statuses.controller.ts` `deleteStatus` tx (lines 315-359) | role-match |
| `apps/api/src/feedback/feedback.module.ts`, `email/email.module.ts`, `account/account.module.ts` | config | — | `apps/api/src/products/products.module.ts` | exact |
| `apps/api/src/feedback/throttle.ts` (`UserThrottlerGuard`) | middleware | request-response | none (RESEARCH Code Examples) | none |
| `apps/api/src/products/statuses.controller.ts` `deleteStatus` (reassign posts) | controller | CRUD | itself line 348 | exact |
| `apps/api/src/products/products.controller.ts` `createProduct` (seed categories) | controller | CRUD | itself lines 95-104 (status seeding) | exact |
| `apps/api/src/auth/guards.ts` (`OriginGuard` skip metadata; `SessionGuard` null `deletedAt`) | middleware | request-response | itself (SessionGuard's `Reflector` + `IS_PUBLIC` read) | exact |
| `apps/api/src/auth/decorators.ts` (+`SkipOriginCheck`) | utility | — | itself `Public` (line 8) | exact |
| `apps/api/src/common/api-error.filter.ts` (429 → `rate_limited`, both switches) | utility | — | itself lines 49-77 and 88+ | exact |
| `apps/api/src/portal/portal.guard.ts`, `tenancy/tenant.guard.ts`, `auth/me.controller.ts`, `invites/invites.service.ts` (+`isNull(workspaces.deletedAt)`) | middleware | — | `portal.guard.ts` lines 24-31 | exact |
| `apps/api/src/platform/platform.controller.ts` (replace 0 placeholders with counts) | controller | CRUD | itself 140-143, 210-223, 318-321 | exact |
| `apps/api/src/email/transport.ts` (`createSmtpTransport(env)`) + `scripts/smtp-check.ts` refactor | utility | file-I/O (network) | `apps/api/src/scripts/smtp-check.ts` lines 41-50 | exact |
| `apps/api/src/email/{email.worker,outbox,render,tokens}.ts` | service | event-driven/batch | none | none |
| `apps/api/src/email/unsubscribe.controller.ts` | controller | request-response | `portal.controller.ts` (`@Public` + serializer) | role-match |
| `apps/api/src/account/account.controller.ts` | controller | CRUD | `statuses.controller.ts` (tx) + `me.controller.ts` (`@CurrentUser`) | role-match |
| `apps/api/src/env.ts` (+`SMTP_*` optional) | config | — | itself lines 3-18 | exact |
| `apps/api/src/app.module.ts` (+FeedbackModule, EmailModule, AccountModule, `ThrottlerModule.forRoot`) | config | — | itself lines 52-60 | exact |
| `apps/api/test/{posts,votes,comments,merge,moderation,categories,email,unsubscribe,account}.test.ts` | test | request-response | `apps/api/test/statuses.test.ts` | exact |
| `apps/api/test/cross-tenant.test.ts` (scope discovery, new routes), `portal-isolation.test.ts`, `public-contract.test.ts` (canary) | test | — | `cross-tenant.test.ts` lines 10-60, 100-135 | exact |
| `apps/api/test/support/seed.ts` (+post/comment/category in B) | test | — | itself | exact |
| `apps/api/test/browser/*.spec.ts` (nuqs back-button, permalink 308) | test | — | `apps/api/test/browser/status-reorder.spec.ts` | role-match |
| `apps/web/app/layout.tsx` (+`NuqsAdapter`) | layout | — | itself | exact |
| `apps/web/app/[ws]/[product]/page.tsx` (board) | page (RSC) | request-response | itself (replaces coming-soon) + `dashboard/[ws]/[product]/statuses/page.tsx` | exact |
| `apps/web/app/[ws]/[product]/layout.tsx` (TabNav Feedback) | layout | — | itself | exact |
| `apps/web/app/[ws]/[product]/p/[ref]/page.tsx` | page (RSC) | request-response | `dashboard/[ws]/[product]/statuses/page.tsx` | role-match |
| `apps/web/app/dashboard/[ws]/[product]/{board,board/[number],categories}/page.tsx` + `*-view.tsx` | page (RSC) + client view | request-response | `dashboard/[ws]/[product]/statuses/{page,statuses-view}.tsx` | exact |
| `apps/web/app/dashboard/[ws]/[product]/page.tsx` (redirect to `/board`) | page | — | itself | exact |
| `apps/web/app/(app)/account/*`, `(app)/unsubscribe/[token]/*` | page + client | request-response | `app/(app)/invite/[token]/{page,accept-invite}.tsx` | role-match |
| `apps/web/lib/api-server.ts` (+`getBoard`, `getPost`, `getAdminPosts`, `getCategories`, `getAccount`, `getUnsubscribe`) | utility | request-response | itself `getPortalProduct` (lines 119-126) | exact |
| `apps/web/lib/api-errors.ts` (+Phase 3 codes) | utility | transform | itself | exact |
| `apps/web/proxy.ts` (+`/account` in matcher) | middleware | — | itself line 26 | exact |
| `components/board/{post-form-dialog}.tsx`, `post/{status-change-dialog,merge-dialog,voters-dialog}.tsx`, `dashboard/{category-dialog,bulk-merge-dialog}.tsx` | component | request-response | `components/dashboard/status-dialog.tsx` | exact |
| `components/dashboard/category-list.tsx` | component | CRUD | `components/dashboard/status-list.tsx` (minus dnd) | role-match |
| `components/dashboard/{board-table,deleted-items}.tsx` | component | — | `components/platform/workspaces-table.tsx` / `team/members-table.tsx` | role-match |
| `components/post/{post-actions-menu,comment-actions-menu}.tsx` | component | — | `components/user-menu.tsx` (DropdownMenu) | role-match |
| `components/board/vote-button.tsx`, `post/{comment-composer,mute-toggle}.tsx` | component | request-response (optimistic) | `status-dialog.tsx` mutation block | partial |
| `components/board/{post-row,board-toolbar,post-list}.tsx`, `post/{author-line,post-timeline,comment-item,activity-item,sign-in-prompt}.tsx`, `ui/textarea.tsx`, `plain-text.tsx` (+test) | component | — | `components/ui/input.tsx`, `ui/avatar.tsx`, `portal/product-card.tsx`; test: `lib/initials.test.ts` | role-match |
| `components/portal/portal-frame.tsx` (+`tabs` slot), `dashboard/sidebar.tsx`, `user-menu.tsx` | component | — | themselves | exact |
| `compose.yaml` (+`SMTP_*` passthrough), `.env.example`, `docs/deploy.md` | config | — | existing env entries | exact |

## Pattern Assignments

### `packages/db/src/schema/feedback.ts` (model)

**Analog:** `packages/db/src/schema/tenancy.ts` lines 65-95. Copy the shape, then paste RESEARCH Pattern 1 tables.
```typescript
export const statuses = pgTable(
  "statuses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("statuses_id_product_unique").on(table.id, table.productId),   // composite-FK target for posts
    uniqueIndex("statuses_product_name_ci").on(table.productId, sql`lower(${table.name})`),
```
Categories copy this verbatim (name CI unique + `categories_id_product_unique`). The constraint names matter, because `isUniqueViolation(e, "<index name>")` maps them to error codes.

**Register** in `packages/db/src/index.ts` lines 7-19 by adding a fourth line to each of the three blocks:
```typescript
import * as feedbackSchema from "./schema/feedback.js";
export const schema = { ...authSchema, ...uploadsSchema, ...tenancySchema, ...feedbackSchema };
export * from "./schema/feedback.js";
```

---

### Admin controllers: `admin-posts.controller.ts`, `categories.controller.ts`

**Analog:** `apps/api/src/products/statuses.controller.ts`

Imports and class header (lines 1-43):
```typescript
import { Controller, Get, Post, Patch, Put, Delete, Body, Query, Param, HttpCode, HttpStatus,
  Inject, UseGuards, UseInterceptors, SerializeOptions } from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, sql, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import { DB, type Db, statuses } from "@userhq/db";
import { StatusSchema, CreateStatusInputSchema, type Status, type CreateStatusInput } from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { isUniqueViolation } from "../common/db-errors.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/statuses")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class StatusesController {
  constructor(@Inject(DB) private readonly db: Db) {}
```
- Read handler (lines 45-63): explicit `select({...})` map, then `rows.map((r) => XSchema.parse(r))`.
- Create in a tx with unique-violation mapping (lines 65-110):
```typescript
try {
  const [inserted] = await this.db.transaction(async (tx) => { ... .returning({ id: ..., name: ... }) });
  return StatusSchema.parse(inserted);
} catch (e) {
  if (isUniqueViolation(e, "statuses_product_name_ci")) {
    throw new ApiException("status_name_taken", 409, "This product already has a status with that name.");
  }
  throw e;
}
```
For categories, use `category_name_taken` and `categories_product_name_ci`.
- UUID param guard (lines 300-304): `UuidParamSchema.safeParse(raw)` → `not_found` 404. Use the same guard for `:id` (comments, categories). For `:number`, use `z.coerce.number().int().positive()`.
- Lock-then-mutate tx (lines 315-359), which is the template for status change, merge, restore, and category delete:
```typescript
await this.db.transaction(async (tx) => {
  const lockedRows = await tx.select({ id: statuses.id, isDefault: statuses.isDefault })
    .from(statuses)
    .where(and(eq(statuses.productId, tenant.productId!), inArray(statuses.id, [statusId, moveTo])))
    .for("update");
  if (lockedRows.length < 2) throw new ApiException("not_found", 404, "Not found.");
  ...
});
```
Merge adds `.orderBy(asc(posts.id))` before `.for("update")` (RESEARCH Pattern 9).

**Status-delete extension:** replace the comment on line 348 with:
```typescript
await tx.update(posts).set({ statusId: moveTo })
  .where(and(eq(posts.statusId, statusId), eq(posts.productId, tenant.productId!)));
```
Keep the Phase 4 comment line.

**Module:** copy `apps/api/src/products/products.module.ts`:
```typescript
@Module({ controllers: [ProductsController, StatusesController], providers: [TenantGuard] })
export class ProductsModule {}
```
Add `FeedbackModule`/`EmailModule`/`AccountModule` to `app.module.ts` `imports` after `ProductsModule` (line 60). `FeedbackModule` provides `TenantGuard`, `PortalGuard`, `FeedbackService`, and `UserThrottlerGuard`.

---

### Portal controllers: `portal-posts.controller.ts`, `portal-comments.controller.ts`

**Analog for reads:** `apps/api/src/portal/portal.controller.ts` lines 1-60
```typescript
@Controller("portal")
@Public()
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get(":ws")
  @UseGuards(PortalGuard)
  @SerializeOptions({ schema: PublicPortalDirectorySchema })
  async getPortalDirectory(@Req() req: any): Promise<PublicPortalDirectory> {
    const { workspaceId } = req.portal ?? {};
    if (!workspaceId) throw new ApiException("not_found", 404, "Not found.");
```
**Difference:** these controllers mix public reads and signed-in writes, so put `@Public()` **per GET handler**, not on the class. Writes are then default-deny through the global `SessionGuard`. Use `@Controller("portal/:ws/:product")` and `@UseGuards(PortalGuard)` at class level. `req.portal = { workspaceId, productId }` is set by `portal.guard.ts` lines 64-67. `req.user` may be null on public GETs, so the viewer flags use `req.user?.id`.

Writes: `@CurrentUser() user: { id: string }` (from `auth/decorators.ts`), `@Body({ schema })`, and `@UseGuards(UserThrottlerGuard) @Throttle({ default: { limit, ttl: 60_000 } })` on each create, vote, and mute handler. Business logic goes in `FeedbackService` (RESEARCH Patterns 2-10).

`PublicPortalProduct` extension: the existing `GET /portal/:ws/:product` handler in `portal.controller.ts` gains `statuses[]` and `categories[]` selects.

---

### `feedback.service.ts` (service, transactions)

**Analog:** `apps/api/src/invites/invites.service.ts` (an `@Injectable()` holding `@Inject(DB) db: Db` with tx logic), plus the tx template above. The code bodies are RESEARCH Patterns 2-10 verbatim. `isWorkspaceAdmin(db, userId, workspaceId)` is a single `workspaceMembers` lookup. Copy the select style from `tenant.guard.ts` lines 40-55.

---

### Guards and decorators

**`SkipOriginCheck`** copies `auth/decorators.ts` line 7-8:
```typescript
export const SKIP_ORIGIN = "skipOrigin";
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN, true);
```
**`OriginGuard`** (`guards.ts` 15-44): inject `Reflector` the way `SessionGuard` does (lines 48-52), and return true early when `reflector.getAllAndOverride(SKIP_ORIGIN, [ctx.getHandler(), ctx.getClass()])` is set. Apply it only to `POST /unsubscribe/:token`.

**`SessionGuard`** line 66:
```typescript
const active = session && !(session.user as any).bannedAt && !(session.user as any).deletedAt ? session : null;
```

**Soft-deleted workspaces:** add `isNull(workspaces.deletedAt)` to `portal.guard.ts` `.where(eq(workspaces.slug, wsSlug))` (line 31) → `.where(and(eq(workspaces.slug, wsSlug), isNull(workspaces.deletedAt)))`. Do the same in `tenant.guard.ts`, the `me.controller.ts` membership query, and `invites.service.ts`.

**`api-error.filter.ts`:** add to **both** switch blocks (after the `UNSUPPORTED_MEDIA_TYPE` case at ~line 66, and in the second switch at ~line 88):
```typescript
case HttpStatus.TOO_MANY_REQUESTS:
  code = "rate_limited";
  message = defaultMessage || "Too many requests";
  break;
```

---

### Email transport (`email/transport.ts`)

**Analog:** `apps/api/src/scripts/smtp-check.ts` lines 41-50. Extract this:
```typescript
const transportOptions = {
  host: opts.host, port,
  secure: isTls,                         // port === 465
  requireTLS: !isTls && requireTls,
  connectionTimeout: timeoutMs, greetingTimeout: timeoutMs, socketTimeout: timeoutMs,
  ...(opts.user ? { auth: { user: opts.user, pass: opts.pass ?? "" } } : {}),
};
nodemailer.createTransport(transportOptions as SMTPTransport.Options);
```
Wrap it in `createSmtpTransport(env)` and have `smtp-check.ts` call it. Keep its credential redaction. The worker, outbox SQL, tokens, and render come from RESEARCH Pattern 11, and `snippet`/`escapeHtml` from Code Examples.

**Env** (`env.ts` lines 3-18): append optional keys in the same style:
```typescript
SMTP_HOST: z.string().optional(),
SMTP_PORT: z.coerce.number().default(587),
SMTP_USER: z.string().optional(),
SMTP_PASS: z.string().optional(),
SMTP_FROM: z.string().email().optional(),
SMTP_REQUIRE_TLS: z.enum(["true","false"]).default("true").transform((v) => v === "true"),
```
Update every `Env` literal in `test/support/test-app.ts` and `test/e2e/*`, as Phase 2 did for `PLATFORM_OWNER_EMAIL`.

---

### API tests

**Analog:** `apps/api/test/statuses.test.ts` lines 1-50
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, and, sql } from "drizzle-orm";
import { createTestApp, signedInCookie } from "./support/test-app.js";

beforeAll(async () => {
  testApp = await createTestApp({ PLATFORM_OWNER_EMAIL: "owner@statuses.test" });
  ownerUser = await signedInCookie(testApp.test, { name: "...", email: "...", emailVerified: true });
  const [ws] = await testApp.db.insert(schema.workspaces).values({ slug: wsSlug, name: "..." }).returning();
  await testApp.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: ownerUser.userId, role: "owner" });
  const [prod] = await testApp.db.insert(schema.products).values({ workspaceId: ws.id, slug, name }).returning();
```
Non-GET requests need `.set("Origin", testApp.env.PUBLIC_URL)`, except in the unsubscribe one-click test, which deliberately omits both Origin and cookie. Hammer tests (throttle, 50 parallel votes) use fresh users.

**`cross-tenant.test.ts`:** add every new `/workspaces/:ws/...` admin route to `CROSS_TENANT_ROUTES` (lines 10-60 style, `(s) => ({ url, body })`). Change discovery at ~line 119 from `fullPath.includes(":ws")` to `fullPath.startsWith("/workspaces/:ws")` (RESEARCH Pitfall 6). Add a separate portal-isolation test.

---

### Web RSC pages (board, permalink, dashboard board/detail/categories)

**Analog:** `apps/web/app/dashboard/[ws]/[product]/statuses/page.tsx` (49 lines)
```tsx
export async function generateMetadata({ params }: StatusesPageProps): Promise<Metadata> {
  const { ws, product } = await params;
  const result = await getProduct(ws, product);
  if (!result.ok) return { title: "Statuses · UserHQ" };
  return { title: `Statuses · ${result.data.name}` };
}

export default async function StatusesPage({ params }: StatusesPageProps): Promise<React.JSX.Element | null> {
  const { ws, product } = await params;
  const [productRes, statusesRes] = await Promise.all([getProduct(ws, product), getStatuses(ws, product)]);
  if (!productRes.ok || !statusesRes.ok) {
    if (!productRes.ok && productRes.status === 403 && productRes.code === "workspace_suspended") return null;
    notFound();
  }
  return <StatusesView ws={ws} product={product} initial={statusesRes.data} />;
}
```
- The board page also takes `searchParams: Promise<{...}>` and passes them to `getBoard`.
- **Permalink:** `generateMetadata` must return `{}` on redirect results. `permanentRedirect` is called only in the page body (RESEARCH Pitfall 4).
- The portal board page replaces the `EmptyState` body of `apps/web/app/[ws]/[product]/page.tsx`. Keep its `getPortalProduct(ws, product)` call; it's `cache()`d, so the layout and page share it.

**Client view:** copy `statuses-view.tsx` (51 lines): `"use client"`, `PageHeader` with `action`, a list, and a dialog with `onSaved={() => router.refresh()}`. Imports are relative with no alias (`../../../../../components/...`).

**Typed readers** in `apps/web/lib/api-server.ts`. Copy lines 119-126:
```typescript
export const getPortalProduct = cache(
  (ws: string, product: string): Promise<ApiReadResult<PublicPortalProduct>> => {
    return apiRead("/api/v1/portal/" + encodeURIComponent(ws) + "/" + encodeURIComponent(product), PublicPortalProductSchema);
  }
);
```

---

### Client dialogs (post form, status change, merge, category, bulk merge, delete account)

**Analog:** `apps/web/components/dashboard/status-dialog.tsx` (233 lines)

Imports (lines 1-32): `useForm` + `zodResolver(<shared input schema>)`, `useMutation`, `toast` from `sonner`, `Dialog*` from `../ui/dialog`, `Field`/`Input`/`NativeSelect`/`Alert`/`Button`, `apiFetch`/`ApiClientError` from `../../lib/api-client`, `errorCopy`/`FIELD_FOR_CODE` from `../../lib/api-errors`, and `QueryProvider` (the outer export wraps `XDialogInner` in it).

Mutation and error mapping (lines 96-140):
```typescript
const mutation = useMutation({
  mutationFn: async (data) => apiFetch(`/api/v1/workspaces/${ws}/products/${product}/statuses`,
    { method: "POST", body: data, schema: StatusSchema }),
  onSuccess: (saved) => { toast.success("Status added"); onSaved(saved); onOpenChange(false); },
  onError: (err: unknown) => {
    if (err instanceof ApiClientError && err.code) {
      if (err.code === "status_name_taken") { setError("name", { message: "..." }); return; }
      const field = FIELD_FOR_CODE[err.code];
      if (field && [...].includes(field)) { setError(field as any, { message: errorCopy(err) }); return; }
    }
    setAlertError(errorCopy(err as any));
  },
});
```
Reset on open (lines 82-92): `React.useEffect(() => { if (open) { setAlertError(null); reset({...}); } }, [open, ...])`. For `edit_conflict`, the `Alert` keeps the form values and adds a `Reload` button that calls `router.refresh()`.

**`VoteButton` (optimistic):** use the same `useMutation` + `apiFetch` with `onMutate` (snapshot and flip), `onError` (roll back and toast `errorCopy`), and `onSettled` (set the server count). This is the only optimistic mutation (UI-SPEC).

`category-list.tsx` takes the row/edit/delete structure of `components/dashboard/status-list.tsx` without the dnd-kit parts. Category delete uses `ConfirmDialog`.

---

### Dropdown action menus

**Analog:** `apps/web/components/user-menu.tsx` lines 52-116 (Trigger `asChild` Button, `DropdownMenuContent align="end"`, `DropdownMenuItem`, `DropdownMenuSeparator`). The `Account settings` item copies the existing item block (lines 71-81) with `UserCog` → `/account`.

---

### Pure utilities and their tests (`plain-text.tsx` linkify, slug/cursor helpers, `snippet`)

**Analog:** `apps/web/lib/initials.ts` + `initials.test.ts` (colocated vitest). The `packages/types` helpers (`slugify(name, max)`, `postSlug`, cursor encode/decode) get tests in the same style, following `packages/types/src/slugs.ts` lines 5, 29-39.

## Shared Patterns

### Errors
**Source:** `apps/api/src/common/api-error.filter.ts` (`ApiException(code, status, message)`)
**Apply to:** all API code. Every new code goes into `API_ERROR_CODES` in `packages/types/src/index.ts` first: `post_not_found`, `comment_not_found`, `post_locked`, `edit_conflict`, `merge_target_invalid`, `category_invalid`, `category_name_taken`, `rate_limited`, `invalid_token`, `owned_workspaces_unresolved`, `transfer_target_invalid`, `platform_owner_account`. The web side adds UI-SPEC copy to `lib/api-errors.ts`.

### Unique-violation mapping
**Source:** `apps/api/src/common/db-errors.ts` `isUniqueViolation(e, "<index name>")`, as used in `statuses.controller.ts` lines 104-110.

### Auth marking
**Source:** `auth/decorators.ts` `Public()` and `CurrentUser()`. `SessionGuard` is default-deny. Admin routes use `TenantGuard` + `@CurrentTenant()`. Portal routes use `PortalGuard` + `req.portal`.

### Response allowlist
**Source:** `@UseInterceptors(StandardSchemaSerializerInterceptor)` at class level + `@SerializeOptions({ schema })` per handler (`portal.controller.ts` lines 28-35). `public-contract.test.ts` enforces this on every `@Public` handler, including unsubscribe. Responses are built from explicit `select({...})` maps. Never use `columns: { x: false }` or drizzle-zod.

### Transactions with row locks
**Source:** `statuses.controller.ts` lines 315-359 (`this.db.transaction` → `.for("update")` → guard-clause throws → mutate).

### Web data flow
RSC reads use `lib/api-server.ts` (`cache()` + `apiRead` + schema parse). Client mutations use `lib/api-client.ts` `apiFetch` (throws `ApiClientError{status, code}`) inside `useMutation`, under `QueryProvider`. After a mutation, call `router.refresh()`. Never use Server Actions.

### ESM / imports
API and packages use relative `.js` imports. Web uses extensionless relative imports with no `@/` alias.

## No Analog Found

| File | Role | Data Flow | Use instead |
|---|---|---|---|
| `apps/api/src/email/email.worker.ts` (+outbox enqueue SQL) | service | event-driven/batch | RESEARCH Pattern 11 (`setInterval`, `FOR UPDATE SKIP LOCKED`, `runOnce(now)`) |
| `apps/api/src/email/tokens.ts` | utility | transform | RESEARCH Pattern 11 HMAC code (node:crypto) |
| `apps/api/src/feedback/throttle.ts` + `ThrottlerModule` | middleware | request-response | RESEARCH Code Examples `UserThrottlerGuard` (new dep `@nestjs/throttler`, human-verify first) |
| `components/board/board-toolbar.tsx` (nuqs) | component | event-driven | RESEARCH Pattern 14. Fallback is `URLSearchParams` + `router.push` (Pitfall 12) |
| `components/board/post-list.tsx` (`useInfiniteQuery`) | component | request-response | TanStack docs. Seed `initialData` from RSC page 1 and dedupe rows by id |
| `0008_backfill_categories.sql` (custom migration) | migration | batch | RESEARCH Pitfall 9 SQL via `drizzle-kit generate --custom` |

## Metadata

**Analog search scope:** `apps/api/{src,test}`, `apps/web/{app,components,lib}`, `packages/{db,types}/src`
**Files scanned:** ~190 tracked source files listed; ~14 analogs read
**Pattern extraction date:** 2026-10-03
