import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { eq, inArray } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  createProductViaApi,
  apiCall,
  baseUrl,
  type StackContext,
} from "../support/stack.js";

describe("Board E2E (Plan 03-04)", () => {
  let stack: StackContext;
  let wsSlug: string;
  let wsId: string;
  let pSlug: string;
  let prodId: string;
  let userCookie: string;
  let userId: string;
  let userName: string;

  beforeAll(async () => {
    stack = await openStack();
    const rand = randomBytes(4).toString("hex");
    userName = `Author ${rand}`;
    const user = await mintSession(stack, {
      name: userName,
      email: `author-${rand}@example.com`,
      emailVerified: true,
    });
    userCookie = user.cookie;
    userId = user.userId;

    wsSlug = `ws-${rand}`;
    const ws = await seedWorkspaceRows(stack, {
      userId,
      name: `Workspace ${rand}`,
      slug: wsSlug,
      role: "owner",
    });
    wsId = ws.id;

    pSlug = `prod-${rand}`;
    await createProductViaApi(userCookie, wsSlug, {
      name: `Product ${rand}`,
      slug: pSlug,
    });

    const [prod] = await stack.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.slug, pSlug))
      .limit(1);
    prodId = prod.id;
  });

  afterAll(async () => {
    if (stack) {
      if (prodId) {
        const postRows = await stack.db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(eq(schema.posts.productId, prodId));
        const postIds = postRows.map((p) => p.id);
        if (postIds.length > 0) {
          await stack.db
            .delete(schema.votes)
            .where(inArray(schema.votes.postId, postIds));
          await stack.db
            .delete(schema.posts)
            .where(inArray(schema.posts.id, postIds));
        }

        await stack.db
          .delete(schema.statuses)
          .where(eq(schema.statuses.productId, prodId));

        await stack.db
          .delete(schema.products)
          .where(eq(schema.products.id, prodId));
      }

      if (wsId) {
        await stack.db
          .delete(schema.workspaceMembers)
          .where(eq(schema.workspaceMembers.workspaceId, wsId));
        await stack.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.id, wsId));
      }

      if (userId) {
        await stack.db
          .delete(schema.session)
          .where(eq(schema.session.userId, userId));
        await stack.db
          .delete(schema.account)
          .where(eq(schema.account.userId, userId));
        await stack.db
          .delete(schema.user)
          .where(eq(schema.user.id, userId));
      }

      await stack.close();
    }
  });

  it("tracer: a post created through the API renders on its permalink and on the board", async () => {
    const postTitle = `Dark mode support ${randomBytes(3).toString("hex")}`;
    const postDesc = "Please add dark mode so it does not hurt our eyes at night.";

    const createRes = await apiCall(
      `/api/v1/portal/${wsSlug}/${pSlug}/posts`,
      {
        method: "POST",
        cookie: userCookie,
        body: {
          title: postTitle,
          description: postDesc,
        },
      }
    );

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.number).toBe(1);
    expect(created.slug).toBeDefined();

    // Fetch permalink HTML
    const permalinkRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`
    );
    expect(permalinkRes.status).toBe(200);
    const permalinkHtml = await permalinkRes.text();
    expect(permalinkHtml).toContain(postTitle);
    expect(permalinkHtml).toContain(userName);
    expect(permalinkHtml).toContain("Under Review");
    expect(permalinkHtml).toContain(postDesc);

    // Fetch board HTML
    const boardRes = await fetch(`${baseUrl}/${wsSlug}/${pSlug}`);
    expect(boardRes.status).toBe(200);
    const boardHtml = await boardRes.text();
    expect(boardHtml).toContain(postTitle);
    expect(boardHtml).toContain("1 vote");
  });
});
