---
phase: 03-feedback-board-conversations
plan: 16
subsystem: platform-console-feedback-counts
tags: [platform-console, soft-delete, feedback-counts, oversight]
status: complete

requires: ["03-15", "02-11"]
provides:
  - "PlatformWorkspaceRowSchema and PlatformWorkspaceDetailSchema expose deleted: boolean"
  - "Platform owner workspaces table and workspace detail header render a danger Deleted badge for soft-deleted workspaces"
  - "Correlated SQL subqueries replacing all postCount and voteCount placeholders across workspaces, products, and users"
  - "Live vs deleted vs merged post filtering across platform metrics"
affects: []

requirements-completed: [PLAT-04, PLAT-07, WORK-07]

plan_head_before: fec43ef5cb19e27c089da76f3333333333333333
plan_head_after: d4ddf2988cb6b16259e8460ce4049fa5ebf06536

actuals:
  tokens: 45000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Qualified table columns in correlated SQL count subqueries to avoid shadowing from nested tables"
    - "Soft-deleted entity visibility in platform oversight console while preserving 404 public barrier"

key-files:
  created: []
  modified:
    - packages/types/src/tenancy.ts
    - apps/api/src/platform/platform.controller.ts
    - apps/api/test/platform.test.ts
    - apps/web/components/platform/workspaces-table.tsx
    - apps/web/components/platform/workspace-detail-header.tsx
    - apps/web/app/(app)/platform/workspaces/[id]/page.tsx

key-decisions:
  - "Correlated subqueries use explicitly qualified table names (workspaces.id, products.id, \"user\".id) to prevent SQL column name shadowing by innermost tables"
  - "Soft-deleted workspaces remain accessible on /platform/workspaces/:id and listed on /platform/workspaces with Deleted badge for owner oversight"

duration: 10 min
completed: 2026-10-04

coverage:
  - id: D-30
    description: "Platform owner console lists and inspects soft-deleted workspaces with Deleted badge, while public and tenant routes return 404"
    requirement: PLAT-04
    verification:
      - kind: automated
        ref: "apps/api/test/platform.test.ts#tracer: a soft-deleted workspace stays listed with deleted true"
        status: pass
    human_judgment: false
  - id: D-16
    description: "Real postCount and voteCount for workspaces, products, and users filter out deleted and merged posts"
    requirement: PLAT-04
    verification:
      - kind: automated
        ref: "apps/api/test/platform.test.ts#workspace, product, and user postCount and voteCount reflect live, non-merged posts and votes"
        status: pass
      - kind: automated
        ref: "apps/api/test/e2e/platform.e2e.test.ts"
        status: pass
    human_judgment: false
---

# Phase 03 Plan 16 Summary: Platform Console Feedback Counts & Soft-Deleted Oversight

Platform oversight now surfaces real metrics and complete visibility into soft-deleted workspaces.

## Accomplishments

1. **Soft-deleted Workspace Oversight (Task 1):**
   - Added `deleted: z.boolean()` to `PlatformWorkspaceRowSchema` and updated API controller to project `workspaces.deleted_at IS NOT NULL`.
   - Updated `WorkspacesTable` and `WorkspaceDetailHeader` components to render a `<Badge variant="danger">Deleted</Badge>`.
   - Verified that soft-deleted workspaces remain visible and inspectable in the platform console, but return 404 on public tenant and portal routes.

2. **Real Post & Vote Counts (Task 2):**
   - Eliminated all placeholder `postCount: 0` and `voteCount: 0` values and ponytail comments in `apps/api/src/platform/platform.controller.ts`.
   - Added correlated subqueries for workspaces, products, and users that accurately count live, non-merged posts (`posts.deleted_at IS NULL AND posts.merged_into_id IS NULL`) and votes cast on those posts.
   - Verified comprehensive behavior through automated unit and E2E suites.
