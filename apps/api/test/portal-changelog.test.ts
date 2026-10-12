import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Public Portal Changelog Feed & Permalink API (Plan 05-02 Task 1)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;

  let publishedSlugOlder: string;
  let publishedSlugNewer: string;
  let draftSlug: string;

  const validDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Release notes text content here." }],
      },
    ],
  };

  beforeAll(async () => {
    testApp = await createTestApp();

    adminUser = await signedInCookie(testApp.test, {
      name: "Portal Changelog Admin",
      email: "portal-admin@changelog.test",
      emailVerified: true,
    });

    wsSlug = "ws-portal-chlg";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Portal Changelog Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "portal-chlg-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Portal Changelog Product",
      })
      .returning();
    prodId = prod.id;

    // Seed tags
    const [tag] = await testApp.db
      .insert(schema.changelogTags)
      .values({
        productId: prodId,
        name: "New Feature",
        color: "#10B981",
      })
      .returning();

    // 1. Older published entry (published on 2026-01-01)
    publishedSlugOlder = "older-release";
    const [olderEntry] = await testApp.db
      .insert(schema.changelogEntries)
      .values({
        productId: prodId,
        title: "Older Release",
        slug: publishedSlugOlder,
        summary: "Summary of older release",
        content: validDoc,
        publishedAt: new Date("2026-01-01T12:00:00Z"),
      })
      .returning();

    await testApp.db.insert(schema.changelogEntryTags).values({
      entryId: olderEntry.id,
      tagId: tag.id,
      productId: prodId,
    });

    // 2. Newer published entry (published on 2026-02-01)
    publishedSlugNewer = "newer-release";
    const [newerEntry] = await testApp.db
      .insert(schema.changelogEntries)
      .values({
        productId: prodId,
        title: "Newer Release",
        slug: publishedSlugNewer,
        summary: "Summary of newer release",
        content: validDoc,
        publishedAt: new Date("2026-02-01T12:00:00Z"),
      })
      .returning();

    await testApp.db.insert(schema.changelogEntryTags).values({
      entryId: newerEntry.id,
      tagId: tag.id,
      productId: prodId,
    });

    // 3. Draft entry (publishedAt: null) - MUST NOT LEAK (CHLG-04)
    draftSlug = "secret-unreleased-feature";
    await testApp.db.insert(schema.changelogEntries).values({
      productId: prodId,
      title: "Secret Unreleased Feature",
      slug: draftSlug,
      summary: "Under NDA internal release",
      content: validDoc,
      publishedAt: null,
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("returns public feed ordered newest first and strictly omits drafts (CHLG-07, CHLG-04)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);

    // Newest first
    expect(res.body.entries[0].slug).toBe(publishedSlugNewer);
    expect(res.body.entries[1].slug).toBe(publishedSlugOlder);

    // Draft is NOT in the feed
    const slugs = res.body.entries.map((e: any) => e.slug);
    expect(slugs).not.toContain(draftSlug);

    // Includes tags
    expect(res.body.entries[0].tags).toHaveLength(1);
    expect(res.body.entries[0].tags[0].name).toBe("New Feature");
  });

  it("fetches single published changelog entry by permalink slug (CHLG-08)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog/${publishedSlugNewer}`);

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe(publishedSlugNewer);
    expect(res.body.title).toBe("Newer Release");
    expect(res.body.tags).toHaveLength(1);
    expect(res.body.tags[0].name).toBe("New Feature");
  });

  it("strictly returns 404 when querying draft entry by slug (draft isolation, CHLG-04, T-05-04)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog/${draftSlug}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });

  it("returns 404 for nonexistent slug", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog/totally-nonexistent-slug`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when workspace is suspended", async () => {
    await testApp.db
      .update(schema.workspaces)
      .set({ suspendedAt: new Date() })
      .where(eq(schema.workspaces.id, wsId));

    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/changelog`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("workspace_suspended");

    // Revert suspension
    await testApp.db
      .update(schema.workspaces)
      .set({ suspendedAt: null })
      .where(eq(schema.workspaces.id, wsId));
  });
});
