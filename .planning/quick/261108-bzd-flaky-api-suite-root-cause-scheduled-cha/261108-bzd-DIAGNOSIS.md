# 261108-bzd Diagnosis: flaky API suite

Written before any fix. HEAD at start: `0a497d4`. Host: macOS (Darwin 25.6), Node 24 (vitest runs on node v26.13.0 here), vitest 5.0.3, 8 CPUs, so vitest's default worker count is `max(1, availableParallelism - 1)` = 7 (read from vitest's `resolveMaxWorkers`). Postgres `max_connections` = 100. No worker cap in any run below. `hookTimeout: 30000` was still present (the 261107-s6l mitigation); it was not removed until the fix.

## A1 Baseline, default parallelism, no instrumentation (5 runs)

| Run | Exit | Duration | Failures |
|---|---|---|---|
| 1 | 1 | 35s | `canary-roadmap-leak` "never leaks any internal roadmap field": expected 401 to be 200 (a public portal endpoint); `invites` "unverified user ... 403 on create": expected 404 to be 200 |
| 2 | 0 | 38s | none |
| 3 | 0 | 35s | none |
| 4 | 0 | 32s | none |
| 5 | 0 | 33s | none |

1 of 5 fails. The failing assertions are status codes that belong to a different server (401 on an anonymous-allowed route, 404 for a workspace that exists).

## A2 Ruled-out checklist (grep evidence)

| Check | Result |
|---|---|
| No `process.env` mutation in `apps/api/src` or `apps/api/test` (assignment, delete, `stubEnv`, `Object.assign(process.env`) | No matches. |
| PORT 3999 never bound | Only appears as a string in `test/support/test-app.ts` lines 67 and 69 and `test/env.test.ts` line 7; nothing listens on it. |
| Limiter state per Nest app | `ThrottlerModule.forRoot(...)` is in `AppModule` (`src/app.module.ts:83`), built per `AppModule.register`; `REDELIVER_THROTTLE` (`webhooks.controller.ts:43`) is a constant. |
| Workers do not start intervals under NODE_ENV test | `push.worker.ts:57`, `webhook.worker.ts:70`, `email/worker.ts:45` all gate on `NODE_ENV !== "test"`. |
| No global undici dispatcher | No `setGlobalDispatcher` / `getGlobalDispatcher` in src or test. |
| Every `createTestApp` has a matching close | 65 call sites in 53 files; no file has more `createTestApp(` calls than `.close()` calls. |

None of these breaks a rule. The pool is `forks` with default file parallelism.

## A3 Mechanism probe (throwaway scripts under /tmp/bzd-probe, outside the repo)

Script 1 (`p1.mjs`): a server on `127.0.0.1:0`, then a wildcard server bound to the same port, then `GET 127.0.0.1:port`.

```
wildcard bind to loopback-held port: succeeded {"address":"::","family":"IPv6","port":61639}
GET 127.0.0.1:61639 answered by: LOOPBACK-SERVER
```

Script 2 (`p2.mjs`): four `127.0.0.1` listeners held, 60000 wildcard `listen(0)` + close, then 60000 `listen(0, "127.0.0.1")` + close:

```
wildcard listen(0): 12 of 60000 landed on a held 127.0.0.1 port
listen(0,"127.0.0.1"): 0 of 60000 landed on a held 127.0.0.1 port
```

Matches the planning numbers exactly. Script 3 (`p3.mjs`) repeats it against the real loopback-specific listeners that were open on this host at that moment (ports 49446, 49475, 49496, 49793, none of them from this repo):

```
wildcard listen(0): 16 of 60000 landed on a foreign port
listen(0,"127.0.0.1"): 0 of 60000 landed on a foreign port
```

supertest 7.3 (`node_modules/.bun/supertest@7.3.0+.../lib/test.js` `serverAddress`) calls `app.listen(0)` (wildcard) when `app.address()` is null, then builds the URL against `127.0.0.1:<port>`. A loopback-specific listener on the same port wins the connection.

