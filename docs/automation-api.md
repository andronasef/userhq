# UserHQ Automation API

This document is the integrator reference for driving a UserHQ workspace with an API key: authentication, scopes, product restrictions, every automation endpoint, pagination, errors, attribution, rate limits and webhooks. It is kept in sync with the code by `apps/api/test/automation-routes.test.ts`, which fails when a scope, route or limit here disagrees with what the API enforces.

---

## 1. Authentication

Send the key as a bearer token on every request:

```http
GET /api/v1/workspaces/acme/requests HTTP/1.1
Authorization: Bearer uhq_live_EXAMPLE_NOT_A_REAL_KEY
```

- The scheme name (`Bearer`) is case-insensitive. No `Origin` header is needed; the browser CSRF origin check does not apply to bearer requests.
- Keys are created and revoked only by signed-in workspace owners and admins, in the workspace settings. A key can never create, list or revoke keys.
- The full token (prefix `uhq_live_`) is shown once at creation. UserHQ stores only a hash, so a lost token cannot be recovered; revoke the key and create a new one.
- A key belongs to one workspace. Optional expiry is 1 to 3650 days; a key without expiry stays valid until revoked.
- A request with a bad key is rejected with `401` and one of these codes:

| Code | Meaning |
|------|---------|
| `api_key_invalid` | The token is malformed, unknown or not a key. |
| `api_key_expired` | The key passed its expiry date. |
| `api_key_revoked` | The key was revoked. |

> [!IMPORTANT]
> Keys are denied by default. A route that does not appear in the Endpoints table below rejects every key, including an `admin` key, with `403 api_key_route_forbidden`.

---

## 2. Scopes

Each key carries one or more scopes. Every endpoint requires exactly one scope. A key with a missing scope gets `403 insufficient_scope`.

| Scope | Description |
|-------|-------------|
| `admin` | Every scope below, including the settings and FAQ scopes, so an `admin` key can change product settings, statuses, categories and FAQ. It never opens session-only routes (API keys, members, invites, workspace settings, product creation and deletion). |
| `requests:read` | View feedback requests, votes, and status. |
| `requests:write` | Create posts headlessly, update status, and manage requests. |
| `comments:read` | View discussions and comments across all posts. |
| `comments:write` | Post comments and admin replies to customer feedback. |
| `roadmap:read` | View roadmap columns, ranks, and planned items. |
| `roadmap:write` | Create, move, and edit roadmap cards and links. |
| `changelog:read` | View published and draft changelog posts. |
| `changelog:write` | Publish, update, and categorize changelog releases. |
| `export:read` | Export all posts, feedback items, and comments in bulk. |
| `webhooks:read` | View webhook subscriptions and delivery logs. |
| `webhooks:write` | Create, update, and delete webhook subscriptions and redeliver events. |
| `settings:read` | View the product list and product settings, statuses and categories. |
| `settings:write` | Change a product's feature switches (Board, Roadmap, Changelog, FAQ) and profile fields, and manage its statuses and categories. Statuses decide which ones appear on the public roadmap, so this scope changes what customers see. |
| `faq:read` | View FAQ categories and questions, including those of a product whose FAQ module is switched off. |
| `faq:write` | Create, edit, reorder and delete FAQ categories and questions. |

---

## 3. Product restrictions

A key may be restricted to a list of products at creation. A restricted key can reach only product-scoped routes (`/workspaces/:ws/products/:product/...`) of its allowed products. Anything else returns `403 product_restricted`:

- a product the key is not allowed to use;
- every workspace-wide route: `requests`, `comments`, `export`, `webhooks` and the product list.

`productRestrictions` is optional when you create a key:

- Omitted or `null` means the key reaches every live product in its workspace.
- Otherwise it is a non-empty list of product ids, and every id must be a live product of the same workspace. Duplicate ids are stored once.
- An empty list is rejected with `400 validation_failed`, because it is neither "all products" nor "no products".
- An unknown id, an id of another workspace and the id of a deleted product are rejected the same way, with one message that does not say which case it was.
- Keys created before this rule with an empty list were unrestricted, and are now stored as unrestricted. A stored value that is neither `null` nor a list of product ids reaches no product.

