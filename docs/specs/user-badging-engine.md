# User Badging & Attribution Engine Specification

## 1. Overview & Objectives
The User Badging & Attribution Engine enables multi-app product creators to recognize, highlight, and filter their users (e.g. paying subscribers, PRO members, beta testers, VIPs) across feedback portals, comments, upvotes, and dashboard triage.

Key capabilities:
1. **Product-Scoped Badges**: Custom labels, slugs, colors, icons, and numerical display priority.
2. **Rule-Based Attribution**: Automatic badge granting based on URL query parameters (`paramKey=paramValue`) matching either exact values or regular expressions, with optional HMAC signature protection.
3. **Guest Attribution Cookie & URL Scrubbing**: 30-day encrypted attribution cookie for anonymous visitors before sign-up, with immediate `window.history.replaceState` removal of sensitive attribution query params from the browser address bar to safeguard user privacy and prevent link-sharing spoofing.
4. **Product Users Directory**: Dashboard view at `/dashboard/[ws]/[product]/users` showing all users who interacted with or hold badges in a product, with activity metrics and manual grant/revoke controls.
5. **Universal Visual Chips & Filtering**: Badge pills on public portal author lines and comments, with badge filtering in dashboard inbox and requests feeds.

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
- `matchType` (text enum: "exact" | "regex", not null, default 'exact')
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
- `BadgeRuleSchema`: id, productId, badgeId, paramKey, matchType, matchValue, hasSecretToken, createdAt, updatedAt
- `CreateBadgeRuleInputSchema`: paramKey, matchType, matchValue, secretToken?

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
