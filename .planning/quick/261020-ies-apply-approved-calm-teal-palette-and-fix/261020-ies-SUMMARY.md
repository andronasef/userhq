---
status: complete
quick_id: 261020-ies
implementation_commit: 2606273
---

# Approved Calm Teal palette

Applied #087F75 actions, #F6F8F7 canvas, #E1F1ED selections and #D8E2DE borders. Deeper #066A62 selected text preserves contrast. Shared face SVG and favicon use fixed #0F182A; brand wordmark HQ uses teal. Removed old purple/coral tokens; semantic brand-accent and brand-selection names now describe their roles. Preserved typography, layout, behavior and tenant overrides.

Updated app-scoped DESIGN.md, PRODUCT.md, schema-v2 design sidecar and CHANGELOG.md. #E8EEF7 is documented only for a future dark interface; no dark theme was added.

## Validation

- Web typecheck and108 tests passed; lint and git diff --check passed.
- vinext production standalone build passed (existing bundler warnings only).
- Actual Playwright screenshots of home, login and existing customer portal at1440px and390px: fonts/images loaded, no overflow or pageerrors. Portal retained #2563EB primary. Both served SVG assets verified exact fixed ink fill.
- Contrast: white/teal4.88:1; selected text/selection5.55:1; muted text/canvas5.87:1; ink/canvas16.62:1.
- Impeccable detector once: unchanged pinned Space Grotesk and incumbent neutral blockquote warnings; no palette findings. No full redesign or new imagery.
- Local ephemeral screenshots/checks/build log in /tmp/userhq-teal-review. Reused repository Playwright due previously established broken T3 screenshot captures. Private authenticated admin screens were source-reviewed and built, not visually tested behind authentication.
