# UserHQ instructions for LLM assistants

This guide describes operating the platform/API documented in this checkout (including unreleased changes). It is repository documentation, not a new API endpoint. Start with [the documentation index](README.md), [user guide](user-guide.md), [API quickstart](api-quickstart.md), and the canonical [Automation API reference](automation-api.md). The root [llms.txt](../llms.txt) is a repository-relative discovery index; these files are not automatically served by the deployed app.

## Use the right source

1. For a checked-out version, API controllers, guards and `packages/types/src` schemas define the implemented contract. Read the matching tag when explaining an older release.
2. The [canonical API reference](automation-api.md) lists all supported key-authenticated routes/scopes, pagination, errors and webhook details. Its route/constant inventory is checked by the existing docs-sync suite.
3. The [quickstart](api-quickstart.md) supplies working request shapes and workflows. Guides and release notes provide context; plans may describe work that is not implemented.

When sources disagree, name the discrepancy and verify implementation. Do not invent OpenAPI, `/docs`, GraphQL, token-refresh or batch endpoints. When editing this repository, obey [AGENTS.md](../AGENTS.md), including GSD and release documentation rules; this operating guide does not override them.

## Establish intent and identifiers first

- Determine whether the person is a customer, workspace owner/admin, integrator or deployment operator. Customer portal access is not workspace administration access.
- Establish the deployment origin, workspace slug, product slug, intended task and credential scopes. Do not ask for tokens in chat or put them in logs, URLs, examples or commits; use the environment/secret mechanism available to the integration.
- Discover product/status/category UUIDs with `settings:read`; a restricted key cannot list all workspace products. If it cannot discover identifiers, obtain them from the authorized person instead of widening the key.
- Distinguish post **number** from post UUID. A create-post result returns `number`/`slug`; request inbox/search results provide UUIDs for roadmap links. Preserve the product context around each post number.
- Read current state before edits. Status updates require the current post `version`; a merged post detail can return `kind: "redirect"` rather than a post.

## Choose an allowed operation

All paths below are relative to `/api/v1/workspaces/:ws`. `P` means `/products/:product`, with slugs substituted and path components encoded. Consult the reference for the complete table and body schemas.

| Goal | Route family / method | Scope and important boundary |
| --- | --- | --- |
| Read cross-product requests | `GET /requests` | `requests:read`; unrestricted key only; response `items` and `nextCursor`. |
| Read one product's board/detail | `GET P/posts`, `GET P/posts/:number` | `requests:read`; detail may redirect after merge. |
| Submit/edit a request | `POST P/posts`, `PATCH P/posts/:number` | `requests:write`; confirm the intended customer-visible content. |
| Change post status | `PUT P/posts/:number/status` | `requests:write`; `statusId`, `version`, optional `note`. |
| Triage comments/reply | `GET /comments`, `POST /comments/:id/reply` | `comments:read` / `comments:write`; workspace-wide, unrestricted key only. |
| Reply with a restricted key | `POST P/posts/:number/comments` | `comments:write`; `body`, optional `parentId` in the same post. |
| Handle/reopen attention | `POST` / `DELETE /comments/:id/handled` | `comments:write`; team-shared attention, not personal read state. |
| Plan, edit, move or link work | `P/roadmap` and its item/move/link routes | `roadmap:read` / `roadmap:write`; linking/moving can change feedback statuses. |
| Draft or publish release notes | `P/changelog`, `POST P/changelog/:id/publish` | `changelog:read` / `changelog:write`; rich-text JSON `content`; publishing is deliberate. |
| Manage FAQ answers | `P/faq/categories`, `P/faq/questions` | `faq:read` / `faq:write`; rich-text JSON `answer`, category UUID required. |
| Read/change modules or product profile | `GET` / `PATCH P` | `settings:read` / `settings:write`; partial `features` keys: board, roadmap, changelog, faq. |
| Manage product badges and users | `P/badges`, `P/users` and badge/rule/grant routes | `settings:read` / `settings:write`; product-scoped; grants require a member or participant. |
| Receive outbound events | `/webhooks` and delivery routes | `webhooks:read` / `webhooks:write`; unrestricted key, public HTTPS receiver. |
| Export privileged feedback | `GET /export/feedback` | `export:read`; unrestricted key even with productId; protect author emails and output. |

`admin` covers automation scopes only. It never grants API-key management, webhook-secret rotation, team/invite operations, workspace settings, product creation/deletion, uploads, personal read state, push settings, OAuth or public portal operations. These are session-only. Do not bypass `403 api_key_route_forbidden` by adding cookies or switching identity.

