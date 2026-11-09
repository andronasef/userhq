---
phase: 07-appearance
reviewed: 2026-11-10
depth: standard
scope: user-badging-quick-tasks
diff_base: 45dc30a
head: 344da9e72551867c5f2795b484b3d9d37c9f89f4
files_reviewed: 50
files_reviewed_list:
  - CHANGELOG.md
  - README.md
  - apps/api/src/app.module.ts
  - apps/api/src/badges/attribution-bind.interceptor.ts
  - apps/api/src/badges/attribution.ts
  - apps/api/src/badges/badges.controller.ts
  - apps/api/src/badges/badges.module.ts
  - apps/api/src/badges/badges.service.ts
  - apps/api/src/badges/portal-badges.controller.ts
  - apps/api/src/badges/product-users.controller.ts
  - apps/api/src/feedback/comments.service.ts
  - apps/api/src/feedback/feedback.module.ts
  - apps/api/src/feedback/portal-comments.controller.ts
  - apps/api/src/feedback/portal-posts.controller.ts
  - apps/api/src/feedback/portal-votes.controller.ts
  - apps/api/src/feedback/posts.service.ts
  - apps/api/test/attribution.test.ts
  - apps/api/test/badges-attribution.test.ts
  - apps/api/test/badges.test.ts
  - apps/api/test/cross-tenant.test.ts
  - apps/api/test/posts.test.ts
  - apps/api/test/public-contract.test.ts
  - apps/api/test/support/seed.ts
  - apps/web/app/[ws]/[product]/layout.tsx
  - apps/web/app/dashboard/[ws]/[product]/settings/page.tsx
  - apps/web/app/dashboard/[ws]/[product]/settings/product-badges-form.tsx
  - apps/web/app/dashboard/[ws]/[product]/users/page.tsx
  - apps/web/components/badges/badge-chip.tsx
  - apps/web/components/dashboard/sidebar.tsx
  - apps/web/components/portal/portal-badge-attribution.tsx
  - apps/web/components/post/author-line.tsx
  - apps/web/components/product-users/product-users-manager.tsx
  - apps/web/lib/attribution.test.ts
  - apps/web/lib/attribution.ts
  - apps/web/test/badges-ui.test.tsx
  - docs/README.md
  - docs/automation-api.md
  - docs/deploy.md
  - docs/llm-guide.md
  - docs/specs/user-badging-engine.md
  - docs/user-guide.md
  - llms.txt
  - packages/db/migrations/0025_jazzy_wildside.sql
  - packages/db/migrations/0026_badge_rule_key_match_type.sql
  - packages/db/src/index.ts
  - packages/db/src/schema/badges.ts
  - packages/types/src/badges.ts
  - packages/types/src/feedback.ts
  - packages/types/src/index.ts
  - packages/types/test/badges.test.ts
findings:
  critical: 4
  warning: 1
  info: 0
  total: 5
status: issues_found
---

# User Badging Quick Tasks: Code Review

The phase-07 directory is used for GSD workflow routing only. This report reviews the badging branch changes from `45dc30a` to `344da9e`, including original implementation and repair commits, not the Appearance phase.

## Narrative Findings (AI reviewer)

### CR-01: API-key search leaks the email addresses that response redaction hides

**Classification:** BLOCKER (security/privacy).
**File:** `apps/api/src/badges/badges.service.ts:374`
**Issue:** `includeEmail=false` only nulls the returned email at line 520; the search predicate still evaluates `u.email ILIKE` for API-key callers. A settings:read key can search an exact address or progressively longer substrings and inspect returned IDs/total to associate an email with a named customer even though every email field is null. This defeats the expressly introduced session-only email boundary.
**Reproduction:** Create a participant named Alice with email secret@example.test. With a settings:read key, GET the users route with search=secret@example.test (Alice is returned) and search=definitely-wrong@example.test (she is absent), while both calls expose null email. The unconditional SQL predicate and returned identities prove the oracle.
**Fix:** Include email in the search predicate only when includeEmail is true; API keys should search visible names only. Add a key-versus-session test checking search behavior, not just null output.

### CR-02: A schema-valid icon can crash public post rendering