Restrictions are stored as product ids, while URLs use product slugs. An unrestricted key reaches every product in its own workspace. A key never reaches another workspace: a foreign or unknown workspace or product returns `404 not_found`.

---

## 4. Endpoints

`:ws` is the workspace slug, `:product` the product slug, `:number` a post number. All paths are under `/api/v1`. Bodies and responses are JSON.

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| `GET` | `/api/v1/workspaces/:ws/products/:product/posts` | `requests:read` | List posts on the board (or deleted posts with `view=deleted`). |
| `POST` | `/api/v1/workspaces/:ws/products/:product/posts` | `requests:write` | Create a post as the integration actor. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/posts/:number` | `requests:read` | Get one post with its timeline. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/posts/:number` | `requests:write` | Edit a post. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/posts/:number` | `requests:write` | Soft-delete a post. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/posts/:number/restore` | `requests:write` | Restore a deleted post. |
| `PUT` | `/api/v1/workspaces/:ws/products/:product/posts/:number/status` | `requests:write` | Change a post's status. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/posts/:number/merge` | `requests:write` | Merge one post into another. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/posts/merge` | `requests:write` | Merge several posts into one. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/posts/:number/voters` | `requests:read` | List the people who voted for a post. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/posts/:number/comments` | `comments:write` | Add a comment to a post. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/comments/:id` | `comments:write` | Edit a comment. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/comments/:id` | `comments:write` | Soft-delete a comment. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/comments/:id/restore` | `comments:write` | Restore a deleted comment. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/comments/deleted` | `comments:read` | List deleted comments. |
| `GET` | `/api/v1/workspaces/:ws/requests` | `requests:read` | Workspace-wide request inbox across products. |
| `GET` | `/api/v1/workspaces/:ws/comments` | `comments:read` | Workspace-wide comment inbox. |
| `POST` | `/api/v1/workspaces/:ws/comments/:id/handled` | `comments:write` | Mark a comment handled. |
| `DELETE` | `/api/v1/workspaces/:ws/comments/:id/handled` | `comments:write` | Reopen a handled comment. |
| `POST` | `/api/v1/workspaces/:ws/comments/:id/reply` | `comments:write` | Reply to a comment as the integration actor. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/roadmap` | `roadmap:read` | List roadmap items. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/roadmap/search-posts` | `roadmap:read` | Search posts to link to a roadmap item (`q`). |
| `POST` | `/api/v1/workspaces/:ws/products/:product/roadmap` | `roadmap:write` | Create a roadmap item. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/roadmap/:id` | `roadmap:write` | Edit a roadmap item. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/roadmap/:id/move` | `roadmap:write` | Move a roadmap item to a status and position. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/roadmap/:id` | `roadmap:write` | Delete a roadmap item. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/roadmap/:id/link` | `roadmap:write` | Link a post to a roadmap item. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/roadmap/:id/unlink/:postId` | `roadmap:write` | Unlink a post from a roadmap item. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/changelog` | `changelog:read` | List changelog entries and tags. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/changelog` | `changelog:write` | Create a draft changelog entry. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/changelog/:id` | `changelog:read` | Get one changelog entry. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/changelog/:id` | `changelog:write` | Edit a changelog entry. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/changelog/:id/publish` | `changelog:write` | Publish an entry. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/changelog/:id/unpublish` | `changelog:write` | Return an entry to draft. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/changelog/:id` | `changelog:write` | Delete an entry. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/changelog/tags` | `changelog:read` | List changelog tags. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/changelog/tags` | `changelog:write` | Create a changelog tag. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/changelog/tags/:tagId` | `changelog:write` | Delete a changelog tag. |
| `GET` | `/api/v1/workspaces/:ws/export/feedback` | `export:read` | Bulk export of posts, comments and votes. |
| `GET` | `/api/v1/workspaces/:ws/products` | `settings:read` | List the workspace's products with their feature switches. |
| `GET` | `/api/v1/workspaces/:ws/products/:product` | `settings:read` | Get one product's settings: feature switches, name, slug, tagline, website and accent colors. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product` | `settings:write` | Update the four feature switches (`features.board`, `roadmap`, `changelog`, `faq`) and the profile fields (name, slug, tagline, website, accent colors). A key can clear the logo (`logoUploadId: null`) but not set one, because keys cannot upload files. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/statuses` | `settings:read` | List the product's statuses in order. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/statuses` | `settings:write` | Create a status (`name`, `type`, `color`, optional `isPublicRoadmap`). |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/statuses/:statusId` | `settings:write` | Edit a status. |
| `PUT` | `/api/v1/workspaces/:ws/products/:product/statuses/:statusId/default` | `settings:write` | Make a status the default for new posts. |
| `PUT` | `/api/v1/workspaces/:ws/products/:product/statuses/order` | `settings:write` | Reorder statuses; send every status id in the new order (`ids`). |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/statuses/:statusId` | `settings:write` | Delete a status; `moveTo` (another status id) is required and receives its posts and roadmap items. The default status cannot be deleted. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/categories` | `settings:read` | List categories with their post counts. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/categories` | `settings:write` | Create a category. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/categories/:id` | `settings:write` | Rename a category. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/categories/:id` | `settings:write` | Delete a category; its posts end up without a category. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/faq` | `faq:read` | Get the FAQ tree: categories with their questions. |
| `GET` | `/api/v1/workspaces/:ws/products/:product/faq/categories` | `faq:read` | List FAQ categories. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/faq/categories` | `faq:write` | Create a FAQ category. |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/faq/categories/:id/reorder` | `faq:write` | Move a FAQ category (`targetRank`). |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/faq/categories/:id` | `faq:write` | Rename a FAQ category. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/faq/categories/:id` | `faq:write` | Delete a FAQ category and its questions. |
| `POST` | `/api/v1/workspaces/:ws/products/:product/faq/questions` | `faq:write` | Create a FAQ question (`categoryId`, `question`, rich-text `answer`). |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/faq/questions/:id/reorder` | `faq:write` | Move a FAQ question (`targetRank`, optionally `targetCategoryId`). |
| `PATCH` | `/api/v1/workspaces/:ws/products/:product/faq/questions/:id` | `faq:write` | Edit a FAQ question. |
| `DELETE` | `/api/v1/workspaces/:ws/products/:product/faq/questions/:id` | `faq:write` | Delete a FAQ question. |
| `GET` | `/api/v1/workspaces/:ws/webhooks` | `webhooks:read` | List webhook subscriptions. |
| `POST` | `/api/v1/workspaces/:ws/webhooks` | `webhooks:write` | Create a webhook subscription. |
| `GET` | `/api/v1/workspaces/:ws/webhooks/:id` | `webhooks:read` | Get one subscription. |
| `PATCH` | `/api/v1/workspaces/:ws/webhooks/:id` | `webhooks:write` | Update a subscription. |
| `DELETE` | `/api/v1/workspaces/:ws/webhooks/:id` | `webhooks:write` | Delete a subscription. |
| `POST` | `/api/v1/workspaces/:ws/webhooks/:id/ping` | `webhooks:write` | Send a test event. |
| `GET` | `/api/v1/workspaces/:ws/webhooks/:id/deliveries` | `webhooks:read` | List delivery attempts for a subscription. |
| `POST` | `/api/v1/workspaces/:ws/webhooks/:id/deliveries/:deliveryId/redeliver` | `webhooks:write` | Redeliver one event. |

