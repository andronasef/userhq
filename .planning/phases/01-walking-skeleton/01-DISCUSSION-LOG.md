# Phase 1: Walking Skeleton - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 01-walking-skeleton
**Areas discussed:** Sign-in & accounts, Upload rules, Environments & deploy, Skeleton UI fidelity

---

## Sign-in & accounts

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-link | Same verified email means one account with both providers | ✓ |
| Reject, link manually | account_not_linked error, link from settings | |
| Separate accounts | One user per provider | |

| Option | Description | Selected |
|--------|-------------|----------|
| /login page | Dedicated page with ?next= return | ✓ |
| Modal dialog | Radix Dialog over the current page | |
| Both | Modal plus fallback page | |

| Option | Description | Selected |
|--------|-------------|----------|
| Provider at first sign-in | Copied once, no auto-sync | ✓ |
| Refresh on every sign-in | Mirror the latest provider profile | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| 30 days, sliding | | |
| 7 days, sliding | Better Auth default | |
| You decide | | |

**User's choice:** Auto-link, /login page, profile copied at first sign-in, session length "14 days" (free text, recorded as sliding).

---

## Upload rules

| Option | Description | Selected |
|--------|-------------|----------|
| 5 MB | | |
| 10 MB | | |
| 2 MB | | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep animation | Animated WebP | |
| First frame only | Static WebP | ✓ (via free text) |

| Option | Description | Selected |
|--------|-------------|----------|
| Presets, 2 widths | logo 512, content 800+1600 | |
| Cap only | Single WebP capped at 1600px | ✓ |
| Presets, logo + capped content | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-only test page | | ✓ |
| Reusable upload component | | |
| API only, tested via e2e | | |

**User's choice:** 2 MB, static only, cap only, dev-only test page.
**Notes:** The user said people can paste external image URLs, so static uploads are enough and save space. The user asked for an explanation of "cap only makes changelog pages heavier" and of per-purpose presets, then chose cap only.

---

## Environments & deploy

| Option | Description | Selected |
|--------|-------------|----------|
| Caddy in compose | Mirrors prod routing locally | ✓ |
| Vite dev proxy | No extra container; routes differently from prod | |

| Option | Description | Selected |
|--------|-------------|----------|
| Prod only | | |
| Staging + prod | | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| One compose app | | ✓ |
| Separate apps | | |

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions | | ✓ |
| Dokploy builds only | | |
| Actions + GHCR images | | |

| Option | Description | Selected |
|--------|-------------|----------|
| main→staging, tag→prod | | ✓ |
| main→staging, manual prod | | |
| Branches | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mailpit on staging | | ✓ |
| Real Brevo on both | | |

**Notes:** The user asked for the difference between Caddy and the Vite proxy before choosing.

---

## Skeleton UI fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal real shell | Tailwind, Inter, Button/Avatar/DropdownMenu, header | ✓ |
| Bare proof pages | | |
| Full design baseline | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dark mode later | Tokens now | ✓ |
| Dark mode from the start | | |

---

## Claude's Discretion

- SMTP check method, Better Auth `updateAge`, `limitInputPixels`, WebP quality, upload path scheme, and staging/prod compose overrides.

## Deferred Ideas

- External https image URLs in rich text (Phase 5 decision; conflicts with the current image.src allowlist)
- Srcset widths and per-purpose upload presets
- Dark mode
