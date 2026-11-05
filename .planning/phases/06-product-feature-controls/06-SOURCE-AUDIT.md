# Phase 6 source and decision audit

Research/UI reconciliation and independent plan check complete; see 06-PLAN-CHECK.md. Implementation is not claimed.

| Source | ID | Item | Plan/task | Status |
|---|---|---|---|---|
| GOAL | Phase6 | Four independently controlled modules, public denial and preserved private management | 01–10 | COVERED |
| REQ | CAP-01 | Owner/admin scoped choices | 01,04,08,10 | COVERED |
| REQ | CAP-02 | Defaults/content/relationships and restoration | 01,05,06,10 | COVERED |
| REQ | CAP-03 | Public API reads/writes and page denial | 03,04,07,10 | COVERED |
| REQ | CAP-04 | Retained private management | 02,04,08,10 | COVERED |
| REQ | CAP-05 | Navigation, landing, directory, single/all-off | 07,08,10 | COVERED |
| REQ | CAP-06 | Nested projections, links and metadata | 05,07,08,10 | COVERED |
| REQ | CAP-07 | Current notification availability and no replay | 06,10 | COVERED |
| REQ | CAP-08 | Migration/isolation/privacy/browser verification | all; final10 | COVERED |
| REQ | CAP-09 | Shared policy composing with auth | 01,03,04,06 | COVERED |
| RESEARCH | CF-1 | Board dashboard uses public endpoints | 02 before03 public gate | COVERED |
| RESEARCH | CF-2 | Generated duplicate device_info statements | 01.1 trim/regenerate;01.2 fresh/upgrade migration | COVERED |
| RESEARCH | N1 | Roadmap item in public post | 05.1;07 permalink | COVERED |
| RESEARCH | N2/N3 | Board linked posts/counts in Roadmap | 05.1;07.3 | COVERED |
| RESEARCH | N4 | Categories/shared status metadata | 05.2 | COVERED |
| RESEARCH | N5/N6 | Notification list/count/activity | 03.2;06.2 | COVERED |
| RESEARCH | N7 | Token-bearing unsubscribe title/URL | 05.2, preserving token actions | COVERED |
| RESEARCH | N8/N9 | Email and post timeline | 06;03 | COVERED |
| RESEARCH | N10 | FAQ/roadmap/dashboard links | 07.3;09.2 | COVERED |
| RESEARCH | Route scan | All product portal handlers explicitly classified | 03.3 | COVERED |
| RESEARCH | Migration/runtime | Generated committed SQL/advisory migrator/built packages/local fixtures | 01;all preconditions;10 | COVERED |
| RESEARCH | Open questions | Stateless recommendation superseded by D-16; OptionA admin routes selected | 02;06 | COVERED |
| UI-SPEC | U1/U2/U8 | Checkboxes, explicit Save, disable confirmation, typed flags | 01;08.1 | COVERED |
| UI-SPEC | U3/U4 | Branded200 noindex, retained directory entry | 07.1;10 | COVERED |
| UI-SPEC | U5/U7 | Hide less-than2 tabs, generic404 direct URLs | 07;10 | COVERED |
| UI-SPEC | U6 | Icons/notices, hidden public preview links | 09.1–2 | COVERED |
| UI-SPEC | States/copy | Errors, loading, saved-vs-dirty, exact empty/dialog copy, keyboard/mobile | 07;08;10 | COVERED |
| CONTEXT | D-02 | Existing delivery-policy seam only | 06 | COVERED |
| CONTEXT | D-07 | Four independent modules | 01;04;08 | COVERED |
| CONTEXT | D-08 | Backend/public URL enforcement | 03;04;07 | COVERED |
| CONTEXT | D-09 | Preserve content and private management | 02;05;09 | COVERED |
| CONTEXT | D-10 | Suppress projections/links/delivery and restore links | 05;06;07;09 | COVERED |
| CONTEXT | D-11 | Defaults, isolation and private field allowlists | 01;03–06;10 | COVERED |
| CONTEXT | D-12 | Both workflows, behavior-first tests, concrete review and diff review | every plan;10.2 | COVERED |
| CONTEXT | D-13 | Board→Roadmap→Changelog→FAQ→neutral | 07.1;10 | COVERED |
| CONTEXT | D-14 | No off-window replay | 06 | COVERED |
| CONTEXT | D-15 | All-off200 noindex and directory presence | 07.1;10 | COVERED |
| CONTEXT | D-16 | Strict old queued/unread suppression; TenantGuard Board paths | 06.1;02→03 | COVERED |

## Dependencies and sizing

Wave1:01. Wave2:02+06 (disjoint file ownership). Wave3:03. Wave4:04. Wave5:05. Wave6:07. Wave7:08. Wave8:09. Wave9:10. Each plan has1–3 tasks and at most28k estimated tokens, calibration factor1/confidence low from zero samples.

Initial persistence tracer uses five authored source/test files plus generated SQL/snapshot/journal and an export when required. Guard declarations and shared component/page props require explicitly enumerated coupled edits. These are bounded vertical slices; no task silently omits caller wiring.

Strict D-16 removes only derived unread delivery rows, never source content/activity/relationships. Marking read alone would allow them to reappear in notification history. Worker tests cover completed disable/re-enable before the final current-item read; an SMTP handoff already sent cannot be recalled. Existing bounded request race is distinguished from queued replay.

Raw uploaded assets remain served under existing unguessable URLs (Research A4); no disabled endpoint enumerates them. Per-file storage authorization is outside this phase and would need an explicit separate decision.

## Exclusions and pending gates

Appearance D-01, workspace inbox/attention D-03/D-04, automation D-05, webhooks D-06 and actual browser-push infrastructure D-02 remain their approved expansion slices. No new dependency or external API integration is needed in Phase6.

Research/PATTERNS are present and UI-SPEC frontmatter approved. Concrete Matt spec/test-seam/ticket/setup review and independent GSD checker remain parent gates. No implementation, product test/build result or live publication is claimed.

Parent owns REQUIREMENTS and STATE: update proposed-plan traceability cells to the CAP mapping above when accepting the ten-plan set.
