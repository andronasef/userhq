---
status: complete
phase: 03-feedback-board-conversations
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md, 03-14-SUMMARY.md, 03-15-SUMMARY.md, 03-16-SUMMARY.md
started: 2026-10-04T08:21:24Z
updated: 2026-10-11T20:53:00Z
---

<!--
Coverage note: 03-03..03-16 coverage blocks use `kind: automated`, which is not a valid
verification kind (unit|integration|e2e|automated_ui|manual_procedural|other). Fail-safe:
every such entry is a human checkpoint. They are grouped below into user-observable tests;
each test lists the coverage ids it covers so no deliverable is dropped.
App: http://localhost:8080 (stack:up) · Mailpit: http://localhost:8025
-->

## Current Test
<!-- OVERWRITE each test - shows where we are -->

completed: all tests passed
awaiting: none

## Tests

### 1. Cold Start Smoke Test
expected: Run `bun run stack:down && bun run stack:up`. Containers come up healthy, migrations 0007/0008 apply without errors in the API logs, and http://localhost:8080 loads a product board with live posts.
result: pass

### 2. Create a Post
covers: 03-04 D1, D7; 03-05 D6
expected: Signed out, the board's "New post" link goes to /login?next=/{ws}/{product}?new=1. Signed in, the form requires a category (when the product has categories), and submitting lands on /p/{n}-{slug}. The new post shows on the board with vote count 1.
result: pass

### 3. Permalink Redirects and 404s
covers: 03-04 D2, D3, D4
expected: Bare /p/{n} and /p/{n}-wrong-slug 301 to the canonical URL. A merged post's permalink 301s to the target post. A non-numeric ref, an unknown number, or a soft-deleted post shows "Page not found".
result: pass

### 4. Safe Rendering and Privacy
covers: 03-04 D5, D6
expected: A post body containing <script>, raw HTML, or a javascript: link renders as plain text with no script executing. Real links get rel="nofollow noopener noreferrer". No author email appears in the board or permalink page source, and posts by a deleted user show "Deleted user".
result: pass

### 5. Voting
covers: 03-06 D1, D2, D3, D4, D5, D6, D7
expected: Clicking vote toggles on and off with the count updating immediately. Rapid triple-clicks settle on the intended state, and the count survives a reload. A signed-out vote redirects to login. The accent colors are readable (white on blue, dark on yellow).
result: pass

### 6. Board Sort, Search and Filters
covers: 03-07 D1, D2, D3, D4, D5
expected: Choosing Newest adds ?sort=new and reorders the list, and Back restores the previous order. Search matches title and description by prefix ("dar" finds "Dark mode"), and Best match ranks title hits first. Completed/closed posts are hidden by default; status=all shows them and a single status isolates its posts. The category filter isolates a category and is hidden when the product has no categories.
result: pass

### 7. Pagination and Empty States
covers: 03-07 D6, D7, D8, D9
expected: On a board with more than 20 posts, "Load more" appends the next page without duplicates, announces "Loaded {n} more posts", and disappears on the last page. A filter that matches nothing shows "No posts match" with a "Clear filters" link.
result: pass

### 8. Categories Admin
covers: 03-05 D1, D2, D3, D4, D5, D7
expected: In the dashboard, an admin can create, rename, and delete categories, and each row shows its post count. A new product starts with "Feature Request" and "Bug". Renaming to an existing name shows a "name taken" error. Deleting a category leaves its posts uncategorized.
result: pass

### 9. Comments
covers: 03-08 D1, D2, D3, D4, D5, D6, D7
expected: A signed-in user comments on a post and the comment appears in the timeline; comments from workspace admins carry an admin badge. The author can edit their own comment, and a stale edit from a second tab shows a conflict. The author or an admin can delete a comment: one with replies becomes a stub, one without disappears. Signed out, the comment box shows a sign-in prompt that returns to the post.
result: pass

### 10. Admin Status Changes and Post Edit/Delete
covers: 03-09 D1, D2, D3
expected: From the portal Admin menu, an admin changes a post's status with a public note, and the badge and timeline update in place. An author can edit or delete their own post until someone else engages; an admin can edit or delete any post. Deleting a status moves its posts to the chosen replacement. A deleted post's permalink shows "Page not found" (from Test 3).
result: pass

