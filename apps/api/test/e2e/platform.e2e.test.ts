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

  beforeAll(async () => {
    stack = await openStack();
  });

  afterAll(async () => {
    if (createdInviteIds.length > 0) {
      await stack.db
        .delete(schema.invites)
        .where(inArray(schema.invites.id, createdInviteIds));
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
});
