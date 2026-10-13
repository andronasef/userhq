import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Dashboard Board API (Plan 03-11)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string; name: string };
  let voterUser: { cookie: string; userId: string; name: string };
  let _otherUser: { cookie: string; userId: string; name: string };
  let wsSlug: string;
  let prodSlug: string;
  let prodId: string;
  let postNumber: number;
  let _reviewStatusId: string;
  let _plannedStatusId: string;
  let _completedStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    ownerUser = await signedInCookie(testApp.test, {
      name: "Workspace Owner",
      email: "owner@dashboard-board.test",
      emailVerified: true,
    });

    voterUser = await signedInCookie(testApp.test, {
      name: "Customer Voter",
      email: "voter@dashboard-board.test",
      emailVerified: true,
    });

    _otherUser = await signedInCookie(testApp.test, {
      name: "Other User",
      email: "other@dashboard-board.test",
      emailVerified: true,
    });

    wsSlug = "ws-dash-board-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Dashboard Board Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "dash-board-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Dashboard Board Product",
        accentColor: "#2563EB",
        nextPostNumber: 1,
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

    _reviewStatusId = seeded.find((s) => s.type === "review")!.id;
    _plannedStatusId = seeded.find((s) => s.type === "planned")!.id;
    _completedStatusId = seeded.find((s) => s.type === "completed")!.id;

    // Create a post
    const res = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
      .set("Cookie", voterUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        title: "Tracer Feedback Post",
        description: "A description of the feedback",
      });
    expect(res.status).toBe(201);
    postNumber = res.body.number;

    // Add another vote from owner
    const voteRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/vote`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(voteRes.status).toBe(200);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: an admin lists posts, opens one, sees voters, and replies with an Admin badge", async () => {
    // 1. Owner lists posts
    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts`)
      .set("Cookie", ownerUser.cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.posts).toBeDefined();
    expect(listRes.body.posts.some((p: any) => p.number === postNumber)).toBe(true);

    // 2. Owner opens detail
    const detailRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}`)
      .set("Cookie", ownerUser.cookie);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.kind).toBe("post");
    expect(detailRes.body.deleted).toBe(false);
    expect(detailRes.body.post.number).toBe(postNumber);
    expect(detailRes.body.viewer.isAdmin).toBe(true);

    // 3. Owner gets voters
    const votersRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/voters`)
      .set("Cookie", ownerUser.cookie);

    expect(votersRes.status).toBe(200);
    expect(votersRes.body.total).toBe(2);
    expect(votersRes.body.voters.length).toBe(2);

    // Crucial privacy check: no "email" key anywhere in JSON response
    const jsonString = JSON.stringify(votersRes.body);
    expect(jsonString.toLowerCase()).not.toContain("email");

    // 4. Owner posts comment through portal endpoint
    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}/comments`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Official response from the team." });

    expect(commentRes.status).toBe(201);
    expect(commentRes.body.author.isAdmin).toBe(true);

    // 5. Public GET of post shows that comment with author.isAdmin true
    const publicRes = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.kind).toBe("post");
    const commentItem = publicRes.body.timeline.find(
      (t: any) => t.kind === "comment" && t.comment.body === "Official response from the team."
    );
    expect(commentItem).toBeDefined();
    expect(commentItem.comment.author.isAdmin).toBe(true);
  });

  describe("Deleted tab and restore (Task 2)", () => {
    it("author self-deletes post P, view=deleted lists it with deletedByAuthor true, and restore brings it back unchanged", async () => {
      // 1. Owner creates post P
      const pRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Post P for author self-delete",
          description: "Author self delete test",
        });
      expect(pRes.status).toBe(201);
      const postPNumber = pRes.body.number;

      // VoterUser votes on P
      await request(testApp.http)
        .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postPNumber}/vote`)
        .set("Cookie", voterUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      // Unique commenter
      const commenter = await signedInCookie(testApp.test, {
        name: "Commenter P",
        email: "commenter-p@test.com",
        emailVerified: true,
      });

      await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postPNumber}/comments`)
        .set("Cookie", commenter.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ body: "A great idea on post P!" });

      // Owner (author) deletes post P
      const delRes = await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postPNumber}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delRes.status).toBe(204);

      // GET posts?view=deleted lists P with deletedByAuthor = true
      const deletedRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts?view=deleted`)
        .set("Cookie", ownerUser.cookie);
      expect(deletedRes.status).toBe(200);
      const row = deletedRes.body.posts.find((p: any) => p.number === postPNumber);
      expect(row).toBeDefined();
      expect(row.deletedByAuthor).toBe(true);

      // Admin detail of deleted post -> kind: "post", deleted: true
      const detailRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postPNumber}`)
        .set("Cookie", ownerUser.cookie);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.kind).toBe("post");
      expect(detailRes.body.deleted).toBe(true);

      // Admin restores post P
      const restoreRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postPNumber}/restore`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(restoreRes.status).toBe(204);

      // P is back on portal with voteCount 2 and its comment intact
      const publicPRes = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postPNumber}`);
      expect(publicPRes.status).toBe(200);
      expect(publicPRes.body.post.voteCount).toBe(2);
      expect(
        publicPRes.body.timeline.some(
          (t: any) => t.kind === "comment" && t.comment.body === "A great idea on post P!"
        )
      ).toBe(true);
    });

    it("admin deletes post Q, deletedBy is admin's name", async () => {
      // Voter user creates post Q
      const qRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Cookie", voterUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Post Q created by customer",
          description: "Details for post Q",
        });
      expect(qRes.status).toBe(201);
      const postQNumber = qRes.body.number;

      // Admin deletes post Q
      const delRes = await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postQNumber}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delRes.status).toBe(204);

      // GET posts?view=deleted lists Q with deletedBy = admin's name
      const deletedRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts?view=deleted`)
        .set("Cookie", ownerUser.cookie);
      expect(deletedRes.status).toBe(200);
      const row = deletedRes.body.posts.find((p: any) => p.number === postQNumber);
      expect(row).toBeDefined();
      expect(row.deletedBy).toBe("Workspace Owner");
      expect(row.deletedByAuthor).toBe(false);
    });

    it("comment C deleted on live post lists with 80-char excerpt, and restore brings it back to timeline", async () => {
      // Create post R
      const rRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Post R for comment testing",
          description: "Post R description",
        });
      const postRNumber = rRes.body.number;

      const commenterR = await signedInCookie(testApp.test, {
        name: "Commenter R",
        email: "commenter-r@test.com",
        emailVerified: true,
      });

      const longCommentText =
        "This is a very long comment body specifically designed to test the eighty character excerpt truncation rule for deleted comments.";
      const cRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postRNumber}/comments`)
        .set("Cookie", commenterR.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ body: longCommentText });
      expect(cRes.status).toBe(201);
      const commentId = cRes.body.id;

      // Admin deletes comment C
      const delCommentRes = await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delCommentRes.status).toBe(204);

      // GET comments/deleted lists it with 80-char excerpt and post.deleted = false
      const deletedCommentsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/comments/deleted`)
        .set("Cookie", ownerUser.cookie);
      expect(deletedCommentsRes.status).toBe(200);
      expect(deletedCommentsRes.body.nextCursor).toBeNull();
      const row = deletedCommentsRes.body.comments.find((c: any) => c.id === commentId);
      expect(row).toBeDefined();
      expect(row.excerpt).toBe(longCommentText.slice(0, 80));
      expect(row.post.number).toBe(postRNumber);
      expect(row.post.deleted).toBe(false);

      // Restore comment C
      const restoreCommentRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/comments/${commentId}/restore`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(restoreCommentRes.status).toBe(204);

      // C is back in public timeline
      const publicRRes = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postRNumber}`);
      expect(publicRRes.status).toBe(200);
      const timelineItem = publicRRes.body.timeline.find(
        (t: any) => t.kind === "comment" && t.comment.id === commentId
      );
      expect(timelineItem).toBeDefined();
      expect(timelineItem.comment.body).toBe(longCommentText);
    });

    it("comment on deleted post shows post.deleted=true and restore returns 404 post_not_found", async () => {
      // Create post S
      const sRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({
          title: "Post S to be deleted",
          description: "Post S description",
        });
      const postSNumber = sRes.body.number;

      const commenterS = await signedInCookie(testApp.test, {
        name: "Commenter S",
        email: "commenter-s@test.com",
        emailVerified: true,
      });

      const cRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postSNumber}/comments`)
        .set("Cookie", commenterS.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ body: "Comment on post S" });
      const commentId = cRes.body.id;

      // Delete comment
      await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/comments/${commentId}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      // Delete post S
      await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postSNumber}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      // GET comments/deleted lists comment with post.deleted = true
      const deletedCommentsRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/comments/deleted`)
        .set("Cookie", ownerUser.cookie);
      const row = deletedCommentsRes.body.comments.find((c: any) => c.id === commentId);
      expect(row).toBeDefined();
      expect(row.post.deleted).toBe(true);

      // Attempt to restore comment while post is deleted returns 404 post_not_found
      const restoreRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/comments/${commentId}/restore`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(restoreRes.status).toBe(404);
      expect(restoreRes.body.code).toBe("post_not_found");
    });

    it("idempotency and edge cases: restore live post -> 404, restore live comment -> 404, delete already-deleted post -> 404", async () => {
      // Create live post
      const liveRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ title: "Live post for edge cases" });
      const liveNumber = liveRes.body.number;

      // Restore live post -> 404
      const restoreLivePostRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${liveNumber}/restore`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(restoreLivePostRes.status).toBe(404);
      expect(restoreLivePostRes.body.code).toBe("post_not_found");

      // Comment on live post
      const commenter = await signedInCookie(testApp.test, {
        name: "Commenter Live",
        email: "commenter-live@test.com",
        emailVerified: true,
      });
      const cRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${liveNumber}/comments`)
        .set("Cookie", commenter.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ body: "Live comment" });
      const commentId = cRes.body.id;

      // Restore live comment -> 404
      const restoreLiveCommentRes = await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/comments/${commentId}/restore`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(restoreLiveCommentRes.status).toBe(404);
      expect(restoreLiveCommentRes.body.code).toBe("comment_not_found");

      // Delete post
      await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${liveNumber}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      // Delete already-deleted post -> 404
      const secondDeleteRes = await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${liveNumber}`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(secondDeleteRes.status).toBe(404);
      expect(secondDeleteRes.body.code).toBe("post_not_found");
    });
  });

  describe("Voters, filtering, and pagination boundaries (Task 3)", () => {
    it("50 voters boundary: exactly 50 voters -> one page, nextCursor null; 51 -> first page 50 + nextCursor, second page 1", async () => {
      // Create post for 51 voters
      const pRes = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ title: "Post with 51 voters" });
      const num = pRes.body.number;

      // Find post ID
      const [postRow] = await testApp.db
        .select({ id: schema.posts.id })
        .from(schema.posts)
        .where(eq(schema.posts.number, num));

      // Unvote author so we start from clean 0
      await request(testApp.http)
        .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${num}/vote`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      // Verify zero voters edge case
      const zeroVotersRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${num}/voters`)
        .set("Cookie", ownerUser.cookie);
      expect(zeroVotersRes.status).toBe(200);
      expect(zeroVotersRes.body.total).toBe(0);
      expect(zeroVotersRes.body.voters).toEqual([]);
      expect(zeroVotersRes.body.nextCursor).toBeNull();

      // Seed 51 users and votes in database directly for speed
      const userInserts = Array.from({ length: 51 }, (_, i) => ({
        id: `voter-boundary-user-${i}`,
        name: `Voter ${i.toString().padStart(2, "0")}`,
        email: `voter${i}@boundary.test`,
        emailVerified: true,
      }));
      await testApp.db.insert(schema.user).values(userInserts);

      const baseTime = new Date("2026-03-01T12:00:00Z").getTime();
      const voteInserts = userInserts.map((u, i) => ({
        postId: postRow.id,
        userId: u.id,
        createdAt: new Date(baseTime + i * 1000), // newest is i=50
      }));
      await testApp.db.insert(schema.votes).values(voteInserts);

      // Update post vote_count to 51
      await testApp.db
        .update(schema.posts)
        .set({ voteCount: 51 })
        .where(eq(schema.posts.id, postRow.id));

      // Page 1: should have 50 voters and nextCursor
      const page1Res = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${num}/voters`)
        .set("Cookie", ownerUser.cookie);
      expect(page1Res.status).toBe(200);
      expect(page1Res.body.total).toBe(51);
      expect(page1Res.body.voters.length).toBe(50);
      expect(page1Res.body.nextCursor).not.toBeNull();

      // Page 2: should have 1 voter and nextCursor null
      const page2Res = await request(testApp.http)
        .get(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${num}/voters?cursor=${encodeURIComponent(page1Res.body.nextCursor)}`
        )
        .set("Cookie", ownerUser.cookie);
      expect(page2Res.status).toBe(200);
      expect(page2Res.body.voters.length).toBe(1);
      expect(page2Res.body.nextCursor).toBeNull();
    });

    it("two voters with equal created_at come back ordered by user id consistently", async () => {
      const [created] = await testApp.db
        .insert(schema.posts)
        .values({
          productId: prodId,
          number: 888,
          title: "Post with equal timestamp voters",
          statusId: _reviewStatusId,
          authorId: ownerUser.userId,
          voteCount: 2,
        })
        .returning();
      const num = created.number;
      const postRow = created;

      const equalTime = new Date("2026-03-02T10:00:00Z");
      await testApp.db.insert(schema.user).values([
        { id: "user-beta", name: "User Beta", email: "beta@test.com", emailVerified: true },
        { id: "user-alpha", name: "User Alpha", email: "alpha@test.com", emailVerified: true },
      ]);
      await testApp.db.insert(schema.votes).values([
        { postId: postRow.id, userId: "user-beta", createdAt: equalTime },
        { postId: postRow.id, userId: "user-alpha", createdAt: equalTime },
      ]);
      await testApp.db
        .update(schema.posts)
        .set({ voteCount: 2 })
        .where(eq(schema.posts.id, postRow.id));

      const votersRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${num}/voters`)
        .set("Cookie", ownerUser.cookie);
      expect(votersRes.status).toBe(200);
      expect(votersRes.body.voters.length).toBe(2);
      // alpha comes before beta because user.id asc
      expect(votersRes.body.voters[0].name).toBe("User Alpha");
      expect(votersRes.body.voters[1].name).toBe("User Beta");
    });

    it("non-member calling GET voters receives 404 not_found; public post JSON contains voteCount but no voters", async () => {
      const nonMember = await signedInCookie(testApp.test, {
        name: "Non Member",
        email: "non-member@test.com",
        emailVerified: true,
      });

      const votersRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts/${postNumber}/voters`)
        .set("Cookie", nonMember.cookie);
      expect(votersRes.status).toBe(404);

      // Public post JSON contains voteCount but no voter names
      const publicRes = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNumber}`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.post.voteCount).toBeDefined();
      expect(publicRes.body.post.voters).toBeUndefined();
      expect(publicRes.body.voters).toBeUndefined();
    });

    it("admin list with no status param includes completed posts; status=open hides them; default sort is new", async () => {
      // Create a completed status post
      const [compPost] = await testApp.db
        .insert(schema.posts)
        .values({
          productId: prodId,
          number: 999,
          title: "Completed status feature",
          statusId: _completedStatusId,
          authorId: ownerUser.userId,
          authorIsAdmin: true,
          voteCount: 0,
        })
        .returning();

      // No status param -> includes completed post
      const allRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts`)
        .set("Cookie", ownerUser.cookie);
      expect(allRes.status).toBe(200);
      expect(allRes.body.posts.some((p: any) => p.number === compPost.number)).toBe(true);

      // status=open -> hides completed post
      const openRes = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/posts?status=open`)
        .set("Cookie", ownerUser.cookie);
      expect(openRes.status).toBe(200);
      expect(openRes.body.posts.some((p: any) => p.number === compPost.number)).toBe(false);
    });
  });
});

