---
phase: "06"
slug: product-feature-controls
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-07"
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Public portal to API | Anonymous or customer requests to `/portal/:ws/:product/**`, gated per module by `PortalGuard` + `@PortalFeature` | Board, roadmap, changelog and FAQ content; branding metadata |
| Dashboard to API | Owner/admin requests through `TenantGuard` (settings PATCH, admin Board routes) | Feature flags, hidden-module content |
| API to customer delivery | Email outbox, in-app notifications, push, rechecked against live flags | Notification titles and links |
| Roadmap internals to public | Internal roadmap fields must never reach a public endpoint | Internal roadmap fields (canary-tested) |

---

## Threat Register

31 entries: 30 per-plan threats plus `T-06-SC` (identical in all ten plans, counted once). All have disposition `mitigate`, severity `high`, status **closed**. Evidence is in the auditor report summarised below.

| Threat ID | Category | Component | Mitigation (evidence) | Status |
|-----------|----------|-----------|-----------------------|--------|
| T-06-01-01..03 | EoP / Info disclosure / Tampering | Settings PATCH, public `features` DTO, stored flags | `TenantGuard`-scoped PATCH, `pickFeatures` allowlist, strict per-key merge, `NOT NULL DEFAULT true` migration 0013 | closed |
| T-06-02-01..03 | EoP / Info disclosure / Tampering | Admin Board routes | Board management on `TenantGuard` admin routes, no feature check on admin paths (D-09), in `CROSS_TENANT_ROUTES` | closed |
| T-06-03-01..03 | EoP / Info disclosure / Tampering | `PortalGuard` Board gate | Fail-closed `@PortalFeature` on all portal controllers, uniform 404, no admin exemption, reads own scoped product row | closed |
| T-06-04-01..03 | EoP / Info disclosure / Tampering | Roadmap, Changelog, FAQ gates | Class-level gates, 16-flag-combination test, roadmap canary, content preserved while hidden | closed |
| T-06-05-01..03 | EoP / Info disclosure / Tampering | Nested projections (linked posts, counts, categories, statuses, unsubscribe) | Read-time public projection context, no writes, relationships preserved | closed |
| T-06-06-01..03 | EoP / Info disclosure / Tampering | Delivery suppression | `FOR SHARE` product lock on enqueue, same-transaction cleanup of derived rows only, send-time worker recheck | closed |
| T-06-07-01..03 | EoP / Info disclosure / Tampering | Web portal composition | Pages check flags then `notFound()` before content/metadata, all-off noindex page, `no-store` product fetch | closed |
| T-06-08-01..03 | EoP / Info disclosure / Tampering | Settings form | Dirty-keys-only PATCH to the TenantGuard route, no public links for disabled modules | closed |
| T-06-09-01..03 | EoP / Info disclosure / Tampering | Dashboard pages | Flags from admin `ProductDetail`, writes through tenant-guarded routes, hidden-module editing preserved | closed |
| T-06-10-01..03 | EoP / Info disclosure / Tampering | Acceptance journey | Cross-tenant route-set equality, canary + projection tests, race test | closed |
| T-06-SC | Tampering | Dependency installation | No dependency change across Phase 6 | closed |

*Status: open · closed. Severity: only open threats at or above `block_on: high` count toward `threats_open`.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | AF-04 (info) | `/uploads/<key>` is served statically; images embedded in hidden Changelog/FAQ content stay fetchable by direct URL. Keys are unguessable and no gated API lists them. | project owner (pending confirmation) | 2026-11-07 |

---

## Additional Findings (post-Phase-6 paths, not in the register)

| ID | Sev | Finding | Resolution |
|----|-----|---------|------------|
| AF-01 | Low | Pending `webhook_deliveries` are not suppressed in the Board/Changelog disable transaction, so a delivery that survives disable then re-enable is sent (diverges from D-14) | Fixed in quick-261108-b3i (tests c07a0c3, fix 5edda00) |
| AF-02 | Low | `PostsService.getPostPage` projection argument defaults to `admin` (fails open if a future caller omits it) | Fixed in quick-261108-b3i (tests c07a0c3, fix 5edda00) |
| AF-03 | Info | `webhookEventModule` returns null (ungated) for unknown event prefixes | Fixed in quick-261108-b3i (tests c07a0c3, fix 5edda00) |
| AF-04 | Info | Static uploads not module-scoped | Accepted, see AR-06-01 |

Verified honouring disabled-module rules: webhook enqueue and worker recheck, all four push enqueue paths and worker, inbox replies via `CommentsService`, API-key default-deny on unscoped routes.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-07 | 31 | 31 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
