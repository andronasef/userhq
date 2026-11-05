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
  test.beforeEach(async ({ page, baseURL }) => {
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
    const reset = await page.request.patch(
      `/api/v1/workspaces/${ws}/products/app`,
      {
        headers: { Origin: baseURL ?? "http://localhost:8080" },
        data: {
          features: { board: true, roadmap: true, changelog: true, faq: true },
        },
      },
    );
    expect(reset.status()).toBe(200);
    await page.goto(`/dashboard/${ws}/app/settings`);
  });
  test("admin saves feature preferences and they survive reloading", async ({
    page,
    baseURL,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Portal features", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: "Feedback board", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("checkbox", { name: "Feedback board", exact: true })
      .uncheck();
    await page
      .locator("form")
      .filter({
        has: page.getByRole("checkbox", {
          name: "Feedback board",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Save features", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Hide Feedback board", exact: true })
      .click();
    await expect(
      page.getByText("Features updated", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Feedback board", exact: true }),
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
    await page
      .getByRole("checkbox", { name: "Feedback board", exact: true })
      .check();
    await page
      .locator("form")
      .filter({
        has: page.getByRole("checkbox", {
          name: "Feedback board",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Save features", exact: true })
      .click();
    await expect(
      page.getByText("Features updated", { exact: true }),
    ).toBeVisible();
  });

  test("keyboard changes stay unsaved on cancel and all-off confirmation is explicit", async ({
    page,
  }) => {
    const section = page.locator("#portal-features");
    const save = section.getByRole("button", {
      name: "Save features",
      exact: true,
    });
    await expect(save).toBeDisabled();
    const board = section.getByRole("checkbox", {
      name: "Feedback board",
      exact: true,
    });
    await board.focus();
    await page.keyboard.press("Space");
    await expect(board).not.toBeChecked();
    await expect(
      section.getByText("Hidden from customers", { exact: true }),
    ).toHaveCount(0);
    await save.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading")).toHaveText(
      "Hide Feedback board from customers?",
    );
    await expect(dialog).toContainText(
      "Notifications for activity while it is off are not sent later.",
    );
    await expect(
      dialog.getByRole("button", { name: "Keep visible" }),
    ).toBeFocused();
    await dialog.getByRole("button", { name: "Keep visible" }).click();
    await expect(board).not.toBeChecked();
    const current = await page.request.get(
      `/api/v1/workspaces/${ws}/products/app`,
    );
    expect((await current.json()).features.board).toBe(true);
    await section
      .getByRole("checkbox", { name: "Roadmap", exact: true })
      .uncheck();
    await save.click();
    await expect(dialog.getByRole("heading")).toHaveText(
      "Hide 2 features from customers?",
    );
    await expect(dialog).toContainText("Feedback board and Roadmap");
    await dialog.getByRole("button", { name: "Keep visible" }).click();
    await section
      .getByRole("checkbox", { name: "Changelog", exact: true })
      .uncheck();
    await section.getByRole("checkbox", { name: "FAQ", exact: true }).uncheck();
    await expect(section.getByRole("status")).toContainText(
      "With every feature off, customers see an unavailable page",
    );
    await save.click();
    await expect(dialog.getByRole("heading")).toHaveText(
      "Hide everything from customers?",
    );
    await dialog
      .getByRole("button", { name: "Hide everything", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByText("Hidden from customers", { exact: true }),
    ).toHaveCount(4);
    await expect(save).toBeDisabled();
    await page.reload();
    await expect(section.getByRole("checkbox").first()).not.toBeChecked();
  });

  test("failed save preserves choices and pending confirmation blocks dismissal before retry succeeds", async ({
    page,
  }) => {
    const section = page.locator("#portal-features");
    const roadmap = section.getByRole("checkbox", {
      name: "Roadmap",
      exact: true,
    });
    await roadmap.uncheck();
    await section.getByRole("button", { name: "Save features" }).click();
    const dialog = page.getByRole("alertdialog");
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const intercepted = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(
      `**/api/v1/workspaces/${ws}/products/app`,
      async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        started();
        await held;
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ code: "not_allowed" }),
        });
      },
    );
    await dialog
      .getByRole("button", { name: "Hide Roadmap", exact: true })
      .click();
    await intercepted;
    await expect(roadmap).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Keep visible" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    release();
    await expect(dialog.getByRole("alert")).toContainText(
      "You no longer have access to this. Refresh the page.",
    );
    await expect(section.getByRole("alert")).toHaveText(
      "You no longer have access to this. Refresh the page.",
    );
    await expect(roadmap).not.toBeChecked();
    await expect(roadmap).toBeEnabled();
    await page.unroute(`**/api/v1/workspaces/${ws}/products/app`);
    await dialog
      .getByRole("button", { name: "Hide Roadmap", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByText("Hidden from customers", { exact: true }),
    ).toHaveCount(1);
  });

  test("stale settings save only dirty keys and enabling does not ask for confirmation", async ({
    page,
    baseURL,
  }) => {
    const section = page.locator("#portal-features");
    // Another admin changes FAQ after this form loaded all-on defaults.
    const other = await page.request.patch(
      `/api/v1/workspaces/${ws}/products/app`,
      {
        headers: { Origin: baseURL ?? "http://localhost:8080" },
        data: { features: { faq: false } },
      },
    );
    expect(other.status()).toBe(200);
    const patch = page.waitForRequest(
      (req) =>
        req.method() === "PATCH" &&
        req.url().endsWith(`/api/v1/workspaces/${ws}/products/app`),
    );
    await section
      .getByRole("checkbox", { name: "Changelog", exact: true })
      .uncheck();
    await section.getByRole("button", { name: "Save features" }).click();
    await page
      .getByRole("button", { name: "Hide Changelog", exact: true })
      .click();
    expect((await patch).postDataJSON()).toEqual({
      features: { changelog: false },
    });
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(
      section.getByRole("checkbox", { name: "FAQ", exact: true }),
    ).not.toBeChecked();
    await expect(
      section.getByText("Hidden from customers", { exact: true }),
    ).toHaveCount(2);
    const restore = page.waitForRequest(
      (req) =>
        req.method() === "PATCH" &&
        req.url().endsWith(`/api/v1/workspaces/${ws}/products/app`),
    );
    await section
      .getByRole("checkbox", { name: "Changelog", exact: true })
      .check();
    await section.getByRole("button", { name: "Save features" }).click();
    expect((await restore).postDataJSON()).toEqual({
      features: { changelog: true },
    });
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(
      section.getByRole("button", { name: "Save features" }),
    ).toBeDisabled();
    const saved = await page.request.get(
      `/api/v1/workspaces/${ws}/products/app`,
    );
    expect((await saved.json()).features).toEqual({
      board: true,
      roadmap: true,
      changelog: true,
      faq: false,
    });
  });
});
