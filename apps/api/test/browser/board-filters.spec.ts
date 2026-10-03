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

test.describe("Board Filters & Sort Browser Specs (Plan 03-07)", () => {
  let stack: StackContext;
  let userA: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const prodSlug = "browser-prod";
  const pagedSlug = "paged-prod";
  let prodId: string;
  let post1Id: string;
  let post2Id: string;
  let post3Id: string;

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    userA = await mintSession(stack, {
      name: "Author Alice",
      emailVerified: true,
    });

    wsSlug = `filters-ws-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: userA.userId,
      name: "Filters Workspace",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    await createProductViaApi(userA.cookie, wsSlug, {
      name: "Browser Product",
      slug: prodSlug,
    });

    const [prodRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, prodSlug));
    prodId = prodRow.id;

    const [cat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, prodId))
      .limit(1);

    // Create 3 posts
    const createPost = async (title: string, desc: string) => {
      const res = await fetch(
        `${effectiveBaseUrl}/api/v1/portal/${wsSlug}/${prodSlug}/posts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: userA.cookie,
            Origin: effectiveBaseUrl,
          },
          body: JSON.stringify({
            title,
            description: desc,
            categoryId: cat.id,
          }),
        }
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      return data.number;
    };

    const n1 = await createPost("Alpha Feature", "First created post");
    const n2 = await createPost("Beta Feature", "Second created post");
    const n3 = await createPost("Gamma Feature", "Third created post");

    // Retrieve post IDs
    const postRows = await stack.db
      .select({ id: schema.posts.id, number: schema.posts.number })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));

    const p1 = postRows.find((p) => p.number === n1)!;
    const p2 = postRows.find((p) => p.number === n2)!;
    const p3 = postRows.find((p) => p.number === n3)!;
    post1Id = p1.id;
    post2Id = p2.id;
    post3Id = p3.id;

    // Adjust votes and dates so Top order != Newest order:
    // Post 1: oldest date, 30 votes -> top order #1, newest order #3
    // Post 2: middle date, 20 votes -> top order #2, newest order #2
    // Post 3: newest date, 5 votes  -> top order #3, newest order #1
    const now = Date.now();
    await stack.db
      .update(schema.posts)
      .set({
        voteCount: 30,
        createdAt: new Date(now - 300_000),
      })
      .where(eq(schema.posts.id, post1Id));

    await stack.db
      .update(schema.posts)
      .set({
        voteCount: 20,
        createdAt: new Date(now - 200_000),
      })
      .where(eq(schema.posts.id, post2Id));

    await stack.db
      .update(schema.posts)
      .set({
        voteCount: 5,
        createdAt: new Date(now - 100_000),
      })
      .where(eq(schema.posts.id, post3Id));

    // Seed 25 posts under pagedSlug for Load more tests
    await createProductViaApi(userA.cookie, wsSlug, {
      name: "Paged Product",
      slug: pagedSlug,
    });

    const [pagedProdRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, pagedSlug));
    const pagedProdId = pagedProdRow.id;

    const [pagedCat] = await stack.db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.productId, pagedProdId))
      .limit(1);

    const [pagedStatus] = await stack.db
      .select({ id: schema.statuses.id })
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, pagedProdId))
      .limit(1);

    const pagedPostsValues = Array.from({ length: 25 }, (_, i) => ({
      productId: pagedProdId,
      number: i + 1,
      title: `Paged Post Item ${i + 1}`,
      description: `Description ${i + 1}`,
      categoryId: pagedCat.id,
      statusId: pagedStatus.id,
      authorId: userA.userId,
      voteCount: 25 - i,
      createdAt: new Date(now - i * 60_000),
    }));
    await stack.db.insert(schema.posts).values(pagedPostsValues);
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

    await stack.close();
  });

  test("tracer: Sort select refetches the server list and Back restores it", async ({
    page,
  }) => {
    // 1. Open the board
    await page.goto(`/${wsSlug}/${prodSlug}`);

    // Wait for the post list to render
    const firstRowLink = page.locator("li").first().getByRole("link");
    await expect(firstRowLink).toContainText("Alpha Feature");

    // 2. Select "Newest"
    const sortSelect = page.getByLabel("Sort by");
    await sortSelect.selectOption("new");

    // 3. Wait for URL to contain sort=new
    await expect(page).toHaveURL(new RegExp(`/${wsSlug}/${prodSlug}\\?.*sort=new`));

    // 4. Server list should re-render newest first: Gamma Feature
    await expect(firstRowLink).toContainText("Gamma Feature");

    // 5. Click Back button
    await page.goBack();

    // 6. Assert URL no longer has sort=new
    await expect(page).not.toHaveURL(/sort=new/);

    // 7. Assert original first row (Alpha Feature) returns
    await expect(firstRowLink).toContainText("Alpha Feature");
  });

  test("Load more fetches next page without duplicates and disappears when nextCursor is null", async ({
    page,
  }) => {
    await page.goto(`/${wsSlug}/${pagedSlug}`);

    // Wait for initial page (20 rows)
    const rows = page.locator("li");
    await expect(rows).toHaveCount(20);

    // Load more button should be visible
    const loadMoreButton = page.getByRole("button", { name: "Load more" });
    await expect(loadMoreButton).toBeVisible();

    // Click Load more
    await loadMoreButton.click();

    // Rows count should become 25
    await expect(rows).toHaveCount(25);

    // Load more button should disappear
    await expect(loadMoreButton).not.toBeVisible();

    // aria-live announcement
    const liveRegion = page.getByRole("status");
    await expect(liveRegion).toContainText("Loaded 5 more posts");
  });
});
