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

test.describe("Workspace Admin API Keys Specs (Plan 09-04)", () => {
  let stack: StackContext;
  let adminUser: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const prodSlug = `prod-api-${Date.now()}`;
  let generatedToken: string = "";

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    adminUser = await mintSession(stack, {
      name: "API Admin",
      emailVerified: true,
    });

    wsSlug = `ws-api-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: adminUser.userId,
      name: "API Automation Test Workspace",
      slug: wsSlug,
    });
    workspaceId = ws.id;

    // Create a product
    await createProductViaApi(adminUser.cookie, wsSlug, {
      name: "Core App",
      slug: prodSlug,
    });
  });

  test.afterAll(async () => {
    if (workspaceId) {
      // Clean up api keys
      await stack.db
        .delete(schema.workspaceApiKeys)
        .where(eq(schema.workspaceApiKeys.workspaceId, workspaceId));

      const prods = await stack.db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.workspaceId, workspaceId));

      if (prods.length > 0) {
        const prodIds = prods.map((p) => p.id);
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

  test("API key complete lifecycle: view empty state, create key, use token, revoke, and verify block", async ({
    page,
    baseURL,
  }) => {
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    // 1. Navigate to API keys settings and view empty state
    await page.goto(`/dashboard/${wsSlug}/settings/api-keys`);

    await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
    const activeTab = page.getByRole("link", { name: "API Keys" });
    await expect(activeTab).toBeVisible();
    await expect(activeTab).toHaveAttribute("aria-current", "page");

    await expect(page.getByText("No API keys created yet")).toBeVisible();

    // 2. Click create API key button
    await page.getByTestId("create-api-key-btn").first().click();

    // Dialog should open
    await expect(page.getByRole("heading", { name: "Create workspace API key" })).toBeVisible();

    // Fill in key name
    const keyNameInput = page.getByTestId("api-key-name-input");
    await keyNameInput.fill("Zapier Feedback Bot");

    // Verify scopes checkboxes
    const exportScope = page.getByTestId("scope-checkbox-export:read");
    await expect(exportScope).toBeChecked();

    // Submit form
    await page.getByTestId("submit-create-api-key-btn").click();

    // Dialog should switch to one-time secret display
    await expect(page.getByRole("heading", { name: "Save your API key" })).toBeVisible();
    const tokenInput = page.getByTestId("generated-api-key-token");
    await expect(tokenInput).toBeVisible();

    generatedToken = await tokenInput.inputValue();
    expect(generatedToken).toMatch(/^uhq_live_[A-Za-z0-9_-]+$/);

    // Close reveal modal
    await page.getByTestId("api-key-done-btn").click();

    // 3. Key should appear in the table
    const table = page.getByTestId("api-keys-table");
    await expect(table).toBeVisible();
    await expect(table.getByText("Zapier Feedback Bot")).toBeVisible();
    await expect(table.getByText(generatedToken.slice(0, 16))).toBeVisible();
    await expect(table.getByText("Active", { exact: true })).toBeVisible();

    // 4. Verify token actually works via HTTP against API
    const preCheck = await fetch(`${effectiveBaseUrl}/api/v1/workspaces/${wsSlug}/export/feedback`, {
      headers: {
        Authorization: `Bearer ${generatedToken}`,
      },
    });
    expect(preCheck.status).toBe(200);

    // 5. Revoke the API key
    const revokeBtn = table.locator('[data-testid^="revoke-api-key-btn-"]').first();
    await revokeBtn.click();

    // Confirm dialog should open
    await expect(page.getByRole("heading", { name: /Revoke "Zapier Feedback Bot"/ })).toBeVisible();
    await page.getByRole("button", { name: "Revoke API Key" }).click();

    // Status badge should change to Revoked
    await expect(table.getByText("Revoked", { exact: true })).toBeVisible();

    // 6. Verify token is now blocked via HTTP
    const postCheck = await fetch(`${effectiveBaseUrl}/api/v1/workspaces/${wsSlug}/export/feedback`, {
      headers: {
        Authorization: `Bearer ${generatedToken}`,
      },
    });
    expect(postCheck.status).toBe(401);
  });
});
