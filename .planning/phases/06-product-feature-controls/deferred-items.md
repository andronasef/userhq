# Phase 6 deferred items

Out-of-scope findings from 06-10 final verification. None are caused by Phase 6 changes.

- `apps/api/test/browser/portal-branding.spec.ts` "OG and favicon metadata backstop" expects `og:title` "Sunny" but the portal layout has emitted "Sunny · Acme" (`${product} · ${workspace}`) since before the Phase 6 fixed point (`8897b40`). The test is stale.
- `apps/api/test/browser/dashboard-header.spec.ts` "320px dashboard header fits one line" looks for a wordmark `a[href="/dashboard"]:has-text("UserHQ")`. Commit `0078f0a` changed the brand to an `<img>` with `aria-label="UserHQ"`, so the text locator matches nothing. The test is stale.
- `bun run --filter @userhq/api test` is intermittently flaky when files run in parallel (random 401/404 responses, "Parse Error: Expected HTTP/..."). `--no-file-parallelism` passed 492/492 on 3 of 3 runs. The suspected cause is supertest ephemeral-port cross-talk with colima/lima ssh port forwards on this host; this was not confirmed. Removing or changing the `listen(0, "127.0.0.1")` fixtures did not remove the flakiness.
