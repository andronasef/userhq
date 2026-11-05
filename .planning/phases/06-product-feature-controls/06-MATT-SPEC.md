# Phase 06 — Matt Spec Review

Reviewed HEAD: `fcd944bd2574c532fd4dcf89cc5f6fda2977b6f3`

Fixed point: `8897b404dd4ec8fb1082affe62ccccb03ea23686`; reviewed `git diff 8897b40...HEAD` and `git log 8897b40..HEAD --oneline` against the expansion spec's Phase 6 behavior, locked CONTEXT/UI-SPEC, CAP-01–09, and plans/summaries 01–10. Plan 10 acceptance evidence is still being produced; its unfinished tests are not counted as implementation defects.

## Spec findings

### CR-01 — BLOCKER: Concurrent fan-out escapes durable notification suppression

**Files:** `apps/api/src/notifications/notifications.service.ts:46–83`; `apps/api/src/products/products.controller.ts:319–331`.

**Spec:** `06-CONTEXT.md:18`: “queued mail and unread in-app rows from before a disable never surface after re-enable”; `:19`: “only events after re-enable notify.”

The availability SELECT and subsequent notification INSERTs do not share a product lock with disable-time cleanup. Pause fan-out after its stakeholder SELECT, complete the disable transaction, then resume insertion: cleanup misses the new row. Re-enabling exposes an old unread notification. Reproduced using the compiled service and a freshly migrated disposable database: unread count was **0 while off**, then **1 after re-enable** without any new event. The temporary database was dropped; no source changed.

**Fix:** Serialize availability checks and delivery creation against product disable using a common transaction-level product lock or durable capability generation. Apply the same synchronization to comment-email enqueue. Add a deterministic interleaving regression.

### WR-01 — WARNING: Refreshed flags leave the pristine feature form stale

**File:** `apps/web/app/dashboard/[ws]/[product]/settings/product-features-form.tsx:65–79`.

**Spec:** `06-UI-SPEC.md:189`: “checkboxes mirror saved features”; `:193`: “router.refresh() supplies fresh server state.”

Both `savedFeatures` and form defaults are initialized once. If another admin disables FAQ, then the current admin saves General or Branding and triggers `router.refresh()`, the sidebar receives fresh flags while the pristine checkbox and hidden-state badge retain the old enabled value. The stale-until-refresh allowance does not cover this state after refresh.

**Fix:** Synchronize changed server feature props into pristine form values and saved-state badges while preserving dirty user choices. Cover the General-save refresh path in the browser.

No confirmed Phase 6 scope creep found.

## Resolution notes

- **CR-01 — resolved** in `159920c`. RED first: `test/product-feature-delivery-race.test.ts` (commit `04d63ef`) failed on both the notification and email cases with the stale row surviving disable and re-enable (length 1, expected 0). `NotificationsService.fanOutStatusChange` and `enqueueCommentEmail` now `SELECT ... FOR SHARE` the `products` row (and return early if Board is off) before any delivery insert, holding the lock until the caller's transaction ends. The disable path needed no change: its `UPDATE products` takes a conflicting row lock, so it waits for an in-flight producer and its cleanup DELETEs then see that producer's rows. The test passed deterministically (3 consecutive runs, 2/2), and the delivery, notifications, email, comments and admin-board suites passed (32/32).
- **WR-01 — resolved** in `f0cf0d9`. `product-features-form.tsx` now passes `values: product.features` with `resetOptions: { keepDirtyValues: true }` to `useForm`, and resyncs the saved-state badges when the server flags change. The browser test "server refresh updates pristine features while preserving unsaved choices" (committed in `2aa76de`) failed first (FAQ checkbox stayed checked after a General-save refresh) and passes after a stack rebuild.
