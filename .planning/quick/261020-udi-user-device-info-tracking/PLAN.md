---
phase: quick-261020-udi
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/types/src/feedback.ts
  - packages/types/src/index.ts
  - packages/db/src/schema/feedback.ts
  - packages/db/migrations/0011_device_info.sql
  - packages/db/migrations/meta/_journal.json
  - apps/api/src/feedback/device-info.ts
  - apps/api/src/feedback/device-info.spec.ts
  - apps/api/src/feedback/portal-posts.controller.ts
  - apps/api/src/feedback/portal-comments.controller.ts
  - apps/api/src/feedback/posts.service.ts
  - apps/api/src/feedback/comments.service.ts
  - apps/api/src/feedback/moderation.service.ts
  - apps/web/components/post/device-badge.tsx
  - apps/web/components/post/author-line.tsx
  - apps/web/components/post/comment-item.tsx
  - apps/web/app/[ws]/[product]/p/[ref]/page.tsx
  - apps/web/app/dashboard/[ws]/[product]/board/[number]/post-detail-view.tsx
autonomous: true
requirements: [DEVICE-01, DEVICE-02, DEVICE-03]
estimate:
  tokens: 20000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - User device information (browser, OS, device type) is automatically captured from the User-Agent header when creating board posts and comments.
    - Device info is strictly admin-only: visible to workspace admins on board posts and comments, but completely hidden/null for regular public portal visitors.
    - Existing posts and comments without device info render gracefully without breaking or displaying placeholder device badges.
    - All tests and typechecks pass across packages/types, packages/db, apps/api, and apps/web.
---

<objective>
Capture and display user device info (browser, OS, device form factor) on both board posts and comments for admins.

Purpose: Help product admins diagnose user bug reports and understand submitter environment context when reviewing feedback and discussions.
Output: Shared DeviceInfo schema, database columns with migration, robust User-Agent parser, admin-only API scoping, and subtle accessible DeviceBadge component on posts and comments.
</objective>

<tasks>
1. Define shared DeviceInfo schema in packages/types and database columns in packages/db schema with migration.
2. Implement User-Agent parser utility and integrate device info capture and admin-only filtering across apps/api services and controllers.
3. Build DeviceBadge component in apps/web, update AuthorLine and PostDetailView to show device metadata for admins, and verify end-to-end.
</tasks>
