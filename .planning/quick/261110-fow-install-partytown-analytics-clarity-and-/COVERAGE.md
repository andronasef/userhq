# API Coverage — selected analytics capabilities

The user explicitly chose provider dashboards, event analytics, public session replay and errors/performance. Other vendor product families are outside this request.

| capability | decision | reason |
|---|---|---|
| GTM loading and dataLayer forwarding | INTEGRATE | Supplied GTM container via Partytown |
| GA4 sanitized page/content and named events | INTEGRATE | Six accepted outcome families |
| GA4 opaque user identity and reset | INTEGRATE | Explicitly accepted after sign-in linking |
| GA4 funnels/cohorts/dimensions | INTEGRATE | Event definitions and exact provider configuration guide |
| GA4 Measurement Protocol vendor transport | OPT-OUT | No G-ID/API secret supplied; use server-confirmed receipts relayed by the browser rather than duplicate server event delivery |
| GA4 advertising, audience exports, ecommerce | OPT-OUT | User selected product analytics; no ads or purchases in UserHQ scope |
| GA4 account/admin/reporting APIs | OPT-OUT | User views provider dashboards; no account automation requested or authorized access provided |
| Clarity public anonymous session replay/custom events | INTEGRATE | Explicit public-only masked recording boundary |
| Clarity account identification/private screen replay | OPT-OUT | User accepted session-only public recording and exclusion of private screens |
| Clarity advertising integrations/account APIs | OPT-OUT | Not part of accepted recording capabilities |
| New Relic browser errors/performance/release | INTEGRATE | Supplied browser agent configuration |
| New Relic Node APM/errors and request correlation | INTEGRATE | Optional genuine server agent config; license key still required |
| New Relic safe operational snapshots | INTEGRATE | Read-only DB report and optional bounded diagnostic forwarding |
| New Relic replay/log content/request-response bodies | OPT-OUT | Explicit diagnostics-only and sensitive-data exclusions |
| New Relic infrastructure agents/NerdGraph account provisioning | OPT-OUT | No infrastructure or account management requested |
| Consent/opt-out UI | OPT-OUT | User explicitly deferred and requested no controls |
| UserHQ analytics dashboard | OPT-OUT | User explicitly uses provider dashboards |
