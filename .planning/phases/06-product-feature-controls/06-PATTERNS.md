# Phase 6: Product Feature Controls - Pattern Map

**Mapped:** 2026-11-05
**Files analyzed:** 30 (new + modified)
**Analogs found:** 30 / 30 (all analogs are git-tracked; verified with `git ls-files`)

Line numbers below were read this session. Where a line range is not given, the excerpt is quoted verbatim from the cited file.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `packages/db/src/schema/tenancy.ts` (4 columns) | model | CRUD | same file, `workspaces.directoryEnabled` (l.27) | exact |
| `packages/db/migrations/0013_*.sql`, `meta/*` | migration | batch | `0011_device_info.sql` / `0012_accent_text_color.sql` (+ CF-2 trim) | exact |
| `packages/db/test/migrate.test.ts` (upgrade case) | test | batch | same file l.129-175 | exact |
| `packages/types/src/tenancy.ts` | model (Zod contract) | request-response | same file `ProductDetailSchema` l.254, `UpdateProductInputSchema` l.261, `PublicPortalProductSchema` l.6 | exact |
| `apps/api/src/portal/product-features.ts` (NEW) | utility + decorator | request-response | `apps/api/src/auth/decorators.ts` (SetMetadata) | role-match |
| `apps/api/src/portal/portal.guard.ts` | middleware (guard) | request-response | self + `OriginGuard` in `auth/guards.ts` (Reflector) | exact |
| `apps/api/src/products/products.controller.ts` | controller | CRUD | self (`updateProduct` l.247-278) | exact |
| `apps/api/src/feedback/portal-{posts,comments,votes,mutes}.controller.ts` | controller | request-response | self (add `@PortalFeature('board')`) | exact |
| `apps/api/src/roadmap/portal-roadmap.controller.ts`, `changelog/portal-changelog.controller.ts`, `faq/portal-faq.controller.ts` | controller | request-response | `PortalPostsController` header | exact |
| `apps/api/src/portal/portal.controller.ts` | controller | request-response | self (N4 projection; decorator `'exempt'`) | exact |
| `apps/api/src/feedback/admin-board.controller.ts` (NEW) | controller | CRUD | `admin-comments.controller.ts` (TenantGuard) + `portal-comments.controller.ts` (handlers/throttle) | role-match |
| `apps/api/src/feedback/posts.service.ts` (N1) | service | transform | self l.654-659 | exact |
| `apps/api/src/notifications/notifications.service.ts` | service | event-driven | self `visible()` l.85-92 | exact |
| `apps/api/src/email/outbox.ts` | service | event-driven | self `enqueueCommentEmail` | exact |
| `apps/api/src/email/worker.ts` | service | batch | self items query l.160-205 | exact |
| `apps/api/src/email/unsubscribe.controller.ts` (N7) | controller | request-response | self `resolvePost` l.71-97 | exact |
| `apps/api/src/feedback/activity` controller (`portal-activity.controller.ts`) | controller | request-response | `PortalPostsController` | role-match |
| `apps/web/lib/portal-features.ts` (NEW) + `.test.ts` | utility | transform | `apps/web/lib/portal-motion.ts` + `portal-motion.test.ts` | role-match |
| `apps/web/components/portal/portal-tabs.tsx` | component | request-response | self | exact |
| `apps/web/app/[ws]/[product]/{layout,page}.tsx`, `roadmap/page.tsx`, changelog/faq/activity/p pages | component (RSC page) | request-response | `roadmap/page.tsx` | exact |
| `apps/web/app/dashboard/[ws]/[product]/settings/product-features-form.tsx` (NEW) | component (client form) | CRUD | `product-general-form.tsx` + checkbox row in `workspace-settings-forms.tsx` l.281-299 | exact |
| `.../settings/page.tsx` | component | request-response | self l.47-68 | exact |
| `apps/web/components/dashboard/hidden-module-notice.tsx` (NEW) | component | transform | `apps/web/components/state-page.tsx` | partial |
| `apps/web/components/dashboard/sidebar.tsx` | component | request-response | self | exact |
| FAQ/roadmap/banner CTA components | component | transform | self | exact |
| `apps/api/test/product-features.test.ts` (NEW) | test | request-response | `canary-roadmap-leak.test.ts`, `portal-isolation.test.ts` via `createTestApp` | role-match |
| `apps/api/test/public-contract.test.ts` | test | transform | self l.1-70 | exact |
| `apps/api/test/email.test.ts` additions | test | batch | self l.195-215 | exact |
| `apps/api/test/browser/product-features.spec.ts` (NEW) | test | request-response | `test/browser/portal-branding.spec.ts` | role-match |

