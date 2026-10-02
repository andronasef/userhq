# Phase 2: Workspaces, Products & Platform Owner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-02
**Phase:** 02-workspaces-products-platform-owner
**Areas discussed:** Admin area layout & URLs, Portal shell & branding, Invite link behavior

---

## Admin area layout & URLs

| Question | Options | Selected |
|---|---|---|
| Dashboard location | /dashboard/{ws}/... · /{ws}/{product}/admin · You decide | /dashboard/{ws}/... |
| Post-sign-in landing | Smart redirect · Always /dashboard picker · Stay on home | Smart redirect |
| Workspace switcher | Dashboard header dropdown · User menu entries · You decide | Header dropdown |
| Dashboard nav | Left sidebar · Top tabs · You decide | Left sidebar |
| Owner console | /platform · /dashboard/platform · Obscure path | /platform |
| Owner as normal user | Yes + console · Console-only account | Yes + console |

## Portal shell & branding

| Question | Options | Selected |
|---|---|---|
| Branding depth | Logo + name · Logo + accent · Workspace vs product logo | Other: "full branding as it could be useful". Claude proposed accent (auto-contrast), tagline, website link, and favicon/OG from logo; the user selected all four |
| Branding scope | Per product with workspace fallback · Per workspace only | Per product with workspace fallback |
| Portal before board | Header + tabs + coming soon · Bare landing · You decide | Header + tabs + coming soon |
| /{ws} page | Header + product cards · Auto-redirect if one product | Other: auto-redirect, and the company can disable the page |
| /{ws} when disabled | Redirect to default product · 404 · Redirect to website link | Redirect to website link (404 if none) |
| Default | List enabled · Disabled | List enabled, auto-redirect with 1 product |
| Powered by UserHQ | Footer always · None · Admin toggle | Footer always |

## Invite link behavior

| Question | Options | Selected |
|---|---|---|
| Expiry | 7 days both · Admin picks · 30d/7d | 7 days both |
| Signed-out invitee | Preview page · Straight to /login | Straight to /login |
| One flow? | Shared /invite/{token} · Separate routes · You decide | Shared |
| Email mismatch | Explain + switch account · Inviter approves | First picked inviter approval, then reversed: "make it simple invitation link … for specific email so we don't have these complex issues" |

**Notes:** The follow-ups on approval (scope, notification, locking) were answered, then withdrawn when the user deferred the approval flow entirely.

## Claude's Discretion

- Reorder implementation, preset palette, contrast algorithm, slug format rules, coming-soon and invite-error copy, and the picker and empty-state visuals.
- Defaults for the undiscussed areas, which the user accepted: soft delete with the slug reserved and type-to-confirm; a ban kills sessions immediately; suspended admins see an unavailable notice; the status editor uses drag handles and a palette plus hex input.

## Deferred Ideas

- Inviter/owner approval of mismatched invite claims
- Product restore UI and suspension reasons
- Custom domains, custom CSS, and a dark theme