**Classification:** BLOCKER (availability).
**File:** `apps/web/components/badges/badge-chip.tsx:46`
**Issue:** BADGE_ICONS is a normal object and indexed without an own-property check. Both create/update schemas accept any icon string up to 50 characters. The accepted value `constructor` resolves to Object via the prototype and is rendered as a React component at line 61. Object returns its props object, causing React to throw. Granting this badge makes post/comment pages containing that author fail rendering; the dashboard badge list fails too.
**Verification:** Transpiled the actual BadgeChip source with TypeScript and rendered it with react-dom/server using icon=constructor. It throws: “Objects are not valid as a React child (found: object with keys {className, aria-hidden}).” No source was modified.
**Fix:** Resolve icons with Object.hasOwn(BADGE_ICONS, icon) or a Map/null-prototype dictionary, and optionally validate supported icon names in shared input schemas. Test inherited names such as constructor and __proto__.

### CR-03: Signed attribution fails for allowed parameter names longer than 96 characters

**Classification:** BLOCKER (incorrect supported behavior).
**File:** `packages/types/src/badges.ts:187`
**Related:** `apps/web/lib/attribution.ts:15`
**Issue:** Rule creation permits exact parameter names of 100 characters, but attribution applies the same 100-character cap to companion keys. Appending _sig makes a 97-character name produce a 101-character key. The browser silently drops this signature; direct API requests containing it receive 400. Valid signed links for allowed 97–100-character names therefore cannot work. Signature parameters dropped by the helper also remain in the address bar because signatureKeys is computed only from retained params.
**Verification:** Existing compiled shared schemas accept a signed rule with paramKey="a".repeat(100), while rejecting AttributeInputSchema with that name, its _sig and its _ts keys.
**Fix:** Distinguish base-key limits from companion-key limits in both browser and API (allow the suffix length only for valid companions), or consistently reduce the supported signed base-name limit. Ensure signature scrubbing inspects the original URL even when a field is rejected. Add boundary tests at 96, 97 and 100 characters.

### CR-04: Editing a comment removes its author's badge chips until reload

**Classification:** BLOCKER (incorrect visible behavior).
**File:** `apps/api/src/feedback/comments.service.ts:315`
**Issue:** createComment and timeline reads now hydrate author.badges, but updateComment constructs the author without badges. The shared schema makes the field optional, so this silently serializes successfully. CommentItem passes this response to PostTimeline.handleCommentUpdate, which replaces the entire comment rather than preserving old author fields. Editing any badged comment therefore removes its badge chips locally until a later reload.
**Reproduction:** Open a post containing a badged author's comment, edit that comment, and save. PATCH returns author without badges and the UI immediately replaces the previously badged author. The update handler does not refresh the route.
**Fix:** Hydrate current public badges for updated.authorId and portal.productId in updateComment, using the same mapping as create/read; return [] for deleted authors. Test the PATCH response for a badged author and the resulting UI update.

### WR-01: Concurrent rule creation bypasses the advertised 50-rule cap

**Classification:** WARNING (robustness/security hardening).
**File:** `apps/api/src/badges/badges.service.ts:301`
**Issue:** Rule count checking and insertion are separate statements outside a transaction/lock. At 49 rules, two concurrent authorized requests can both observe 49 and insert, leaving 51. Repeating parallel batches defeats the bound on public regex fan-out that the implementation and documentation claim. The existing test only checks serial creation after count is already 50.
**Fix:** Serialize additions per product, for example with a transaction locking the product row before counting and inserting; all creation paths must use the same lock. Add a concurrent-request test asserting the committed count never exceeds 50.

## Verification and scope notes

- Static source/caller/schema review plus two isolated reproductions described above.
- Prior green suites were treated as evidence of existing coverage, not proof against uncovered cases. No full test-suite rerun was necessary for this review.
- Source files were not edited and no commits were created by the reviewer.
- Deferred inbox/requests filters, public feed-list badges, and documented residual catastrophic regex backtracking were deliberately excluded.
- No structural fallow or external reviewer evidence was supplied.

_Reviewer: Codex (gsd-code-reviewer)_

