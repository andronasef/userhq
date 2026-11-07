import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { schema } from "@userhq/db";
import { API_KEY_SCOPES, API_KEY_RATE_LIMIT } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { discoverRoutes, type DiscoveredRoute } from "./support/routes.js";

const docs = () => readFileSync(new URL("../../../docs/automation-api.md", import.meta.url), "utf8");

/** Text of one H2 section, matched by a word in its heading. */
function section(word: string): string {
  const parts = docs().split(/^## /m).slice(1);
  const found = parts.find((p) => p.split("\n")[0].toLowerCase().includes(word.toLowerCase()));
  if (!found) throw new Error(`docs/automation-api.md has no "${word}" section`);
  return found;
}

/** Cells of every table row whose first cell is backticked. */
function rows(text: string): string[][] {
  return text
    .split("\n")
    .filter((l) => /^\|\s*`/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}
const unquote = (c: string) => c.replace(/^`|`$/g, "");

// Session-only /workspaces/:ws controllers. A new :ws route must be scoped (and documented) or land here with a reason.
const SESSION_ONLY_CONTROLLERS: Record<string, string> = {
  ApiKeysController: "credentials: a key must never mint, list or revoke keys",
  MembersController: "team membership",
  TeamInvitesController: "team invites",
  WorkspaceController: "workspace settings and deletion",
  PushFollowController: "a person's own browser push subscription",
  // Story 20 lists FAQ and product settings as automation targets, but these routes carry no scope today.
  // Pinned deliberately as a known gap, not silently: give them scopes and move them to the docs to close it.
  FaqController: "story-20 gap: FAQ has no scope yet",
  ProductsController: "story-20 gap: product settings have no scope yet",
  StatusesController: "story-20 gap: product status settings have no scope yet",
  CategoriesController: "story-20 gap: product category settings have no scope yet",
};
// Handler exceptions inside otherwise scoped controllers: "Controller.handler".
const SESSION_ONLY_HANDLERS: Record<string, string> = {
  "WorkspaceFeedbackController.markCommentRead": "a person's own read state",
};

describe("automation route inventory and docs sync (quick-261107-flq)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let routes: DiscoveredRoute[];
  let scoped: DiscoveredRoute[];
  const label = (r: DiscoveredRoute) => `${r.verb} /api/v1${r.path} (${r.controller}.${r.handler})`;

  beforeAll(async () => {
    testApp = await createTestApp();
    routes = discoverRoutes(testApp.app);
    scoped = routes.filter((r) => r.scopes.length > 0);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("every scoped route declares exactly one scope from API_KEY_SCOPES", () => {
    for (const r of scoped) {
      expect(r.scopes, label(r)).toHaveLength(1);
      expect(API_KEY_SCOPES as readonly string[], label(r)).toContain(r.scopes[0]);
    }
  });

  it("every non-admin scope is used by at least one route", () => {
    const used = new Set(scoped.map((r) => r.scopes[0]));
    for (const scope of API_KEY_SCOPES.filter((s) => s !== "admin")) {
      expect(used.has(scope), `no route requires ${scope}`).toBe(true);
    }
    expect(used.has("admin")).toBe(false);
  });

  it("every /workspaces/:ws route is scoped or deliberately pinned as session-only", () => {
    const unclassified = routes
      .filter((r) => r.path.startsWith("/workspaces/:ws") && r.scopes.length === 0)
      .filter((r) => !(r.controller in SESSION_ONLY_CONTROLLERS))
      .filter((r) => !(`${r.controller}.${r.handler}` in SESSION_ONLY_HANDLERS))
      .map(label);
    expect(
      unclassified,
      `Unscoped :ws routes: add @RequireScopes and a row in docs/automation-api.md, or pin them as session-only with a reason in this test.`
    ).toEqual([]);
  });

  it("admin keys are denied (api_key_route_forbidden) on every route without a scope", async () => {
    const admin = await signedInCookie(testApp.test, {
      name: "Sweep Admin",
      email: `sweep-${Date.now()}@userhq.test`,
      emailVerified: true,
    });
    const slug = `ws-sweep-${Date.now()}`;
    const [ws] = await testApp.db.insert(schema.workspaces).values({ name: "Sweep", slug }).returning();
    await testApp.db.insert(schema.workspaceMembers).values({ workspaceId: ws.id, userId: admin.userId, role: "owner" });
    const created = await request(testApp.http)
      .post(`/api/v1/workspaces/${slug}/api-keys`)
      .set({ Cookie: admin.cookie, Origin: testApp.env.PUBLIC_URL })
      .send({ name: "Sweep key", scopes: ["admin"] });
    expect(created.status).toBe(201);

    const unscoped = routes.filter((r) => r.scopes.length === 0);
    expect(unscoped.length).toBeGreaterThan(0);
    for (const r of unscoped) {
      const url = "/api/v1" + r.path.replace(/:[A-Za-z]+/g, "x");
      const res = await (request(testApp.http) as any)[r.verb.toLowerCase()](url)
        .set("Authorization", `Bearer ${created.body.token}`)
        .send({});
      expect(res.status, `${label(r)} -> ${res.status}`).toBe(403);
      expect(res.body.code, label(r)).toBe("api_key_route_forbidden");
    }
  });

  it("the docs Scopes table lists exactly API_KEY_SCOPES", () => {
    const documented = rows(section("Scopes")).map((c) => unquote(c[0]));
    expect(documented.sort()).toEqual([...API_KEY_SCOPES].sort());
  });

  it("the docs Endpoints table equals the set of scoped routes, by method, path and scope", () => {
    const documented = rows(section("Endpoints")).map((c) => `${unquote(c[0])} ${unquote(c[1])} ${unquote(c[2])}`);
    const actual = scoped.map((r) => `${r.verb} /api/v1${r.path} ${r.scopes[0]}`);
    expect(documented.filter((d) => !actual.includes(d)), "documented but not enforced").toEqual([]);
    expect(actual.filter((a) => !documented.includes(a)), "enforced but not documented").toEqual([]);
    expect(new Set(documented).size, "duplicate documented rows").toBe(documented.length);
  });

  it("the docs state the rate limit with the constant's numbers", () => {
    expect(section("Rate limits")).toContain(
      `${API_KEY_RATE_LIMIT.limit} requests per ${API_KEY_RATE_LIMIT.windowSeconds} seconds per key`
    );
  });
});
