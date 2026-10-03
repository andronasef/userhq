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
import { pngOfSize } from "../support/images.js";

test.describe("Portal Branding Backstop (Plan 02-10)", () => {
  let stack: StackContext;
  let user: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const sunnySlug = "sunny";
  const oceanSlug = "ocean";
  let uploadId: string;

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    user = await mintSession(stack, { name: "Branding Tester", emailVerified: true });
    wsSlug = `acme-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Acme",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    // Create Sunny product
    await createProductViaApi(user.cookie, wsSlug, {
      name: "Sunny",
      slug: sunnySlug,
    });

    // Upload logo
    const pngBuffer = await pngOfSize(64, 64);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pngBuffer], { type: "image/png" }),
      "logo.png"
    );

    const uploadRes = await fetch(`${effectiveBaseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: {
        Cookie: user.cookie,
        Origin: effectiveBaseUrl,
      },
      body: formData,
    });
    expect(uploadRes.status).toBe(201);
    const uploadJson = await uploadRes.json();
    uploadId = uploadJson.id;

    // Patch Sunny with accent #FACC15, tagline, website, and logo
    const patchSunnyRes = await fetch(
      `${effectiveBaseUrl}/api/v1/workspaces/${wsSlug}/products/${sunnySlug}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          accentColor: "#FACC15",
          tagline: "Bright ideas",
          websiteUrl: "https://sunny.example",
          logoUploadId: uploadId,
        }),
      }
    );
    expect(patchSunnyRes.status).toBe(200);

    // Create Ocean product
    await createProductViaApi(user.cookie, wsSlug, {
      name: "Ocean",
      slug: oceanSlug,
    });

    // Patch Ocean with accent #2563EB and website
    const patchOceanRes = await fetch(
      `${effectiveBaseUrl}/api/v1/workspaces/${wsSlug}/products/${oceanSlug}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie,
          Origin: effectiveBaseUrl,
        },
        body: JSON.stringify({
          accentColor: "#2563EB",
          websiteUrl: "https://ocean.example",
        }),
      }
    );
    expect(patchOceanRes.status).toBe(200);
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

    if (uploadId) {
      await stack.db
        .delete(schema.uploads)
        .where(eq(schema.uploads.id, uploadId));
    }

    if (user?.userId) {
      await stack.db.delete(schema.user).where(eq(schema.user.id, user.userId));
    }

    await stack.close();
  });

  test("accent tokens computed-style backstop for #FACC15 and #2563EB", async ({
    page,
  }) => {
    // 1. Visit Sunny
    await page.goto(`/${wsSlug}/${sunnySlug}`);
    await page.waitForLoadState("networkidle");

    const sunnyPortal = page.locator('[data-shell="portal"]');
    await expect(sunnyPortal).toBeVisible();

    const sunnyPrimaryFg = await sunnyPortal.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--primary-foreground").trim()
    );
    expect(sunnyPrimaryFg).toBe("#000000");

    const sunnyBackLink = page.locator('a:has-text("Back to Acme")');
    await expect(sunnyBackLink).toBeVisible();
    const sunnyLinkColor = await sunnyBackLink.evaluate(
      (el) => getComputedStyle(el).color
    );
    expect(sunnyLinkColor).toBe("rgb(23, 23, 23)");

    // 2. Visit Ocean
    await page.goto(`/${wsSlug}/${oceanSlug}`);
    await page.waitForLoadState("networkidle");

    const oceanPortal = page.locator('[data-shell="portal"]');
    await expect(oceanPortal).toBeVisible();

    const oceanPrimaryFg = await oceanPortal.evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--primary-foreground").trim()
    );
    expect(oceanPrimaryFg).toBe("#FFFFFF");

    const oceanBackLink = page.locator('a:has-text("Back to Acme")');
    await expect(oceanBackLink).toBeVisible();
    const oceanLinkColor = await oceanBackLink.evaluate(
      (el) => getComputedStyle(el).color
    );
    expect(oceanLinkColor).toBe("rgb(37, 99, 235)");
  });

  test("OG and favicon metadata backstop", async ({ page }) => {
    // 1. Visit Sunny (with logo, tagline)
    await page.goto(`/${wsSlug}/${sunnySlug}`);
    await page.waitForLoadState("networkidle");

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toBe("Sunny");

    const ogDesc = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(ogDesc).toBe("Bright ideas");

    const ogSite = await page.locator('meta[property="og:site_name"]').getAttribute("content");
    expect(ogSite).toBe("Acme");

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toMatch(/^https?:\/\/[^/]+\/uploads\/[a-z0-9/-]+\.webp$/);

    const favicon = await page.locator('link[rel="icon"][type="image/webp"]').getAttribute("href");
    expect(favicon).toMatch(/^https?:\/\/[^/]+\/uploads\/[a-z0-9/-]+\.webp$/);

    // 2. Visit Ocean (no logo, fallback description)
    await page.goto(`/${wsSlug}/${oceanSlug}`);
    await page.waitForLoadState("networkidle");

    const oceanOgImageCount = await page.locator('meta[property="og:image"]').count();
    expect(oceanOgImageCount).toBe(0);

    const oceanOgDesc = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(oceanOgDesc).toBe("Share feedback and follow updates for Ocean.");
  });
});