## Pattern Assignments

### `packages/db/src/schema/tenancy.ts` (model, CRUD)

**Analog:** same file, `workspaces` table.

```ts
directoryEnabled: boolean("directory_enabled").notNull().default(true),
```
Add to `products`: `boardEnabled: boolean("board_enabled").notNull().default(true)`, then `roadmapEnabled`, `changelogEnabled`, `faqEnabled` (`boolean` already imported l.7).

**Migration (CF-2):** from `packages/db` run `drizzle-kit generate --name product_features`. Delete the two spurious `ALTER TABLE ... "device_info"` lines (comments, posts). Re-run generate and require "No schema changes", then `db:check`. Copy shape from `0012_accent_text_color.sql`: `ALTER TABLE "products" ADD COLUMN "board_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint`.

### `packages/db/test/migrate.test.ts` (upgrade case)

**Analog:** same file l.129-175. Copy the temp-dir pattern (`fs.cpSync` of `migrations`, truncate `journalContent.entries`, `runMigrateCli({ DATABASE_URL, MIGRATIONS_FOLDER })`, then run the real folder and compare `drizzle.__drizzle_migrations` count with `totalMigrations`).
```ts
journalContent.entries = [journalContent.entries[0]];
fs.writeFileSync(journalCopyPath, JSON.stringify(journalContent, null, 2));
const res1 = await runMigrateCli({ DATABASE_URL: tempDb.url, MIGRATIONS_FOLDER: tempMigrationsDir });
```
Change: truncate with `.slice(0, 13)` (through 0012), insert a workspace + product via `client.query`, then full run and assert the 4 columns are `true`.

### `packages/types/src/tenancy.ts` (contract)

**Analog:** same file.
```ts
export const ProductDetailSchema = ProductSummarySchema.extend({
  logoUploadId: z.uuid().nullable(),
  tagline: z.string().nullable(),
  websiteUrl: z.string().nullable(),
});
export const UpdateProductInputSchema = z.object({
  name: NameSchema.optional(),
  ...
  accentTextColor: NullableHexColorSchema.optional(),
});
```
Add `PRODUCT_FEATURE_KEYS`, `ProductFeaturesSchema`; add `features: ProductFeaturesSchema.partial().optional()` to the update schema; `features: ProductFeaturesSchema` to `ProductDetailSchema`, to `ProductSummarySchema` (UI-SPEC U8: sidebar), and to `PublicPortalProductSchema.product` (or top level, l.6-19). Remember `ProductsController.listProducts` returns `ProductSummary`, so it needs the four columns too.

### `apps/api/src/portal/product-features.ts` (NEW, decorator + predicate)

**Analog:** `apps/api/src/auth/decorators.ts` l.7-8 (and l.17-18).
```ts
export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);
```
Copy: `export const PORTAL_FEATURE = "portalFeature"; export const PortalFeature = (f) => SetMetadata(PORTAL_FEATURE, f);` plus pure `featureEnabled(flags, f)`.

### `apps/api/src/portal/portal.guard.ts` (guard)

**Reflector pattern** from `auth/guards.ts` l.23-26 (inject `Reflector` in constructor as l.17-20 do):
```ts
const skipOrigin = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN, [ctx.getHandler(), ctx.getClass()]);
```
**Edit site** in the guard: product select l.44-54 (`select({ id: products.id })`, add four flag columns), and `req.portal = { workspaceId: ws.id, productId }` l.63-66 (add `features`). Keep the order: ws 404 (l.33) -> suspended 403 (l.37) -> product 404 (l.56) -> feature 404. Throw with the existing literal:
```ts
throw new ApiException("not_found", 404, "Not found.");
```
The ws-only branch (no `:product`) must skip the feature check. Missing metadata on a `:product` route must throw a plain `Error` (fail closed).

