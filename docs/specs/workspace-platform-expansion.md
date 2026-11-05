# Workspace platform expansion

**DRAFT — product behavior approved; concrete test seams, ticket sizing and setup draft await review.** No feature implementation or external publication is recorded by this document.

## Problem Statement

Admins must switch between product boards to understand customer demand and outstanding conversations. They cannot tailor which modules a product exposes or automate routine work with supported credentials. Customers lack an appearance preference and optional browser updates.

## Solution

Add five capabilities: appearance preferences, optional browser push, a workspace feedback inbox, an admin automation API with webhooks, and independent product feature controls. Preserve tenant isolation, private roadmap data, and existing product content.

## Current state

Each product has one feedback board plus roadmap, changelog and FAQ. The workspace dashboard lists products. In-app status notifications and comment email delivery already exist. Browser push, theme selection, automation API keys, and feature switches are new work.

## User Stories

1. As a visitor, I want Light, Dark and System appearance, so that the portal is comfortable to read.
2. As an admin, I want the same appearance choices in the dashboard, so that my work remains comfortable.
3. As a returning visitor, I want my preference remembered, so that I do not repeatedly select it.
4. As a customer, I want optional push for replies and followed-request status changes, so that I can leave the portal open or closed.
5. As an admin, I want to follow selected products, so that unrelated activity does not interrupt me.
6. As a recipient, I want event preferences and grouped activity, so that updates remain useful.
7. As a recipient, I want generic push text by default and optional previews, so that notification content stays under my control.
8. As a visitor, I want permission requested only after I select Enable push, so that I understand the request.
9. As an admin, I want requests from every workspace product in one inbox, so that I can compare demand.
10. As an admin, I want product, category, status and date filters, so that I can narrow my work.
11. As an admin, I want demand and recent-activity sorting, so that I can prioritize.
12. As an admin, I want shared status meanings alongside custom product names, so that filters work across products.
13. As an admin, I want a separate comments feed with request and product context, so that I can reply directly.
14. As a team, I want shared Needs attention state, so that work is not lost between admins.
15. As an admin, I want replying or marking handled to resolve a comment, so that completed work leaves the queue.
16. As a team, I want new customer replies to reopen attention, so that follow-ups receive a response.
17. As an admin, I want personal unread state separate from handling, so that reading does not resolve team work.
18. As an admin, I want scoped, expiring and revocable workspace API keys, so that integrations have limited access.
19. As an admin, I want optional product restrictions on keys, so that integrations reach only their intended products.
20. As an integrator, I want documented requests, comments, status, roadmap, changelog, FAQ and product-setting operations, so that routine work needs no UI.
21. As an integrator, I want paginated feedback exports, so that I can analyze demand externally.
22. As an admin, I want integration audit attribution, so that automated changes are traceable.
23. As a customer, I want integration-submitted feedback to retain its source, so that it does not falsely imply I performed the action.
24. As an integrator, I want signed activity webhooks with retries and stable event identifiers, so that my tools can respond reliably.
25. As a workspace owner or admin, I want independent Board, Roadmap, Changelog and FAQ switches, so that each portal fits its product.
26. As an admin, I want disabled content preserved and editable privately, so that I can prepare and later restore it.
27. As a customer, I want disabled features absent from navigation, links and public endpoints, so that the portal consistently reflects its configuration.
28. As an admin, I want existing products to retain their enabled modules, so that upgrading changes no current behavior.
29. As a customer, I want notifications to respect current access and feature availability, so that they do not reveal unavailable content.
30. As a tenant, I want workspace boundaries and private roadmap fields protected across every new capability, so that my data stays private.

## Implementation Decisions

### Locked behavior