### 11. Admin Board Table, Voters and Restore
covers: 03-11 D1, D2, D3
expected: The dashboard board table supports search, filters, and sort. Opening a post shows its timeline and a paginated voter list. Deleted posts and comments are listed and can be restored; a comment can't be restored while its parent post is still deleted.
result: pass

### 12. Merge Duplicate Posts
covers: 03-12 D1, D2
expected: An admin merges a duplicate into a target post, singly or in bulk from the table's selection bar with a survivor picker. Votes combine without double-counting, comments interleave chronologically, and the duplicate's permalink 301s to the target (from Test 3).
result: pass

### 13. Comment Email Digest
covers: 03-10 D1, D2, D3; 03-03 D1
expected: User B comments on User A's post, and after the batch window a digest email arrives in Mailpit (http://localhost:8025). It shows at most 3 escaped comment snippets per post plus "+N more comments", and carries unsubscribe headers. Opted-out or muted users get nothing. compose.yaml passes all 6 SMTP_* variables, and .env.example documents them.
result: pass

### 14. Unsubscribe and Per-Post Mute
covers: 03-13 D1, D2
expected: The email's one-click unsubscribe opens a landing page, which does not change anything until confirmed. Unsubscribing can be undone. The bell toggle on a post page (or the email's mute link) mutes only that post, independent of the global opt-out.
result: pass

### 15. Account Settings and Mobile Layout
covers: 03-14 D1, D2
expected: The user menu links to account settings, which has a working comment-email toggle. Signed out, the settings page redirects to login. At 320px width, board rows and post headers fit without horizontal scroll.
result: pass

### 16. Account Deletion
covers: 03-15 D1, D2, D3, D4
expected: The Danger zone dialog makes owners transfer or delete each owned workspace before Continue enables, then shows a summary. After deletion the user is signed out, their posts and comments read "Deleted user", and their votes still count. Deleted workspaces 404. The platform owner's account can't be deleted. (Also covers the "Deleted user" check from Test 4.)
result: pass

### 17. Platform Console: Deleted Workspaces and Counts
covers: 03-16 D-30, D-16
expected: The platform owner console lists soft-deleted workspaces with a \"Deleted\" badge and can open them, while their public and tenant routes 404. Post and vote counts for workspaces, products, and users exclude deleted and merged posts.
result: pass

### 18. New Dependency Approval
covers: 03-01 D1
expected: You have checked and approve @nestjs/throttler@6.7.1 and nuqs@2.10.1 as legitimate registry packages.
result: pass

### 19. Production Brevo SMTP
covers: 03-03 D2, D3
expected: From inside the production API container on the VPS, the Brevo submission port (587, or the 2525/465 fallback) is reachable, and the sending domain's DKIM/SPF is authenticated in Brevo.
result: pass

### 20. Install pinned packages, verify frozen lockfile, untrusted scripts check, and module imports
expected: Install pinned packages, verify frozen lockfile, untrusted scripts check, and module imports
result: pass
source: automated
coverage_id: 03-01 D2

### 21. Public post creation, retrieval, and board listing through portal API with sequential numbering and auto-vote
expected: Public post creation, retrieval, and board listing through portal API with sequential numbering and auto-vote
result: pass
source: automated
coverage_id: 03-02 D1

### 22. Derived URL slug generation and canonical post permalink resolution
expected: Derived URL slug generation and canonical post permalink resolution
result: pass
source: automated
coverage_id: 03-02 D2

### 23. Default status assignment on new posts and status DTO inclusion
expected: Default status assignment on new posts and status DTO inclusion
result: pass
source: automated
coverage_id: 03-02 D3

### 24. Author DTO serialization excluding email and internal IDs with canary leak verification
expected: Author DTO serialization excluding email and internal IDs with canary leak verification
result: pass
source: automated
coverage_id: 03-02 D4

### 25. Migration 0007_feedback applied on live Docker stack at boot
expected: Migration 0007_feedback applied on live Docker stack at boot
result: pass
source: automated
coverage_id: 03-02 D5

## Summary

total: 25
passed: 25
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