Not available to keys: API keys, webhook secret rotation, members, invites, workspace settings, product creation and deletion, and the account and portal routes. All of these return `403 api_key_route_forbidden`.

---

## 5. Pagination and export

Every list route returns at most one page and, where it paginates, a `nextCursor` (`null` on the last page). Pass it back as `cursor` to get the next page. Cursors are opaque; do not build them.

| Route | Parameters | Response |
|-------|------------|----------|
| Product posts (`.../posts`) | `q`, `sort` (`top`, `new`, `match`), `category` (uuid), `status` (`all`, `open` or a status uuid), `view` (`deleted`), `cursor`. Page size is fixed at 50. | `{ posts, nextCursor }` |
| Post voters (`.../posts/:number/voters`) | `cursor`. Page size is fixed at 50. | `{ total, voters, nextCursor }` |
| Deleted comments (`.../comments/deleted`) | `cursor`. Page size is fixed at 50. | `{ comments, nextCursor }` |
| Workspace requests (`/requests`) | `product` (slug), `statusId`, `statusType`, `categoryId`, `sort` (`top`, `new`, `activity`; default `top`), `search`, `createdFrom`, `createdTo` (`YYYY-MM-DD`), `cursor`, `limit` (1 to 50, default 20). | `{ items, nextCursor, totalCount }` |
| Workspace comments (`/comments`) | `product` (slug), `attention` (`all`, `needs_attention`, `handled`; default `needs_attention`), `cursor`, `limit` (1 to 50, default 20). | `{ items, nextCursor, needsAttentionCount }` |
| Webhook deliveries (`.../deliveries`) | `page` (from 1, default 1), `limit` (1 to 100, default 20). Page-number pagination, no cursor. | `{ deliveries, total }` |
| Roadmap, changelog, webhook subscriptions | Not paginated; the full list is returned. | `{ items }`, `{ entries, tags }`, `{ subscriptions }` |
| Products, statuses, categories, FAQ | Not paginated; the full list is returned. | An array of products, an array of statuses, an array of categories (each with `postCount`), `{ categories }` for the FAQ tree (each category with its questions), and an array of FAQ categories |

