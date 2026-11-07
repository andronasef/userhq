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

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) throw new Error(`not an rgb colour: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(parseRgb(a)), luminance(parseRgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hasDark = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

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

  test("System follows the OS scheme live; an explicit choice is not overridden", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`/${wsSlug}/${productSlug}`);
    await page.waitForLoadState("networkidle");

    const group = page.locator('div[role="radiogroup"][aria-label="Appearance preference"]');
    const systemRadio = group.locator('button[role="radio"]:has-text("System")');
    await expect(systemRadio).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe("dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      "rgb(11, 17, 30)"
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
    await expect(systemRadio).toHaveAttribute("aria-checked", "true");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Explicit Light stays light when the OS flips to dark.
    await group.locator('button[role="radio"]:has-text("Light")').click();
    await page.emulateMedia({ colorScheme: "dark" });
    // Give a (wrongly) wired listener time to act before asserting nothing changed.
    await page.waitForTimeout(300);
    expect(await hasDark(page)).toBe(false);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("stored dark is painted by the head script alone (no app scripts)", async ({
    browser,
    baseURL,
  }) => {
    // Fresh context so the init script and script blocking do not leak into other cases.
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await context.addInitScript((key) => {
        try {
          localStorage.setItem(key, "dark");
        } catch {
          // storage blocked: the assertions below will fail loudly
        }
      }, "userhq_theme");
      // Inline scripts are not requests, so only the head script can run. With
      // hydration impossible, this proves the head script paints the stored theme.
      await page.route("**/*", (route) =>
        route.request().resourceType() === "script" ? route.abort() : route.continue()
      );
      await page.goto(`/${wsSlug}/${productSlug}`, { waitUntil: "load" });

      expect(await hasDark(page)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe("dark");
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
        "rgb(11, 17, 30)"
      );
    } finally {
      await context.close();
    }
  });

  test("accent link text meets 4.5:1 on page and card in light and dark", async ({ page }) => {
    const readColours = () =>
      page.evaluate(() => {
        const shell = document.querySelector('[data-shell="portal"]') as HTMLElement;
        const probe = document.createElement("span");
        probe.textContent = "probe";
        probe.style.color = "var(--primary-text)";
        shell.appendChild(probe);
        const out = {
          probe: getComputedStyle(probe).color,
          shellFg: getComputedStyle(shell).color,
          page: getComputedStyle(document.body).backgroundColor,
          card: getComputedStyle(shell.querySelector("header") as HTMLElement).backgroundColor,
        };
        probe.remove();
        return out;
      });

    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(`/${wsSlug}/${productSlug}`);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const light = await readColours();

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/dark/);
    const dark = await readColours();

    for (const c of [light, dark]) {
      expect(contrast(c.probe, c.page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.probe, c.card)).toBeGreaterThanOrEqual(4.5);
      // Guards against --primary-text silently falling back to the inherited colour.
      expect(c.probe).not.toBe(c.shellFg);
    }
    // The light-dark() pair really switches with the theme.
    expect(light.probe).not.toBe(dark.probe);
  });
});