## A4 In-suite proof: requests do reach the wrong server

Deviation from the plan: instead of patching `webhook-receiver.ts` (which only sees one of the long-lived listeners and none of the foreign ones), I used a preload script outside the repo (`NODE_OPTIONS="--require /tmp/bzd-probe/..."`). Nothing under `apps/` was modified at any point (`git status --short apps` is empty).

Instrument v1 (`stray.cjs`): tag every outgoing `http.request` with the sender pid; log any request arriving at an `http.Server` of a different pid. Validated cross-process and under supertest in vitest. 10 instrumented runs: 2 runs failed (a `Parse Error: Expected HTTP/` in `workspaces.test.ts`, and `workspace-feedback` expected 401 to be 400) and 0 cross-process requests were observed at any HTTP server. So the strays are not requests from this repo's other test workers landing on this repo's own HTTP servers.

Instrument v2 (`stray2.cjs`): stamp every response from an in-process `http.Server` with `x-bzd-srv: <pid>`; on the client, log any supertest response that lacks the stamp or fails with an HTTP parse error, and record what holds that port (`lsof`).

| Run | Exit | Duration | Stray lines | Failures |
|---|---|---|---|---|
| 1 | 1 | 38s | 0 | `webhook-worker` "keeps the body and changes the signature timestamp between attempts": receiver got 3 requests, expected 2 (no stray recorded; not explained by this evidence) |
| 2 | 0 | 38s | 0 | none |
| 3 | 1 | 34s | 3 | `team` concurrent invite creates: `[404,404]` vs `[201,409]`; `team` accept edge cases: 401 vs 200 |
| 4 | 0 | 46s | 0 | none |
| 5 | 0 | 38s | 0 | none |
| 6 | 1 | 32s | 1 | `workspace-feedback` paging: expected 200, got 404 |
| 7 | 0 | 40s | 0 | none |
| 8 | 0 | 27s | 0 | none |
| 9 | 0 | 27s | 0 | none |
| 10 | 0 | 27s | 0 | none |
| 11 | 1 | 26s | 0 | all 767 tests pass; vitest "Errors 1": unhandled `57P01 terminating connection due to administrator command` (originated in `api-key-attribution.test.ts`) |
| 12 | 1 | 28s | 1 | `portal` "directory for unknown workspace returns 404": expected 401 to be 404 |
| 13 | 0 | 26s | 0 | none |
| 14 | 0 | 27s | 0 | none |
| 15 | 1 | 26s | 0 | all 767 tests pass; same unhandled `57P01` (originated in `votes.test.ts`) |

The five stray lines, verbatim (holders are `lsof` output: `p` pid, `c` command, `n` address):

```
run 3: status=404 POST /api/v1/workspaces/ws-a-2e3e76e0/invites  port=49446 holders=p1775 cloudflared n127.0.0.1:49446 | p61717 node (the test process) n*:49446   (twice)
run 3: status=401 POST /api/v1/invites/<token>/accept             port=49496 holders=p2137 node n127.0.0.1:49496 | p61717 node (the test process) n*:49496
run 6: status=404 GET /api/v1/workspaces/ws-inbox-paging/requests port=49475 holders=p2091 T3 Code (Beta) n127.0.0.1:49475 | p62761 node (the test process) n*:49475
run 12: status=401 GET /api/v1/portal/non-existent-ws             port=49496 holders=p2137 node n127.0.0.1:49496 | p64944 node (the test process) n*:49496
```

In every case the test process's own wildcard listener (`n*:port`, bound by supertest) shares the port with a different process listening on `127.0.0.1:port`, and the response came from that other process. Holders seen: `cloudflared`, a `node` dev server, and `T3 Code`, all ordinary background processes of this machine and none of them part of this repo. 4 of the 6 failing v2 runs have a recorded stray that matches the failing request.

