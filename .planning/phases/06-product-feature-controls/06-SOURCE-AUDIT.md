# Phase 6 source and decision audit

**Proposed, not executed.** No separate phase RESEARCH, UI-SPEC, plan-check verdict or implementation evidence was produced by the documentation capture.

## Goal coverage

| Scope | Requirement | Plans/tasks | Existing evidence/pattern |
|---|---|---|---|
| Independent scoped controls | CAP-01 | 06-01 tasks 1–2; 06-02 task 1 | ProductsController, TenantGuard, product general settings |
| Defaults/data preservation | CAP-02 | 06-01 tasks 1–3; 06-04 task 2 | tenancy schema; committed migrations/test database migrator |
| Public API/page denial | CAP-03 | 06-01 tasks 1–3; 06-02 both | PortalGuard and portal feature controllers |
| Authorized admin access | CAP-04 | 06-01/02; 06-04 task 2 | Existing TenantGuard-protected controllers |
| Navigation/landing | CAP-05 | 06-01 Board tracer; 06-03 task 1 | Product page/layout, portal tabs/cards |
| Cross-feature projection | CAP-06 | 06-03 task 2 | Roadmap linked posts, portal metadata, FAQ CTA, activity |
| Notification delivery | CAP-07 | 06-04 task 1 | Existing outbox/worker/render and in-app service |
| Isolation/privacy proof | CAP-08 | Every plan; 06-04 task 2 | HTTP fixtures, portal-isolation/canary tests, Playwright |
| Shared policy/future reuse | CAP-09 | 06-01/02; 06-04 task 1 | Composed tenant/public guards, worker policy seam |

## Locked decision traceability

| Decision | Destination |
|---|---|
| D-01 appearance | Expansion slice 1; outside phase 6 |
| D-02 push | Expansion slice 8; only existing delivery-policy reuse in 06-04 |
| D-03 workspace requests/comments | Expansion slices 3–4; outside phase 6 |
| D-04 shared attention/unread | Expansion slice 4; outside phase 6 |
| D-05 automation keys/API | Expansion slices 5–6; outside phase 6 |
| D-06 webhooks | Expansion slice 7; outside phase 6 |
| D-07 independent modules | 06-01/02/03 |
| D-08 public enforcement | 06-01/02/03 |
| D-09 preserved content/admin access | 06-01/02/03/04 |
| D-10 links/notifications/re-enable | 06-03/04 |
| D-11 defaults/isolation/privacy | Every plan, final matrix in 06-04 |
| D-12 both workflows/setup review | Context prerequisites, all plan objectives, setup proposal |

## Constraints and open engineering proposals

Existing schema/contract/controller/component/test pointers are listed in 06-CONTEXT. No new board entity, auth stack or native dependency is planned. Migration generation/committed SQL/advisory-lock application remain mandatory. Scope expansion must preserve admin authorization and public explicit DTO allowlists.

Engineering details awaiting review/research: four booleans versus comparable typed persistence; capability object exact contract; not_found response; landing fallback order; durable notification suppression outcome; final policy module placement; category/status metadata suppression. Endpoint inventory must cover public signed-in mutations, standalone permalinks, activity and nested linked data; auth/account/unsubscribe are explicit exemptions.

Main proposed test seams are existing Nest HTTP/Postgres acceptance and Docker HTTP/Playwright journeys, with controlled delivery receivers. Exact endpoint/code scope is reconciled during research and plan checking. Paths named product-features.test.ts and product-features.spec.ts are future test artifacts, not current evidence.

## Review status

- Product behavior: approved in two user interview rounds.
- Concrete spec/test seams/ticket sizing/blockers: pending Matt review.
- Tracker setup draft: pending concrete review; intended GitHub/single-glossary direction approved.
- Phase research, UI-SPEC, security/plan checking: pending.
- Feature implementation and live roadmap publication: not performed or verified by this capture.
