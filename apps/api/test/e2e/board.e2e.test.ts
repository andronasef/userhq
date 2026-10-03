import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { eq, inArray } from "drizzle-orm";
import {
  openStack,
  mintSession,
  seedWorkspaceRows,
  createProductViaApi,
  apiCall,
  baseUrl,
  type StackContext,
} from "../support/stack.js";

describe("Board E2E (Plan 03-04)", () => {
  let stack: StackContext;
  let wsSlug: string;
  let wsId: string;
  let pSlug: string;
  let userCookie: string;
  let userId: string;
  let userName: string;
  let userEmail: string;
  const userIds: string[] = [];

  beforeAll(async () => {
    stack = await openStack();
    const rand = randomBytes(4).toString("hex");
    userName = `Author ${rand}`;
    userEmail = `author-${rand}@example.com`;
    const user = await mintSession(stack, {
      name: userName,
      email: userEmail,
      emailVerified: true,
    });
    userCookie = user.cookie;
    userId = user.userId;
    userIds.push(userId);

    wsSlug = `ws-${rand}`;
    const ws = await seedWorkspaceRows(stack, {
      userId,
      name: `Workspace ${rand}`,
      slug: wsSlug,
      role: "owner",
    });
    wsId = ws.id;

    pSlug = `prod-${rand}`;
    await createProductViaApi(userCookie, wsSlug, {
      name: `Product ${rand}`,
      slug: pSlug,
    });

    const [prodRow] = await stack.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, pSlug));
    await stack.db
      .delete(schema.categories)
      .where(eq(schema.categories.productId, prodRow.id));
  });

  afterAll(async () => {
    if (stack) {
      if (wsId) {
        const prodRows = await stack.db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(eq(schema.products.workspaceId, wsId));
        const prodIds = prodRows.map((p) => p.id);
        if (prodIds.length > 0) {
          const postRows = await stack.db
            .select({ id: schema.posts.id })
            .from(schema.posts)
            .where(inArray(schema.posts.productId, prodIds));
          const postIds = postRows.map((p) => p.id);
          if (postIds.length > 0) {
            await stack.db
              .delete(schema.votes)
              .where(inArray(schema.votes.postId, postIds));
            await stack.db
              .delete(schema.posts)
              .where(inArray(schema.posts.id, postIds));
          }

          await stack.db
            .delete(schema.statuses)
            .where(inArray(schema.statuses.productId, prodIds));

          await stack.db
            .delete(schema.products)
            .where(inArray(schema.products.id, prodIds));
        }

        await stack.db
          .delete(schema.workspaceMembers)
          .where(eq(schema.workspaceMembers.workspaceId, wsId));
        await stack.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.id, wsId));
      }

      if (userIds.length > 0) {
        await stack.db
          .delete(schema.session)
          .where(inArray(schema.session.userId, userIds));
        await stack.db
          .delete(schema.account)
          .where(inArray(schema.account.userId, userIds));
        await stack.db
          .delete(schema.user)
          .where(inArray(schema.user.id, userIds));
      }

      await stack.close();
    }
  });

  it("tracer: a post created through the API renders on its permalink and on the board", async () => {
    const postTitle = `Dark mode support ${randomBytes(3).toString("hex")}`;
    const postDesc = "Please add dark mode so it does not hurt our eyes at night.";

    const createRes = await apiCall(
      `/api/v1/portal/${wsSlug}/${pSlug}/posts`,
      {
        method: "POST",
        cookie: userCookie,
        body: {
          title: postTitle,
          description: postDesc,
        },
      }
    );

    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.number).toBe(1);
    expect(created.slug).toBeDefined();

    // Fetch permalink HTML
    const permalinkRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`
    );
    expect(permalinkRes.status).toBe(200);
    const permalinkHtml = await permalinkRes.text();
    expect(permalinkHtml).toContain(postTitle);
    expect(permalinkHtml).toContain(userName);
    expect(permalinkHtml).toContain("Under Review");
    expect(permalinkHtml).toContain(postDesc);

    // Fetch board HTML
    const boardRes = await fetch(`${baseUrl}/${wsSlug}/${pSlug}`);
    expect(boardRes.status).toBe(200);
    const boardHtml = await boardRes.text();
    expect(boardHtml).toContain(postTitle);
    expect(boardHtml).toContain("1 vote");
  });

  it("canonical 301 redirects: bare number and stale slug return 301 to canonical path", async () => {
    const postTitle = `Canonical test ${randomBytes(3).toString("hex")}`;
    const createRes = await apiCall(
      `/api/v1/portal/${wsSlug}/${pSlug}/posts`,
      {
        method: "POST",
        cookie: userCookie,
        body: {
          title: postTitle,
          description: "Testing canonical redirect status 301.",
        },
      }
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    const canonicalPath = `/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`;

    // Bare number /p/{n}
    const resBare = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}`,
      { redirect: "manual" }
    );
    expect(resBare.status).toBe(301);
    const bareLocation = resBare.headers.get("location");
    expect(bareLocation).toBeDefined();
    expect(new URL(bareLocation!, baseUrl).pathname).toBe(canonicalPath);

    // Stale / wrong slug /p/{n}-wrong-slug
    const resWrong = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-wrong-slug`,
      { redirect: "manual" }
    );
    expect(resWrong.status).toBe(301);
    const wrongLocation = resWrong.headers.get("location");
    expect(wrongLocation).toBeDefined();
    expect(new URL(wrongLocation!, baseUrl).pathname).toBe(canonicalPath);
  });

  it("merged post returns 301 to target post's canonical permalink", async () => {
    // Target post
    const targetRes = await apiCall(`/api/v1/portal/${wsSlug}/${pSlug}/posts`, {
      method: "POST",
      cookie: userCookie,
      body: {
        title: `Target Post ${randomBytes(3).toString("hex")}`,
        description: "Target post description.",
      },
    });
    expect(targetRes.status).toBe(201);
    const target = await targetRes.json();

    // Source post to be merged
    const sourceRes = await apiCall(`/api/v1/portal/${wsSlug}/${pSlug}/posts`, {
      method: "POST",
      cookie: userCookie,
      body: {
        title: `Source Post ${randomBytes(3).toString("hex")}`,
        description: "Source post description.",
      },
    });
    expect(sourceRes.status).toBe(201);
    const source = await sourceRes.json();

    // Look up target post row ID in database
    const [targetRow] = await stack.db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(eq(schema.posts.number, target.number))
      .limit(1);

    // Set mergedIntoId on source post
    await stack.db
      .update(schema.posts)
      .set({ mergedIntoId: targetRow.id })
      .where(eq(schema.posts.number, source.number));

    // Request source permalink with manual redirect
    const resMerged = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${source.number}-${source.slug}`,
      { redirect: "manual" }
    );
    expect(resMerged.status).toBe(301);
    const mergedLocation = resMerged.headers.get("location");
    expect(mergedLocation).toBeDefined();
    expect(new URL(mergedLocation!, baseUrl).pathname).toBe(
      `/${wsSlug}/${pSlug}/p/${target.number}-${target.slug}`
    );
  });

  it("unknown number, non-numeric ref, and soft-deleted post return 404", async () => {
    const resUnknown = await fetch(`${baseUrl}/${wsSlug}/${pSlug}/p/999999`);
    expect(resUnknown.status).toBe(404);
    const unknownHtml = await resUnknown.text();
    expect(unknownHtml).toContain("Page not found");

    const resNonNumeric = await fetch(`${baseUrl}/${wsSlug}/${pSlug}/p/abc`);
    expect(resNonNumeric.status).toBe(404);
    const nonNumericHtml = await resNonNumeric.text();
    expect(nonNumericHtml).toContain("Page not found");

    // Create a post and soft delete it
    const delPostRes = await apiCall(`/api/v1/portal/${wsSlug}/${pSlug}/posts`, {
      method: "POST",
      cookie: userCookie,
      body: {
        title: `To be deleted ${randomBytes(3).toString("hex")}`,
      },
    });
    expect(delPostRes.status).toBe(201);
    const delPost = await delPostRes.json();

    await stack.db
      .update(schema.posts)
      .set({ deletedAt: new Date() })
      .where(eq(schema.posts.number, delPost.number));

    const resDeleted = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${delPost.number}-${delPost.slug}`
    );
    expect(resDeleted.status).toBe(404);
    const deletedHtml = await resDeleted.text();
    expect(deletedHtml).toContain("Page not found");
  });

  it("renders text safely with no HTML execution and wraps links with rel nofollow", async () => {
    const safeUser = await mintSession(stack, {
      name: "Safe Author",
      email: `safe-${randomBytes(3).toString("hex")}@example.com`,
      emailVerified: true,
    });
    userIds.push(safeUser.userId);

    const safeTitle = `Safe post ${randomBytes(3).toString("hex")}`;
    const safeDesc = `<script>alert(1)</script> **bold** javascript:alert(1) https://example.com/x.`;

    const createRes = await apiCall(`/api/v1/portal/${wsSlug}/${pSlug}/posts`, {
      method: "POST",
      cookie: safeUser.cookie,
      body: {
        title: safeTitle,
        description: safeDesc,
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const res = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`
    );
    expect(res.status).toBe(200);
    const html = await res.text();

    // Check script tag is escaped / rendered as text, not raw script element
    expect(html).not.toContain("<script>alert(1)</script>");
    // Check javascript: is not turned into a link
    expect(html).not.toContain('href="javascript:alert(1)"');
    // Markdown stays literal
    expect(html).toContain("**bold**");
    // Trailing period is excluded from href
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    // Exactly one nofollow link
    const matches = html.match(/rel="nofollow noopener noreferrer"/g) || [];
    expect(matches.length).toBe(1);
  });

  it("privacy canary: author email never appears in board or permalink HTML, and deleted author renders 'Deleted user'", async () => {
    const rand = randomBytes(4).toString("hex");
    const canaryEmail = `canary-${rand}@sensitive-internal-domain.com`;
    const canaryUser = await mintSession(stack, {
      name: `Canary Author ${rand}`,
      email: canaryEmail,
      emailVerified: true,
    });
    userIds.push(canaryUser.userId);

    const createRes = await apiCall(`/api/v1/portal/${wsSlug}/${pSlug}/posts`, {
      method: "POST",
      cookie: canaryUser.cookie,
      body: {
        title: `Canary post ${rand}`,
        description: "Post by temporary canary author",
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    // Fetch permalink HTML
    const permalinkRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`
    );
    expect(permalinkRes.status).toBe(200);
    const permalinkHtml = await permalinkRes.text();
    expect(permalinkHtml).not.toContain(canaryEmail);
    expect(permalinkHtml).toContain(`Canary Author ${rand}`);

    // Fetch board HTML
    const boardRes = await fetch(`${baseUrl}/${wsSlug}/${pSlug}`);
    expect(boardRes.status).toBe(200);
    const boardHtml = await boardRes.text();
    expect(boardHtml).not.toContain(canaryEmail);

    // Soft-delete canary user from DB
    await stack.db
      .update(schema.user)
      .set({ deletedAt: new Date() })
      .where(eq(schema.user.id, canaryUser.userId));

    // Refetch permalink HTML
    const deletedAuthorRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`
    );
    expect(deletedAuthorRes.status).toBe(200);
    const deletedAuthorHtml = await deletedAuthorRes.text();
    expect(deletedAuthorHtml).toContain("Deleted user");
    expect(deletedAuthorHtml).not.toContain(`Canary Author ${rand}`);
  });

  it("signed-out visitor sees New post link pointing to /login?next=/{ws}/{product}?new=1", async () => {
    const boardRes = await fetch(`${baseUrl}/${wsSlug}/${pSlug}`);
    expect(boardRes.status).toBe(200);
    const boardHtml = await boardRes.text();

    const expectedNext = encodeURIComponent(`/${wsSlug}/${pSlug}?new=1`);
    expect(boardHtml).toContain(`/login?next=${expectedNext}`);
  });

  it("permalink has <title>{post title} · {product}</title> and canonical tag", async () => {
    const seoUser = await mintSession(stack, {
      name: "SEO Author",
      email: `seo-${randomBytes(3).toString("hex")}@example.com`,
      emailVerified: true,
    });
    userIds.push(seoUser.userId);

    const postTitle = `SEO test ${randomBytes(3).toString("hex")}`;
    const postDesc = "This is a detailed description of the feature request for metadata tests.";
    const createRes = await apiCall(`/api/v1/portal/${wsSlug}/${pSlug}/posts`, {
      method: "POST",
      cookie: seoUser.cookie,
      body: {
        title: postTitle,
        description: postDesc,
      },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const permalinkRes = await fetch(
      `${baseUrl}/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`
    );
    expect(permalinkRes.status).toBe(200);
    const html = await permalinkRes.text();

    expect(html).toContain(`<title>${postTitle} · `);
    expect(html).toContain(`rel="canonical"`);
    expect(html).toContain(`/${wsSlug}/${pSlug}/p/${created.number}-${created.slug}`);
  });

  it("empty board displays empty state with prompt to share an idea", async () => {
    const emptySlug = `empty-${randomBytes(4).toString("hex")}`;
    const emptyName = `Empty Product ${randomBytes(2).toString("hex")}`;
    await createProductViaApi(userCookie, wsSlug, {
      name: emptyName,
      slug: emptySlug,
    });

    const res = await fetch(`${baseUrl}/${wsSlug}/${emptySlug}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Nothing here yet");
    expect(html).toContain(`Share an idea for ${emptyName}, and others can vote on it.`);
  });
});
