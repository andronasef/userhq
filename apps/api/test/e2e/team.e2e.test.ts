import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { schema } from "@userhq/db";
import { inArray } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  apiCall,
  type StackContext,
} from "../support/stack.js";

describe("Team E2E (Plan 02-07)", () => {
  let stack: StackContext;
  const createdWorkspaceIds: string[] = [];
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
    if (createdWorkspaceIds.length > 0) {
      await stack.db
        .delete(schema.workspaces)
        .where(inArray(schema.workspaces.id, createdWorkspaceIds));
    }
    await stack.close();
  });

  it("owner invites a teammate; teammate opens link and joins; team page lists both members", async () => {
    const ownerName = `Team Lead ${Date.now()}`;
    const owner = await mintSession(stack, {
      name: ownerName,
      emailVerified: true,
    });

    const slug = `team-e2e-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: owner.userId,
      name: "Acme Team E2E",
      slug,
    });
    createdWorkspaceIds.push(ws.id);

    // 1. Owner creates team invite
    const mateEmail = `mate-e2e-${Date.now()}@acme.example`;
    const mateName = `Mate E2E ${Date.now()}`;

    const createRes = await apiCall(`/api/v1/workspaces/${slug}/invites`, {
      method: "POST",
      cookie: owner.cookie,
      body: { email: mateEmail },
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const link = createData.link as string;
    const token = link.split("/invite/")[1];

    const inviteRows = await stack.db.query.invites.findMany({
      where: (inv, { eq }) => eq(inv.email, mateEmail),
    });
    if (inviteRows.length > 0) {
      createdInviteIds.push(inviteRows[0].id);
    }

    // 2. Mint teammate session
    const mate = await mintSession(stack, {
      name: mateName,
      email: mateEmail,
      emailVerified: true,
    });

    // 3. Teammate GET /invite/{token} renders "Joining"
    const invitePageRes = await apiCall(`/invite/${token}`, {
      cookie: mate.cookie,
    });
    expect(invitePageRes.status).toBe(200);
    const inviteHtml = await invitePageRes.text();
    expect(inviteHtml).toContain("Joining");

    // 4. Teammate accepts invite
    const acceptRes = await apiCall(`/api/v1/invites/${token}/accept`, {
      method: "POST",
      cookie: mate.cookie,
    });
    expect(acceptRes.status).toBe(200);
    const acceptData = await acceptRes.json();
    expect(acceptData.workspaceSlug).toBe(slug);

    // 5. Owner GET /dashboard/{ws}/team contains both names
    const teamPageRes = await apiCall(`/dashboard/${slug}/team`, {
      cookie: owner.cookie,
    });
    expect(teamPageRes.status).toBe(200);
    const teamHtml = await teamPageRes.text();
    expect(teamHtml).toContain(ownerName);
    expect(teamHtml).toContain(mateName);
  });
});
