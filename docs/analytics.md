# Analytics and diagnostics

UserHQ sends product usage to Google Analytics through Google Tag Manager (`GTM-TNBWG655`), selected public session recordings to Microsoft Clarity (`zbe3hrnykn`), and browser errors/performance to the supplied New Relic browser application. Reports live in those providers, not in UserHQ. Production enables tracking by default. Development and test disable it; platform-owner activity is excluded. No consent banner or visitor opt-out control is included in this implementation. The operator has deferred consent-policy review.

## Execution and recording boundaries

GTM runs through `@qwik.dev/partytown` 1.0.5. Dev/build scripts copy same-origin worker assets to `/~partytown/`; vinext standalone includes them. Main-thread `dataLayer.push` calls are forwarded into the worker. The worker fallback is disabled rather than silently moving GTM onto the main thread.

Clarity runs on the main thread. A Chromium compatibility probe with the real Clarity 0.8.77 recorder and intercepted collectors showed that Partytown produced analytics packets but no playback packets; main-thread execution produced initial DOM snapshots and mutations. A successful collector request alone is not proof that replay works. New Relic also stays on the main thread to instrument real page errors and browser requests. Its replay, session traces, user actions, logging and AJAX payload capture are disabled.

Clarity initializes only on public index screens (marketing home, workspace directory, board, roadmap, changelog feed and FAQ), without query/hash or a potentially sensitive referrer. It does not initialize on content-derived post/release URLs, sign-in, invitations, account, activity, platform or dashboard screens. All body content is masked, including inputs and portal content; do not add `data-clarity-unmask`. Choose **Strict** masking in the Clarity project as defense in depth. Clarity still receives public page addresses and browser/device metadata; it is not an anonymous aggregate-only service. No account identifier is sent to Clarity.

Recorded public screens use full document navigation, including search URL changes, rather than preserving recorder observers across SPA screens. Anchor clicks, the shared imperative router and history transitions enforce this boundary. Private dashboard-to-dashboard navigation remains client-side. New client code must use `useAnalyticsRouter` from `lib/analytics-navigation` rather than importing `useRouter` directly when it can navigate between public and private screens.

Provider loading waits for the server's current-user classification. New Relic therefore does not capture every pre-hydration error; API APM and the application error boundary provide additional coverage. Blocked vendors, disabled workers, ad blockers, page exits and network loss can cause missing events. They must never prevent a product operation.

## Google Tag Manager configuration — required before GA4 receives data

Loading the supplied GTM container is not the same as configuring a GA4 web stream. No GA4 measurement ID or Measurement Protocol secret was supplied. This change does not publish tags or create reports in a private provider account.

1. In GA4, select/create the intended web stream and get its `G-…` measurement ID. In **Admin → Data streams → Enhanced measurement**, turn off automatic page, search, form, outbound-click and other content capture. Do not configure raw URL-based events.
2. In GTM, create a **Google tag** using that measurement ID. Set `send_page_view` to `false`. Restrict its trigger to the custom event `userhq_event`, so it initializes from the sanitized event context rather than collecting the initial raw URL. Use once-per-page tag firing. Set `page_location`, `page_title`, `page_referrer` and `user_id` from the data-layer variables below.
3. Create Version 2 data-layer variables named after `event_name`, `user_id`, `page_location`, `page_title`, `page_referrer`, and each event property listed below. Every event explicitly clears unused properties to prevent stale GTM values leaking between events.
4. Create a **Custom Event** trigger matching exactly `userhq_event`. Create a **Google Analytics: GA4 Event** tag using the measurement ID, event name `{{DLV - event_name}}`, and the listed property variables as event parameters. Include the sanitized page values. Configure the Google tag as its setup tag, and do not create a second automatic page-view trigger.
5. Set GA's `user_id` configuration to `{{DLV - user_id}}`. Do not register User-ID as a custom dimension. A logout pushes `userhq_identity` with `user_id: null`; add a Google tag update triggered on that event that sets `user_id` to the data-layer value, without sending a page view. Subsequent events also explicitly carry the cleared identity.
6. Register event-scoped custom dimensions for bounded `actor_role`, `surface`, `module`, `action`, `method`, `outcome`, `channel`, `notification_type`, `release` and `route`; register custom metrics for `result_count` and `duration_ms` only where needed. Do not register user, receipt or content identifiers as report dimensions. Register tenant IDs only after considering cardinality: high-volume dimensions can cause GA's `(other)` aggregation. Exact tenant reports may eventually need a deliberate export.
7. Preview against a disposable/test deployment with a temporary test container, verify one successful action produces one event, then publish the production container. Do not install additional Clarity or New Relic tags through GTM: those providers already load directly. Avoid automatic tag templates that reintroduce raw URLs/titles/form values. Verify **Realtime/DebugView** and an actual masked Clarity recording after deployment.

The application sends objects of this shape, not arbitrary application data:

