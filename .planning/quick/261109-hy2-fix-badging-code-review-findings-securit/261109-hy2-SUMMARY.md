---
status: complete
phase: quick-261109-hy2
plan: 01
---

# Badging review fixes

Completed on 2026-11-10. Implementation commits: a272547 (attribution) and 16122d5 (admin contracts, migration and directory).

## Finding coverage

- HY2-01: remove the public self-claim route.
- HY2-02: version the portal API call and scrub signature parameters before sending, matched keys afterward.
- HY2-03: signed httpOnly, product-bound guest cookies; bind on authenticated browser attribution or post/comment/vote interaction and clear consumed cookies.
- HY2-04: cap inputs, patterns and rules; anchor regex matching and throttle attribution.
- HY2-05: byte-safe MAC comparisons and timestamp-inclusive signatures with a 30-day age window and five-minute future tolerance.
- HY2-06: validate and serialize public/admin handlers with shared contracts; classify public routes.
- HY2-07: regression and cross-tenant coverage.
- HY2-08: require workspace membership or product participation for manual grants.
- HY2-09: use product activity/grant dates instead of account creation or the current time.
- HY2-10: shared mappers and typed rule/source columns.
- HY2-11: exact/regex parameter-name matching, generated migration 0026 and form control.
- HY2-12: API reference, user guide, specification, LLM guide and unreleased changelog updates.
- HY2-13: deferred inbox/requests badge filters and public feed-list badges. Public board rows have no author field (a new public-data decision); workspace feeds span products (requiring a cross-product picker and tenant-verified feed queries); implementing these also exceeds this repair plan's context budget.

## Decisions and adjacent fixes

Authenticated browser attribution performs session binding because a portal RSC cannot forward a clearing Set-Cookie header. Two-stage URL scrubbing preserves private rule definitions. Adjacent fixes include versioning admin fetches, correcting the broken test harness and invalid-body handling, prototype-safe parameter lookup, omitting directory email for API keys, fixing empty create-description payloads and stale author fixtures/assertions, and repairing directory SQL (comment scoping through posts and explicit SQL arrays). A 50-rule cap and API-key email redaction are discretionary hardening additions.

Regex caps, anchoring and throttling do not eliminate catastrophic backtracking in an admin-authored pattern; a linear-time engine remains follow-up work. Signed links remain replayable by holders inside their accepted window.

## Documentation review

Updated docs/README.md, README.md, llms.txt and docs/deploy.md in addition to the planned guides. docs/api-quickstart.md reviewed: its existing workflows and versioned examples remain accurate; no badge example duplicated there. No new deployment environment variables. BETTER_AUTH_SECRET rotation invalidates pending attribution cookies.

Global userhq skill instructions and reference copies updated locally. skills-manager-cli is absent from PATH; deploying the refreshed skill to agent targets remains pending. Helper CLIs need no new command for this change; canonical routes are available through the reference.

## Verification

- Lint-rule suite: 26 passed.
- Attribution API/security/public contract: 28 passed; URL helpers: 3 passed.
- Shared types: 40 passed; DB: 7 passed; web: 320 passed; cross-tenant: 104 passed.
- Root typecheck and migration db:check passed. Lint passed with warnings.
- Build of shared packages passed; migration 0026 was generated and checked. git diff --check passed.
- Initial full API run: 865 passed, 5 failed; directory SQL and stale author assertion repaired. Final full API rerun: 66 files, 870 tests passed.

All HY2-01 through HY2-12 repairs are complete. HY2-13 remains explicitly deferred as above. Reserved parameter suffixes fail shared-schema validation with 400 validation_failed; invalid regex and rule-cap failures use badge_rule_invalid. Missing product-scoped revocations return 404 not_found. No branch push, release tag or deployment performed.
