# UserHQ API quickstart

For workspace administrators and developers automating UserHQ. These examples target the v0.3.0 API contract; the [Automation API reference](automation-api.md) is the canonical endpoint, scope, pagination and webhook reference. For the UI, use the [user guide](user-guide.md); assistants should also read the [LLM guide](llm-guide.md).

## 1. Create a credential

Sign in with Google or GitHub as a workspace owner or admin. Open **Workspace settings → API Keys**, create a named integration key, select only its required scopes and products, and choose an expiry if appropriate. Store the token shown at creation in your secret manager. It cannot be retrieved later; revoke a lost token and create another.

A key belongs to one workspace. `admin` grants all automation scopes, but does not grant session-only operations. Keys cannot manage keys, workspace/team membership, invitations, product creation/deletion, file uploads, personal read state, push preferences or webhook-secret rotation. Use the signed-in UI for these operations.

Restriction rules:

- Omitted or `null` restrictions mean unrestricted within the key's workspace. A non-empty list contains product **UUIDs**, not slugs; duplicates are stored once.
- `[]`, unknown products, deleted products and products of another workspace are rejected. Foreign/deleted/unknown IDs receive the same validation message.
- A product-restricted key cannot call workspace-wide lists, inbox actions, export, product discovery or webhook-management routes, even with a product filter. Use an allowed product route instead.
- For webhook PATCH, omitting `productRestrictions` preserves the existing restriction; `null` removes it. Keys themselves have no update route.

## 2. Set up a shell and discover identifiers

Examples use Bash, `curl` with `--json` support, and `jq`. Load `USERHQ_API_KEY` from your secret manager or a private environment; do not paste it into committed scripts or logs. Run write examples only when you intend their effects.

```bash
export USERHQ_ORIGIN='https://userhq.increasinglabs.com' # or your own deployment
export WS='your-workspace-slug'
export PRODUCT='your-product-slug'
: "${USERHQ_API_KEY:?Load your API key into the environment first}"
BASE="$USERHQ_ORIGIN/api/v1/workspaces/$WS"
P="/products/$PRODUCT"
api() {
  local path="$1"; shift
  curl --silent --show-error --fail-with-body \
    -H "Authorization: Bearer $USERHQ_API_KEY" "$BASE$path" "$@"
}

# settings:read; the workspace product list requires an unrestricted key
api '/products' | jq '.[] | {id, slug, name, features}'
api "$P/statuses" | jq '.[] | {id, name, type, isPublicRoadmap}'
api "$P/categories" | jq '.[] | {id, name}'
```

Choose the product's status/category from those results rather than assuming seeded names or IDs. Paths use workspace/product **slugs**; status, category, comment, roadmap, changelog and FAQ identifiers are **UUIDs**. Feedback detail paths use the post's positive integer **number**, unique within its product. A created post returns `{number, slug}`, not a post UUID.

The examples below reuse `STATUS_ID`, `CATEGORY_ID` and other identifiers you have selected from actual responses. Do not use placeholder IDs in live requests.

## 3. Read and triage feedback

```bash
# requests:read; product-scoped board, fixed page size 50
api "$P/posts" --get --data-urlencode 'sort=top' | jq .

# requests:read; unrestricted key: workspace-wide cross-product inbox
api '/requests' --get --data-urlencode 'sort=activity' \
  --data-urlencode 'limit=20' | jq .

# comments:read; unrestricted key: actionable customer comments
api '/comments' --get --data-urlencode 'attention=needs_attention' | jq .
```

