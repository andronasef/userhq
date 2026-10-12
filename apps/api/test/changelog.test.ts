import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Changelog Admin API & Tag Seeding (Plan 05-02 Task 1)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string };
  let otherUser: { cookie: string; userId: string };
  let wsSlug: string;
  let wsId: string;
  let otherWsSlug: string;
  let prodSlug: string;
  let prodId: string;

  const validDoc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Exciting new updates shipped today!" }],
      },
    ],
  };

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@changelog.test",
    });

    ownerUser = await signedInCookie(testApp.test, {
      name: "Changelog Admin",
      email: "owner@changelog.test",
      emailVerified: true,
    });

    otherUser = await signedInCookie(testApp.test, {
      name: "Other Tenant Admin",
      email: "other@changelog.test",
      emailVerified: true,
    });

    wsSlug = "ws-changelog-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Changelog Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: ownerUser.userId,
      role: "owner",
    });

    otherWsSlug = "ws-other-changelog";
    const [otherWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: otherWsSlug,
        name: "Other Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: otherWs.id,
      userId: otherUser.userId,
      role: "owner",
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("seeds default changelog tags (New, Improved, Fixed) when product is created", async () => {
    prodSlug = "changelog-product";
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Changelog Product",
        slug: prodSlug,
      });

    expect(createRes.status).toBe(201);

    const [prod] = await testApp.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.slug, prodSlug));
    prodId = prod.id;

    // Verify seeded tags
    const tagsRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/tags`)
      .set("Cookie", ownerUser.cookie);

    expect(tagsRes.status).toBe(200);
    const tagNames = tagsRes.body.map((t: any) => t.name).sort();
    expect(tagNames).toEqual(["Fixed", "Improved", "New"]);
  });

  it("supports tag CRUD: create custom tag and reject duplicates", async () => {
    const createTagRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/tags`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Performance",
        color: "#8B5CF6",
      });

    expect(createTagRes.status).toBe(201);
    expect(createTagRes.body.name).toBe("Performance");
    expect(createTagRes.body.color).toBe("#8B5CF6");
    const newTagId = createTagRes.body.id;

    // Duplicate tag name returns 409
    const dupRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/tags`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "performance", // case-insensitive check
        color: "#123456",
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe("tag_name_taken");

    // Delete the custom tag
    const delRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/tags/${newTagId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delRes.status).toBe(204);
  });

  it("creates a draft changelog entry with null publishedAt", async () => {
    const tagsRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/tags`)
      .set("Cookie", ownerUser.cookie);

    const firstTag = tagsRes.body[0];

    const res = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Version 1.0 Launch",
        summary: "Our major first release with foundational capabilities",
        content: validDoc,
        tagIds: [firstTag.id],
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Version 1.0 Launch");
    expect(res.body.slug).toBe("version-1-0-launch");
    expect(res.body.summary).toBe("Our major first release with foundational capabilities");
    expect(res.body.publishedAt).toBeNull();
    expect(res.body.tags).toHaveLength(1);
    expect(res.body.tags[0].name).toBe(firstTag.name);
  });

  it("auto-deduplicates slugs upon collision (D-15)", async () => {
    const firstRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Dark Mode Support",
        content: validDoc,
      });
    expect(firstRes.status).toBe(201);
    expect(firstRes.body.slug).toBe("dark-mode-support");

    // Second entry with same title
    const secondRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Dark Mode Support",
        content: validDoc,
      });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.slug).toBe("dark-mode-support-2");

    // Third entry with same title
    const thirdRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Dark Mode Support",
        content: validDoc,
      });
    expect(thirdRes.status).toBe(201);
    expect(thirdRes.body.slug).toBe("dark-mode-support-3");
  });

  it("updates draft entry content and summary (debounced auto-save behavior)", async () => {
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Auto Save Draft",
        content: validDoc,
      });
    const entryId = createRes.body.id;

    const updateRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/${entryId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        summary: "Updated draft summary during authoring",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Autosaved body revision." }],
            },
          ],
        },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.summary).toBe("Updated draft summary during authoring");
    expect(updateRes.body.content.content[0].content[0].text).toBe("Autosaved body revision.");
    expect(updateRes.body.publishedAt).toBeNull();
  });

  it("publishes entry with custom/backdated date, unpublishes, and deletes", async () => {
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Historical Release Note",
        content: validDoc,
      });
    const entryId = createRes.body.id;

    // 1. Publish with custom date (D-13)
    const customDate = "2025-11-20T10:00:00.000Z";
    const pubRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/${entryId}/publish`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ publishedAt: customDate });

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.publishedAt).toBe(customDate);

    // 2. Unpublish entry (CHLG-05)
    const unpubRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/${entryId}/unpublish`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(unpubRes.status).toBe(200);
    expect(unpubRes.body.publishedAt).toBeNull();

    // 3. Delete entry (CHLG-06)
    const delRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/${entryId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delRes.status).toBe(204);

    // Verify deleted
    const getRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/${entryId}`)
      .set("Cookie", ownerUser.cookie);

    expect(getRes.status).toBe(404);
  });

  it("enforces tenant isolation: another workspace admin cannot access changelog entry (TenantGuard 404)", async () => {
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Confidential Tenant Entry",
        content: validDoc,
      });
    const entryId = createRes.body.id;

    // otherUser trying to access entry in wsSlug
    const crossRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/changelog/${entryId}`)
      .set("Cookie", otherUser.cookie);

    expect(crossRes.status).toBe(404);
  });
});
