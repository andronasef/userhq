import { test, expect } from "@playwright/test";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  cleanupWorkspaces,
  type StackContext,
} from "../support/stack.js";

test.describe("320px Dashboard Header Backstop (Plan 02-04)", () => {
  let stack: StackContext;
  let user: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let slug: string;

  test.beforeAll(async () => {
    stack = await openStack();
    user = await mintSession(stack, { name: "320px Tester" });
    slug = `northwind-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Northwind Traders International Holdings",
      slug,
    });
    workspaceId = ws.id;
  });

  test.afterAll(async () => {
    if (workspaceId) {
      await cleanupWorkspaces(stack, [workspaceId]);
    }
    if (user?.userId) {
      await stack.db.delete(schema.user).where(eq(schema.user.id, user.userId));
    }
    await stack.close();
  });

  test("320px dashboard header fits one line and causes no horizontal scroll", async ({
    page,
    baseURL,
  }) => {
    const cookiePairs = user.cookie.split(";").map((c) => c.trim()).filter(Boolean);
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
        url: baseURL ?? "http://localhost:8080",
      });
    }
    await page.context().addCookies(cookiesToAdd);

    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/dashboard/${slug}`);
    await page.waitForLoadState("networkidle");

    // 1. Assert documentElement.scrollWidth <= 320
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(320);

    // 2. Assert all 4 header elements fit on one line inside header bounding box
    const header = page.locator('header[data-shell="dashboard"]');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();

    const openNavBtn = page.locator('button[aria-label="Open navigation"]');
    const wordmarkLink = page.locator(
      'header[data-shell="dashboard"] a[href="/dashboard"]:has-text("UserHQ")'
    );
    const switcherTrigger = page.locator(
      'button[aria-label^="Switch workspace, current:"]'
    );
    const accountMenuTrigger = page.locator(
      'button[aria-label="Open account menu"]'
    );

    const elements = [
      openNavBtn,
      wordmarkLink,
      switcherTrigger,
      accountMenuTrigger,
    ];

    for (const el of elements) {
      const box = await el.boundingBox();
      expect(box).not.toBeNull();
      const centerY = box!.y + box!.height / 2;
      expect(centerY).toBeGreaterThanOrEqual(headerBox!.y);
      expect(centerY).toBeLessThanOrEqual(headerBox!.y + headerBox!.height);
    }

    // 3. Screenshot
    await page.screenshot({ path: "test-results/dashboard-header-320.png" });

    // 4. Open switcher and assert no horizontal scroll
    await switcherTrigger.click();
    await page.waitForTimeout(150);
    const switcherScrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(switcherScrollWidth).toBeLessThanOrEqual(320);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    // 5. Open drawer and assert no horizontal scroll
    await openNavBtn.click();
    await page.waitForTimeout(150);
    const drawerScrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(drawerScrollWidth).toBeLessThanOrEqual(320);
    await page.keyboard.press("Escape");
  });
});