### Export

`GET /api/v1/workspaces/:ws/export/feedback` returns posts with their comments for bulk sync into another system.

| Parameter | Description |
|-----------|-------------|
| `limit` | Items per page, 1 to 500, default 100. |
| `cursor` | The `nextCursor` of the previous page. |
| `since` | ISO 8601 datetime; only items changed after it. |
| `productId` | Product uuid; limit the export to one product. |

The response is `{ items, nextCursor, hasMore, totalCount }`. Keep requesting with `cursor` until `hasMore` is `false`.

---

## 6. Errors

Every error has the same body and a stable machine-readable `code`:

```json
{ "code": "insufficient_scope", "message": "API key lacks the required scope." }
```

Branch on `code`, not on `message`.

| Status | Code | When |
|--------|------|------|
| 400 | `validation_failed` | The body is invalid, for example an empty `productRestrictions` list or a product id outside the workspace. |
| 401 | `api_key_invalid` | Unknown or malformed key. |
| 401 | `api_key_expired` | The key is past its expiry. |
| 401 | `api_key_revoked` | The key was revoked. |
| 403 | `api_key_route_forbidden` | The route has no scope, so no key may use it. |
| 403 | `insufficient_scope` | The key lacks the scope the route requires. |
| 403 | `product_restricted` | The key is restricted to other products, or the route is workspace-wide. |
| 403 | `workspace_suspended` | The workspace is suspended. |
| 404 | `not_found` | Unknown workspace or product, or one that belongs to another workspace. |
| 429 | `rate_limited` | Too many requests; see Rate limits. |

Validation and domain failures (`validation_failed`, `post_not_found`, `comment_not_found`, `post_locked`, `edit_conflict`, `merge_target_invalid`, and similar) use the same body with their own codes.

---

## 7. Attribution

A change made by a key is never attributed to a person. It is made by an integration actor named `<key name> (integration)`, which is neither the key's creator nor a customer. The author of a key-made post or comment is that actor, and a key-made post adds no vote.

Responses say which integration made the content or change in a `source` field, `null` for human-made content:

- Public shape (post detail, comment, activity entry; also served to the anonymous portal): `{ "kind": "integration", "name": "<key name>" }`. It never contains a key id.
- Admin shape (admin board row, workspace request item, workspace comment item): the same fields plus `apiKeyId`.

The export carries `createdByApiKeyId` on posts and comments. Status changes are recorded with the key id on the audit row, including status changes caused by roadmap moves. No response ever contains a key hash or a token; the token is returned once, when the key is created.

