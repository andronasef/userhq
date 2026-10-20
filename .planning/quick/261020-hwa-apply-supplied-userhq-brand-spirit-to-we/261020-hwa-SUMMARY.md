---
status: complete
quick_id: 261020-hwa
implementation_commit: 0078f0a
---

# UserHQ brand adaptation

Applied the supplied identity in spirit to the existing web product: extracted human face and local favicon, Manrope body and Space Grotesk headings, cool paper/ink/indigo tokens, restrained coral detail, welcome and OAuth entry, shared controls, app/dashboard/mobile identity and portal attribution. Tenant logos, names, accents and workflows remain intact. Root branding no longer inherits a previously visited tenant.

## Artifacts and scope

Product and token-bearing design records live in apps/web/PRODUCT.md, apps/web/DESIGN.md and apps/web/.impeccable/design.json because the UI workspace owns this system (app-scoped refinement of provisional plan paths). Font binaries were committed concurrently in 841fabd; their licenses are included in 0078f0a. Product/plan setup was committed concurrently in 4170ea5. Existing unrelated development changes were preserved.

## Validation

- Web typecheck and all 108 tests across 14 files passed.
- Repository oxlint and git diff --check passed.
- vinext production standalone build passed; existing bundler configuration/dynamic-import warnings remain nonblocking.
- Playwright captured actual home, login, public feedback, roadmap and FAQ views; desktop1440px, mobile390px and narrow320px checks showed no horizontal overflow. Both local fonts and every image loaded; no page errors. Existing portal primary accent stayed #2563EB.
- Home sign-in navigation, root identity after a tenant visit, keyboard focus, and login error rendering passed.
- Impeccable detector ran once. Space Grotesk warning is explicitly pinned by supplied brand. Neutral blockquote border is incumbent content formatting. Documenter added the existing rich-text type sizes and small/pill radii flagged as undocumented.
- Independent Impeccable finish review disposition: ship for captured Operate scope; no material fixes. Independent documenter validated YAML/JSON tokens, eight canonical sections, component references and schema-v2 sidecar.

## Evidence and limits

Captures and runtime checks: /tmp/userhq-brand-review/ (ephemeral local evidence). T3 preview snapshots twice produced mismatched1280x800 duplicated imagery for mobile viewports; used repository Playwright for reliable captures. Private dashboard surfaces were source-reviewed and built, but not visually inspected behind an authenticated session. OAuth provider submission was not performed. No deployment or backend change.