### `apps/api/src/products/products.controller.ts`

**Partial merge** (l.273-278 style, one line per key, no read-modify-write):
```ts
if (input.tagline !== undefined) updateData.tagline = input.tagline;
if (input.accentTextColor !== undefined) updateData.accentTextColor = input.accentTextColor;
```
Add `if (input.features?.board !== undefined) updateData.boardEnabled = input.features.board;` x4. Gate at l.280 (`Object.keys(updateData).length > 0`) works unchanged. Add the four columns to the `select` in `getProduct` (l.175-184) and `listProducts` (l.143-149), and map to `features: { board: row.boardEnabled, ... }` in the `ProductDetailSchema.parse({...})` call (l.199-208). Class already has `@UseGuards(TenantGuard)` (l.48): do not weaken.

### Portal controllers (decorator application)

**Analog:** `portal-posts.controller.ts` l.35-37.
```ts
@Controller("portal/:ws/:product")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalPostsController {
```
Add `@PortalFeature("board")` at class level for posts, comments, votes, mutes, activity; `"roadmap"` / `"changelog"` / `"faq"` for their controllers (`PortalRoadmapController` uses `@Controller("portal/:ws/:product/roadmap")` + `@UseGuards(PortalGuard)`, same shape); `PortalController` gets `"exempt"`. Class-level `PortalGuard` already runs before method-level `UserThrottlerGuard`.

**Projection edits (N2/N3):** `portal-roadmap.controller.ts` reads `req.portal` (`const { productId } = req.portal ?? {};` l.~46); extend to `features` and skip the `posts` join / `linkedPosts` query when `!features.board`. Keep the strict zero-join to `roadmapItemInternals` comment intact.

### `apps/api/src/feedback/admin-board.controller.ts` (NEW, CF-1)

**Guard/shape analog:** `admin-comments.controller.ts` l.1-30.
```ts
@Controller("workspaces/:ws/products/:product/comments")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AdminCommentsController {
  ...
  { workspaceId: tenant.workspaceId, productId: tenant.productId! }
```
**Handler/DTO/throttle analog:** `portal-comments.controller.ts` l.40-70.
```ts
@Post("posts/:number/comments")
@UseGuards(UserThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@HttpCode(HttpStatus.CREATED)
@SerializeOptions({ schema: PublicCommentSchema })
...
return this.commentsService.createComment(portal, user, parseResult.data, input, userAgent);
```
Substitute `portal` with `{ workspaceId: tenant.workspaceId, productId: tenant.productId! }`, reuse `CreateCommentInputSchema`/`UpdateCommentInputSchema`/`UpdatePostInputSchema`, keep `postNumberParamSchema`/`uuidParamSchema`. Register in `feedback.module.ts`. Note existing `workspaces/:ws/products/:product/comments` prefix is taken by `AdminCommentsController` (only `deleted`/`:id/restore`); route `PATCH/DELETE :id` must not collide with `deleted`. Repoint dashboard calls listed in RESEARCH CF-1 table.

### `apps/api/src/notifications/notifications.service.ts` (gate)

**Edit site** l.85-92:
```ts
private visible(userId: string) {
  return and(
    eq(notifications.userId, userId),
    isNull(posts.deletedAt),
    isNull(products.deletedAt),
    isNull(workspaces.deletedAt)
  );
}
```
Add `eq(products.boardEnabled, true)`. Both consumers already `innerJoin(products, ...)` (l.99, ~135). `fanOutStatusChange` stakeholder SQL gets an `EXISTS (... board_enabled)` early gate (callers: `moderation.service.ts`, `roadmap.service.ts`).

### `apps/api/src/email/outbox.ts` and `worker.ts`