## Preserve boundaries

- Rule secrets are write-only. Never put secrets, signing-example secrets or attribution cookies in logs, URLs or commits. Attribution links are generated by the customer backend, not an assistant. API keys receive no directory email; the public attribution call is not an automation route.

- Public roadmap fields are separate from internal fields. Never publish internal titles, descriptions, notes, deadlines, assignees or raw admin responses. A public item also needs an enabled Roadmap and a status enabled for the public roadmap.
- Public post/comment attribution may name an integration, but never include an API-key ID. Do not turn an API-key action into a person's action or claim that a key-created post casts a vote.
- Product restrictions are UUID allowlists, scoped to one workspace. `null`/omitted on creation means all products; `[]` is rejected. Malformed stored lists fail closed. Restricted keys cannot use workspace-wide routes even with a product filter.
- Webhook PATCH omission preserves current restrictions; `null` removes them. Do not silently widen restrictions when translating user intent.
- Disabled modules preserve admin data and management access but hide customer routes/navigation. Turning one off suppresses corresponding notifications/events and can remove pending delivery work; turning it on does not replay suppressed deliveries. It is not a substitute for revoking credentials.
- A future changelog date controls visibility; the background announcement runs in batches every 60 seconds. Feature state is checked at processing, not reconstructed between ticks. Do not promise exact-second delivery or historical suppression for an off/on cycle entirely between ticks.
- Browser push and Follow are personal UI/session actions, not automation API operations. A synthetic service-worker test is not evidence of a real OS notification click.

## Make writes intentional and verifiable

Get explicit task intent before publishing, sending customer-visible replies, changing modules/statuses, merging/deleting content, revoking credentials or configuring outbound destinations. Explain the concrete affected product/content when a requested action is ambiguous. Existing authorization for a clear task need not be repeatedly reconfirmed.

Use the request schemas, including a minimal `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Text"}]}]}` for rich text. Do not submit HTML, invent rank values, use external image URLs outside the accepted schema or assume an upload route accepts keys. See [the quickstart](api-quickstart.md) for complete request examples.

After an edit, read back the relevant resource and check its state; report actual identifiers and outcomes without credentials. Do not report a draft as published or an enabled module as a delivered notification. When using UI automation, verify the visible result as well as successful navigation.

Changing a product's `locales.defaultLocale` promotes existing translations into the main content fields for changelog entries, FAQ questions, and roadmap items. Before making that change, inspect `GET P/locales/swap-preview?target=<locale>` with `settings:read` and explain the promotion/fallback counts. The subsequent product `PATCH` needs `settings:write`; it preserves previous content as a source-language translation when promoting a translation and retains original content when no translation exists. See the [API reference](automation-api.md) for the response shape. The operation does not generate translations.

## Page, recover and deduplicate correctly

- Follow opaque `nextCursor` values with URL encoding; do not construct them. Respect route-specific wrappers and fixed versus configurable page sizes. Webhook delivery logs use page numbers, not cursors.
- Interpret `{code,message}` errors by `code`. On `401`, fix the credential; on `403`, inspect permission/restriction/session boundaries; on `404`, do not probe other tenants; on `edit_conflict`, reread and reconcile.
- On `429`, honor `Retry-After`. Do not weaken guards or rotate keys to evade limits. The 120 requests/60 seconds per-key counter is shared across replicas; individual routes may be stricter.
- No general idempotency-key contract exists. Reconcile timeouts and unknown write outcomes with reads before retrying a create/reply/publication; retries can duplicate effects.
- For webhooks, verify HMAC-SHA256 over `timestamp + "." + raw request bytes`, using the stored secret and a constant-time comparison. Enforce the 300-second tolerance before parsing or acting. Deduplicate envelope `id`; `X-UserHQ-Delivery` is a delivery record identifier. Rotation has no overlap, and later attempts use the new secret. Use [the exact reference](automation-api.md#9-webhooks), not an improvised signature algorithm.
- API health failures or HTML from auth endpoints indicate deployment/proxy investigation. Direct operators to [the runbook](deploy.md); never suggest removing production VAPID validation or regenerating keys on each deployment.

## Keep documentation aligned

On behavior/API/configuration changes, update the affected guides and canonical reference together. Before every release tag, follow the changelog/docs checklist in [AGENTS.md](../AGENTS.md), verify local links/examples and run the existing docs-sync gate when API documentation changes. Never move an already published tag to include later documentation.
