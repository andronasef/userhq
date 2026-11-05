import { test, expect } from "@playwright/test";
import { schema } from "@userhq/db";
import { and, eq, inArray } from "drizzle-orm";
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
    await createProductViaApi(user.cookie, ws, {
      name: "Sibling App",
      slug: "sibling",
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
        await stack.db.delete(schema.roadmapItems).where(inArray(schema.roadmapItems.productId, ids));
        await stack.db.delete(schema.posts).where(inArray(schema.posts.productId, ids));
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
    for (const name of ["Feedback board", "Roadmap", "Changelog", "FAQ"]) {
      const checkbox = page.locator("#portal-features").getByRole("checkbox", { name, exact: true });
      await expect(checkbox).toBeEnabled();
      await expect(checkbox).toBeChecked();
    }
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
    await expect(board).toBeEnabled();
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
    await expect(section.locator("#feature-roadmap")).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Keep visible" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    release();
    await expect(dialog.getByRole("alert")).toContainText(
      "You no longer have access to this. Refresh the page.",
    );
    await expect(section.locator('[role="alert"]')).toHaveText(
      "You no longer have access to this. Refresh the page.",
    );
    await expect(section.locator("#feature-roadmap")).not.toBeChecked();
    await expect(section.locator("#feature-roadmap")).toBeEnabled();
    await page.unroute(`**/api/v1/workspaces/${ws}/products/app`);
    await dialog
      .getByRole("button", { name: "Hide Roadmap", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      section.getByText("Hidden from customers", { exact: true }),
    ).toHaveCount(1);
    await expect(section.getByRole("alert")).toHaveCount(0);
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

  test("public landing chooses enabled modules and all-off keeps branding and directory", async ({ page, baseURL }) => {
    const root = `/${ws}/app`;
    const set = async (features: Record<string, boolean>) => {
      const res = await page.request.patch(`/api/v1/workspaces/${ws}/products/app`, {
        headers: { Origin: baseURL! }, data: { features },
      });
      expect(res.status()).toBe(200);
    };
    // Anonymous navigation gives zero/one/many customer tabs without Activity.
    const visitor = await page.context().browser()!.newContext({ baseURL });
    const publicPage = await visitor.newPage();
    try {
      const cases = [
        { features: { board: true, roadmap: false, changelog: false, faq: false }, path: "", heading: "Feedback" },
        { features: { board: false, roadmap: true, changelog: false, faq: false }, path: "/roadmap", heading: "Roadmap" },
        { features: { board: false, roadmap: false, changelog: true, faq: false }, path: "/changelog", heading: "Changelog" },
        { features: { board: false, roadmap: false, changelog: false, faq: true }, path: "/faq", heading: "Frequently Asked Questions" },
      ];
      for (const c of cases) {
        await set(c.features);
        const initial = await publicPage.request.get(root, { maxRedirects: 0 });
        expect(initial.status()).toBe(c.path ? 307 : 200);
        if (c.path) expect(new URL(initial.headers().location, baseURL).pathname).toBe(root + c.path);
        const res = await publicPage.goto(root);
        expect(res!.status()).toBe(200);
        await expect(publicPage).toHaveURL(new RegExp(`${root}${c.path}$`));
        await expect(publicPage.getByRole("heading", { level: 1, name: c.heading, exact: true })).toBeVisible();
        await expect(publicPage.locator('a[aria-current="page"]')).toHaveCount(0);
        await expect(publicPage.getByRole("link", { name: "View feedback board", exact: true })).toHaveCount(0);
        await expect(publicPage.getByRole("link", { name: "Explore feedback", exact: true })).toHaveCount(0);
      }
      await set({ board: true, roadmap: true, changelog: true, faq: true });
      await publicPage.goto(root);
      await expect(publicPage.getByRole("link", { name: "Roadmap", exact: true })).toBeVisible();
      await expect(publicPage.getByRole("link", { name: "FAQ", exact: true })).toBeVisible();
      await set({ board: false, roadmap: false, changelog: false, faq: false });
      const unavailable = await publicPage.goto(root);
      expect(unavailable!.status()).toBe(200);
      await expect(publicPage.getByRole("heading", { name: "Nothing is available here right now" })).toBeVisible();
      await expect(publicPage.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(publicPage.getByText("Feature App", { exact: true }).first()).toBeVisible();
      await expect(publicPage.locator('a[aria-current="page"]')).toHaveCount(0);
      for (const path of ["/roadmap", "/changelog", "/changelog/hidden-title-canary", "/faq", "/p/1-hidden-title-canary"]) {
        const denied = await publicPage.goto(root + path);
        expect(denied!.status(), path).toBe(404);
        await expect(publicPage.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
        expect(await publicPage.title()).not.toContain("hidden-title-canary");
      }
      // Activity retains the pre-existing anonymous sign-in redirect. A signed-in
      // owner on the public URL receives the same feature denial as customers.
      const activity = await page.goto(root + "/activity");
      expect(activity!.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
      const directory = await publicPage.goto(`/${ws}`);
      expect(directory!.status()).toBe(200);
      await expect(publicPage.getByRole("link", { name: /Feature App/ })).toHaveAttribute("href", root);
    } finally { await visitor.close(); }
  });

  test("server refresh updates pristine features while preserving unsaved choices", async ({ page, baseURL }) => {
    const section = page.locator("#portal-features");
    const faq = section.getByRole("checkbox", { name: "FAQ", exact: true });
    const general = page.locator("form").filter({ has: page.locator("#product-name") });
    const setFaq = async (enabled: boolean) => {
      const res = await page.request.patch(`/api/v1/workspaces/${ws}/products/app`, {
        headers: { Origin: baseURL! }, data: { features: { faq: enabled } },
      });
      expect(res.status()).toBe(200);
    };
    await setFaq(false);
    await general.getByLabel("Product name", { exact: true }).fill("Feature App refreshed");
    await general.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(general.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    await expect(faq).not.toBeChecked();
    await expect(section.getByText("Hidden from customers", { exact: true })).toHaveCount(1);
    // Refresh a second time while Roadmap has an unsaved local edit. The local
    // choice must survive, while FAQ's untouched value follows the server.
    await section.getByRole("checkbox", { name: "Roadmap", exact: true }).uncheck();
    await setFaq(true);
    await general.getByLabel("Product name", { exact: true }).fill("Feature App");
    await general.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(general.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    await expect(section.getByRole("checkbox", { name: "Roadmap", exact: true })).not.toBeChecked();
    await expect(faq).toBeChecked();
    await expect(section.getByRole("button", { name: "Save features", exact: true })).toBeEnabled();
  });

  test("hidden dashboard modules remain manageable and settings wrap at narrow widths", async ({ page, baseURL }) => {
    const base = `/api/v1/workspaces/${ws}/products/app`;
    const metadata = await page.request.get(`/api/v1/portal/${ws}/app`);
    const categoryId = (await metadata.json()).categories[0].id;
    const create = async (title: string) => {
      const res = await page.request.post(`/api/v1/portal/${ws}/app/posts`, {
        headers: { Origin: baseURL! }, data: { title, description: "Preserved request body", categoryId },
      });
      expect(res.status()).toBe(201); return res.json();
    };
    const post = await create("Preserved request canary");
    const duplicate = await create("Merge search canary");
    expect((await page.request.patch(base, { headers: { Origin: baseURL! }, data: { features: { board: false, roadmap: false, changelog: false, faq: false } } })).status()).toBe(200);
    const dashboard = `/dashboard/${ws}/app`;
    for (const route of ["board", "roadmap", "changelog", "changelog/new", "faq"]) {
      const res = await page.goto(`${dashboard}/${route}`);
      expect(res!.status(), route).toBe(200);
      await expect(page.getByRole("link", { name: "Turn on in settings", exact: true })).toHaveAttribute("href", `${dashboard}/settings#portal-features`);
      await expect(page.getByText("Hidden from customers", { exact: true }).first()).toBeVisible();
    }
    await page.goto(`${dashboard}/board/${post.number}`);
    await expect(page.getByRole("heading", { name: "Preserved request canary", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "View on portal", exact: true })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Edit post", exact: true }).click();
    const edit = page.getByRole("dialog");
    await edit.getByLabel("Title", { exact: true }).fill("Edited while hidden canary");
    const update = page.waitForRequest(req => req.method() === "PATCH" && req.url().endsWith(`/posts/${post.number}`));
    await edit.getByRole("button", { name: "Save post", exact: true }).click();
    expect((await update).url()).toContain(`/workspaces/${ws}/products/app/posts/`);
    await expect(edit).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Edited while hidden canary", exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Write a comment", exact: true }).fill("Private management comment canary");
    const comment = page.waitForRequest(req => req.method() === "POST" && req.url().endsWith(`/posts/${post.number}/comments`));
    await page.getByRole("button", { name: "Post comment", exact: true }).click();
    expect((await comment).url()).toContain(`/workspaces/${ws}/products/app/posts/`);
    await expect(page.getByText("Private management comment canary", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page.getByRole("menuitem", { name: "Merge into…", exact: true }).click();
    const merge = page.getByRole("dialog");
    await merge.getByPlaceholder("Search posts in app").fill("Merge search canary");
    await expect(merge.getByText("Merge search canary", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto(`${dashboard}/board/${duplicate.number}`);
    await page.getByRole("button", { name: "Admin", exact: true }).click();
    await page.getByRole("menuitem", { name: "Delete post", exact: true }).click();
    const deletion = page.waitForRequest(req => req.method() === "DELETE" && req.url().endsWith(`/posts/${duplicate.number}`));
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete post", exact: true }).click();
    expect((await deletion).url()).toContain(`/workspaces/${ws}/products/app/posts/`);
    await expect(page).toHaveURL(`${baseURL}${dashboard}/board`);
    await expect(page.getByText("Merge search canary", { exact: true })).toHaveCount(0);
    // Re-enable restores the original request and the edit/comment made privately.
    expect((await page.request.patch(base, { headers: { Origin: baseURL! }, data: { features: { board: true } } })).status()).toBe(200);
    const restored = await page.goto(`/${ws}/app/p/${post.number}`);
    expect(restored!.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Edited while hidden canary", exact: true })).toBeVisible();
    await expect(page.getByText("Private management comment canary", { exact: true })).toBeVisible();
    await page.goto(`${dashboard}/settings`);
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("#portal-features")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px settings overflow`).toBe(true);
    }
  });
  test("nested links follow Board and Roadmap, and public tabs wrap at narrow widths", async ({ page, baseURL }) => {
    const base = `/api/v1/workspaces/${ws}/products/app`;
    const set = async (features: Record<string, boolean>) =>
      expect((await page.request.patch(base, { headers: { Origin: baseURL! }, data: { features } })).status()).toBe(200);
    const [product] = await stack.db.select().from(schema.products)
      .where(and(eq(schema.products.workspaceId, workspaceId), eq(schema.products.slug, "app")));
    const [status] = await stack.db.insert(schema.statuses).values({
      productId: product.id, name: "Nested planned", type: "planned", color: "#123456", position: 90, isPublicRoadmap: true,
    }).returning();
    const [item] = await stack.db.insert(schema.roadmapItems).values({
      productId: product.id, statusId: status.id, publicTitle: "Nested roadmap item", publicDescription: "Roadmap body", isPublic: true, rank: "a1",
    }).returning();
    await stack.db.insert(schema.posts).values({
      productId: product.id, number: 900, title: "Nested linked request", authorId: user.userId, statusId: status.id, roadmapItemId: item.id, voteCount: 3,
    });
    const roadmap = `/${ws}/app/roadmap`;
    const open = async () => {
      await page.goto(roadmap);
      await page.getByRole("button", { name: /Nested roadmap item/ }).click();
      return page.getByRole("dialog");
    };
    const dialog = await open();
    await expect(dialog.getByRole("link", { name: /Nested linked request/ })).toHaveAttribute("href", /\/p\/900/);
    await set({ board: false });
    const hidden = await open();
    await expect(hidden.getByText("Roadmap body", { exact: true })).toBeVisible();
    await expect(hidden.getByText("Related feedback discussions")).toHaveCount(0);
    await expect(page.locator('a[href*="/p/900"]')).toHaveCount(0);
    await expect(page.getByText("Nested linked request")).toHaveCount(0);
    await page.keyboard.press("Escape");
    // FAQ empty-state CTA to the Board exists only while the Board does.
    await set({ board: false, faq: true });
    await page.goto(`/${ws}/app/faq`);
    await expect(page.getByRole("link", { name: "Explore feedback", exact: true })).toHaveCount(0);
    await set({ board: true, roadmap: true, changelog: true, faq: true });
    await page.goto(`/${ws}/app/faq`);
    await expect(page.getByRole("link", { name: "Explore feedback", exact: true })).toHaveAttribute("href", `/${ws}/app`);
    // Many tabs (including signed-in Activity) never overflow the page, and each stays keyboard reachable.
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${ws}/app`);
      const tabs = page.getByRole("navigation", { name: "Tabs" });
      await expect(tabs.getByRole("link")).toHaveCount(5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px portal overflow`).toBe(true);
      await tabs.getByRole("link", { name: "Activity", exact: true }).focus();
      await expect(tabs.getByRole("link", { name: "Activity", exact: true })).toBeFocused();
    }
    // One enabled module needs no tab strip; zero modules show the neutral page (landing test covers copy).
    await page.setViewportSize({ width: 1280, height: 800 });
    await set({ board: false, roadmap: false, changelog: true, faq: false });
    await page.goto(`/${ws}/app/changelog`);
    await expect(page.getByRole("navigation", { name: "Tabs" })).toHaveCount(0);
  });
});
