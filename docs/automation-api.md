# UserHQ Automation API

This document is the integrator reference for driving a UserHQ workspace with an API key: authentication, scopes, product restrictions, every automation endpoint, pagination, errors, attribution and rate limits. It is kept in sync with the code by `apps/api/test/automation-routes.test.ts`, which fails when a scope, route or limit here disagrees with what the API enforces.

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
| `admin` | Every scope below. It never opens session-only routes (API keys, members, invites, workspace settings, products, statuses, categories, FAQ). |
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

---

## 3. Product restrictions

A key may be restricted to a list of products at creation. A restricted key can reach only product-scoped routes (`/workspaces/:ws/products/:product/...`) of its allowed products. Anything else returns `403 product_restricted`:

- a product the key is not allowed to use;
- every workspace-wide route: `requests`, `comments`, `export` and `webhooks`.

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
| `GET` | `/api/v1/workspaces/:ws/webhooks` | `webhooks:read` | List webhook subscriptions. |
| `POST` | `/api/v1/workspaces/:ws/webhooks` | `webhooks:write` | Create a webhook subscription. |
| `GET` | `/api/v1/workspaces/:ws/webhooks/:id` | `webhooks:read` | Get one subscription. |
| `PATCH` | `/api/v1/workspaces/:ws/webhooks/:id` | `webhooks:write` | Update a subscription. |
| `DELETE` | `/api/v1/workspaces/:ws/webhooks/:id` | `webhooks:write` | Delete a subscription. |
| `POST` | `/api/v1/workspaces/:ws/webhooks/:id/ping` | `webhooks:write` | Send a test event. |
| `GET` | `/api/v1/workspaces/:ws/webhooks/:id/deliveries` | `webhooks:read` | List delivery attempts for a subscription. |
| `POST` | `/api/v1/workspaces/:ws/webhooks/:id/deliveries/:deliveryId/redeliver` | `webhooks:write` | Redeliver one event. |

Not available to keys, by design or not yet: API keys, members, invites, workspace settings, products, statuses, categories and FAQ. All of these return `403 api_key_route_forbidden`. Product settings, statuses, categories and FAQ are listed as automation targets in the product spec (story 20) but have no scope yet; see the project notes.

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
- The counter lives in the memory of one API process. UserHQ runs a single API replica today, so the limit is exact; running more replicas multiplies it until a shared store is added.
- Some routes also have a lower limit of their own: `POST /api/v1/workspaces/:ws/products/:product/posts/:number/comments` allows 10 comments per 60 seconds per key.
- Invalid tokens are rejected with `401` before any key is known, so they have no per-key counter.
