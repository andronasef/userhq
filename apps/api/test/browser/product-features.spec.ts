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

test.describe("Product feature settings", () => {
  let stack: StackContext;
  let user: Awaited<ReturnType<typeof mintSession>>;
  let workspaceId: string;
  let ws: string;
  test.beforeAll(async () => {
    stack = await openStack();
    user = await mintSession(stack, {
      name: "Feature Admin",
      emailVerified: true,
    });
    ws = `features-${Date.now()}`;
    workspaceId = (
      await seedWorkspaceRows(stack, {
        userId: user.userId,
        name: "Feature workspace",
        slug: ws,
      })
    ).id;
    await createProductViaApi(user.cookie, ws, {
      name: "Feature App",
      slug: "app",
    });
  });
  test.afterAll(async () => {
    if (workspaceId) {
      const products = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, workspaceId));
      const ids = products.map((product) => product.id);
      if (ids.length) {
        await stack.db
          .delete(schema.categories)
          .where(inArray(schema.categories.productId, ids));
        await stack.db
          .delete(schema.statuses)
          .where(inArray(schema.statuses.productId, ids));
        await stack.db
          .delete(schema.changelogTags)
          .where(inArray(schema.changelogTags.productId, ids));
        await stack.db
          .delete(schema.products)
          .where(inArray(schema.products.id, ids));
      }
      await cleanupWorkspaces(stack, [workspaceId]);
    }
    if (user)
      await stack.db.delete(schema.user).where(eq(schema.user.id, user.userId));
    await stack?.close();
  });
  test("admin saves Board preference and it survives reloading", async ({
    page,
    baseURL,
  }) => {
    const cookies = user.cookie
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .flatMap((pair) => {
        const index = pair.indexOf("=");
        if (index < 0) return [];
        const name = pair.slice(0, index);
        if (
          [
            "path",
            "httponly",
            "samesite",
            "max-age",
            "expires",
            "secure",
          ].includes(name.toLowerCase())
        )
          return [];
        return [
          {
            name,
            value: pair.slice(index + 1),
            url: baseURL ?? "http://localhost:8080",
          },
        ];
      });
    await page.context().addCookies(cookies);
    await page.goto(`/dashboard/${ws}/app/settings`);
    await expect(
      page.getByRole("checkbox", { name: "Board", exact: true }),
    ).toBeChecked();
    await page.getByRole("checkbox", { name: "Board", exact: true }).uncheck();
    await page
      .locator("form")
      .filter({
        has: page.getByRole("checkbox", { name: "Board", exact: true }),
      })
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hide feature", exact: true })
      .click();
    await expect(
      page.getByText("Changes saved", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Board", exact: true }),
    ).not.toBeChecked();
    const saved = await page.request.get(
      `/api/v1/workspaces/${ws}/products/app`,
    );
    expect(saved.status()).toBe(200);
    expect((await saved.json()).features).toEqual({
      board: false,
      roadmap: true,
      changelog: true,
      faq: true,
    });
    await page.getByRole("checkbox", { name: "Board", exact: true }).check();
    await page
      .locator("form")
      .filter({
        has: page.getByRole("checkbox", { name: "Board", exact: true }),
      })
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByText("Changes saved", { exact: true }),
    ).toBeVisible();
  });
});
