import { test, expect } from "@playwright/test";
import { schema } from "@userhq/db";
import { eq, inArray, and } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  createProductViaApi,
  cleanupWorkspaces,
  type StackContext,
} from "../support/stack.js";

test.describe("Portal 320px Responsive Layout Backstop (Plan 03-14)", () => {
  let stack: StackContext;
  let userA: { cookie: string; userId: string; email: string };
  let userB: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const prodSlug = "mobile-prod";
  let prodId: string;
  let _postId: string;
  const longTitle =
    "Optimize performance when rendering very large datasets across multiple mobile screens and devices without scroll issue";

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    userA = await mintSession(stack, {
      name: "Admin Alice",
      emailVerified: true,
    });
    userB = await mintSession(stack, {
      name: "Customer Bob",
      emailVerified: true,
    });

    // Ensure userA has commentEmails = true
    await stack.db
      .update(schema.user)
      .set({ commentEmails: true })
      .where(eq(schema.user.id, userA.userId));

    wsSlug = `p320-ws-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: userA.userId,
      name: "Responsive 320 Workspace",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    await createProductViaApi(userA.cookie, wsSlug, {
      name: "Mobile Product",
      slug: prodSlug,
    });

    const [prodRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.workspaceId, workspaceId),
          eq(schema.products.slug, prodSlug)
        )
      );
    prodId = prodRow.id;

    const [cat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, prodId))
      .limit(1);

    // User B submits post with 120-character title
    const postRes = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${prodSlug}/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userB.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          title: longTitle,
          description: "Testing responsive layout at 320px width.",
          categoryId: cat.id,
        }),
      }
    );
    if (!postRes.ok) {
      const errText = await postRes.text();
      throw new Error(`Failed to create post (${postRes.status}): ${errText}`);
    }
    const postData = (await postRes.json()) as { id: string };
    _postId = postData.id;

    // User A comments on post so A is in the conversation
    const commentRes = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${prodSlug}/posts/1/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          body: "Admin Alice joins the conversation to test the mute bell and admin actions.",
        }),
      }
    );
    if (!commentRes.ok) {
      const errText = await commentRes.text();
      throw new Error(`Failed to create comment (${commentRes.status}): ${errText}`);
    }
  });

  test.afterAll(async () => {
    if (workspaceId) {
      const wsProducts = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, workspaceId));
      const prodIds = wsProducts.map((p) => p.id);
      if (prodIds.length > 0) {
        const productPosts = await stack.db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(inArray(schema.posts.productId, prodIds));
        const postIds = productPosts.map((p) => p.id);
        if (postIds.length > 0) {
          await stack.db
            .delete(schema.comments)
            .where(inArray(schema.comments.postId, postIds));
          await stack.db
            .delete(schema.postMutes)
            .where(inArray(schema.postMutes.postId, postIds));
          await stack.db
            .delete(schema.votes)
            .where(inArray(schema.votes.postId, postIds));
          await stack.db
            .delete(schema.posts)
            .where(inArray(schema.posts.id, postIds));
        }
        await stack.db
          .delete(schema.categories)
          .where(inArray(schema.categories.productId, prodIds));
        await stack.db
          .delete(schema.statuses)
          .where(inArray(schema.statuses.productId, prodIds));
        await stack.db
          .delete(schema.products)
          .where(inArray(schema.products.id, prodIds));
      }
      await cleanupWorkspaces(stack, [workspaceId]);
    }
    if (userA?.userId) {
      await stack.db
        .delete(schema.user)
        .where(eq(schema.user.id, userA.userId));
    }
    if (userB?.userId) {
      await stack.db
        .delete(schema.user)
        .where(eq(schema.user.id, userB.userId));
    }
    await stack.close();
  });

  test("the board row and post header stay usable at 320px without horizontal scroll", async ({
    page,
    baseURL,
  }) => {
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";
    const cookiePairs = userA.cookie
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);
    const cookiesToAdd = [];
    for (const pair of cookiePairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      if (["path", "httponly", "samesite"].includes(name.toLowerCase())) continue;
      cookiesToAdd.push({
        name,
        value,
        url: effectiveBaseUrl,
      });
    }
    await page.context().addCookies(cookiesToAdd);

    await page.setViewportSize({ width: 320, height: 640 });

    // 1. Board page at 320px
    await page.goto(`/${wsSlug}/${prodSlug}`);
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/portal-320-board.png" });

    const boardNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(boardNoOverflow).toBe(true);

    // Assert the 120-character title is visible on the board
    const postLink = page.locator(`a:has-text("${longTitle}")`);
    await expect(postLink).toBeVisible();

    // 2. Post page at 320px
    await page.goto(`/${wsSlug}/${prodSlug}/p/1`);
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "test-results/portal-320-post.png" });

    const postNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(postNoOverflow).toBe(true);

    // 3. Verify Admin menu trigger and Mute button are visible
    const adminTrigger = page.locator('button:has-text("Admin")');
    await expect(adminTrigger).toBeVisible();

    const muteBtn = page.locator('button[aria-label="Mute email for this post"]');
    await expect(muteBtn).toBeVisible();
    await expect(muteBtn).toHaveText(/Mute/);

    // 4. Click Mute button and verify no overflow
    await muteBtn.click();
    await expect(muteBtn).toHaveText(/Unmute/);

    const postMutedNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(postMutedNoOverflow).toBe(true);

    // 5. Click Admin menu trigger and verify no overflow
    await adminTrigger.click();
    const menuContent = page.locator('[role="menu"]');
    await expect(menuContent).toBeVisible();

    const menuOpenNoOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );
    expect(menuOpenNoOverflow).toBe(true);
  });
});
