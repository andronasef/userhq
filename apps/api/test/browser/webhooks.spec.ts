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

test.describe("Workspace Outbound Webhooks UI Specs (Phase 10)", () => {
  let stack: StackContext;
  let adminUser: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let wsSlug: string;
  const prodSlug = `prod-wh-${Date.now()}`;

  test.beforeAll(async ({ baseURL }) => {
    stack = await openStack();
    const effectiveBaseUrl = baseURL ?? "http://localhost:8080";

    adminUser = await mintSession(stack, {
      name: "Webhook Admin",
      emailVerified: true,
    });

    wsSlug = `ws-wh-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: adminUser.userId,
      name: "Webhooks Test Workspace",
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
      // Clean up webhooks
      await stack.db
        .delete(schema.webhookDeliveries)
        .where(
          inArray(
            schema.webhookDeliveries.subscriptionId,
            stack.db
              .select({ id: schema.webhookSubscriptions.id })
              .from(schema.webhookSubscriptions)
              .where(eq(schema.webhookSubscriptions.workspaceId, workspaceId))
          )
        );

      await stack.db
        .delete(schema.webhookSubscriptions)
        .where(eq(schema.webhookSubscriptions.workspaceId, workspaceId));

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

  test("Webhook subscription complete lifecycle: view empty state, create webhook, ping, view deliveries, and delete", async ({
    page,
    baseURL,
  }) => {
    // 1. Navigate to Webhooks settings and view empty state
    await page.goto(`/dashboard/${wsSlug}/settings/webhooks`);

    await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
    const activeTab = page.getByRole("link", { name: "Webhooks" });
    await expect(activeTab).toBeVisible();
    await expect(activeTab).toHaveAttribute("aria-current", "page");

    await expect(page.getByText("No webhooks configured yet")).toBeVisible();

    // 2. Click create Webhook button
    await page.getByTestId("create-webhook-btn").first().click();

    // Dialog should open
    await expect(page.getByRole("heading", { name: "Create Webhook Subscription" })).toBeVisible();

    // Fill in payload URL & description
    const urlInput = page.getByTestId("webhook-url-input");
    await urlInput.fill("https://example.com/webhooks/incoming");

    const descInput = page.getByTestId("webhook-description-input");
    await descInput.fill("Production Slack Notification Relay");

    // Submit form
    await page.getByTestId("submit-webhook-btn").click();

    // Dialog should switch to secret display view
    await expect(page.getByRole("heading", { name: "Webhook Created" })).toBeVisible();
    const secretDisplay = page.getByTestId("webhook-secret-display");
    await expect(secretDisplay).toBeVisible();
    const secretVal = await secretDisplay.inputValue();
    expect(secretVal.startsWith("whsec_")).toBe(true);

    // Click Done
    await page.getByTestId("webhook-done-btn").click();

    // 3. Subscription row now rendered in active list
    await expect(page.getByText("https://example.com/webhooks/incoming")).toBeVisible();
    await expect(page.getByText("Production Slack Notification Relay")).toBeVisible();
    await expect(page.getByText("Active")).toBeVisible();

    // 4. Send ping
    const pingBtn = page.getByRole("button", { name: "Send Ping" });
    await expect(pingBtn).toBeVisible();
    await pingBtn.click();

    // Verify toast
    await expect(page.getByText("Test ping event enqueued for delivery")).toBeVisible();

    // 5. Check Deliveries dialog
    const deliveriesBtn = page.getByRole("button", { name: "Deliveries" });
    await deliveriesBtn.click();

    const deliveriesModal = page.getByRole("dialog");
    await expect(deliveriesModal.getByRole("heading", { name: "Recent Deliveries" })).toBeVisible();
    await expect(deliveriesModal.getByText("ping", { exact: true })).toBeVisible();

    // Close dialog with Escape
    await page.keyboard.press("Escape");

    // 6. Delete webhook
    const deleteBtn = page.locator('button[title="Delete webhook"]').first();
    await deleteBtn.click();

    await expect(page.getByRole("heading", { name: "Delete Webhook Subscription" })).toBeVisible();
    await page.getByRole("button", { name: "Delete Webhook" }).click();

    // Webhook should be removed and empty state restored
    await expect(page.getByText("No webhooks configured yet")).toBeVisible();
  });
});
