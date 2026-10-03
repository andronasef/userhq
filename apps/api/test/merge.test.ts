import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Merge API (Plan 03-12)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string; name: string };
  let userA: { cookie: string; userId: string; name: string };
  let userB: { cookie: string; userId: string; name: string };
  let userC: { cookie: string; userId: string; name: string };
  let userD: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let reviewStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    ownerUser = await signedInCookie(testApp.test, {
      name: "Workspace Owner",
      email: "owner@merge.test",
      emailVerified: true,
    });

    userA = await signedInCookie(testApp.test, {
      name: "User A",
      email: "user-a@merge.test",
      emailVerified: true,
    });

    userB = await signedInCookie(testApp.test, {
      name: "User B",
      email: "user-b@merge.test",
      emailVerified: true,
    });

    userC = await signedInCookie(testApp.test, {
      name: "User C",
      email: "user-c@merge.test",
      emailVerified: true,
    });

    userD = await signedInCookie(testApp.test, {
      name: "User D",
      email: "user-d@merge.test",
      emailVerified: true,
    });

    wsSlug = "ws-merge-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Merge Test Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "merge-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        name: "Merge Product",
        slug: prodSlug,
        accentColor: "#2563EB",
      })
      .returning();
    prodId = prod.id;

    for (let i = 0; i < SEEDED_STATUSES.length; i++) {
      const s = SEEDED_STATUSES[i];
      const [inserted] = await testApp.db
        .insert(schema.statuses)
        .values({
          productId: prodId,
          name: s.name,
          color: s.color,
          type: s.type,
          position: i,
          isDefault: s.isDefault,
        })
        .returning();
      if (s.isDefault) {
        reviewStatusId = inserted.id;
      }
    }
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: merging a duplicate moves votes and comments and redirects", async () => {
    // Dup post (number 1): created by userA, voters A & B; comment by C
    const [dupPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Duplicate Dark Mode Request",
        description: "Please add dark mode to the app",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 2,
      })
      .returning();

    await testApp.db.insert(schema.votes).values([
      { postId: dupPost.id, userId: userA.userId },
      { postId: dupPost.id, userId: userB.userId },
    ]);

    const commentTimestamp = new Date("2026-05-01T12:00:00Z");
    const [commentC] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: dupPost.id,
        authorId: userC.userId,
        body: "I would love dark mode too!",
        createdAt: commentTimestamp,
      })
      .returning();

    // Target post (number 2): created by userB, voters B & D
    const [targetPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 2,
        title: "Dark Theme Support",
        description: "Night mode option in settings",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 2,
      })
      .returning();

    await testApp.db.insert(schema.votes).values([
      { postId: targetPost.id, userId: userB.userId },
      { postId: targetPost.id, userId: userD.userId },
    ]);

    // Admin merges dup into target
    const mergeRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${dupPost.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: targetPost.number });

    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body).toEqual({
      number: targetPost.number,
      slug: "dark-theme-support",
      voteCount: 3, // voters A, B, D (B counted once!)
    });

    // Check target timeline contains C's comment with original createdAt
    const targetPortalRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${targetPost.number}`);
    expect(targetPortalRes.status).toBe(200);
    expect(targetPortalRes.body.kind).toBe("post");
    expect(targetPortalRes.body.post.voteCount).toBe(3);

    const timelineComments = targetPortalRes.body.timeline.filter(
      (item: any) => item.kind === "comment"
    );
    expect(timelineComments.length).toBe(1);
    expect(timelineComments[0].comment.id).toBe(commentC.id);
    expect(timelineComments[0].comment.body).toBe("I would love dark mode too!");
    expect(timelineComments[0].comment.createdAt).toBe(commentTimestamp.toISOString());

    // GET dup from portal -> kind redirect with target number
    const dupPortalRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${dupPost.number}`);
    expect(dupPortalRes.status).toBe(200);
    expect(dupPortalRes.body.kind).toBe("redirect");
    expect(dupPortalRes.body.number).toBe(targetPost.number);

    // GET dup from admin API -> kind redirect with target number
    const dupAdminRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${dupPost.number}`)
      .set("Cookie", ownerUser.cookie);
    expect(dupAdminRes.status).toBe(200);
    expect(dupAdminRes.body.kind).toBe("redirect");
    expect(dupAdminRes.body.number).toBe(targetPost.number);
  });

  it("bulk merge keep K with [X, Y]: combines votes, redirects X and Y to K", async () => {
    // Post K (number 10): voters [A]
    const [postK] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 10,
        title: "Export to CSV",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postK.id, userId: userA.userId });

    // Post X (number 11): voters [B, C]
    const [postX] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 11,
        title: "CSV Export feature",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 2,
      })
      .returning();
    await testApp.db.insert(schema.votes).values([
      { postId: postX.id, userId: userB.userId },
      { postId: postX.id, userId: userC.userId },
    ]);

    // Post Y (number 12): voters [A, C, D]
    const [postY] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 12,
        title: "Download data as spreadsheet",
        statusId: reviewStatusId,
        authorId: userC.userId,
        voteCount: 3,
      })
      .returning();
    await testApp.db.insert(schema.votes).values([
      { postId: postY.id, userId: userA.userId },
      { postId: postY.id, userId: userC.userId },
      { postId: postY.id, userId: userD.userId },
    ]);

    const bulkRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        keepNumber: postK.number,
        mergeNumbers: [postX.number, postY.number],
      });

    expect(bulkRes.status).toBe(200);
    // Distinct voters: A, B, C, D = 4
    expect(bulkRes.body.voteCount).toBe(4);

    // Both X and Y redirect to K
    const getX = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postX.number}`);
    expect(getX.body).toEqual({ kind: "redirect", number: postK.number, slug: "export-to-csv" });

    const getY = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postY.number}`);
    expect(getY.body).toEqual({ kind: "redirect", number: postK.number, slug: "export-to-csv" });
  });

  it("flattens redirect chains: post Z merged into X points straight to K when X merges into K", async () => {
    // Post K (number 20)
    const [postK] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 20,
        title: "SSO Integration",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postK.id, userId: userA.userId });

    // Post X (number 21)
    const [postX] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 21,
        title: "SAML and Okta SSO",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postX.id, userId: userB.userId });

    // Post Z (number 22) merged previously into X
    const [postZ] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 22,
        title: "Okta Login",
        statusId: reviewStatusId,
        authorId: userC.userId,
        voteCount: 0,
        mergedIntoId: postX.id,
      })
      .returning();

    // Now merge X into K
    const mergeRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postX.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: postK.number });
    expect(mergeRes.status).toBe(200);

    // Z must now redirect directly to K, not X
    const getZ = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postZ.number}`);
    expect(getZ.body).toEqual({ kind: "redirect", number: postK.number, slug: "sso-integration" });

    const [zRow] = await testApp.db
      .select({ mergedIntoId: schema.posts.mergedIntoId })
      .from(schema.posts)
      .where(eq(schema.posts.id, postZ.id));
    expect(zRow.mergedIntoId).toBe(postK.id);
  });

  it("threaded comments (parent + 2 replies) move to target with parent links intact", async () => {
    const [target] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 30,
        title: "Webhooks V2",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: target.id, userId: userA.userId });

    const [dup] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 31,
        title: "Webhook payloads",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: dup.id, userId: userB.userId });

    // Parent comment on dup
    const [parentComment] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: dup.id,
        authorId: userA.userId,
        body: "Can we get HMAC signatures on webhooks?",
        createdAt: new Date("2026-05-02T10:00:00Z"),
      })
      .returning();

    // Two replies to parent
    const [reply1] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: dup.id,
        parentId: parentComment.id,
        authorId: userB.userId,
        body: "Yes, standard sha256 headers please.",
        createdAt: new Date("2026-05-02T11:00:00Z"),
      })
      .returning();

    const [reply2] = await testApp.db
      .insert(schema.comments)
      .values({
        postId: dup.id,
        parentId: parentComment.id,
        authorId: userC.userId,
        body: "+1 for sha256 HMAC",
        createdAt: new Date("2026-05-02T12:00:00Z"),
      })
      .returning();

    const mergeRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${dup.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: target.number });
    expect(mergeRes.status).toBe(200);

    // Verify all comments moved to target post in db
    const moved = await testApp.db
      .select({ id: schema.comments.id, postId: schema.comments.postId, parentId: schema.comments.parentId })
      .from(schema.comments)
      .where(inArray(schema.comments.id, [parentComment.id, reply1.id, reply2.id]));

    expect(moved.every((c) => c.postId === target.id)).toBe(true);
    const parentRow = moved.find((c) => c.id === parentComment.id);
    const reply1Row = moved.find((c) => c.id === reply1.id);
    const reply2Row = moved.find((c) => c.id === reply2.id);
    expect(parentRow?.parentId).toBeNull();
    expect(reply1Row?.parentId).toBe(parentComment.id);
    expect(reply2Row?.parentId).toBe(parentComment.id);

    // Verify target timeline has parent with its replies
    const targetRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${target.number}`);
    expect(targetRes.body.timeline[0].kind).toBe("comment");
    expect(targetRes.body.timeline[0].comment.id).toBe(parentComment.id);
    expect(targetRes.body.timeline[0].replies.length).toBe(2);
    expect(targetRes.body.timeline[0].replies[0].id).toBe(reply1.id);
    expect(targetRes.body.timeline[0].replies[1].id).toBe(reply2.id);
  });

  it("merging duplicate with only author vote and no comments succeeds cleanly", async () => {
    const [target] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 40,
        title: "API rate limiting",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: target.id, userId: userA.userId });

    const [dup] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 41,
        title: "Throttling limits",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: dup.id, userId: userB.userId });

    const mergeRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${dup.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: target.number });

    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.voteCount).toBe(2);

    const targetRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${target.number}`);
    expect(targetRes.body.timeline.length).toBe(0);
  });

  it("validation: self merge, foreign product, deleted target, or keep in mergeNumbers returns 400 merge_target_invalid", async () => {
    const [livePost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 50,
        title: "Live post for validation",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: livePost.id, userId: userA.userId });

    const [deletedPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 51,
        title: "Deleted post",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 1,
        deletedAt: new Date(),
      })
      .returning();

    // 1. Self merge
    const selfRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${livePost.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: livePost.number });
    expect(selfRes.status).toBe(400);
    expect(selfRes.body.code).toBe("merge_target_invalid");

    // 2. Foreign product / non-existent number
    const nonExistentRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${livePost.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: 99999 });
    expect(nonExistentRes.status).toBe(400);
    expect(nonExistentRes.body.code).toBe("merge_target_invalid");

    // 3. Merging into a deleted post
    const intoDeletedRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${livePost.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: deletedPost.number });
    expect(intoDeletedRes.status).toBe(400);
    expect(intoDeletedRes.body.code).toBe("merge_target_invalid");

    // 4. Bulk merge with keep in mergeNumbers
    const bulkSelfRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        keepNumber: livePost.number,
        mergeNumbers: [livePost.number],
      });
    expect(bulkSelfRes.status).toBe(400);
    expect(bulkSelfRes.body.code).toBe("merge_target_invalid");
  });

  it("validation: duplicate already deleted or merged returns 404 post_not_found", async () => {
    const [liveTarget] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 60,
        title: "Live Target Post",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: liveTarget.id, userId: userA.userId });

    const [alreadyDeleted] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 61,
        title: "Already deleted post",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 1,
        deletedAt: new Date(),
      })
      .returning();

    const delRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${alreadyDeleted.number}/merge`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetNumber: liveTarget.number });
    expect(delRes.status).toBe(404);
    expect(delRes.body.code).toBe("post_not_found");
  });

  it("two concurrent opposite merges X->Y and Y->X: exactly one succeeds, no deadlock", async () => {
    const [postX] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 70,
        title: "Race post X",
        statusId: reviewStatusId,
        authorId: userA.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postX.id, userId: userA.userId });

    const [postY] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 71,
        title: "Race post Y",
        statusId: reviewStatusId,
        authorId: userB.userId,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postY.id, userId: userB.userId });

    // Send opposite merges concurrently
    const [res1, res2] = await Promise.allSettled([
      request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postX.number}/merge`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ targetNumber: postY.number }),
      request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postY.number}/merge`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ targetNumber: postX.number }),
    ]);

    expect(res1.status).toBe("fulfilled");
    expect(res2.status).toBe("fulfilled");

    const r1 = (res1 as PromiseFulfilledResult<request.Response>).value;
    const r2 = (res2 as PromiseFulfilledResult<request.Response>).value;

    const statuses = [r1.status, r2.status];
    // Exactly one must be 200 (succeeded), the other either 400 or 404 (failed cleanly without 500 or deadlock!)
    expect(statuses).toContain(200);
    const failedStatus = statuses.find((s) => s !== 200);
    expect([400, 404]).toContain(failedStatus);
  });
});

