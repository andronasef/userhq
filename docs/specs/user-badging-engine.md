# User Badging & Attribution Engine Specification

## 1. Overview & Objectives
The User Badging & Attribution Engine enables multi-app product creators to recognize, highlight, and filter their users (e.g. paying subscribers, PRO members, beta testers, VIPs) across feedback portals, comments, upvotes, and dashboard triage.

Key capabilities:
1. **Product-Scoped Badges**: Custom labels, slugs, colors, icons, and numerical display priority.
2. **Rule-Based Attribution**: Automatic badge granting based on URL query parameters (`paramKey=paramValue`) matching either exact values or regular expressions, with optional HMAC signature protection.
3. **Guest Attribution Cookie & URL Scrubbing**: 30-day HMAC-signed httpOnly attribution cookie for anonymous visitors before sign-up, with two-stage `window.history.replaceState` removal of signature parameters before the request and matched keys after the response.
4. **Product Users Directory**: Dashboard view at `/dashboard/[ws]/[product]/users` showing all users who interacted with or hold badges in a product, with activity metrics and manual grant/revoke controls.
5. **Visual Chips**: Badge pills on post details and comments. Badge filtering in dashboard inbox/requests feeds and badges on public feed lists are deferred.

---

## 2. Database Schema (`packages/db`)

### `product_badges`
- `id` (uuid, primary key, defaultRandom)
- `productId` (uuid, references `products.id` on delete cascade, indexed)
- `name` (text, not null) e.g., "PRO", "Early Adopter"
- `slug` (text, not null) e.g., "pro", "early-adopter"
- `description` (text, nullable)
- `color` (text, not null, default '#0284c7') - background color
- `textColor` (text, not null, default '#ffffff') - foreground text color
- `icon` (text, nullable) - lucide icon name
- `priority` (integer, not null, default 0) - higher priority badges display first
- `isActive` (boolean, not null, default true)
- `createdAt` (timestamp with timezone, default now)
- `updatedAt` (timestamp with timezone, default now)
- *Constraint*: Unique index on `(productId, slug)`

### `product_badge_rules`
- `id` (uuid, primary key, defaultRandom)
- `productId` (uuid, references `products.id` on delete cascade, indexed)
- `badgeId` (uuid, references `product_badges.id` on delete cascade, indexed)
- `paramKey` (text, not null) e.g., "pro_id", "tier", "plan"
- `keyMatchType` (typed text enum: "exact" | "regex", not null, default 'exact')
- `matchType` (typed text enum: "exact" | "regex", not null, default 'exact')
- `matchValue` (text, not null)
- `secretToken` (text, nullable) - optional HMAC secret for anti-spoofing
- `createdAt` (timestamp with timezone, default now)
- `updatedAt` (timestamp with timezone, default now)

### `user_product_badges`
- `id` (uuid, primary key, defaultRandom)
- `userId` (text, references `user.id` on delete cascade, indexed)
- `productId` (uuid, references `products.id` on delete cascade, indexed)
- `badgeId` (uuid, references `product_badges.id` on delete cascade, indexed)
- `source` (text enum: "rule" | "manual", not null, default 'rule')
- `matchedParamValue` (text, nullable)
- `expiresAt` (timestamp with timezone, nullable)
- `grantedByUserId` (text, references `user.id` on delete set null, nullable)
- `createdAt` (timestamp with timezone, default now)
- `updatedAt` (timestamp with timezone, default now)
- *Constraint*: Unique index on `(userId, productId, badgeId)`

---

## 3. Data Contracts (`@userhq/types`)

### Badges & Rules
- `BadgeSchema`: id, productId, name, slug, description, color, textColor, icon, priority, isActive, rulesCount, createdAt, updatedAt
- `CreateBadgeInputSchema`: name, slug, description?, color?, textColor?, icon?, priority?, isActive?
- `UpdateBadgeInputSchema`: name?, slug?, description?, color?, textColor?, icon?, priority?, isActive?
- `BadgeRuleSchema`: id, productId, badgeId, paramKey, keyMatchType, matchType, matchValue, hasSecretToken, createdAt, updatedAt
- `CreateBadgeRuleInputSchema`: paramKey, keyMatchType, matchType, matchValue, secretToken?

### Users Directory
- `ProductUserListItemSchema`:
  - `id`: string
  - `name`: string | null
  - `email`: string | null
  - `image`: string | null
  - `badges`: Array<{ id: string, name: string, slug: string, color: string, textColor: string, icon: string | null, priority: number, source: string, grantedAt: string }>
  - `postsCount`: number
  - `commentsCount`: number
  - `votesCount`: number
  - `firstSeenAt`: string
  - `lastActiveAt`: string
- `ProductUsersQuerySchema`: page (default 1), limit (default 25), search?, badgeId?


## 4. Attribution protocol and boundaries

Both parameter names and values support exact or regex matching. Regexes are fully anchored. Limits: exact key/incoming key 100 characters, rule value 256, regex pattern (name or value) 200, 50 rules per product, 50 parameters per attribution call, 256 characters per input value, and 10 pending badges per cookie. Parameter names ending `_sig` or `_ts` are reserved.

For a signed rule, send `{key}_sig` as hex HMAC-SHA256 of `value + "." + {key}_ts`, using the rule secret. `{key}_ts` is Unix seconds; accepted age is 30 days with at most five minutes of future skew. Generic `sig` and `signature` parameters are not used. A copied signed link can be replayed within this window; unsigned rules do not authenticate purchase ownership.

`POST /api/v1/portal/:ws/:product/badges/attribute` accepts `{searchParams}` and returns `{matchedBadges,scrubKeys}`. The public response contains only badge presentation fields and caller-supplied keys, never rule patterns or secrets. The endpoint is throttled to 60 calls per minute per caller. Signature parameters are scrubbed before the network request; matched keys named in the response are scrubbed afterward. This two-stage scrub avoids exposing server-only rule definitions to the client.

Pending guest attribution uses `uhq_attr_{productId}`, HMAC-signed using `BETTER_AUTH_SECRET` with a domain label and product id in the signed input, httpOnly, SameSite=Lax, Secure in production, valid for 30 days. It is integrity protected, not encrypted. Rotation of `BETTER_AUTH_SECRET` invalidates outstanding cookies. The next authenticated browser portal page load calls attribution to bind it; creating a post/comment or voting also binds it. Consumed or stale cookies are cleared on browser-originated authenticated calls. Binding verifies the cookie, product and active badge before granting; malformed/expired cookies grant nothing. There is no public self-claim endpoint.

Admin routes live under `/api/v1/workspaces/:ws/products/:product/badges` and `/users`; see the [API reference](../automation-api.md#user-badges). Manual grants require a workspace member or product participant, with identical 404 `badge_user_not_member` for unknown users and outsiders. Directory dates use activity in this product only: first seen is earliest post/comment/vote/grant, last active is latest post/comment/vote or first seen. API keys receive null email. Rule secrets are write-only; only `hasSecretToken` is returned.

## 5. Upgrade and residual risk

Migration 0026 adds `key_match_type` defaulting to exact; committed migrations apply at API startup. Signed links now require timestamps and the timestamp-inclusive HMAC input. Existing regex rules now match the whole input.

An administrator-authored catastrophic regex is bounded by input/pattern caps, anchoring and throttling but is not eliminated. A linear-time regex engine remains follow-up work. Inbox/requests badge filters and public feed-list badges remain deferred.
