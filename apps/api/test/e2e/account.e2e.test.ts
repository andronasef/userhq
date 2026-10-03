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

describe("Account deletion E2E (Plan 03-15)", () => {
  let stack: StackContext;
  let wsId: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    stack = await openStack();
  });

  afterAll(async () => {
    if (!stack) return;
    if (wsId) {
      const prods = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, wsId));
      const prodIds = prods.map((p) => p.id);
      if (prodIds.length > 0) {
        const postRows = await stack.db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(inArray(schema.posts.productId, prodIds));
        const postIds = postRows.map((p) => p.id);
        if (postIds.length > 0) {
          await stack.db.delete(schema.comments).where(inArray(schema.comments.postId, postIds));
          await stack.db.delete(schema.postActivity).where(inArray(schema.postActivity.postId, postIds));
          await stack.db.delete(schema.votes).where(inArray(schema.votes.postId, postIds));
          await stack.db.delete(schema.posts).where(inArray(schema.posts.id, postIds));
        }
        await stack.db.delete(schema.statuses).where(inArray(schema.statuses.productId, prodIds));
        await stack.db.delete(schema.products).where(inArray(schema.products.id, prodIds));
      }
      await stack.db.delete(schema.workspaceMembers).where(eq(schema.workspaceMembers.workspaceId, wsId));
      await stack.db.delete(schema.workspaces).where(eq(schema.workspaces.id, wsId));
    }
    if (userIds.length > 0) {
      await stack.db.delete(schema.session).where(inArray(schema.session.userId, userIds));
      await stack.db.delete(schema.account).where(inArray(schema.account.userId, userIds));
      await stack.db.delete(schema.user).where(inArray(schema.user.id, userIds));
    }
    await stack.close();
  });

  it("after deleting the author via the API, the post page shows Deleted user and neither name nor email", async () => {
    const rand = randomBytes(4).toString("hex");
    const owner = await mintSession(stack, {
      name: `Board Owner ${rand}`,
      email: `del-owner-${rand}@example.com`,
      emailVerified: true,
    });
    userIds.push(owner.userId);
    const wsSlug = `del-ws-${rand}`;
    const prodSlug = `del-prod-${rand}`;
    wsId = (await seedWorkspaceRows(stack, { userId: owner.userId, name: `WS ${rand}`, slug: wsSlug })).id;
    await createProductViaApi(owner.cookie, wsSlug, { name: `Prod ${rand}`, slug: prodSlug });
    // A seeded category would make categoryId required on new posts
    const [prodRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, prodSlug));
    await stack.db.delete(schema.categories).where(eq(schema.categories.productId, prodRow.id));

    const authorName = `Leaving Lena ${rand}`;
    const authorEmail = `lena-${rand}@example.com`;
    const author = await mintSession(stack, { name: authorName, email: authorEmail, emailVerified: true });
    userIds.push(author.userId);

    const postRes = await apiCall(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`, {
      method: "POST",
      cookie: author.cookie,
      body: { title: `Lena's idea ${rand}`, description: "Please add this" },
    });
    expect(postRes.status).toBe(201);
    const post = await postRes.json();
    const url = `${baseUrl}/${wsSlug}/${prodSlug}/p/${post.number}-${post.slug}`;

    const before = await (await fetch(url)).text();
    expect(before).toContain(authorName);

    const delRes = await apiCall("/api/v1/account/delete", {
      method: "POST",
      cookie: author.cookie,
      body: { workspaces: [] },
    });
    expect(delRes.status).toBe(204);

    const afterRes = await fetch(url);
    expect(afterRes.status).toBe(200);
    const html = await afterRes.text();
    expect(html).toContain("Deleted user");
    expect(html).not.toContain(authorName);
    expect(html).not.toContain(authorEmail);

    // The scrubbed session is dead
    const me = await apiCall("/api/v1/account", { cookie: author.cookie });
    expect(me.status).toBe(401);
  });
});
