import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import {
  openStack,
  ownerSession,
  mintSession,
  apiCall,
  baseUrl,
  type StackContext,
} from "../support/stack.js";

describe("Workspace Create E2E (Plan 02-03)", () => {
  let stack: StackContext;
  let owner: Awaited<ReturnType<typeof ownerSession>>;
  let nonMember: Awaited<ReturnType<typeof mintSession>>;
  let wsSlug: string;
  let wsName: string;

  beforeAll(async () => {
    stack = await openStack();
    owner = await ownerSession(stack);
    nonMember = await mintSession(stack, {
      name: "Non Member User",
      emailVerified: true,
    });

    const rand = randomBytes(4).toString("hex");
    wsSlug = `ws-${rand}`;
    wsName = `Acme Corp ${rand}`;
  });

  afterAll(async () => {
    if (stack) {
      if (wsSlug) {
        await stack.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.slug, wsSlug));
      }
      if (nonMember?.userId) {
        await stack.db
          .delete(schema.user)
          .where(eq(schema.user.id, nonMember.userId));
      }
      if (owner?.created && owner.userId) {
        await stack.db
          .delete(schema.user)
          .where(eq(schema.user.id, owner.userId));
      }
      await stack.close();
    }
  });

  it("platform owner creates a workspace and lands on its dashboard with empty state", async () => {
    const createRes = await apiCall("/api/v1/workspaces", {
      method: "POST",
      cookie: owner.cookie,
      body: { name: wsName, slug: wsSlug },
    });

    expect(createRes.status).toBe(201);
    const createdJson = await createRes.json();
    expect(createdJson).toEqual({ slug: wsSlug });

    const dashRes = await fetch(`${baseUrl}/dashboard/${wsSlug}`, {
      headers: { Cookie: owner.cookie },
    });
    expect(dashRes.status).toBe(200);
    const html = await dashRes.text();
    expect(html).toContain(wsName);
    expect(html).toContain("No products yet");
    expect(html).toContain("Create a product to give your customers a public portal for feedback.");
  });

  it("minted non-member gets 404 for another tenant's dashboard", async () => {
    const dashRes = await fetch(`${baseUrl}/dashboard/${wsSlug}`, {
      headers: { Cookie: nonMember.cookie },
    });
    expect(dashRes.status).toBe(404);
    const html = await dashRes.text();
    expect(html).toContain("Page not found");
  });

  it("minted non-owner sees invite-only message at /dashboard/new", async () => {
    const newRes = await fetch(`${baseUrl}/dashboard/new`, {
      headers: { Cookie: nonMember.cookie },
    });
    expect(newRes.status).toBe(200);
    const html = await newRes.text();
    expect(html).toContain("Workspace creation is invite-only");
    expect(html).not.toContain("Create your workspace");
  });

  it("platform owner sees create form at /dashboard/new", async () => {
    const newRes = await fetch(`${baseUrl}/dashboard/new`, {
      headers: { Cookie: owner.cookie },
    });
    expect(newRes.status).toBe(200);
    const html = await newRes.text();
    expect(html).toContain("Create your workspace");
    expect(html).not.toContain("Workspace creation is invite-only");
  });
});
