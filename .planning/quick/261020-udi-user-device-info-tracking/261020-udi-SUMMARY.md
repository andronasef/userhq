# Quick Task Summary: User Device Info Tracking (261020-udi)

## Overview
Captured and surfaced user device info (browser, OS, device type) on feedback board posts and comments for workspace admins, helping product teams diagnose environment-specific feedback and bug reports.

## Changes Completed
- **Types**: Added `DeviceInfoSchema` to `@userhq/types` (`feedback.ts`).
- **Database**: Added nullable `device_info` JSONB column to `posts` and `comments` in `packages/db/src/schema/feedback.ts` with migration `0011_device_info.sql`.
- **API**:
  - Implemented `parseUserAgent` in `apps/api/src/feedback/device-info.ts`.
  - Captured user device info on post creation and comment creation from the `User-Agent` header.
  - Restricted device info to admins only in `posts.service.ts`, `comments.service.ts`, and `moderation.service.ts` (public visitors receive null).
- **Web UI**:
  - Added `DeviceBadge` component in `apps/web/components/post/device-badge.tsx`.
  - Surfaced device info badge in `AuthorLine`, `CommentItem`, and `PostDetailView` for admins.
  - Added unit tests in `apps/web/test/device-badge.test.tsx` and `apps/api/test/device-info.test.ts`.
