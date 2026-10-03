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

describe("Comments E2E (Plan 03-08)", () => {
  let stack: StackContext;
  let wsSlug: string;
  let wsId: string;
  let pSlug: string;
  let postAuthorCookie: string;
  let postAuthorId: string;
  const userIds: string[] = [];
  let postNumber: number;
  let postSlug: string;

  beforeAll(async () => {
    stack = await openStack();
    const rand = randomBytes(4).toString("hex");

    const postAuthor = await mintSession(stack, {
      name: `PostAuthor ${rand}`,
      email: `postauthor-${rand}@example.com`,
      emailVerified: true,
    });
    postAuthorCookie = postAuthor.cookie;
    postAuthorId = postAuthor.userId;
    userIds.push(postAuthorId);

    wsSlug = `ws-${rand}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: postAuthorId,
      name: `Workspace ${rand}`,
      slug: wsSlug,
      role: "owner",
    });
    wsId = ws.id;

    pSlug = `prod-${rand}`;
    await createProductViaApi(postAuthorCookie, wsSlug, {
      name: `Product ${rand}`,
      slug: pSlug,
    });

    const [prodRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, pSlug));
    await stack.db
      .delete(schema.categories)
      .where(eq(schema.categories.productId, prodRow.id));

    const createPostRes = await apiCall(
      `/api/v1/portal/${wsSlug}/${pSlug}/posts`,
      {
        method: "POST",
        cookie: postAuthorCookie,
        body: {
          title: `Post for Comments ${rand}`,
          description: "Let's talk in comments",
        },
      }
    );
    expect(createPostRes.status).toBe(201);
    const createdPost = await createPostRes.json();
    postNumber = createdPost.number;
    postSlug = createdPost.slug;
  });

  afterAll(async () => {
    if (stack) {
      if (wsId) {
        const prodRows = await stack.db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(eq(schema.products.workspaceId, wsId));
        const prodIds = prodRows.map((p) => p.id);
        if (prodIds.length > 0) {
          const postRows = await stack.db
            .select({ id: schema.posts.id })
            .from(schema.posts)
            .where(inArray(schema.posts.productId, prodIds));
          const postIds = postRows.map((p) => p.id);
          if (postIds.length > 0) {
            await stack.db
              .delete(schema.comments)
              .where(inArray(schema.comments.postId, postIds));
            await stack.db
              .delete(schema.votes)
              .where(inArray(schema.votes.postId, postIds));
            await stack.db
              .delete(schema.posts)
              .where(inArray(schema.posts.id, postIds));
          }

          await stack.db
            .delete(schema.statuses)
            .where(inArray(schema.statuses.productId, prodIds));

          await stack.db
            .delete(schema.products)
            .where(inArray(schema.products.id, prodIds));
        }

        await stack.db
          .delete(schema.workspaceMembers)
          .where(eq(schema.workspaceMembers.workspaceId, wsId));
        await stack.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.id, wsId));
      }

      if (userIds.length > 0) {
        await stack.db
          .delete(schema.session)
          .where(inArray(schema.session.userId, userIds));
        await stack.db
          .delete(schema.account)
          .where(inArray(schema.account.userId, userIds));
        await stack.db
          .delete(schema.user)
          .where(inArray(schema.user.id, userIds));
      }

      await stack.close();
    }
  });

  it("signed-out post page HTML contains sign-in prompt and link to #comment", async () => {
    const postRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${postNumber}-${postSlug}`
    );
    expect(postRes.status).toBe(200);
    const html = await postRes.text();

    expect(html).toContain("Sign in to join the conversation.");

    const expectedNext = `/${wsSlug}/${pSlug}/p/${postNumber}-${postSlug}#comment`;
    const decodedHtml = decodeURIComponent(html);
    expect(decodedHtml).toContain(`/login?next=${expectedNext}`);
  });

  it("deleted parent with visible reply renders stub without deleted author or body", async () => {
    const rand = randomBytes(4).toString("hex");
    const parentAuthor = await mintSession(stack, {
      name: `ParentAuthor ${rand}`,
      email: `parent-${rand}@example.com`,
      emailVerified: true,
    });
    userIds.push(parentAuthor.userId);

    const replyAuthor = await mintSession(stack, {
      name: `ReplyAuthor ${rand}`,
      email: `reply-${rand}@example.com`,
      emailVerified: true,
    });
    userIds.push(replyAuthor.userId);

    const secretBody = `Parent secret comment text ${rand}`;
    const parentRes = await apiCall(
      `/api/v1/portal/${wsSlug}/${pSlug}/posts/${postNumber}/comments`,
      {
        method: "POST",
        cookie: parentAuthor.cookie,
        body: { body: secretBody },
      }
    );
    expect(parentRes.status).toBe(201);
    const parentComment = await parentRes.json();

    const replyBody = `Visible child reply text ${rand}`;
    const replyRes = await apiCall(
      `/api/v1/portal/${wsSlug}/${pSlug}/posts/${postNumber}/comments`,
      {
        method: "POST",
        cookie: replyAuthor.cookie,
        body: { body: replyBody, parentId: parentComment.id },
      }
    );
    expect(replyRes.status).toBe(201);

    // Mark the parent comment deleted directly in the database
    await stack.db
      .update(schema.comments)
      .set({ deletedAt: new Date() })
      .where(eq(schema.comments.id, parentComment.id));

    // Fetch the post page HTML as a signed-out viewer
    const postRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${postNumber}-${postSlug}`
    );
    expect(postRes.status).toBe(200);
    const html = await postRes.text();

    expect(html).toContain(replyBody);
    expect(html).toContain(`ReplyAuthor ${rand}`);
    expect(html).toContain("[Comment deleted]");
    expect(html).not.toContain(secretBody);
    expect(html).not.toContain(`ParentAuthor ${rand}`);
  });
});
