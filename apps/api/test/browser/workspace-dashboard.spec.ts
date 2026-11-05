import { test, expect } from "@playwright/test";
import { schema } from "@userhq/db";
import { eq, inArray } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  createProductViaApi,
  cleanupWorkspaces,
  type StackContext,
} from "../support/stack.js";

test.describe("Workspace Dashboard Specs (Plan 08-04)", () => {
  let stack: StackContext;
  let adminUser: { cookie: string; userId: string; email: string };
  let customerUser: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const alphaSlug = `alpha-${Date.now()}`;
  const betaSlug = `beta-${Date.now()}`;
  let alphaProdId: string;
  let betaProdId: string;
  let alphaPostNumber: number;
  let betaPostNumber: number;
  let customerCommentId: string;

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    adminUser = await mintSession(stack, {
      name: "Workspace Admin",
      emailVerified: true,
    });

    customerUser = await mintSession(stack, {
      name: "Customer Charlie",
      emailVerified: true,
    });

    wsSlug = `ws-dash-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: adminUser.userId,
      name: "Acme Multi-Product Workspace",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    // Create 2 products
    await createProductViaApi(adminUser.cookie, wsSlug, {
      name: "Alpha App",
      slug: alphaSlug,
    });

    await createProductViaApi(adminUser.cookie, wsSlug, {
      name: "Beta Suite",
      slug: betaSlug,
    });

    const prods = await stack.db
      .select({ id: schema.products.id, slug: schema.products.slug })
      .from(schema.products)
      .where(inArray(schema.products.slug, [alphaSlug, betaSlug]));

    alphaProdId = prods.find((p) => p.slug === alphaSlug)!.id;
    betaProdId = prods.find((p) => p.slug === betaSlug)!.id;

    const [alphaCat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, alphaProdId))
      .limit(1);

    const [betaCat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, betaProdId))
      .limit(1);

    // Create a request in Alpha
    const resA = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${alphaSlug}/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: customerUser.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          title: "Dark mode support for Alpha",
          description: "Please add high-contrast dark theme.",
          categoryId: alphaCat.id,
        }),
      }
    );
    expect(resA.status).toBe(201);
    const postAData = await resA.json();
    alphaPostNumber = postAData.number;

    // Create a request in Beta
    const resB = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${betaSlug}/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: customerUser.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          title: "Webhook exports for Beta",
          description: "Real-time webhook notifications.",
          categoryId: betaCat.id,
        }),
      }
    );
    expect(resB.status).toBe(201);
    const postBData = await resB.json();
    betaPostNumber = postBData.number;

    // Create a customer comment on Alpha post
    const resComment = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${alphaSlug}/posts/${alphaPostNumber}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: customerUser.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          body: "When is this expected to ship? We really need it.",
        }),
      }
    );
    expect(resComment.status).toBe(201);
    const commentData = await resComment.json();
    customerCommentId = commentData.id;
  });

  test.afterAll(async () => {
    if (workspaceId) {
      const prods = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, workspaceId));

      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);
        const postRows = await stack.db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(inArray(schema.posts.productId, prodIds));
        const postIds = postRows.map((p) => p.id);

        if (postIds.length > 0) {
          const commentRows = await stack.db
            .select({ id: schema.comments.id })
            .from(schema.comments)
            .where(inArray(schema.comments.postId, postIds));
          const commentIds = commentRows.map((c) => c.id);

          if (commentIds.length > 0) {
            await stack.db
              .delete(schema.commentReads)
              .where(inArray(schema.commentReads.commentId, commentIds));
            await stack.db
              .delete(schema.comments)
              .where(inArray(schema.comments.id, commentIds));
          }

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
    if (adminUser?.userId) {
      await stack.db.delete(schema.user).where(eq(schema.user.id, adminUser.userId));
    }
    if (customerUser?.userId) {
      await stack.db.delete(schema.user).where(eq(schema.user.id, customerUser.userId));
    }
    await stack.close();
  });

  test.beforeEach(async ({ page, baseURL }) => {
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";
    const cookiePairs = adminUser.cookie.split(";").map((c) => c.trim()).filter(Boolean);
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
  });

  test("workspace dashboard shows products, cross-product requests feed, and comments inbox", async ({
    page,
  }) => {
    // 1. Visit root workspace dashboard
    await page.goto(`/dashboard/${wsSlug}`);

    // Verify workspace title and default Products tab
    await expect(page.getByRole("heading", { name: "Acme Multi-Product Workspace" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Alpha App" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Beta Suite" })).toBeVisible();

    // Verify Tab bar exists
    const requestsTab = page.getByRole("link", { name: /Requests \(All Boards\)/i });
    const commentsTab = page.getByRole("link", { name: /Comments/i });
    await expect(requestsTab).toBeVisible();
    await expect(commentsTab).toBeVisible();

    // Verify attention count badge on comments tab (should be >= 1)
    await expect(commentsTab).toContainText("1");

    // 2. Switch to Requests (All Boards) Tab
    await requestsTab.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/${wsSlug}\\?tab=requests`));

    // Verify cross-product requests from both Alpha and Beta are displayed
    await expect(page.getByText("Dark mode support for Alpha")).toBeVisible();
    await expect(page.getByText("Webhook exports for Beta")).toBeVisible();
    const requestList = page.locator(".divide-y");
    await expect(requestList.getByText("Alpha App")).toBeVisible();
    await expect(requestList.getByText("Beta Suite")).toBeVisible();

    // Test product filter: filter by Alpha App
    const productSelect = page.getByLabel("Filter by product");
    await productSelect.selectOption(alphaSlug);
    await expect(page.getByText("Dark mode support for Alpha")).toBeVisible();
    await expect(page.getByText("Webhook exports for Beta")).not.toBeVisible();

    // Reset filter
    const resetButton = page.getByRole("button", { name: "Reset" });
    await resetButton.click();
    await expect(page.getByText("Webhook exports for Beta")).toBeVisible();

    // Test search filter
    const searchInput = page.getByPlaceholder("Search all feedback requests...");
    await searchInput.fill("Webhook");
    await searchInput.press("Enter");
    await expect(page.getByText("Webhook exports for Beta")).toBeVisible();
    await expect(page.getByText("Dark mode support for Alpha")).not.toBeVisible();

    // 3. Switch to Comments Tab
    await commentsTab.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/${wsSlug}\\?tab=comments`));

    // Verify customer comment is shown in Needs Attention view
    await expect(page.getByText("When is this expected to ship? We really need it.")).toBeVisible();
    await expect(page.getByText("Customer Charlie")).toBeVisible();
    await expect(page.getByText("Needs attention").first()).toBeVisible();

    // 4. Mark handled action
    const markHandledButton = page.getByRole("button", { name: /Mark handled/i }).first();
    await markHandledButton.click();

    // Verify toast and handled state
    await expect(page.getByText("Comment marked handled")).toBeVisible();
    await expect(page.getByRole("button", { name: /Reopen/i })).toBeVisible();

    // 5. Reopen comment
    const reopenButton = page.getByRole("button", { name: /Reopen/i });
    await reopenButton.click();
    await expect(page.getByText("Comment reopened for attention")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark handled/i }).first()).toBeVisible();

    // 6. Inline quick reply as admin
    const replyButton = page.getByRole("button", { name: /Reply/i }).first();
    await replyButton.click();

    const replyTextarea = page.getByPlaceholder(/Write an admin reply/i);
    await expect(replyTextarea).toBeVisible();
    await replyTextarea.fill("We are planning to ship this next sprint!");

    const sendReplyButton = page.getByRole("button", { name: /Send Reply/i });
    await sendReplyButton.click();

    await expect(page.getByText("Reply posted and marked handled")).toBeVisible();
  });
});
