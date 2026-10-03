import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Comments API (Plan 03-08)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let userA: { cookie: string; userId: string; name: string };
  let userB: { cookie: string; userId: string; name: string };
  let userC: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let postNumber: number;

  beforeAll(async () => {
    testApp = await createTestApp();

    userA = await signedInCookie(testApp.test, {
      name: "Author Alice",
      email: "alice@comments.test",
      emailVerified: true,
    });

    userB = await signedInCookie(testApp.test, {
      name: "Commenter Bob",
      email: "bob@comments.test",
      emailVerified: true,
    });

    wsSlug = "ws-comments-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Comments Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: userA.userId,
      role: "owner",
    });

    prodSlug = "comments-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Comments Product",
        accentColor: "#2563EB",
      })
      .returning();
    prodId = prod.id;

    // Seed default 5 statuses
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

    const defaultStatus = seeded.find((s) => s.isDefault)!;

    // Create a post by User A
    const [createdPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Initial Post by Alice",
        description: "Post description for comments testing",
        statusId: defaultStatus.id,
        authorId: userA.userId,
        authorIsAdmin: true,
        voteCount: 1,
      })
      .returning();

    postNumber = createdPost.number;
    userC = await signedInCookie(testApp.test, {
      name: "Visitor Charlie",
      email: "charlie@comments.test",
      emailVerified: true,
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: a signed-in user comments and the post page returns it", async () => {
    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Same here\nPlease" });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.body).toBe("Same here\nPlease");
    expect(commentRes.body.author.name).toBe("Commenter Bob");
    expect(commentRes.body.author.isAdmin).toBe(false);
    expect(commentRes.body.author.email).toBeUndefined();
    expect(commentRes.body.email).toBeUndefined();
    expect(commentRes.body.authorId).toBeUndefined();

    // Verify GET post returns the comment in timeline
    const postRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Cookie", userB.cookie);

    expect(postRes.status).toBe(200);
    expect(postRes.body.kind).toBe("post");
    expect(Array.isArray(postRes.body.timeline)).toBe(true);
    expect(postRes.body.timeline.length).toBe(1);

    const item = postRes.body.timeline[0];
    expect(item.kind).toBe("comment");
    expect(item.comment.body).toBe("Same here\nPlease");
    expect(item.comment.author.name).toBe("Commenter Bob");
    expect(item.comment.author.isAdmin).toBe(false);

    // Verify the JSON contains neither B's email nor B's user ID
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain("bob@comments.test");
    expect(serialized).not.toContain(userB.userId);
  });

  it("handles one-level replies and normalizes reply-to-reply to top-level parent (D-16)", async () => {
    // Post a top-level comment by user A (admin)
    const topRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Admin top-level note", isAdmin: false });

    expect(topRes.status).toBe(201);
    expect(topRes.body.author.isAdmin).toBe(true); // server snapshot from membership
    const topId = topRes.body.id;

    // User B replies to top-level comment
    const reply1Res = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Reply 1 to top-level", parentId: topId, isAdmin: true });

    expect(reply1Res.status).toBe(201);
    expect(reply1Res.body.author.isAdmin).toBe(false); // client cannot spoof isAdmin
    const reply1Id = reply1Res.body.id;

    // User C replies to reply 1 (reply-to-reply) -> should normalize to topId
    const reply2Res = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Reply 2 (reply to reply)", parentId: reply1Id });

    expect(reply2Res.status).toBe(201);
    const reply2Id = reply2Res.body.id;

    // GET post timeline: top comment should have both replies nested under it
    const postRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`)
      .set("Cookie", userB.cookie);

    expect(postRes.status).toBe(200);
    const topItem = postRes.body.timeline.find((t: any) => t.kind === "comment" && t.comment.id === topId);
    expect(topItem).toBeDefined();
    expect(topItem.replies.length).toBe(2);
    expect(topItem.replies[0].id).toBe(reply1Id);
    expect(topItem.replies[1].id).toBe(reply2Id);
  });

  it("returns 404 comment_not_found for unknown or deleted parentId", async () => {
    const unknownParentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Invalid parent", parentId: "00000000-0000-0000-0000-000000000000" });

    expect(unknownParentRes.status).toBe(404);
    expect(unknownParentRes.body.code).toBe("comment_not_found");
  });

  it("enforces edit/delete authorization (author or admin only)", async () => {
    // Create a comment by user B
    const createRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment by Bob to edit/delete" });
    const commentId = createRes.body.id;
    const version = createRes.body.version;

    // User C (non-author, non-admin) attempts to edit -> 403 not_allowed
    const cEditRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Hacked by Charlie", version });
    expect(cEditRes.status).toBe(403);
    expect(cEditRes.body.code).toBe("not_allowed");

    // User C attempts to delete -> 403 not_allowed
    const cDelRes = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(cDelRes.status).toBe(403);
    expect(cDelRes.body.code).toBe("not_allowed");

    // User B (author) edits -> 200, version+1, editedAt set
    const bEditRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Edited by Bob", version });
    expect(bEditRes.status).toBe(200);
    expect(bEditRes.body.body).toBe("Edited by Bob");
    expect(bEditRes.body.version).toBe(version + 1);
    expect(bEditRes.body.editedAt).toBeTruthy();

    // User A (workspace admin) edits Bob's comment -> 200
    const aEditRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Moderated by Alice", version: bEditRes.body.version });
    expect(aEditRes.status).toBe(200);
    expect(aEditRes.body.body).toBe("Moderated by Alice");
    expect(aEditRes.body.version).toBe(version + 2);

    // Stale version edit -> 409 edit_conflict
    const conflictRes = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Stale edit attempt", version: version });
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.code).toBe("edit_conflict");
  });

  it("handles deleted comments, stubs lifecycle, and prevents double delete", async () => {
    // Create a standalone comment by user B with no replies
    const soloRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Solo comment to delete" });
    const soloId = soloRes.body.id;

    // Delete solo comment -> 204
    const delSolo = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${soloId}`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delSolo.status).toBe(204);

    // Second delete -> 404 comment_not_found
    const delAgain = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${soloId}`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delAgain.status).toBe(404);
    expect(delAgain.body.code).toBe("comment_not_found");

    // Patch a deleted comment -> 404 comment_not_found
    const patchDel = await request(testApp.http)
      .patch(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${soloId}`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Zombie edit", version: 1 });
    expect(patchDel.status).toBe(404);
    expect(patchDel.body.code).toBe("comment_not_found");

    // GET post timeline: solo comment should completely vanish (no replies)
    const postRes1 = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);
    const soloFound = postRes1.body.timeline.find((t: any) => t.id === soloId || t.comment?.id === soloId);
    expect(soloFound).toBeUndefined();

    // Now test stub lifecycle:
    // Create parent comment with 1 reply
    const parentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Parent comment for stub testing" });
    const parentId = parentRes.body.id;

    const childRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Child reply to keep parent alive as stub", parentId });
    const childId = childRes.body.id;

    // Delete parent comment: has 1 visible reply -> should become a stub
    const delParent = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${parentId}`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delParent.status).toBe(204);

    const postRes2 = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);
    const stubItem = postRes2.body.timeline.find((t: any) => t.id === parentId);
    expect(stubItem).toBeDefined();
    expect(stubItem.kind).toBe("stub");
    expect(stubItem.body).toBeUndefined();
    expect(stubItem.author).toBeUndefined();
    expect(stubItem.replies.length).toBe(1);
    expect(stubItem.replies[0].id).toBe(childId);

    // Delete child reply -> stub now has 0 visible replies -> stub vanishes!
    const delChild = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${childId}`)
      .set("Cookie", userC.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delChild.status).toBe(204);

    const postRes3 = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);
    const stubFoundAfter = postRes3.body.timeline.find((t: any) => t.id === parentId || t.comment?.id === parentId);
    expect(stubFoundAfter).toBeUndefined();
  });

  it("proves votes and new comments do not bump existing comment version", async () => {
    const cRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Version stability test" });
    const cId = cRes.body.id;
    const initialVersion = cRes.body.version;

    // Vote on post
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/votes`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    // Add another comment on post
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Unrelated comment" });

    // Check comment version via GET post
    const postRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);
    const found = postRes.body.timeline.find((t: any) => t.kind === "comment" && t.comment.id === cId);
    expect(found.comment.version).toBe(initialVersion);
  });
});