Not explained by this mechanism: v2 run 1 (webhook-worker counted 3 receiver hits, expected 2, no stray recorded) and the two unhandled-`57P01` runs (11, 15). The `57P01` (`DROP DATABASE ... WITH (FORCE)` killing a connection that is still closing) never appeared in the 20 uninstrumented runs (A1 and A5) and showed up 3 times in the 25 instrumented ones, so I treat it as a possible second cause that the instrumentation (extra synchronous work per request) may make more likely. It is not fixed here. If it shows in the post-fix runs it gets its own diagnosis.

## A5 Exclusion experiment: repo-owned loopback listeners are not required for the failures

15 default-parallelism runs with `webhooks`, `push`, `outbound-http`, `product-feature-delivery-race`, `public-product-features`, `webhook-events`, `webhook-secrets` and `webhook-worker` excluded (50 of 58 files run):

| Run | Exit | Duration | Failures |
|---|---|---|---|
| 1 | 1 | 44s | `dashboard-board` (Parse Error), 3 in `portal-changelog` (404/403 where 200 expected, and an undefined `.map`) |
| 2-5 | 0 | 42-47s | none |
| 6 | 1 | 41s | `api-keys` rate limit (Parse Error), `votes` throttling (404 vs 200), `workspace-feedback` reply (401 vs 201) |
| 7-9 | 0 | 33-42s | none |
| 10 | 1 | 32s | `uploads` rate limit (Parse Error) |
| 11-13 | 0 | 24-29s | none |
| 14 | 1 | 28s | `merge` tracer (Parse Error), `workspaces` x2 (404 vs 200, 401 vs 400) |
| 15 | 0 | 28s | none |

