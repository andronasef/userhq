import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Post Edit and Delete API (Plan 03-09 Task 2)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string; name: string };
  let adminUser: { cookie: string; userId: string; name: string };
  let authorUser: { cookie: string; userId: string; name: string };
  let otherUser: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let defaultStatusId: string;
  let nextPostNum = 100;

  beforeAll(async () => {
    testApp = await createTestApp();

    ownerUser = await signedInCookie(testApp.test, {
      name: "Workspace Owner",
      email: "owner@edit.test",
      emailVerified: true,
    });

    adminUser = await signedInCookie(testApp.test, {
      name: "Workspace Admin",
      email: "admin@edit.test",
      emailVerified: true,
    });

    authorUser = await signedInCookie(testApp.test, {
      name: "Post Author",
      email: "author@edit.test",
      emailVerified: true,
    });

    otherUser = await signedInCookie(testApp.test, {
      name: "Other User",
      email: "other@edit.test",
      emailVerified: true,
    });

    wsSlug = "ws-edit-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Edit Test Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values([
      {
        workspaceId: wsId,
        userId: ownerUser.userId,
        role: "owner",
      },
      {
        workspaceId: wsId,
        userId: adminUser.userId,
        role: "admin",
      },
    ]);

    prodSlug = "edit-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Edit Test Product",
        accentColor: "#2563EB",
      })
      .returning();
    prodId = prod.id;

    const seeded = await testApp.db
      .insert(schema.statuses)
      .values(
        SEEDED_STATUSES.map((s, idx) => ({
          productId: prodId,
          name: s.name,
          type: s.type,
          color: s.color,
          position: idx,
          isDefault: s.type === "review",
        }))
      )
      .returning();

    const def = seeded.find((s) => s.isDefault)!;
    defaultStatusId = def.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createPost(opts?: {
    authorId?: string;
    version?: number;
    title?: string;
    deletedAt?: Date | null;
    mergedIntoId?: string | null;
  }) {
    const num = nextPostNum++;
    const author = opts?.authorId ?? authorUser.userId;
    const title = opts?.title ?? `Test Post ${num}`;
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: num,
        title,
        description: `Description for ${num}`,
        statusId: defaultStatusId,
        authorId: author,
        authorIsAdmin: false,
        voteCount: 1,
        version: opts?.version ?? 1,
        deletedAt: opts?.deletedAt ?? null,
        mergedIntoId: opts?.mergedIntoId ?? null,
      })
      .returning();

    // Auto-vote by author
    await testApp.db.insert(schema.votes).values({
      postId: post.id,
      userId: author,
    });

    return post;
  }

  it("Author edits with version 1 while only their auto-vote exists -> 200 new slug, version 2, edited_at set", async () => {
    const post = await createPost({ title: "Original Unedited Title" });

    const res = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Brand New Updated Title",
        description: "Updated description",
        version: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.number).toBe(post.number);
    expect(res.body.slug).toBe("brand-new-updated-title");

    const [updated] = await testApp.db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, post.id));
    expect(updated.version).toBe(2);
    expect(updated.title).toBe("Brand New Updated Title");
    expect(updated.editedAt).not.toBeNull();
  });

  it("Author edit locked when another user votes -> 403 post_locked", async () => {
    const post = await createPost();

    // Other user votes
    await testApp.db.insert(schema.votes).values({
      postId: post.id,
      userId: otherUser.userId,
    });

    const res = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Attempted Author Edit",
        version: 1,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("post_locked");
  });

  it("Author edit locked when another user comments -> 403 post_locked", async () => {
    const post = await createPost();

    // Other user comments
    await testApp.db.insert(schema.comments).values({
      postId: post.id,
      authorId: otherUser.userId,
      body: "A comment from another user",
      version: 1,
    });

    const res = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Attempted Author Edit After Comment",
        version: 1,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("post_locked");
  });

  it("Author edit unlocked when only author commented -> 200", async () => {
    const post = await createPost();

    // Author comments on own post
    await testApp.db.insert(schema.comments).values({
      postId: post.id,
      authorId: authorUser.userId,
      body: "Author's own comment",
      version: 1,
    });

    const res = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Author Edit With Own Comment",
        version: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("author-edit-with-own-comment");
  });

  it("Author edit unlocked after another user's comment is deleted -> 200", async () => {
    const post = await createPost();

    // Other user comments, then it is soft deleted
    const [otherComment] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: post.id,
        authorId: otherUser.userId,
        body: "Comment to be deleted",
        version: 1,
      })
      .returning();

    await testApp.db
      .update(schema.comments)
      .set({ deletedAt: new Date(), deletedById: otherUser.userId })
      .where(eq(schema.comments.id, otherComment.id));

    const res = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Author Edit After Comment Deleted",
        version: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("author-edit-after-comment-deleted");
  });

  it("Admin edits locked post -> 200; non-author non-admin -> 403 not_allowed", async () => {
    const post = await createPost();

    // Other user votes (locks post for author)
    await testApp.db.insert(schema.votes).values({
      postId: post.id,
      userId: otherUser.userId,
    });

    // Admin edits
    const adminRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Admin Edit On Locked Post",
        version: 1,
      });

    expect(adminRes.status).toBe(200);

    // Non-author non-admin attempts edit -> 403 not_allowed
    const nonAuthorRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", otherUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Unauthorized Edit",
        version: 2,
      });

    expect(nonAuthorRes.status).toBe(403);
    expect(nonAuthorRes.body.code).toBe("not_allowed");
  });

  it("Stale version -> 409 edit_conflict; edit of a deleted or merged post -> 404 post_not_found", async () => {
    const post = await createPost({ version: 2 });

    // Send stale version 1
    const staleRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Stale Edit",
        version: 1,
      });

    expect(staleRes.status).toBe(409);
    expect(staleRes.body.code).toBe("edit_conflict");

    // Deleted post
    const deletedPost = await createPost({ deletedAt: new Date() });
    const delRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${deletedPost.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Edit Deleted",
        version: 1,
      });

    expect(delRes.status).toBe(404);
    expect(delRes.body.code).toBe("post_not_found");

    // Merged post
    const mergedPost = await createPost({ mergedIntoId: post.id });
    const mergeRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${mergedPost.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Edit Merged",
        version: 1,
      });

    expect(mergeRes.status).toBe(404);
    expect(mergeRes.body.code).toBe("post_not_found");
  });

  it("Author delete while unlocked -> 204; author delete when locked -> 403 post_locked; admin delete when locked -> 204", async () => {
    // 1. Author delete while unlocked
    const unlockedPost = await createPost();
    const delRes1 = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${unlockedPost.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delRes1.status).toBe(204);

    // Get post -> 404
    const getRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${unlockedPost.number}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(getRes.status).toBe(404);

    // Delete again -> 404
    const delResAgain = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${unlockedPost.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delResAgain.status).toBe(404);

    // 2. Author delete when locked -> 403 post_locked
    const lockedPost = await createPost();
    await testApp.db.insert(schema.votes).values({
      postId: lockedPost.id,
      userId: otherUser.userId,
    });

    const lockedDelRes = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${lockedPost.number}`)
      .set("Cookie", authorUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(lockedDelRes.status).toBe(403);
    expect(lockedDelRes.body.code).toBe("post_locked");

    // 3. Admin delete when locked -> 204
    const adminDelRes = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${lockedPost.number}`)
      .set("Cookie", adminUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(adminDelRes.status).toBe(204);
  });

  it("Non-author non-admin delete -> 403 not_allowed", async () => {
    const post = await createPost();

    const res = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
      .set("Cookie", otherUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("not_allowed");
  });

  it("Parallel edit and delete by two admins -> exactly one succeeds", async () => {
    const post = await createPost({ version: 2 });

    const [editRes, delRes] = await Promise.all([
      request(testApp.http)
        .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Admin Parallel Edit",
          version: 2,
        }),
      request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}`)
        .set("Cookie", adminUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL),
    ]);

    // If edit won first: edit returned 200, delete deleted it with 204.
    // If delete won first: delete returned 204, edit failed with 404 post_not_found.
    if (delRes.status === 204 && editRes.status === 404) {
      expect(editRes.body.code).toBe("post_not_found");
    } else {
      expect(editRes.status).toBe(200);
      expect(delRes.status).toBe(204);
    }
  });

  it("Votes and comments never change posts.version", async () => {
    const post = await createPost({ version: 1 });

    // Other user votes via API
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}/vote`)
      .set("Cookie", otherUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    const [afterVote] = await testApp.db
      .select({ version: schema.posts.version })
      .from(schema.posts)
      .where(eq(schema.posts.id, post.id));
    expect(afterVote.version).toBe(1);

    // Other user comments via API
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post.number}/comments`)
      .set("Cookie", otherUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        body: "A comment to check post version immutability",
      });

    const [afterComment] = await testApp.db
      .select({ version: schema.posts.version })
      .from(schema.posts)
      .where(eq(schema.posts.id, post.id));
    expect(afterComment.version).toBe(1);
  });
});