**Enqueue** (raw SQL CTE `r`): add to the `WHERE` after `u.banned_at IS NULL`:
```sql
AND EXISTS (SELECT 1 FROM posts p JOIN products pr ON pr.id = p.product_id WHERE p.id = ${postId} AND pr.board_enabled)
```
**Worker** items query (l.160-205) already joins `products`; add `eq(products.boardEnabled, true)` inside the `and(...)` beside `isNull(products.deletedAt)`. The existing empty branch is the durable outcome (no new status):
```ts
if (items.length === 0) {
  await this.db.update(commentEmailBatches).set({ status: "cancelled" }).where(eq(commentEmailBatches.id, batch.id));
  cancelledCount++; continue;
}
```
D-16 strict mode: in the `updateProduct` handler, when `features.board === false`, delete pending `comment_email_items` and set `read_at = now()` on the product's unread notifications inside one `this.db.transaction(...)` (see `createProduct` transaction l.82-132 for the `tx` style).

### `apps/api/src/email/unsubscribe.controller.ts` (N7)

**Edit site** `resolvePost` l.71-97: add `boardEnabled: products.boardEnabled` to the select; when false return `{ live: true, title: null, url: null }` (mute/unmute still works). The return shape at l.118-123 already uses `postTitle: null, postUrl: null`.

### `apps/web/lib/portal-features.ts` (NEW) + test

**Analog:** `apps/web/lib/portal-motion.ts` + `portal-motion.test.ts` (pure helpers, node-env vitest, no hooks). Implement `portalTabs(ws, product, features, hasUser)`, `landingHref(ws, product, features)` (RESEARCH "Landing resolver"), `portalDescription(name, workspaceName, features)`. Import `PRODUCT_FEATURE_KEYS` from `@userhq/types`; never import `@userhq/db`.

### `apps/web/components/portal/portal-tabs.tsx`

**Current** (l.13-27): hardcoded `tabs` array and `activeHref` startsWith chain. Replace the array with `portalTabs(...)` and keep the `usePathname` active logic (l.29-38) and `<TabNav tabs activeHref />`. Add required `features` prop (UI-SPEC: no default).

### Portal RSC pages

**Analog:** `apps/web/app/[ws]/[product]/roadmap/page.tsx`.
```ts
const [productRes, roadmapRes] = await Promise.all([getPortalProduct(ws, product), getPublicRoadmap(ws, product)]);
if (!productRes.ok) { notFound(); }
const items = roadmapRes.ok ? roadmapRes.data.items : [];
```
Add after the `!productRes.ok` check: `if (!productRes.features.roadmap) notFound();` and return `{}` from `generateMetadata` (l.14-26) when off. Root `page.tsx`: when `!features.board`, `redirect(landingHref(...))` (from `next/navigation`, already used in `app/[ws]/page.tsx`) else render `StatePage` inside the frame with `robots: { index: false, follow: false }`.

### `product-features-form.tsx` (NEW)

**Analog (wiring):** `product-general-form.tsx`.
```tsx
const mutation = useMutation({
  mutationFn: async (data) => apiFetch(`/api/v1/workspaces/${ws}/products/${product.slug}`, { method: "PATCH", body: data, schema: ProductDetailSchema }),
  onSuccess: (updated) => { toast.success("Changes saved"); reset({...}); router.refresh(); },
  onError: (err) => setAlertError(errorCopy(err as any)),
});
...
<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
  <fieldset disabled={mutation.isPending} className="space-y-6">
  ...
  <Button type="submit" disabled={!isDirty || mutation.isPending}>
```
Wrap in `<QueryProvider>` with an `Inner` component (l.253-261). Imports use relative paths `../../../../../components/ui/*` and `lib/*` (l.16-24).
**Checkbox analog:** `workspace-settings-forms.tsx` l.282-298 (`type="checkbox"`, `{...register(...)}`, `className="size-4 mt-1 rounded border-border accent-foreground cursor-pointer"`). Use `font-semibold` not `font-medium` (UI-SPEC). **Confirm:** `ConfirmDialog` props at `components/ui/confirm-dialog.tsx` l.12-24 (`open, onOpenChange, title, description, dismissLabel, confirmLabel, confirmVariant, pendingLabel, onConfirm`). PATCH body is `{ features }` only.