4 of 15 fail, the same symptoms as the full suite. This refutes the first form of the planning hypothesis (the repo's own long-lived 127.0.0.1 listeners are what the wildcard listeners collide with). The colliding holders are foreign loopback listeners, as A4 v2 shows. `Parse Error: Expected HTTP/` is a request answered by a non-HTTP listener.

## Conclusion

Confirmed root cause. supertest starts its own wildcard (`::`) listener on an ephemeral port for every app that is not already listening, and closes it after the last request. The request is then sent to `127.0.0.1:<port>`. When the kernel hands that wildcard bind a port that some other process holds with a `127.0.0.1`-specific listener, the bind succeeds (macOS allows a wildcard bind next to a specific one) and the connection is answered by the other process. On this host that other process is whatever happens to be listening on loopback in the ephemeral range (cloudflared, a node dev server, T3 Code; the repo's own long-lived listeners add to it). The test then sees a 401, 404, 403 or `Parse Error` that is really another server's answer. This is a trust-boundary defect for tenant-isolation tests (D-11): a 403/404 assertion can pass or fail for the wrong reason. Evidence: A3 (mechanism reproduced, 16 landings in 60000 with foreign listeners, 0 with a loopback bind), A4 v2 (5 strays caught in the act, with `lsof` naming the foreign holder, tied to failing tests in 4 runs), A5 (failures persist without the repo's own listeners, so they are not the cause).

Fix direction (unchanged): make `createTestApp` own exactly one listener per app, bound to `127.0.0.1`, so supertest never starts a wildcard listener, and the kernel's ephemeral port choice is conflict-aware against loopback-specific holders (A3: 0 of 60000). Add a guard test.

Residual risk: a foreign process holding a wildcard port with address reuse enabled could still be shared with a `127.0.0.1` bind on some platforms; and the 57P01 and webhook-worker (3 vs 2) observations above are not explained by this mechanism and are tracked for the post-fix runs.

## Resume audit and additional teardown cause (2026-11-08)

The interrupted run left this diagnosis file **untracked** while committing RED `c9a138f`, loopback fix `e08b721`, and input-validation fix `0d8b096`. Its text reports that it was written before those fixes, but there is no diagnosis commit predating them. The plan's commit-order acceptance criterion is therefore not met; the resumed work preserves that history instead of rewriting it. The earlier `/tmp/bzd*` probe scripts and logs were no longer present at resumption, so the earlier tables above are inherited evidence, not measurements repeated in this continuation.

The continuation's first default-parallel API run (`/tmp/bzd-resume-post-api-1.log`) passed all 775 assertions in 59 files but exited 1 after 41.5 seconds because of one unhandled PostgreSQL `57P01` (terminating connection due to administrator command). This confirms the previously suspected second cause without instrumentation.

Installed `pg-pool` removes clients from its internal collection before `client.end(callback)` completes. Its public `pool.end()` promise consequently resolves before the clients' terminal `end` events. An independent real-Postgres probe on this host observed:

```
pool.end resolved; closed clients: 0
remove event after socket closed
after socket close; closed clients: 1
```

The probe's final observation used a 50 ms delay to observe the ordering; the fix uses no delay. Previously the test harness immediately issued `DROP DATABASE ... WITH (FORCE)` after `app.close()`/`pool.end()`, so PostgreSQL could forcibly terminate a connection still completing graceful shutdown. The harness now subscribes to each real client's public `end` event when the pool emits `connect`, and awaits those terminal events before dropping the database. It does not catch or suppress pool errors and does not raise timeouts. The real-DB regression opens ten concurrent connections and checks that all observed clients have ended when `close()` returns. That focused test passed before the fix too because the failure is a race; the actual RED evidence is the full-suite failure plus the deterministic public-event ordering probe.

## Receiver probe isolation

The interrupted work also left a filter dropping every HTTP request without `x-userhq-delivery`. That would hide malformed application deliveries, so it was replaced with a method boundary: the fixture rejects non-POST requests with 405 and records every POST, including one without any webhook headers. A new HTTP test failed before the fixture fix (GET recorded as an extra delivery), then passed with the fix; it also asserts that a missing-header POST is still recorded. Focused verification of isolation, webhook worker/secrets and API keys passed 60 tests.

Earlier notes attributed unsolicited GETs with a `node` agent to local tooling, but the original raw receiver logs did not survive interruption. This continuation does not claim to identify that caller or prove that GET noise explains every earlier extra-hit failure. The fixture's POST-only contract is now explicit and its malformed-delivery assertions remain sensitive.

## Measured integration-hook budget

After the socket lifecycle fix, five default-parallel API runs passed (table below). The first full CI attempt then failed after 146.9 seconds: nine files hit Vitest's 10-second hook deadline, mostly in `beforeAll` database/app setup and once in `portal-changelog`'s `afterAll`. It passed 715 assertions and skipped 61 because setup timed out. No wrong-server response or `57P01` occurred. Re-running those nine files together passed all 72 assertions in 11.30 seconds.

One bounded diagnostic full-suite run instrumented the real PostgreSQL client query timings through an external `/tmp` preload, while a separate admin connection sampled `pg_stat_activity` every 100 ms. It passed all 776 assertions in 89.34 seconds. Its 835 samples observed at most 29 client connections and 14 active connections, below the configured 100-connection limit. Checkpoint waits dominated (306 `CheckpointDone` plus 318 `CheckpointStart` samples), with WAL sync/write waits also present. The slowest individual DROP DATABASE was 6647 ms; CREATE DATABASE was 1359 ms, and another query took 2083 ms. These are real database lifecycle and checkpoint costs under concurrent load; no connection exhaustion was observed. The original CI failure establishes that the complete hook can exceed 10 seconds; the probe does not claim a 6.65-second single statement alone exceeded that deadline.

The parent approved a measured 30-second **integration hook** budget, matching the existing 30-second test budget, while retaining default file/worker parallelism. This explicitly changes the earlier plan criterion that `hookTimeout` must be absent. The earlier unexplained override was removed and tested; the reinstated budget has recorded failure and timing evidence. It does not suppress failed assertions, PostgreSQL errors or wrong-server responses. No temporary instrumentation was added to tracked source; `/tmp` preloads are absent from the final verification environment. Five standalone runs do not need repeating for this timeout-only configuration change; the three consecutive CI runs restart after it.

<!-- post-fix reliability runs are appended below after the fix -->
