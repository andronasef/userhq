import { test, expect } from "@playwright/test";
import { schema } from "@userhq/db";
import { and, eq } from "drizzle-orm";
import { openStack, mintSession, seedWorkspaceRows, createProductViaApi, cleanupWorkspaces, type StackContext } from "../support/stack.js";

test.describe("Product following and push click targets", () => {
  let stack: StackContext;
  let admin: { cookie: string; userId: string; email: string };
  let workspaceId: string;
  let productId: string;
  const workspaceSlug = `follow-${Date.now()}`;
  const productSlug = "follow-product";
  const productName = "Follow Product";
  const follows = () => stack.db.select().from(schema.pushFollowedProducts).where(and(
    eq(schema.pushFollowedProducts.userId, admin.userId), eq(schema.pushFollowedProducts.productId, productId)
  ));

  test.beforeAll(async () => {
    stack = await openStack();
    admin = await mintSession(stack, { name: "Follow Admin", emailVerified: true });
    const workspace = await seedWorkspaceRows(stack, { userId: admin.userId, name: "Follow workspace", slug: workspaceSlug });
    workspaceId = workspace.id;
    await createProductViaApi(admin.cookie, workspaceSlug, { name: productName, slug: productSlug });
    const [product] = await stack.db.select({ id: schema.products.id }).from(schema.products)
      .where(and(eq(schema.products.workspaceId, workspaceId), eq(schema.products.slug, productSlug)));
    productId = product.id;
  });

  test.beforeEach(async ({ context, baseURL }) => {
    await stack.db.delete(schema.pushFollowedProducts).where(eq(schema.pushFollowedProducts.productId, productId));
    const cookies = admin.cookie.split(";").map((pair) => pair.trim()).filter(Boolean).flatMap((pair) => {
      const at = pair.indexOf("=");
      if (at < 0) return [];
      const name = pair.slice(0, at);
      if (["path", "httponly", "samesite"].includes(name.toLowerCase())) return [];
      return [{ name, value: pair.slice(at + 1), url: baseURL ?? "http://localhost:8080" }];
    });
    await context.addCookies(cookies);
  });

  test.afterAll(async () => {
    if (productId) {
      await stack.db.delete(schema.pushFollowedProducts).where(eq(schema.pushFollowedProducts.productId, productId));
      await stack.db.delete(schema.categories).where(eq(schema.categories.productId, productId));
      await stack.db.delete(schema.statuses).where(eq(schema.statuses.productId, productId));
      await stack.db.delete(schema.products).where(eq(schema.products.id, productId));
    }
    if (workspaceId) await cleanupWorkspaces(stack, [workspaceId]);
    if (admin?.userId) await stack.db.delete(schema.user).where(eq(schema.user.id, admin.userId));
    await stack?.close();
  });

  test("an admin can follow persistently, reload, then unfollow", async ({ page }) => {
    await page.goto(`/dashboard/${workspaceSlug}?tab=products`);
    const toggle = page.getByRole("button", { name: `Follow ${productName}`, exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveText("Follow");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveText("Following");
    await expect.poll(async () => (await follows()).length).toBe(1);
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveText("Following");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveText("Follow");
    await expect.poll(async () => (await follows()).length).toBe(0);
  });

  test("a failed follow request rolls back the optimistic state and shows an error", async ({ page }) => {
    await page.goto(`/dashboard/${workspaceSlug}?tab=products`);
    const toggle = page.getByRole("button", { name: `Follow ${productName}`, exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    let release!: () => void;
    const responseGate = new Promise<void>((resolve) => { release = resolve; });
    const route = `**/api/v1/workspaces/${workspaceSlug}/products/${productSlug}/push-follow`;
    await page.route(route, async (request) => {
      await responseGate;
      await request.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "internal_error", message: "Simulated failure" }) });
    });
    try {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(toggle).toBeDisabled();
      release();
      await expect(toggle).toHaveAttribute("aria-pressed", "false");
      await expect(toggle).toHaveText("Follow");
      await expect(toggle).toBeEnabled();
      await expect(page.getByText("Could not follow this product.", { exact: true })).toBeVisible();
      expect(await follows()).toHaveLength(0);
    } finally {
      release();
      await page.unroute(route);
    }
  });

  test("the registered service worker resolves canonical and foreign synthetic notification click targets", async ({ page, context, baseURL }) => {
    const origin = new URL(baseURL ?? "http://localhost:8080").origin;
    await context.grantPermissions(["notifications"], { origin });
    await page.goto(`/dashboard/${workspaceSlug}?tab=products`);
    const existing = context.serviceWorkers().find((worker) => new URL(worker.url()).pathname === "/sw.js");
    const [worker] = await Promise.all([
      existing ? Promise.resolve(existing) : context.waitForEvent("serviceworker", { predicate: (candidate) => new URL(candidate.url()).pathname === "/sw.js" }),
      page.evaluate(async () => {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      }),
    ]);
    const postPath = `/${workspaceSlug}/${productSlug}/p/42-a-customer-request`;
    const recorded = await worker.evaluate(async (paths) => {
      const clients = (self as unknown as { clients: { matchAll(options?: unknown): Promise<unknown[]>; openWindow(url: string): Promise<unknown> } }).clients;
      const originalMatch = clients.matchAll;
      const originalOpen = clients.openWindow;
      const opened: string[] = [];
      let closed = 0;
      try {
        clients.matchAll = async () => [];
        clients.openWindow = async (url) => { opened.push(url); return null; };
        for (const raw of paths) {
          const pending: Promise<unknown>[] = [];
          const event = Object.assign(new Event("notificationclick"), {
            notification: { data: { url: raw }, close: () => { closed++; } },
            waitUntil: (promise: Promise<unknown>) => pending.push(promise),
          });
          self.dispatchEvent(event);
          await Promise.all(pending);
        }
      } finally {
        clients.matchAll = originalMatch;
        clients.openWindow = originalOpen;
      }
      return { opened, closed };
    }, [postPath, "https://foreign.example.test/escape"]);
    expect(recorded).toEqual({ opened: [`${origin}${postPath}`, `${origin}/`], closed: 2 });
  });
});