---

## 8. Rate limits

Every request authenticated by a key counts against that key: 120 requests per 60 seconds per key, as a sliding window. The request after the limit returns `429` with code `rate_limited` and a `Retry-After` header holding a whole number of seconds to wait.

- The limit is per key. Another key, or a signed-in person using the same route, is not affected.
- Counters are kept in PostgreSQL, so every API replica counts against the same limit and a restart does not reset it. Each keyed request costs one small database write, and a route with its own limit costs one more.
- If the counter store is unavailable, the request is allowed and a warning is logged: rate limits fail open, while authentication does not depend on them.
- Some routes also have a lower limit of their own: `POST /api/v1/workspaces/:ws/products/:product/posts/:number/comments` allows 10 comments per 60 seconds per key.
- Redelivering a webhook delivery allows 10 redeliveries per 60 seconds per caller (per key for key requests).
- Invalid tokens are rejected with `401` before any key is known, so they have no per-key counter.

---

## 9. Webhooks

A webhook subscription sends signed `POST` requests with JSON bodies to your HTTPS endpoint when something changes in the workspace. Subscriptions are managed with the `webhooks:read` and `webhooks:write` routes in the Endpoints table, or in the workspace settings.

### Subscriptions and the signing secret

- `POST /api/v1/workspaces/:ws/webhooks` takes `url` (public HTTPS), `events` (names from the table below, or `*`), and optionally `productRestrictions` (product ids) and `description`. The `201` response carries the signing secret in `secret` (`whsec_` followed by random characters).
- The secret is returned **only** by that create response and by the rotate response. List, get, update and delivery-log responses never contain it. Store it when you get it; it cannot be read again.
- `POST /api/v1/workspaces/:ws/webhooks/:id/rotate-secret` issues a new secret and returns the subscription with it. Rotation is session-only: a signed-in workspace owner or admin does it, and every API key, including an `admin` key, gets `403 api_key_route_forbidden`.
- Rotation is immediate. There is no overlap window: the old secret stops signing with the next attempt. Each attempt is signed when it is sent, so a delivery that fails around the swap is retried and signed with the new secret. Update your receiver, and the retry succeeds.
- `productRestrictions` follows the rule in Product restrictions, on `POST` and on `PATCH`: omitted or `null` means all products, otherwise a non-empty list of live product ids of the workspace. `PATCH` with `null` removes the restriction, and `PATCH` with an empty list or an id outside the workspace returns `400 validation_failed`.
- A subscription with `productRestrictions` only receives events of the listed products. A paused subscription (`isActive: false`) receives nothing.

### Events

| Event | When | `data` fields |
|-------|------|---------------|
| `*` | Subscribes to every event type below, including event types added in the future. | As for each event. |
| `ping` | A test event sent to one subscription with the ping route. It has no product. | `message` |
| `post.created` | A post is created. | `id`, `number`, `title`, `description`, `authorId`, `categoryId`, `statusId` |
| `post.updated` | A post's title, description or category is edited. | `id`, `number`, `title`, `description`, `categoryId` |
| `post.status_changed` | A post's status changes: an admin changes it, its roadmap item moves, or it is linked to a roadmap item in another status. Once per post whose status really changed. | `postId`, `postNumber`, `previousStatusId`, `newStatus` (`id`, `name`, `color`, `type`), `actorId`, `note` (`null` for roadmap-driven changes) |
| `post.deleted` | A post is deleted. | `id`, `number` |
| `post.merged` | A duplicate post is merged into another. Once per merged duplicate. | `id`, `number`, `mergedInto` (`id`, `number`), `actorId` |
| `post.restored` | A deleted post is restored. | `id`, `number`, `actorId` |
| `comment.created` | A comment is added, including replies from the workspace inbox. Exactly one event per comment. | `id`, `postId`, `postNumber`, `authorId`, `body`, `parentId` |
| `comment.deleted` | A comment is deleted. | `id`, `postId` |
| `comment.restored` | A deleted comment is restored. | `id`, `postId`, `actorId` |
| `changelog.published` | A changelog entry becomes live: created live, edited to a past date, published, or its scheduled date arrives. Once per draft-to-live transition. | `id`, `title`, `summary`, `publishedAt` |

