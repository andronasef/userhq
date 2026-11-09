# Localization admin review — 2026-11-10

Scope: working changes against `d1b5fb1910ce480a9421cc5be29fbd363a2fed45` (`git diff HEAD`) plus the untracked product locale form test. The previously committed localization foundation is context, not a complete retrospective audit. Standards and Spec were reviewed independently by two read-only agents. Findings below describe the pre-fix code.

## Standards

1. **P2 — Empty FAQ answers now save.** `faq-question-dialog.tsx` replaced meaningful-content inspection with a top-level array-length check. Clearing Tiptap leaves an empty paragraph, which passed that check. **Fixed:** recursive meaningful-content validation rejects empty paragraphs, whitespace and empty nested lists while accepting text and images; regression tests cover these cases.
2. **P2 — Distinct roadmap fields have identical labels.** `roadmap-item-modal.tsx` used the description label for internal notes. **Fixed:** a separate notes label exists in all 13 dictionaries.
3. **Documented standard — Missing workflow documentation.** AGENTS.md requires affected guides alongside visible workflow changes. The new confirmation/impact preview was absent from the user guide. **Fixed:** the user guide, canonical API reference and LLM guide describe preview, confirmation, content promotion, preserved source-language content and fallback. API docs distinguish the UI confirmation from the direct PATCH contract.

No additional concrete baseline-smell findings were reported. Three findings, all addressed; the highest severity was P2.

## Spec

1. **P2 — Confirmation bypasses the impact preview.** The new button remained enabled while loading and after silently caught preview failures. **Fixed:** confirmation and the save handler require a completed preview for the selected target; errors have translated retry controls; closing/reopening invalidates older requests. Tests cover loading, absent and wrong-target previews, pending saves, failure/retry copy, success counts and Arabic error copy.
2. **P2 — FAQ validation regression.** Relaxing blank-answer validation was unrelated to the requested locale editor. **Fixed:** as described in Standards finding 1 (the same defect).
3. **P2 — Localization is partial in edited editor workflows.** Newly rewritten validation messages remained English. **Fixed in the reviewed replacements:** FAQ category/question/answer validation, changelog title validation and save statuses, editor placeholders, the language-settings default badge and minimum-language error use dictionaries. New keys are supplied in all 13 locales. The review does not certify exhaustive localization of untouched helper/error copy elsewhere in the platform.

Three findings, all addressed within the pending-change review scope; the highest severity was P2. No new API security incompatibility was identified in the pending API test changes.

## Additional correction

The new webhook URL helper incorrectly advertised HTTP support. Its translations now require a public HTTPS endpoint, matching the server's existing outbound destination policy. Unused imports in changed API-key/webhook components were removed.

## Verification scope

- Lint: exit 0; existing warnings remain elsewhere in the repository.
- Typecheck: all four workspaces passed.
- Web tests: 338 passed, including the new regression cases and dictionary parity checks.
- Production web build: `vinext build` passed with bundler warnings.
- No manual browser interaction or visual RTL/layout certification was performed. Confirmation tests render the component's states; they do not exercise a real browser event sequence.
- Full-suite final result is recorded in the task summary.
