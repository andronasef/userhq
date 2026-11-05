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

test.describe("Appearance & Dark Mode (Slice 1 / Phase 07)", () => {
  let stack: StackContext;
  let user: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const productSlug = "core";

  test.beforeAll(async () => {
    stack = await openStack();
    user = await mintSession(stack, { name: "Theme Tester", emailVerified: true });
    wsSlug = `theme-ws-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Theme Test Corp",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    await createProductViaApi(user.cookie, wsSlug, {
      name: "Core",
      slug: productSlug,
    });
  });

  test.afterAll(async () => {
    if (workspaceId) {
      const prods = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, workspaceId));
      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);
        await stack.db
          .delete(schema.statuses)
          .where(inArray(schema.statuses.productId, prodIds));
        await stack.db
          .delete(schema.products)
          .where(inArray(schema.products.id, prodIds));
      }
      await cleanupWorkspaces(stack, [workspaceId]);
    }
    if (user?.userId) {
      await stack.db.delete(schema.user).where(eq(schema.user.id, user.userId));
    }
    await stack.close();
  });

  test("portal footer segmented theme switcher toggles dark mode, updates computed styles, and persists across reload", async ({
    page,
  }) => {
    // 1. Visit portal page
    await page.goto(`/${wsSlug}/${productSlug}`);
    await page.waitForLoadState("networkidle");

    const segmentedGroup = page.locator('div[role="radiogroup"][aria-label="Appearance preference"]');
    await expect(segmentedGroup).toBeVisible();

    const darkOption = segmentedGroup.locator('button[role="radio"]:has-text("Dark")');
    const lightOption = segmentedGroup.locator('button[role="radio"]:has-text("Light")');
    const systemOption = segmentedGroup.locator('button[role="radio"]:has-text("System")');

    await expect(darkOption).toBeVisible();
    await expect(lightOption).toBeVisible();
    await expect(systemOption).toBeVisible();

    // 2. Select Dark
    await darkOption.click();

    // Verify .dark class and dataset.theme
    const hasDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(hasDarkClass).toBe(true);

    const dataTheme = await page.evaluate(() =>
      document.documentElement.dataset.theme
    );
    expect(dataTheme).toBe("dark");

    // Verify computed background style changes to dark palette (#0b111e -> rgb(11, 17, 30))
    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    expect(darkBg).toBe("rgb(11, 17, 30)");

    // 3. Verify anti-FOUC persistence across reload
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const reloadedHasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(reloadedHasDark).toBe(true);

    // 4. Switch back to Light
    const lightOptionAfterReload = page.locator(
      'div[role="radiogroup"][aria-label="Appearance preference"] button[role="radio"]:has-text("Light")'
    );
    await lightOptionAfterReload.click();

    const hasNoDarkClass = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(hasNoDarkClass).toBe(false);

    // 5. Reload to verify light persists
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const reloadedHasLight = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(reloadedHasLight).toBe(false);
  });

  test("dashboard header theme switcher allows switching appearance", async ({
    baseURL,
    context,
    page,
  }) => {
    // Set auth cookies properly
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";
    const cookiesToAdd: Array<{ name: string; value: string; url: string }> = [];
    for (const pair of user.cookie.split(";")) {
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

    await page.goto(`/dashboard/${wsSlug}`);
    await page.waitForLoadState("networkidle");

    // Header theme toggle button
    const themeToggleBtn = page.locator('header[data-shell="dashboard"] button[aria-label*="Theme:"]');
    await expect(themeToggleBtn).toBeVisible();

    // Click toggle to open dropdown
    await themeToggleBtn.click();

    // Select Dark from dropdown
    const darkItem = page.locator('[role="menuitem"]:has-text("Dark")');
    await expect(darkItem).toBeVisible();
    await darkItem.click();
    await expect(page.locator('[role="menu"]')).not.toBeVisible();

    // Verify .dark class applied to document
    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);

    // Verify dashboard card background matches dark token (#131d2e -> rgb(19, 29, 46))
    const headerBg = await page.evaluate(() => {
      const header = document.querySelector('header[data-shell="dashboard"]');
      return header ? getComputedStyle(header).backgroundColor : "";
    });
    expect(headerBg).toBe("rgb(19, 29, 46)");

    // Switch back to Light via theme toggle
    await themeToggleBtn.click();
    const lightItem = page.locator('[role="menuitem"]:has-text("Light")');
    await expect(lightItem).toBeVisible();
    await lightItem.click();
    await expect(page.locator('[role="menu"]')).not.toBeVisible();

    const isStillDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isStillDark).toBe(false);
  });
});