### Settings `page.tsx`

**Analog:** self l.61-67; insert between General and Branding:
```tsx
<div className="border-t border-border pt-8 mt-8">
  <ProductBrandingForm ws={ws} product={productData} />
</div>
```
New section wrapper gets `id="portal-features"` and `scroll-mt-24`.

### `hidden-module-notice.tsx` (NEW) / `StatePage`

**Analog:** `components/state-page.tsx` (props interface + `React.JSX.Element` return, Tailwind tokens `text-muted-foreground`). Compose `Badge variant="outline"`, `Button asChild` + `Link` per UI-SPEC Surface 2.

### Tests

**Contract scan** (`public-contract.test.ts` l.20-67): extend the same `ModulesContainer`/`MetadataScanner` loop; for any controller path starting `portal/:ws/:product`, assert `Reflect.getMetadata("portalFeature", metatype) ?? Reflect.getMetadata("portalFeature", handler)` is defined.
```ts
const modulesContainer = testApp.app.get(ModulesContainer);
const methodNames = metadataScanner.getAllMethodNames(Object.getPrototypeOf(instance));
const methodPath = Reflect.getMetadata("path", handler);
```
**Behavior tests** (`product-features.test.ts`): `createTestApp()` returns `{ app, http, db, ... }`; `signedInCookie` and `seedTenants` from `test/support`. Cross-tenant and canary style from `portal-isolation.test.ts` and `canary-roadmap-leak.test.ts`. **Worker** pattern from `email.test.ts` l.199-215: `emailWorker.runOnce(new Date(Date.now() + 25 * 3600_000))`, assert `updatedBatch.status` is `"cancelled"`. **Browser** spec follows `test/browser/portal-branding.spec.ts`; assert `response.status() === 404`.

## Shared Patterns

### Uniform unavailable response
**Source:** `apps/api/src/portal/portal.guard.ts` l.21/34/57
**Apply to:** guard feature check, N-projection short-circuits
```ts
throw new ApiException("not_found", 404, "Not found.");
```

### Admin authorization (never replaced by the feature gate)
**Source:** `apps/api/src/products/products.controller.ts` l.47-49
**Apply to:** toggle endpoint, new admin Board controller
```ts
@Controller("workspaces/:ws/products")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
```
`tenant.productId` and `tenant.workspaceId` come from `@CurrentTenant()`, never the body.

### Serializer on every public handler
**Source:** `portal-posts.controller.ts` (`@Public()` + `@SerializeOptions({ schema: ... })`), enforced by `public-contract.test.ts`. New fields (`features`) must be added to the response Zod schemas or they are stripped.

### Explicit column select, no exclusion mode
`tools/oxlint-userhq.mjs` bans `columns: { x: false }`. Use `select({ ... })` maps as in `listProducts` l.142-149.

### Web server fetch
`lib/api-server.ts` exposes React-`cache()` wrapped `getPortalProduct`; layout, page and `generateMetadata` share one fetch. `apps/web` may not import `@userhq/db`, `drizzle-orm`, or use `import.meta.env`.

### Test/run commands
`bun run build:packages` before API tests (consume `dist`). Never `bun test`. Never `drizzle-kit push`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Landing fallback `redirect()` in root `page.tsx` | component | request-response | Only `app/[ws]/page.tsx` does a similar single-product redirect; combine with `landingHref` helper |
| Durable email suppression | service | batch | No new code; reuses existing `cancelled` outcome (worker l.196-203) |
| Unit test for `PortalGuard` feature check | test | request-response | No guard unit test exists; cover through HTTP matrix in `product-features.test.ts` |

## Metadata

**Analog search scope:** `apps/api/src/{auth,portal,products,feedback,roadmap,notifications,email}`, `apps/api/test`, `packages/db/{src,test}`, `packages/types/src`, `apps/web/{lib,components,app}`
**Files scanned:** about 25 read (sections), tracked-source check via `git ls-files`
**Pattern extraction date:** 2026-11-05