Lists return different wrappers: product posts use `posts`, workspace inboxes use `items`. Follow each route's `nextCursor` until null; pass the exact opaque value using `--data-urlencode "cursor=$CURSOR"`. Workspace inbox `limit` is configurable from 1–50, while product board pages are fixed at 50. Webhook delivery logs use numbered pages instead. See the reference's [pagination table](automation-api.md#5-pagination-and-export).

### Create a request and change its status

```bash
# requests:write; CATEGORY_ID is an existing category UUID
created=$(api "$P/posts" --json "$(jq -n --arg category "$CATEGORY_ID" \
  '{title:"Export feedback as CSV",description:"Let our team share feedback with analysts.",categoryId:$category}')")
POST_NUMBER=$(jq -er '.number' <<< "$created")

# requests:read; inspect the detail before changing anything
detail=$(api "$P/posts/$POST_NUMBER")
# A merged post can return kind=redirect; resolve it deliberately before proceeding.
VERSION=$(jq -er 'select(.kind == "post") | .post.version' <<< "$detail")

# requests:write; STATUS_ID is a chosen status UUID from this product
api "$P/posts/$POST_NUMBER/status" -X PUT \
  --json "$(jq -n --arg status "$STATUS_ID" --argjson version "$VERSION" \
    '{statusId:$status,version:$version,note:"Accepted for planning."}')"
```

The integration becomes the author of key-created content, named `<key name> (integration)`; it does not impersonate the key creator or add a vote. Status changes use optimistic versions: on `edit_conflict`, reread and reconcile the newer state before trying again.

### Reply to a particular customer comment

```bash
# comments:write; unrestricted key, COMMENT_ID from the workspace comment inbox
api "/comments/$COMMENT_ID/reply" \
  --json '{"body":"Thanks. We have included this request in our planning."}'
```

This creates a customer-visible admin reply and handles the selected customer's comment. Needs attention/Handled is team-shared; a new customer follow-up can need attention again. Personal read state is session-only. With a restricted key, use the allowed product's `POST .../posts/:number/comments` and `{ "body": "...", "parentId": "<comment UUID>" }` instead. It requires `comments:write`; the parent must belong to that post.

## 4. Plan work privately, then publish deliberately

```bash
# roadmap:write; returns an admin item with .id
item=$(api "$P/roadmap" --json "$(jq -n --arg status "$STATUS_ID" \
  '{statusId:$status,internalTitle:"Investigate CSV export",isPublic:false}')")
ITEM_ID=$(jq -er '.id' <<< "$item")

# roadmap:write; publish only after reviewing the public wording and status
api "$P/roadmap/$ITEM_ID" -X PATCH \
  --json '{"publicTitle":"Feedback exports","publicDescription":"Export customer feedback for analysis.","isPublic":true}'
```

The roadmap must be enabled and the item's status must be included in the public roadmap for customers to see it. Public responses use the separate public title/description. Internal descriptions, notes, assignees and deadlines are private; never copy an admin response wholesale into public release text.

To link feedback, use `POST .../roadmap/:id/link` with `{ "postId": "<post UUID>" }`; obtain UUIDs from the workspace request `items[].id` or roadmap `search-posts` results, not the create-post response. Linking and moving a roadmap item can change linked post statuses and notify customers. The dedicated move endpoint is `PATCH .../roadmap/:id/move` with `statusId` and a valid `targetRank`; follow the [reference](automation-api.md#4-endpoints) and [rank contract](../packages/types/src/roadmap.ts) rather than inventing rank strings.

## 5. Write a changelog and FAQ

Changelog `content` and FAQ `answer` are validated rich-text JSON documents, not HTML or arbitrary Markdown. The following paragraph document is a minimal reusable value:

```bash
DOC='{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feedback exports are now available."}]}]}'

# changelog:write; omitted publishedAt creates a draft
entry=$(api "$P/changelog" --json "$(jq -n --argjson content "$DOC" \
  '{title:"Feedback exports",summary:"Share feedback with your analysts.",content:$content}')")
ENTRY_ID=$(jq -er '.id' <<< "$entry")

# changelog:write; publishes now; review before running
api "$P/changelog/$ENTRY_ID/publish" --json '{}'

# faq:write; create category, then a question with its UUID
category=$(api "$P/faq/categories" --json '{"name":"Exports"}')
FAQ_CATEGORY_ID=$(jq -er '.id' <<< "$category")
api "$P/faq/questions" --json "$(jq -n --arg category "$FAQ_CATEGORY_ID" --argjson answer "$DOC" \
  '{categoryId:$category,question:"Can I export customer feedback?",answer:$answer}')"
```

Publishing supports an optional `publishedAt` ISO datetime. A future date schedules visibility; the webhook scheduler normally queues the announcement within about a minute after it is due, with batches of at most 100. Feature state is checked when processed: due events processed while Changelog is off are discarded and are not replayed on re-enable. An off/on cycle entirely between scheduler ticks is not reconstructed. Unpublishing or moving the date into the future re-arms the next live transition.

For richer documents, follow [the accepted node/mark and URL schema](../packages/types/src/rich-text.ts). API keys cannot upload images; do not send HTML or invent external image URLs.

## 6. Configure product modules

```bash
# settings:read, then settings:write
api "$P" | jq '{id,slug,name,features}'
api "$P" -X PATCH --json '{"features":{"faq":true,"changelog":true}}'
```

Only supplied feature switches change. Available switches are `board`, `roadmap`, `changelog` and `faq`. Disabling a module hides its customer-facing routes/navigation while preserving admin data and management access. Board and Changelog gates also suppress their webhook/push events; re-enabling does not replay suppressed deliveries. Module switches do not revoke a key's admin read/write scopes. A product PATCH can also update the profile fields listed in the reference; keys may clear a logo with `logoUploadId: null`, but cannot upload/set a new image.

## 7. Receive signed events or export a snapshot

```bash
# webhooks:write; unrestricted key, use a real public HTTPS receiver you control
api '/webhooks' --json '{"url":"https://your-receiver.example/userhq","events":["post.created","comment.created"]}'
```

The create response contains `secret` once. Store it securely; do not pipe the whole response into application logs. Listing subscriptions never returns the secret. Rotation is a signed-in admin operation; there is no overlap period, and subsequent attempts/retries use the new secret.

Verify `X-UserHQ-Signature` before trusting a webhook: HMAC-SHA256 over the exact bytes `timestamp + "." + rawBody`, using the stored signing secret. The signature header is `t=<Unix seconds>,v1=<hex>`. Enforce a 300-second timestamp tolerance in either direction and use a constant-time comparison. Preserve the raw body before JSON parsing; do not hash reserialized JSON. The [reference includes verification code](automation-api.md#verifying-the-signature).

Deduplicate by envelope `id`, stable across retries and redelivery. `X-UserHQ-Delivery` identifies the delivery record, not the event. A receiver's `2xx` response means success; failures get up to five total attempts with 1, 5, 30 and 120 minute backoff. Respond quickly after durably accepting the event; each outbound attempt has a 10-second deadline. Destinations must remain public HTTPS and cannot rely on redirects.

For a bulk sync, `export:read` requires an unrestricted key even when `productId` is supplied. Export includes privileged admin data and author emails; keep its output private.

```bash
# Read-only pagination; optionally add --data-urlencode "productId=$PRODUCT_ID"
CURSOR=''
while :; do
  args=(--get --data-urlencode 'limit=100')
  [[ -z "$CURSOR" ]] || args+=(--data-urlencode "cursor=$CURSOR")
  page=$(api '/export/feedback' "${args[@]}") || break
  jq '.items' <<< "$page" # replace with your own durable ingestion
  [[ $(jq -r '.hasMore' <<< "$page") == true ]] || break
  CURSOR=$(jq -er '.nextCursor' <<< "$page") || break
done
```

Use `since=<ISO datetime>` for changed-item exports, not as a substitute for reading all pages. This is not a deletion-event log; use webhook events where your integration needs deletion notifications.

## 8. Handle failures and uncertain writes

API error bodies use `{ "code": "...", "message": "..." }`. Branch on `code`; messages can change. `400 validation_failed` means fix the body/IDs; `401` key errors mean replace/renew the credential; `403` means check scopes, product restriction and session-only access; `404` can also conceal another tenant's resources. Reconcile `edit_conflict` with a fresh read.

The per-key sliding limit is 120 requests per 60 seconds across API replicas. Respect `429` and `Retry-After`; comment creation and webhook redelivery have lower route limits. Back off reads. There is no general idempotency-key contract: a timeout or lost write response does not prove a mutation failed. Read back and reconcile before replaying creates, replies, status changes or publication.

If authentication endpoints return HTML/404 or `/api/v1/health` returns 502, an operator should check the API and proxy rather than rotate user credentials. Production startup needs persistent VAPID keys; see the [deployment runbook](deploy.md).
