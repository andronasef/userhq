import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { schema } from "@userhq/db";
import { inArray } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  createProductViaApi,
  apiCall,
  type StackContext,
} from "../support/stack.js";

describe("Statuses E2E (Plan 02-09)", () => {
  let stack: StackContext;
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    stack = await openStack();
  });

  afterAll(async () => {
    if (createdWorkspaceIds.length > 0) {
      const prods = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(inArray(schema.products.workspaceId, createdWorkspaceIds));

      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);
        await stack.db
          .delete(schema.statuses)
          .where(inArray(schema.statuses.productId, prodIds));
        await stack.db
          .delete(schema.products)
          .where(inArray(schema.products.id, prodIds));
      }

      await stack.db
        .delete(schema.workspaceMembers)
        .where(inArray(schema.workspaceMembers.workspaceId, createdWorkspaceIds));
      await stack.db
        .delete(schema.workspaces)
        .where(inArray(schema.workspaces.id, createdWorkspaceIds));
    }
    await stack.close();
  });

  it("admin visits product statuses page; sees seeded statuses and Default badge", async () => {
    const ownerName = `Status Owner ${Date.now()}`;
    const owner = await mintSession(stack, {
      name: ownerName,
      emailVerified: true,
    });

    const wsSlug = `ws-stat-e2e-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: owner.userId,
      name: "Statuses E2E Workspace",
      slug: wsSlug,
    });
    createdWorkspaceIds.push(ws.id);

    const prodSlug = `app-${Date.now()}`;
    const prodName = `Status App ${Date.now()}`;

    const created = await createProductViaApi(owner.cookie, wsSlug, {
      name: prodName,
      slug: prodSlug,
    });
    expect(created.slug).toBe(prodSlug);

    // GET /dashboard/{ws}/{p}/statuses HTML contains "Under Review", "Declined", and "Default"
    const res = await apiCall(`/dashboard/${wsSlug}/${prodSlug}/statuses`, {
      cookie: owner.cookie,
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Under Review");
    expect(html).toContain("Declined");
    expect(html).toContain("Default");
  });
});
