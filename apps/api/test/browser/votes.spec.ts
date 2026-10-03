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

test.describe("Votes Browser Backstops (Plan 03-06)", () => {
  let stack: StackContext;
  let userA: { cookie: string; userId: string; email: string };
  let voterB: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const oceanSlug = "ocean";
  const sunnySlug = "sunny";
  let oceanPostId: string;
  let _sunnyPostId: string;

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    userA = await mintSession(stack, {
      name: "Author Alice",
      emailVerified: true,
    });
    voterB = await mintSession(stack, {
      name: "Voter Bob",
      emailVerified: true,
    });

    wsSlug = `votes-ws-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: userA.userId,
      name: "Votes Workspace",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    // 1. Create Ocean product (#2563EB)
    await createProductViaApi(userA.cookie, wsSlug, {
      name: "Ocean App",
      slug: oceanSlug,
    });

    await fetch(
      `${effectiveBaseUrl}/api/v1/workspaces/${wsSlug}/products/${oceanSlug}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({ accentColor: "#2563EB" }),
      }
    );

    // 2. Create Sunny product (#FACC15)
    await createProductViaApi(userA.cookie, wsSlug, {
      name: "Sunny App",
      slug: sunnySlug,
    });

    await fetch(
      `${effectiveBaseUrl}/api/v1/workspaces/${wsSlug}/products/${sunnySlug}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({ accentColor: "#FACC15" }),
      }
    );

    // Get products from DB to get their IDs
    const [oceanProdRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.workspaceId, workspaceId),
          eq(schema.products.slug, oceanSlug)
        )
      );
    const oceanProdId = oceanProdRow.id;

    const [sunnyProdRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(
        and(
          eq(schema.products.workspaceId, workspaceId),
          eq(schema.products.slug, sunnySlug)
        )
      );
    const sunnyProdId = sunnyProdRow.id;

    // Get categories for Ocean and Sunny
    const [oceanCat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, oceanProdId))
      .limit(1);

    const [sunnyCat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, sunnyProdId))
      .limit(1);

    // Create post for Ocean
    const createOceanPostRes = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${oceanSlug}/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          title: "Ocean Post Idea",
          description: "Details for ocean idea",
          categoryId: oceanCat.id,
        }),
      }
    );
    expect(createOceanPostRes.status).toBe(201);

    const [oceanPostRow] = await stack.db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, oceanProdId),
          eq(schema.posts.number, 1)
        )
      );
    oceanPostId = oceanPostRow.id;

    // Create post for Sunny
    const createSunnyPostRes = await fetch(
      `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${sunnySlug}/posts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          title: "Sunny Post Idea",
          description: "Details for sunny idea",
          categoryId: sunnyCat.id,
        }),
      }
    );
    expect(createSunnyPostRes.status).toBe(201);

    const [sunnyPostRow] = await stack.db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.productId, sunnyProdId),
          eq(schema.posts.number, 1)
        )
      );
    _sunnyPostId = sunnyPostRow.id;
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
      await stack.db.delete(schema.user).where(eq(schema.user.id, userA.userId));
    }
    if (voterB?.userId) {
      await stack.db.delete(schema.user).where(eq(schema.user.id, voterB.userId));
    }

    await stack.close();
  });

  test("rapid double and triple clicks leave exact count and survive reload", async ({
    page,
    context,
    baseURL,
  }) => {
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";
    const cookiePairs = voterB.cookie
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
    await context.addCookies(cookiesToAdd);

    await page.goto(`/${wsSlug}/${oceanSlug}`);
    await page.waitForLoadState("networkidle");

    const voteBtn = page.locator('button[aria-label*="Upvote"]');
    await expect(voteBtn).toBeVisible();
    expect(await voteBtn.getAttribute("aria-pressed")).toBe("false");

    // Rapid triple click
    await voteBtn.click();
    await voteBtn.click();
    await voteBtn.click();

    // Wait for network idle to allow in-flight and queued mutations to settle
    await page.waitForLoadState("networkidle");

    const countText = await voteBtn.locator("span").textContent();
    const pressed = await voteBtn.getAttribute("aria-pressed");

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    const reloadVoteBtn = page.locator('button[aria-label*="Upvote"]');
    expect(await reloadVoteBtn.locator("span").textContent()).toBe(countText);
    expect(await reloadVoteBtn.getAttribute("aria-pressed")).toBe(pressed);

    // Verify DB holds 0 or 1 vote row for voterB (never 2)
    const bVotes = await stack.db
      .select()
      .from(schema.votes)
      .where(
        and(
          eq(schema.votes.postId, oceanPostId),
          eq(schema.votes.userId, voterB.userId)
        )
      );
    expect(bVotes.length).toBeLessThanOrEqual(1);

    // Click once more, reload, and verify flipped state
    await reloadVoteBtn.click();
    await page.waitForLoadState("networkidle");
    const flippedPressed = await reloadVoteBtn.getAttribute("aria-pressed");
    expect(flippedPressed).not.toBe(pressed);

    await page.reload();
    await page.waitForLoadState("networkidle");
    const reloadedFlippedBtn = page.locator('button[aria-label*="Upvote"]');
    expect(await reloadedFlippedBtn.getAttribute("aria-pressed")).toBe(
      flippedPressed
    );
  });

  test("accent contrast backstop for #2563EB and #FACC15 on vote box", async ({
    page,
    context,
    baseURL,
  }) => {
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";
    const cookiePairs = voterB.cookie
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
    await context.addCookies(cookiesToAdd);

    // 1. Test #2563EB (Ocean)
    await page.goto(`/${wsSlug}/${oceanSlug}`);
    await page.waitForLoadState("networkidle");

    const oceanVoteBtn = page.locator('button[aria-label*="Upvote"]');
    await expect(oceanVoteBtn).toBeVisible();

    // Ensure it's unvoted first to check unvoted count color
    if ((await oceanVoteBtn.getAttribute("aria-pressed")) === "true") {
      await oceanVoteBtn.click();
      await expect(oceanVoteBtn).toHaveAttribute("aria-pressed", "false");
    }

    // Unvoted count color is blue rgb(37, 99, 235)
    await expect
      .poll(async () =>
        oceanVoteBtn.evaluate((el) => getComputedStyle(el).color)
      )
      .toBe("rgb(37, 99, 235)");

    // Vote it
    await oceanVoteBtn.click();
    await expect(oceanVoteBtn).toHaveAttribute("aria-pressed", "true");

    // Voted box text color is white rgb(255, 255, 255) (waiting for transition to finish)
    await expect
      .poll(async () =>
        oceanVoteBtn.evaluate((el) => getComputedStyle(el).color)
      )
      .toBe("rgb(255, 255, 255)");

    // 2. Test #FACC15 (Sunny)
    await page.goto(`/${wsSlug}/${sunnySlug}`);
    await page.waitForLoadState("networkidle");

    const sunnyVoteBtn = page.locator('button[aria-label*="Upvote"]');
    await expect(sunnyVoteBtn).toBeVisible();

    // Ensure it's unvoted first to check unvoted count color
    if ((await sunnyVoteBtn.getAttribute("aria-pressed")) === "true") {
      await sunnyVoteBtn.click();
      await expect(sunnyVoteBtn).toHaveAttribute("aria-pressed", "false");
    }

    // Unvoted count color for #FACC15 uses dark #171717 (rgb(23, 23, 23))
    await expect
      .poll(async () =>
        sunnyVoteBtn.evaluate((el) => getComputedStyle(el).color)
      )
      .toBe("rgb(23, 23, 23)");

    // Vote it
    await sunnyVoteBtn.click();
    await expect(sunnyVoteBtn).toHaveAttribute("aria-pressed", "true");

    // Voted box text color for #FACC15 is dark (rgb(0, 0, 0) for #000000 primaryForeground)
    await expect
      .poll(async () =>
        sunnyVoteBtn.evaluate((el) => getComputedStyle(el).color)
      )
      .toBe("rgb(0, 0, 0)");
  });
});