- A subscription to `*` also receives `post.merged`, `post.restored` and `comment.restored`, and any event type added later.
- `changelog.published` also fires for a future `publishedAt` when that date arrives. A background job checks every 60 seconds, so the announcement is normally queued within about a minute, followed by the webhook queue's own delivery interval. One tick processes at most 100 due entries; a larger backlog takes additional ticks.
- An entry whose due event is processed while the product's Changelog is off sends nothing and is never replayed on re-enable. Unpublishing or rescheduling it to a future date re-arms the next live transition.
- Editing an already-live entry, or publishing it again, sends nothing. Unpublishing and publishing again sends one more.
- Roadmap-driven `post.status_changed` events carry the shared status and the post only. Internal roadmap titles, descriptions, notes, assignees and deadlines never appear in any payload.

### Payload and headers

Every request body is one JSON envelope:

```json
{
  "id": "evt_0123456789abcdef0123456789abcdef",
  "event": "post.created",
  "createdAt": "2026-11-07T10:00:00.000Z",
  "workspace": { "id": "...", "slug": "acme" },
  "product": { "id": "...", "slug": "mobile", "name": "Mobile" },
  "data": {}
}
```

`product` is `null` for `ping`. The event `id` (`evt_` plus 32 hex characters) is created when the event is queued and is the same on every retry and every redelivery. Deduplicate on it.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `User-Agent` | `UserHQ-Webhooks/1.0` |
| `X-UserHQ-Event` | The event name, for example `post.created`. |
| `X-UserHQ-Delivery` | The delivery id (the id shown in the delivery log). It identifies the delivery record, not the event. |
| `X-UserHQ-Timestamp` | Unix seconds when this attempt was signed. |
| `X-UserHQ-Signature` | `t={unix seconds},v1={hex}` |

### Verifying the signature

`v1` is the hex HMAC SHA-256 of `{t}.{raw body}`, keyed with your signing secret, where `{t}` is the timestamp in the header and the body is the exact bytes you received. Verify before parsing, reject timestamps more than 5 minutes old, and compare in constant time. Every attempt is signed afresh with a new timestamp, so a retry has a different signature than the first attempt.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

### Delivery, retries and backoff

- Any `2xx` response is success. Any other status, a timeout or a connection error is a failed attempt.
- Each attempt has a 10 second deadline. The response body is stored truncated to 1000 characters in the delivery log.
- The destination must be a public HTTPS address without URL credentials. It is checked when you save it and again on every attempt.
- A delivery gets 5 attempts in total. After a failed attempt the next one is queued after 1, 5, 30 and 120 minutes. The delivery is marked failed after the fifth failed attempt.
- Delivery logs are visible with the deliveries route (newest first).

### Redelivery

`POST /api/v1/workspaces/:ws/webhooks/:id/deliveries/:deliveryId/redeliver` queues a delivery again for immediate sending, with the same event id.

- Only delivered, failed or suppressed deliveries of an active endpoint can be redelivered. A paused endpoint returns `409 webhook_inactive`; a delivery that is still pending or being sent returns `409 delivery_not_final`; a deleted endpoint or another workspace's delivery returns `404 not_found`.
- A redelivery counts toward the 5 attempts: a delivery that already used all five gets exactly one more attempt.
- The limit is in Rate limits.

### Disabled modules

Events for a product whose Board (`post.*`, `comment.*`) or Changelog (`changelog.*`) module is switched off are not queued. An event already queued (pending or being sent) when the module is switched off is marked `suppressed` immediately, in the same save that switches the module off, and is never sent; switching the module back on does not revive it. The send-time check stays as a second guard. Events about merged posts are still sent, because `post.merged` itself reports the merge.

### Retention

Delivery logs for delivered, failed and suppressed deliveries older than 30 days, measured from the last attempt (or creation if never attempted), are deleted by an hourly cleanup. Pending and in-flight deliveries are never deleted.
