# Phase 3: Feedback Board & Conversations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 03-feedback-board-conversations
**Areas discussed:** Admin moderation surface, Board & post page layout, Comment structure, Comment email behavior

---

## Admin moderation surface

| Question | Options | Selected |
|---|---|---|
| Where admins moderate | Dashboard Board page (rec) / Both dashboard + inline portal menu / Inline portal only | Both dashboard + inline portal menu |
| Where admins reply | On portal as themselves (rec) / From dashboard post view too | From dashboard post view too |
| Merge target picking | Search picker from duplicate (rec) / Bulk select on dashboard table | "both" (free text) |
| Merge trace | Redirect + note on target (rec) / Silent redirect only | Silent redirect only |
| Status note display | Activity entry in timeline (rec) / Banner at top | Activity entry in timeline |
| Deleted items | No restore UI (rec) / Dashboard filter + restore | Dashboard filter + restore |

**Notes:** Choosing inline portal moderation amends Phase 2 D-01.

## Board & post page layout

| Question | Options | Selected |
|---|---|---|
| Board list | Compact rows, vote box left (rec) / Cards grid | Compact rows |
| Submit | Dialog (rec) / Separate page / Sidebar form | Dialog |
| Paging | Load more (rec) / Infinite scroll / Numbered pages | Load more |
| Self-vote | Auto-vote (rec) / Starts at 0 | Auto-vote |
| Filters | Toolbar + URL state (rec) / Left sidebar | Toolbar + URL state |
| Permalink | /p/{number}-{slug} (rec) / /p/{id} / /p/{slug} | /p/{number}-{slug} |
| Post edits | Always editable + marker (rec) / Lock after votes/comments | Lock after votes/comments |
| Self-delete | Admins only (rec) / Yes if no other votes/comments | Yes if no other votes/comments |

**Notes:** Claude read "votes/comments" as engagement from *others*, so the author's own auto-vote doesn't count. The user confirmed the post "edited" marker in a later question.

## Comment structure

| Question | Options | Selected |
|---|---|---|
| Threading | Flat (rec) / One level of replies | One level of replies |
| Formatting | Plain + autolinks (rec) / Light markdown | Plain + autolinks |
| Deleted comment | Disappears (rec) / Placeholder | Placeholder |
| Placeholder when | Only if it has replies (rec) / Always | Only if it has replies |
| Ordering | Both oldest first (rec) / Newest top-level first | Both oldest first |
| Edited marker | Yes (rec) / No | Yes (comments and posts) |

**Notes:** The user asked for an explanation of the placeholder rule before answering.

## Comment email behavior

| Question | Options | Selected |
|---|---|---|
| Frequency | Batch per post ~10 min (rec) / One per comment | Free text: "one email a day that queues if he has multiple things in the platform per company" |
| Send time | 24h after first queued (rec) / Fixed hour / First immediate then daily | 24h after first queued |
| Recipients | Everyone in conversation (rec) / Narrower for replies | Everyone in conversation |
| Admin alerts | No (rec) / Yes | No |
| Content / opt-out | Full text + global opt-out (rec) / Snippet + per-post mute | Snippet + per-post mute |
| Snippet length | ~200 chars (rec) / Counts only | ~200 chars |
| Mute location | Email + post page bell (rec) / Email only | Email + post page bell |

## Claude's Discretion

Batch outbox mechanics, page size and cursor, slug rules, how search interacts with sort, dashboard table design, category editor UX, account deletion UX, rate-limit thresholds, and how the voter list looks.

## Deferred Ideas

- Product-wide admin email alerts (a new email type, out of scope)
- Digest timezone or send-hour preference
