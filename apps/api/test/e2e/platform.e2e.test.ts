import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { schema } from "@userhq/db";
import { inArray } from "drizzle-orm";
import {
  openStack,
  mintSession,
  ownerSession,
  apiCall,
  type StackContext,
} from "../support/stack.js";

describe("Platform Owner Console E2E (Plan 02-05)", () => {
  let stack: StackContext;
  const createdInviteIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    stack = await openStack();
  });

  afterAll(async () => {
    if (createdInviteIds.length > 0) {
      await stack.db
        .delete(schema.invites)
        .where(inArray(schema.invites.id, createdInviteIds));
    }
    if (createdWorkspaceIds.length > 0) {
      await stack.db
        .delete(schema.statuses)
        .where(
          inArray(
            schema.statuses.productId,
            stack.db
              .select({ id: schema.products.id })
              .from(schema.products)
              .where(inArray(schema.products.workspaceId, createdWorkspaceIds))
          )
        );
      await stack.db
        .delete(schema.products)
        .where(inArray(schema.products.workspaceId, createdWorkspaceIds));
      await stack.db
        .delete(schema.workspaces)
        .where(inArray(schema.workspaces.id, createdWorkspaceIds));
    }
    if (createdUserIds.length > 0) {
      await stack.db
        .update(schema.user)
        .set({ bannedAt: null })
        .where(inArray(schema.user.id, createdUserIds));
      await stack.db
        .delete(schema.user)
        .where(inArray(schema.user.id, createdUserIds));
    }
    await stack.close();
  });

  it("platform owner creates an invite, views /platform HTML with invite listed", async () => {
    const owner = await ownerSession(stack);
    const email = `e2e-invite-${Date.now()}@example.com`;

    // POST /api/v1/platform/invites
    const postRes = await apiCall("/api/v1/platform/invites", {
      method: "POST",
      cookie: owner.cookie,
      headers: {
        Origin: stack.env.PUBLIC_URL,
      },
      body: { email },
    });

    expect(postRes.status).toBe(201);
    const inviteData = await postRes.json();
    expect(inviteData.email).toBe(email);

    // Track invite id for cleanup
    const rows = await stack.db.query.invites.findMany({
      where: (inv, { eq }) => eq(inv.email, email),
    });
    expect(rows).toHaveLength(1);
    createdInviteIds.push(rows[0].id);

    // GET /platform HTML
    const getRes = await apiCall("/platform", {
      cookie: owner.cookie,
    });
    expect(getRes.status).toBe(200);
    const html = await getRes.text();

    expect(html).toContain("Platform");
    expect(html).toContain(email);

    const appShellMatches = html.match(/data-shell="app"/g) || [];
    expect(appShellMatches).toHaveLength(1);
  });

  it("anonymous caller gets 404 and Page not found on /platform with no redirect", async () => {
    const res = await apiCall("/platform", {
      redirect: "manual",
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();

    const html = await res.text();
    expect(html).toContain("Page not found");
    const appShellMatches = html.match(/data-shell="app"/g) || [];
    expect(appShellMatches).toHaveLength(1);
  });

  it("non-owner caller gets 404 and Page not found on /platform with no redirect", async () => {
    const regular = await mintSession(stack, { name: "Regular User" });

    const pageRes = await apiCall("/platform", {
      cookie: regular.cookie,
      redirect: "manual",
    });
    expect(pageRes.status).toBe(404);
    expect(pageRes.headers.get("location")).toBeNull();

    const html = await pageRes.text();
    expect(html).toContain("Page not found");
    const appShellMatches = html.match(/data-shell="app"/g) || [];
    expect(appShellMatches).toHaveLength(1);

    // Non-owner API access also returns 404
    const apiRes = await apiCall("/api/v1/platform/invites", {
      cookie: regular.cookie,
    });
    expect(apiRes.status).toBe(404);
    const apiJson = await apiRes.json();
    expect(apiJson.code).toBe("not_found");
  });

  it("platform owner browses /platform/workspaces, non-owner gets 404", async () => {
    const owner = await ownerSession(stack);
    const ts = Date.now();
    const slug = `e2e-ws-${ts}`;
    const name = `E2E Workspace ${ts}`;

    // Seed workspace
    const [ws] = await stack.db
      .insert(schema.workspaces)
      .values({ slug, name })
      .returning();
    createdWorkspaceIds.push(ws.id);

    // Owner views /platform/workspaces?q={slug}
    const getRes = await apiCall(`/platform/workspaces?q=${slug}`, {
      cookie: owner.cookie,
    });
    expect(getRes.status).toBe(200);
    const html = await getRes.text();
    expect(html).toContain(name);
    expect(html).toContain(`/${slug}`);

    // Non-owner gets 404
    const regular = await mintSession(stack, { name: "Regular Non Owner" });
    const nonOwnerRes = await apiCall("/platform/workspaces", {
      cookie: regular.cookie,
      redirect: "manual",
    });
    expect(nonOwnerRes.status).toBe(404);
  });

  it("suspended workspace takes portals and dashboard offline without deleting data", async () => {
    const owner = await ownerSession(stack);
    const ts = Date.now();
    const wsSlug = `sus-e2e-${ts}`;
    const wsName = `Suspended E2E ${ts}`;
    const prodSlug = `prod-${ts}`;

    // 1. Seed member user
    const member = await mintSession(stack, { name: "Suspended Member" });

    // 2. Seed primary workspace (to be suspended)
    const [ws] = await stack.db
      .insert(schema.workspaces)
      .values({ slug: wsSlug, name: wsName })
      .returning();
    createdWorkspaceIds.push(ws.id);

    // 3. Seed secondary workspace for member (so me.workspaces.length > 1)
    const [wsOther] = await stack.db
      .insert(schema.workspaces)
      .values({ slug: `other-ws-${ts}`, name: `Other WS ${ts}` })
      .returning();
    createdWorkspaceIds.push(wsOther.id);

    await stack.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: member.userId, role: "owner" },
      { workspaceId: wsOther.id, userId: member.userId, role: "owner" },
    ]);

    // 4. Seed product
    await stack.db
      .insert(schema.products)
      .values({ workspaceId: ws.id, slug: prodSlug, name: "Suspended Product" })
      .returning();

    // 5. Suspend workspace via owner API
    const susRes = await apiCall(`/api/v1/platform/workspaces/${ws.id}/suspend`, {
      method: "POST",
      cookie: owner.cookie,
      headers: { Origin: stack.env.PUBLIC_URL },
    });
    expect(susRes.status).toBe(204);

    // 6. Member opens /dashboard/{wsSlug} -> "{wsName} is unavailable" in AppShell, no sidebar
    const dashRes = await apiCall(`/dashboard/${wsSlug}`, {
      cookie: member.cookie,
    });
    expect(dashRes.status).toBe(200);
    const dashHtml = await dashRes.text();
    expect(dashHtml).toContain(`${wsName} is unavailable`);
    expect(dashHtml).toContain("Go to home");
    expect(dashHtml).toContain("Switch workspace");
    expect(dashHtml).not.toContain('aria-label="Workspace"');

    // 7. Public portal directory /{wsSlug} -> "This page is unavailable"
    const portalDirRes = await apiCall(`/${wsSlug}`);
    const portalDirHtml = await portalDirRes.text();
    expect(portalDirHtml).toContain("This page is unavailable");

    // 8. Public product portal /{wsSlug}/{prodSlug} -> "This page is unavailable"
    const portalProdRes = await apiCall(`/${wsSlug}/${prodSlug}`);
    const portalProdHtml = await portalProdRes.text();
    expect(portalProdHtml).toContain("This page is unavailable");

    // 9. Lift suspension via owner API
    const liftRes = await apiCall(`/api/v1/platform/workspaces/${ws.id}/suspend`, {
      method: "DELETE",
      cookie: owner.cookie,
      headers: { Origin: stack.env.PUBLIC_URL },
    });
    expect(liftRes.status).toBe(204);

    // 10. Dashboard access is restored
    const restoredDashRes = await apiCall(`/dashboard/${wsSlug}`, {
      cookie: member.cookie,
    });
    expect(restoredDashRes.status).toBe(200);
    const restoredHtml = await restoredDashRes.text();
    expect(restoredHtml).not.toContain(`${wsName} is unavailable`);
  });

  it("platform owner bans a user, signed out everywhere, login error shows account banned copy", async () => {
    const owner = await ownerSession(stack);
    const user = await mintSession(stack, { name: "Banned E2E User" });
    createdUserIds.push(user.userId);

    // Prior to ban: user has active session
    const homeResBefore = await apiCall("/", { cookie: user.cookie });
    expect(homeResBefore.status).toBe(200);

    // Ban user through owner API
    const banRes = await apiCall(`/api/v1/platform/users/${user.userId}/ban`, {
      method: "POST",
      cookie: owner.cookie,
      headers: { Origin: stack.env.PUBLIC_URL },
    });
    expect(banRes.status).toBe(204);

    // Old cookie -> GET / renders the signed-out state ("Sign in" button in header)
    const homeResAfter = await apiCall("/", { cookie: user.cookie });
    expect(homeResAfter.status).toBe(200);
    const homeHtmlAfter = await homeResAfter.text();
    expect(homeHtmlAfter).toContain("Sign in");

    // Login with account_banned error: GET /login?error=account_banned
    const loginRes = await apiCall("/login?error=account_banned");
    expect(loginRes.status).toBe(200);
    const loginHtml = await loginRes.text();
    expect(loginHtml).toContain("This account can't sign in");
    expect(loginHtml).toContain("Your access to UserHQ has been suspended");

    // Lift ban
    const liftRes = await apiCall(`/api/v1/platform/users/${user.userId}/ban`, {
      method: "DELETE",
      cookie: owner.cookie,
      headers: { Origin: stack.env.PUBLIC_URL },
    });
    expect(liftRes.status).toBe(204);
  });
});
