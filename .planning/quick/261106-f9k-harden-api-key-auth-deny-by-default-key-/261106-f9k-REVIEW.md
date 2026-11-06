# API key security review

Scope: `7e65389...1ac0d94`, then corrective commit `1df7611`.
Independent ask-matt standards and spec reviewers inspected the diff separately.

## Standards

One blocker: Better Auth mounts Express middleware before Nest guards, making
SessionGuard's auth-route rejection unreachable. No other concrete standards
or security finding established in the reviewed diff.

Resolved in `1df7611`: the AuthModule middleware rejects key credentials before
Better Auth reads cookies. Real HTTP GET get-session and POST sign-out tests
failed with 200 before the fix and now return 403 while preserving the session.

## Spec

Two blockers: the same auth middleware bypass, and case-sensitive Bearer parsing
that allowed a key plus cookie to fall back to human authorization.

Both resolved in `1df7611`. One parser now classifies credentials consistently
for origin checks, SessionGuard and Better Auth middleware. A real HTTP test
failed with 200 for lowercase bearer on the account route before the fix; mixed
case, repeated spaces and tab separators now preserve key authorization on
allowed routes and return 403 on human-only routes.

Restricted workspace aggregates returning 403 are explicitly permitted by the
approved security plan. No material scope creep identified. Missing FAQ/settings
automation, outbound URL safety and other approved follow-up fixes were outside
this review.

## Outcome

Initial findings: Standards 1 blocker; Spec 2 blockers (one shared).
All findings addressed and regression-tested by the primary agent; no additional
delegate re-check was run for these focused corrections.
