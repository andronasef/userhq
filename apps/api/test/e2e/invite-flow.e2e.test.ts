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

describe("Invite Flow E2E (Plan 02-06)", () => {
  let stack: StackContext;
  const createdInviteIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

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
        .delete(schema.workspaces)
        .where(inArray(schema.workspaces.id, createdWorkspaceIds));
    }
    await stack.close();
  });

  it("signed-out redirect, matching user redirect to /dashboard/new, workspace creation, and already used display", async () => {
    const owner = await ownerSession(stack);
    const email = `e2e-holder-${Date.now()}@acme.example`;
    const slug = `e2e-ws-${Date.now()}`;

    // 1. Owner creates platform invite via apiCall
    const postRes = await apiCall("/api/v1/platform/invites", {
      method: "POST",
      cookie: owner.cookie,
      body: { email },
    });
    expect(postRes.status).toBe(201);
    const inviteData = await postRes.json();
    const link = inviteData.link as string;
    const token = link.split("/invite/")[1];
    expect(token).toHaveLength(43);

    // Track invite id
    const rows = await stack.db.query.invites.findMany({
      where: (inv, { eq }) => eq(inv.email, email),
    });
    expect(rows).toHaveLength(1);
    createdInviteIds.push(rows[0].id);

    // 2. Signed-out visitor gets 307 to /login?next=/invite/{token}
    const signedOutRes = await apiCall(`/invite/${token}`, {
      redirect: "manual",
    });
    expect(signedOutRes.status).toBe(307);
    const location = signedOutRes.headers.get("location");
    expect(location).toBe(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

    // 3. Minted user with matching verified email gets redirect to /dashboard/new
    const holder = await mintSession(stack, {
      name: "Acme Lead",
      email,
      emailVerified: true,
    });

    const matchingRes = await apiCall(`/invite/${token}`, {
      cookie: holder.cookie,
      redirect: "manual",
    });
    expect(matchingRes.status).toBe(307);
    expect(matchingRes.headers.get("location")).toBe("/dashboard/new");

    // 4. Holder creates workspace
    const wsRes = await apiCall("/api/v1/workspaces", {
      method: "POST",
      cookie: holder.cookie,
      body: {
        name: "Acme Live",
        slug,
      },
    });
    expect(wsRes.status).toBe(201);
    const wsData = await wsRes.json();
    expect(wsData.slug).toBe(slug);

    const wsRows = await stack.db.query.workspaces.findMany({
      where: (w, { eq }) => eq(w.slug, slug),
    });
    expect(wsRows).toHaveLength(1);
    createdWorkspaceIds.push(wsRows[0].id);

    // 5. Subsequent visit to /invite/{token} renders "This invite has already been used"
    const usedRes = await apiCall(`/invite/${token}`, {
      cookie: holder.cookie,
    });
    expect(usedRes.status).toBe(200);
    const html = await usedRes.text();
    expect(html).toContain("This invite has already been used");
  });
});
