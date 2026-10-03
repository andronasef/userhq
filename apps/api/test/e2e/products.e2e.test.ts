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

describe("Products E2E (Plan 02-08)", () => {
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

  it("admin creates a product; overview lists it with 'View portal'; portal page is live for visitors", async () => {
    const ownerName = `Product Owner ${Date.now()}`;
    const owner = await mintSession(stack, {
      name: ownerName,
      emailVerified: true,
    });

    const wsSlug = `ws-prod-e2e-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: owner.userId,
      name: "Products E2E Workspace",
      slug: wsSlug,
    });
    createdWorkspaceIds.push(ws.id);

    const prodSlug = `app-${Date.now()}`;
    const prodName = `Acme App ${Date.now()}`;

    const created = await createProductViaApi(owner.cookie, wsSlug, {
      name: prodName,
      slug: prodSlug,
    });
    expect(created.slug).toBe(prodSlug);

    // GET /dashboard/{ws} HTML contains the product name and "View portal"
    const dashRes = await apiCall(`/dashboard/${wsSlug}`, {
      cookie: owner.cookie,
    });
    expect(dashRes.status).toBe(200);
    const dashHtml = await dashRes.text();
    expect(dashHtml).toContain(prodName);
    expect(dashHtml).toContain("View portal");

    // GET /{ws}/{p} (no cookie) -> 200 with the product name
    const portalRes = await apiCall(`/${wsSlug}/${prodSlug}`);
    expect(portalRes.status).toBe(200);
    const portalHtml = await portalRes.text();
    expect(portalHtml).toContain(prodName);
  });
});