- **D-01:** Light/Dark/System across dashboard and public portals; default System; remember each visitor's choice.
- **D-02:** Optional browser push for admins' selected-product new requests/comments and customers' replies/followed status changes. Event preferences, grouping, explicit Enable push permission trigger, generic default text, optional previews, retryable outbox, and current-access/preference checks before delivery.
- **D-03:** Workspace main inbox retains individual boards; separate Requests/Comments; product/category/status/date filters; demand/recent activity sorting; product context; direct reply; shared status meanings with custom names retained.
- **D-04:** Needs attention is team-shared. Admin reply or explicit handling resolves a customer comment; a new customer reply reopens it. Personal unread state is independent.
- **D-05:** Workspace API keys have explicit permissions, expiration, revocation, optional product restrictions, one-time secret display and integration attribution. Support the operations in story 20 and feedback export. Customer-attributed submissions still identify their integration source. Ownership transfer and workspace deletion are excluded initially.
- **D-06:** Signed outbound webhooks cover requests, comments, status changes and published content; use outbox retries and stable event identifiers.
- **D-07:** Owners/admins independently control four product features, including standalone FAQ/changelog combinations.
- **D-08:** Disabled modules disappear publicly and reject direct public URLs and API reads/writes. Backend enforcement is mandatory.
- **D-09:** Preserve content and relationships. Authorized admins retain management access and can re-enable modules; later automation follows the same authorization policy.
- **D-10:** Suppress public links/previews into disabled modules, including notification links. Pause customer notifications and recheck availability at delivery. Re-enabling restores valid links/relationships.
- **D-11:** Existing products migrate with all four modules enabled. Tenant isolation and public roadmap allowlists remain trust boundaries.
- **D-12:** Use both GSD and Matt's skills, GitHub Issues as intended ticket tracker, and one root glossary. Concrete setup/spec/ticket review precedes publication and execution.

### Engineering proposals for review

Extend existing product settings and shared response contracts with a four-boolean capability object. Reuse tenant authorization and add a public feature policy; disabled public access should return a consistent not-found response. Keep branding metadata reachable while excluding disabled module data.

**D-13 (confirmed 2026-11-05):** landing fallback is Board, Roadmap, Changelog, FAQ, then a neutral unavailable state when all are disabled. **D-14 (confirmed 2026-11-05):** notifications suppressed while a feature was disabled are not replayed on re-enable.

Theme storage, exact API key scopes, route names, retry timings and webhook signing format remain implementation details to resolve during phase research. Store only secure API-key hashes. Reuse business services, explicit public response allowlists, and generated committed migrations applied by the existing migrator. No database schema push.

### Proposed ticket graph

| Slice | End-to-end delivery | Blocked by |
|---|---|---|
| 1. Appearance | Visitor selects/persists theme across portal and dashboard | None |
| 2. Product feature controls | Admin configures modules; public access, links and delivery honor them; data survives re-enable | None |
| 3. Workspace requests | Admin filters/sorts all workspace requests with product context | None |
| 4. Comments and attention | Direct replies, shared handling/reopening, personal unread state | 3 |
| 5. API keys/read/export | Admin creates limited credentials and integration reads/exports within scope | None |
| 6. API writes and audit | Integration changes supported resources with traceable attribution | 5 |
| 7. Signed webhooks | Integration receives signed, retryable audited activity events | 6 |
| 8. Browser push | User opts in; preferences, subscriptions and delivery rules work end to end | 2, 4 |

Slice 2 is the first scheduled work and is decomposed into four GSD execution plans. Ticket granularity remains proposed: refine broad slices into context-sized vertical tickets before publishing. Other ready slices do not become blockers merely because they are scheduled later.

## Testing Decisions

**Proposed seams pending review:** prefer existing Nest HTTP/controller tests with the real test database and authentication harness, then Docker-backed HTTP and Playwright journeys for rendered behavior. Observe requests/responses, persistence, permissions, and delivery outcomes; do not mirror helper implementations.

Use existing product, portal, isolation, roadmap privacy, notification and email tests as prior art. Extend these seams rather than creating parallel app bootstraps. Controlled SMTP/push/webhook receivers prove retry, duplicate suppression, revoked access and disabled-feature behavior. Browser tests cover theme persistence, system changes, first paint, module settings, links, inbox handling and keyboard/mobile access. Do not claim those tests ran during this documentation task.

## Out of Scope

Billing or plan entitlements; a separate boards entity; per-product team memberships; native mobile push; new auth providers; ownership transfers/workspace deletion via the initial automation API. This capture does not implement features, publish tickets, edit the live roadmap, deploy, or modify agent steering files.

## Further Notes

Review checklist: confirm spec completeness; proposed HTTP/browser/delivery test seams; ticket sizing and blocking edges; setup draft; fallback order/not-found behavior; and notification re-enable semantics. Then publish the approved spec/tickets to GitHub and use GSD research, UI specification, plan checking and execution with Matt behavior-first implementation/review. Feature-form scripts were provided in conversation, but saved live roadmap entries have not been verified.
