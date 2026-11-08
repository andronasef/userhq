# Independent review

Fixed point: `ffec020`; reviewed implementation: `7da6763`.

## Standards

No actionable findings. Shared schema validation and read policy enforce restrictions; live product lookup is workspace-scoped; push registration and account switching are transactional. Migration 0024 changes only empty arrays to NULL, preserving timestamps. No new dependencies or unrelated migrations.

## Security and specification

No actionable vulnerabilities or deviations. Cross-user push registration requires both stored keys, otherwise leaves the subscription untouched and creates no caller preferences. Successful account switching deletes the old row and its queued deliveries. Restriction input rejects empty and foreign/deleted/unknown IDs; both read paths deny malformed lists. Integration actor initialization arbitrates both uniqueness constraints and verifies the exact identity before returning an actor.

Nonblocking documentation correction applied: omission on webhook PATCH preserves restrictions; null removes them. Already dispatched push network requests cannot be retracted; the queued-delivery guarantee does not claim that capability.

Verification: 244 affected tests and complete CI passed (834 API, 280 web, 32 types, 7 DB, 26 lint-rule tests, plus lint, typechecks, builds and migration checks). Review was read-only; the existing docs-sync suite checked the final wording correction.