```js
{
  event: "userhq_event",
  event_name: "vote_added",
  user_id: "opaque-account-identifier-or-null",
  actor_role: "customer",
  surface: "portal",
  module: "board",
  action: "vote",
  route: "/:ws/:product/p/:ref",
  page_location: "https://your-host/:ws/:product/p/:ref",
  page_title: "UserHQ board",
  page_referrer: "",
  workspace_id: "opaque-tenant-id",
  product_id: "opaque-product-id"
}
```

Allowed properties are `environment`, `release`, `actor_role`, `surface`, `module`, `action`, `method`, `outcome`, `channel`, `notification_type`, `result_count`, `duration_ms`, `resumed`, `workspace_id`, `product_id` and `route`. Their runtime schemas use fixed enums and numeric bounds. No names, email addresses, customer text, search terms, private roadmap fields, raw errors, query/hash strings, tokens or credentials belong in custom events. Page titles/locations/referrers are explicitly replaced. A dedicated optional `ANALYTICS_ID_SALT` stabilizes opaque account IDs; without it the application hashes random internal account IDs with its default namespace. Changing the salt changes cohort identity. Tenant IDs are keyed in the API and survive tenant slug changes; rotating the auth secret changes those tenant telemetry IDs.

## Event catalogue

| Events                                                 | Definition and delivery owner                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page_view`, `portal_viewed`                           | Browser route impression; once per pathname/document. Query changes are not independent page views. A portal impression is not proof of useful reading.                                                                                                                                                 |
| `content_opened`                                       | Browser post/release detail impression, explicit roadmap-modal open, FAQ answer open or changelog expansion. No titles or bodies.                                                                                                                                                                       |
| `search_completed`                                     | Browser FAQ search after 600 ms idle, with matching-answer count; board search after results render, with current page's result count (not a total across pagination). No raw search term.                                                                                                              |
| `search_result_opened`                                 | Explicit FAQ answer open while searching, or board result clicked while a search is active. Automatically expanded FAQ results do not count as explicit opens.                                                                                                                                          |
| `contribution_started`                                 | Vote-add intent, feedback composer opened, or comment submitted for validation. These start points differ; compare each action separately.                                                                                                                                                              |
| `sign_in_required`                                     | A logged-out vote/comment/submission action redirects to login. Merely displaying a sign-in button is not intent.                                                                                                                                                                                       |
| `auth_started`                                         | Google/GitHub button selected, with `method`.                                                                                                                                                                                                                                                           |
| `auth_failed`                                          | A known browser request failure or recognized OAuth error return. Cancellation, expiry and provider problems are separate categories. No observed return is not a confirmed technical failure.                                                                                                          |
| `sign_up`, `login`                                     | Actual Better Auth user/session creation on an OAuth callback. New accounts emit both; returning accounts only login. A short-lived signed httpOnly cookie is bound to the session/user and consumed by the browser's existing `/me` request. Root-page `/me` reads and refreshes do not invent logins. |
| `vote_added`, `vote_removed`                           | Committed vote state transitions; repeated idempotent PUT/DELETE operations do not count twice.                                                                                                                                                                                                         |
| `feedback_created`, `comment_created`                  | Confirmed API creations, not optimistic UI updates.                                                                                                                                                                                                                                                     |
| `public_response_added`                                | A real team member creates a public comment. Private read/handled state is not a public response.                                                                                                                                                                                                       |
| `post_auth_action_completed`                           | The original action completes for the same product within 30 minutes. Only action, local scope and timestamp are stored for this purpose; no draft content. This measures continuation, not whether a draft survived.                                                                                   |
| `validation_error_shown`, `contribution_failed`        | Client validation or failed mutation, with action/category and without field values or raw error text.                                                                                                                                                                                                  |
| `workspace_created`, `product_created`, `portal_ready` | Confirmed workspace/product creation and the initially usable public product. These are milestones, not the complete definition of activation.                                                                                                                                                          |
| `product_configured`                                   | A successful product settings update. Do not equate repeated saves with new activated workspaces.                                                                                                                                                                                                       |
| `team_invite_accepted`                                 | Successful one-use team invitation acceptance. Invite tokens never become event properties.                                                                                                                                                                                                             |
| `feedback_reviewed`, `feedback_handled`                | Personal comment read and changed shared handled state. These are internal operations, not customer acknowledgements.                                                                                                                                                                                   |
| `feedback_decision_published`                          | A changed public feedback status, including status cascades from roadmap work. A status transition is visible progress; its semantic meaning depends on your configured statuses.                                                                                                                       |
| `roadmap_feedback_linked`, `roadmap_status_changed`    | Confirmed linking and changed status of a public roadmap item. Pure private movement and rank-only moves are excluded from public progress.                                                                                                                                                             |
| `changelog_published`                                  | A manual draft-to-live publication that wins the durable announcement claim. Scheduling is not publication. Background scheduled publications have no browser relay; use the database and operational diagnostics for complete scheduled-publication totals.                                            |
| `notification_link_opened`                             | In-app click or safe email/push channel/type marker consumed on arrival. Includes subsequent actions in that page's attribution context. Does not claim delivery or reading.                                                                                                                            |

Successful operations accumulate in a request-local buffer, which is discarded on failure. The API returns a validated `x-userhq-analytics` response receipt only to browser requests marked `x-userhq-browser: 1`. `apiFetch` relays it once; components do not separately emit successful mutations. Receipts are best-effort and are not an event outbox. API keys/integration actors and the platform owner are excluded. Role is workspace-specific: a team member of another workspace is still a customer here. SSR uses `x-userhq-browser: context` to request opaque tenant context, never success events. Standard JSON response bodies and authorization remain unchanged.

## Reports and denominators

Build separate GA Explorations for customers and workspace teams:

- **Discovery:** content opens per portal visitor; module usage; zero-result searches / completed searches. A short FAQ visit may succeed; no event proves resolution.
- **Participation:** completed action / started action, separately for votes, comments and feedback. Follow sign-in-required → auth-started → login → post-auth-action-completed. Show known failures separately from incomplete observation.
- **Authentication:** login successes / auth starts, by provider/device/browser/language. `sign_up` distinguishes new accounts. Use an explicit funnel window and inspect repeated attempts; do not call an unobserved OAuth return a failure.
- **Workspace activation:** created → product ready → first external contribution → first team response/public decision. API events provide the workflow; the database provides current outstanding work. Do not count an owner's test vote or integration import as customer adoption.
- **Attention:** answered/decided share and elapsed time, keeping unanswered work in the denominator. Internal reads are not acknowledgements; shipping every request is not the objective.
- **Progress:** linked feedback and public decisions/changes, with manual and scheduled publication totals clearly separated. A published changelog is not automatically evidence that a particular feedback request shipped.
- **Retention:** weekly/monthly returning readers, contributors and administrators, using role-appropriate actions. Separate quiet workspaces from workspaces with ignored incoming requests.
- **Notification usefulness:** followed notification → subsequent content/action, by channel/type. Provider acceptance is not delivery; visiting is not reading.

Do not infer exact user counts from browsers or replay counts. Anonymous identities, blocked scripts, multiple devices, worker page exits, missing cookies and GA processing can change counts. GA's anonymous-to-signed-in association has session/device limits. Avoid depending on worker `user_engagement` exit events.

## Current-state operational report

After building packages/API, run with the intended database environment:

```sh
node --env-file=env.local.dev apps/api/dist/scripts/analytics-report.js
```

The read-only, 15-second-bounded CLI returns aggregate current external requests, unanswered/acknowledged counts, oldest unanswered age, completed-response median/p90, workspaces/products, ready portals, workspaces with responses and activation from retained external requests/votes/comments followed by a team response. It includes unanswered requests explicitly; medians describe completed responses only. Classification uses current membership, current undeleted rows and retained public comments/status activity; membership changes, deletions and pre-instrumentation history limit historical interpretations. Request-backlog metrics concern submitted requests; activation additionally considers retained external votes and comments. Deleted contributions and current membership mean this is a current-state reconstruction, not an immutable historical activation ledger. No customer text or contact data is printed. It is operator-only and exposes no HTTP endpoint.

## New Relic API monitoring

The supplied browser key is public browser configuration and is not a server ingest license. To enable optional Node APM, set `NEW_RELIC_LICENSE_KEY` to an actual server ingest key, optionally set `NEW_RELIC_APP_NAME` (default `UserHQ API`), and keep `NEW_RELIC_ENABLED=true`. The API startup wrapper preloads the agent and official ESM loader before Nest/pg. No key means ordinary Node startup with no server telemetry. Node ESM instrumentation remains vendor-dependent; verify real ingestion after configuring it.

Set `APP_RELEASE` to the deployed tag or commit SHA for browser error release correlation and event segmentation (default `unversioned`). Server request attributes, headers, SQL recording, automatic log forwarding and exception messages are disabled/redacted. API 5xx are reported using a generic error, not arbitrary exception content. Browser errors have generic messages and URL/email obfuscation; New Relic may still capture technical browser metadata. User-submitted content never belongs in custom diagnostics. Serve source maps through a restricted upload workflow rather than publishing source maps or secrets to the public web image.

Suggested operator-created New Relic alerts (examples, tune after observing volume):

- API 5xx rate: `SELECT percentage(count(*), WHERE http.statusCode >= 500) FROM Transaction WHERE appName = 'UserHQ API'`, above 5% for 5 minutes, only when request volume is meaningful.
- Slow requests: `SELECT percentile(duration, 95) FROM Transaction WHERE appName = 'UserHQ API'`, above 2 seconds for 10 minutes; compare against your measured baseline.
- Notification acceptance: `SELECT count(*) FROM UserHQDelivery FACET channel, outcome`. `provider_accepted` means SMTP/push provider acceptance, not device delivery or user reading. Retries count attempts.
- Backlog trend: `SELECT latest(unanswered_requests), latest(oldest_unanswered_hours) FROM UserHQBacklog` after deliberately scheduling reports with a correctly preloaded server agent and `--publish`. The report never installs a scheduler itself.

No provider dashboards, alerts, tags or live ingestion are claimed as created/verified by local code tests. Local tests stub collectors; do a real end-to-end account check after deploying and publishing GTM.
