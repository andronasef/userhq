import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  user,
  posts,
  products,
  workspaces,
  postMutes,
  statuses,
  workspaceMembers,
  commentEmailBatches,
} from "@userhq/db";
import { SEEDED_STATUSES, postSlug } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { signToken } from "../src/email/tokens.js";
import { EmailWorker } from "../src/email/worker.js";

describe("Unsubscribe & Mute (Plan 03-13)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let emailWorker: EmailWorker;
  let userA: { cookie: string; userId: string; email: string };
  let userB: { cookie: string; userId: string; email: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let defaultStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    emailWorker = testApp.app.get(EmailWorker);

    const rand = randomBytes(4).toString("hex");
    const emailA = `unsub-a-${rand}@mail.test`;
    const emailB = `unsub-b-${rand}@mail.test`;

    userA = {
      ...(await signedInCookie(testApp.test, {
        name: "Unsub Alice",
        email: emailA,
        emailVerified: true,
      })),
      email: emailA,
    };

    userB = {
      ...(await signedInCookie(testApp.test, {
        name: "Unsub Bob",
        email: emailB,
        emailVerified: true,
      })),
      email: emailB,
    };

    // Ensure userA has commentEmails = true initially
    await testApp.db
      .update(user)
      .set({ commentEmails: true })
      .where(eq(user.id, userA.userId));

    wsSlug = `ws-${rand}`;
    const [wsRow] = await testApp.db
      .insert(workspaces)
      .values({
        name: "Unsub Workspace",
        slug: wsSlug,
      })
      .returning();
    wsId = wsRow.id;

    await testApp.db.insert(workspaceMembers).values({
      workspaceId: wsId,
      userId: userA.userId,
      role: "owner",
    });

    prodSlug = `prod-${rand}`;
    const [prodRow] = await testApp.db
      .insert(products)
      .values({
        workspaceId: wsId,
        name: "Unsub Product",
        slug: prodSlug,
      })
      .returning();
    prodId = prodRow.id;

    const seeded = await testApp.db
      .insert(statuses)
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
    defaultStatusId = seeded.find((s) => s.isDefault)!.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: unsubscribe page flow turns comment emails off", async () => {
    const token = signToken(testApp.env.BETTER_AUTH_SECRET, userA.userId, "all");

    // 1. GET returns subscribed without modifying DB
    const getRes = await request(testApp.http).get(`/api/v1/unsubscribe/${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({
      scope: "all",
      state: "subscribed",
      postTitle: null,
      postUrl: null,
    });

    const [dbUserBefore] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserBefore.commentEmails).toBe(true);

    // 2. POST with Origin sets comment_emails = false and returns unsubscribed
    const postRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${token}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(postRes.status).toBe(200);
    expect(postRes.body).toEqual({
      scope: "all",
      state: "unsubscribed",
      postTitle: null,
      postUrl: null,
    });

    const [dbUserAfterPost] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserAfterPost.commentEmails).toBe(false);

    // Reset user to subscribed for the one-click test
    await testApp.db
      .update(user)
      .set({ commentEmails: true })
      .where(eq(user.id, userA.userId));

    // 3. RFC 8058 one-click case: POST with no Cookie and no Origin
    const oneClickRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${token}`)
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("List-Unsubscribe=One-Click");
    expect(oneClickRes.status).toBe(200);
    expect(oneClickRes.body).toEqual({
      scope: "all",
      state: "unsubscribed",
      postTitle: null,
      postUrl: null,
    });

    const [dbUserAfterOneClick] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserAfterOneClick.commentEmails).toBe(false);

    // 4. Non-exempt route without Origin still returns 403 forbidden
    const nonExemptRes = await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", userA.cookie)
      .send({ name: "Forbidden Ws", slug: "forbidden-ws" });
    expect(nonExemptRes.status).toBe(403);

    // 5. Repeated POST is idempotent (200, still unsubscribed)
    const repeatPostRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${token}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(repeatPostRes.status).toBe(200);
    expect(repeatPostRes.body.state).toBe("unsubscribed");

    // 6. DELETE turns emails back on (state: subscribed)
    const deleteRes = await request(testApp.http)
      .delete(`/api/v1/unsubscribe/${token}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({
      scope: "all",
      state: "subscribed",
      postTitle: null,
      postUrl: null,
    });

    const [dbUserAfterDelete] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserAfterDelete.commentEmails).toBe(true);

    // 7. Later POST turns them off again
    const postAgainRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${token}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(postAgainRes.status).toBe(200);
    expect(postAgainRes.body.state).toBe("unsubscribed");

    // 8. Empty, truncated, and tampered tokens return 404 invalid_token
    const tamperedToken =
      token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    const truncatedToken = token.slice(0, 10);

    const tamperedRes = await request(testApp.http).get(
      `/api/v1/unsubscribe/${tamperedToken}`
    );
    expect(tamperedRes.status).toBe(404);
    expect(tamperedRes.body.code).toBe("invalid_token");

    const truncatedRes = await request(testApp.http).get(
      `/api/v1/unsubscribe/${truncatedToken}`
    );
    expect(truncatedRes.status).toBe(404);
    expect(truncatedRes.body.code).toBe("invalid_token");

    const unknownUserToken = signToken(
      testApp.env.BETTER_AUTH_SECRET,
      "non-existent-user-id",
      "all"
    );
    const unknownRes = await request(testApp.http).get(
      `/api/v1/unsubscribe/${unknownUserToken}`
    );
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body.code).toBe("invalid_token");
  });

  it("handles post-scoped tokens: GET, POST mute, repeat POST, DELETE unmute", async () => {
    // Create a live post
    const [p] = await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Speed up dashboard load",
        statusId: defaultStatusId,
        authorId: userA.userId,
      })
      .returning();

    const postToken = signToken(
      testApp.env.BETTER_AUTH_SECRET,
      userA.userId,
      `p:${p.id}`
    );

    const expectedUrl = `/${wsSlug}/${prodSlug}/p/1-${postSlug("Speed up dashboard load")}`;

    // 1. GET returns subscribed with title and permalink
    const getRes = await request(testApp.http).get(
      `/api/v1/unsubscribe/${postToken}`
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({
      scope: "post",
      state: "subscribed",
      postTitle: "Speed up dashboard load",
      postUrl: expectedUrl,
    });

    // Verify no mute row yet
    const mutesBefore = await testApp.db
      .select()
      .from(postMutes)
      .where(and(eq(postMutes.userId, userA.userId), eq(postMutes.postId, p.id)));
    expect(mutesBefore).toHaveLength(0);

    // 2. POST mutes the post
    const postRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${postToken}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(postRes.status).toBe(200);
    expect(postRes.body).toEqual({
      scope: "post",
      state: "unsubscribed",
      postTitle: "Speed up dashboard load",
      postUrl: expectedUrl,
    });

    const mutesAfterPost = await testApp.db
      .select()
      .from(postMutes)
      .where(and(eq(postMutes.userId, userA.userId), eq(postMutes.postId, p.id)));
    expect(mutesAfterPost).toHaveLength(1);

    // 3. POST again is idempotent (200, still unsubscribed)
    const repeatRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${postToken}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.state).toBe("unsubscribed");

    // 4. DELETE un-mutes the post
    const deleteRes = await request(testApp.http)
      .delete(`/api/v1/unsubscribe/${postToken}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({
      scope: "post",
      state: "subscribed",
      postTitle: "Speed up dashboard load",
      postUrl: expectedUrl,
    });

    const mutesAfterDelete = await testApp.db
      .select()
      .from(postMutes)
      .where(and(eq(postMutes.userId, userA.userId), eq(postMutes.postId, p.id)));
    expect(mutesAfterDelete).toHaveLength(0);
  });

  it("returns post_unavailable for deleted and merged posts, with no mute row written", async () => {
    // Deleted post
    const [deletedP] = await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 2,
        title: "Old deleted post",
        statusId: defaultStatusId,
        authorId: userA.userId,
        deletedAt: new Date(),
      })
      .returning();

    const deletedToken = signToken(
      testApp.env.BETTER_AUTH_SECRET,
      userA.userId,
      `p:${deletedP.id}`
    );

    const getDeletedRes = await request(testApp.http).get(
      `/api/v1/unsubscribe/${deletedToken}`
    );
    expect(getDeletedRes.status).toBe(200);
    expect(getDeletedRes.body).toEqual({
      scope: "post",
      state: "post_unavailable",
      postTitle: null,
      postUrl: null,
    });

    const postDeletedRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${deletedToken}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(postDeletedRes.status).toBe(200);
    expect(postDeletedRes.body).toEqual({
      scope: "post",
      state: "post_unavailable",
      postTitle: null,
      postUrl: null,
    });

    // Merged post
    const [targetP] = await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 3,
        title: "Target canonical post",
        statusId: defaultStatusId,
        authorId: userA.userId,
      })
      .returning();

    const [mergedP] = await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 4,
        title: "Merged duplicate post",
        statusId: defaultStatusId,
        authorId: userA.userId,
        mergedIntoId: targetP.id,
      })
      .returning();

    const mergedToken = signToken(
      testApp.env.BETTER_AUTH_SECRET,
      userA.userId,
      `p:${mergedP.id}`
    );

    const getMergedRes = await request(testApp.http).get(
      `/api/v1/unsubscribe/${mergedToken}`
    );
    expect(getMergedRes.status).toBe(200);
    expect(getMergedRes.body).toEqual({
      scope: "post",
      state: "post_unavailable",
      postTitle: null,
      postUrl: null,
    });

    const postMergedRes = await request(testApp.http)
      .post(`/api/v1/unsubscribe/${mergedToken}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(postMergedRes.status).toBe(200);
    expect(postMergedRes.body).toEqual({
      scope: "post",
      state: "post_unavailable",
      postTitle: null,
      postUrl: null,
    });

    // Verify neither wrote to postMutes
    const mutes = await testApp.db.select().from(postMutes);
    const deletedOrMergedMutes = mutes.filter(
      (m) => m.postId === deletedP.id || m.postId === mergedP.id
    );
    expect(deletedOrMergedMutes).toHaveLength(0);
  });

  it("verifies global off and per-post mute independence (worker drops muted post comments)", async () => {
    // 1. Unmuting a post while global is off does not turn global emails back on
    await testApp.db
      .update(user)
      .set({ commentEmails: false })
      .where(eq(user.id, userA.userId));

    const [post5] = await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 5,
        title: "Independence test post",
        statusId: defaultStatusId,
        authorId: userA.userId,
      })
      .returning();

    const token5 = signToken(
      testApp.env.BETTER_AUTH_SECRET,
      userA.userId,
      `p:${post5.id}`
    );

    // DELETE on post token to unmute
    const unmuteRes = await request(testApp.http)
      .delete(`/api/v1/unsubscribe/${token5}`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(unmuteRes.status).toBe(200);
    expect(unmuteRes.body.state).toBe("subscribed");

    const [dbUserCheck] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserCheck.commentEmails).toBe(false);

    // 2. Global on + muted post -> no email batch created for that post's comments
    await testApp.db
      .update(user)
      .set({ commentEmails: true })
      .where(eq(user.id, userA.userId));

    // Mute post 5
    await testApp.db.insert(postMutes).values({
      userId: userA.userId,
      postId: post5.id,
    });

    // User B comments on post 5
    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/5/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Checking mute suppression" });
    expect(commentRes.status).toBe(201);

    // Verify no batch was enqueued for userA because post 5 is muted
    const batchesForMutedPost = await testApp.db
      .select()
      .from(commentEmailBatches)
      .where(
        and(
          eq(commentEmailBatches.userId, userA.userId),
          eq(commentEmailBatches.status, "pending")
        )
      );
    expect(batchesForMutedPost).toHaveLength(0);

    // 3. Post was unmuted when commented, then muted before worker runs -> worker drops items & cancels batch
    const [post6] = await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 6,
        title: "Late mute test post",
        statusId: defaultStatusId,
        authorId: userA.userId,
      })
      .returning();

    // User B comments on unmuted post 6 -> batch created
    const commentRes6 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/6/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Late mute test comment" });
    expect(commentRes6.status).toBe(201);

    const userBatches = await testApp.db
      .select()
      .from(commentEmailBatches)
      .where(
        and(
          eq(commentEmailBatches.userId, userA.userId),
          eq(commentEmailBatches.status, "pending")
        )
      );
    expect(userBatches.length).toBeGreaterThan(0);

    // Now mute post 6 before worker sends
    await testApp.db.insert(postMutes).values({
      userId: userA.userId,
      postId: post6.id,
    });

    // Advance 25 hours and run worker
    const futureDate = new Date(Date.now() + 25 * 3600_000);
    const workerResult = await emailWorker.runOnce(futureDate);
    // Since post 6 was muted, its items are dropped -> empty -> 0 sent!
    expect(workerResult.sent).toBe(0);

    // Batch was marked cancelled
    const [finalBatch] = await testApp.db
      .select()
      .from(commentEmailBatches)
      .where(eq(commentEmailBatches.id, userBatches[0].id));
    expect(finalBatch.status).toBe("cancelled");
  });

  it("handles portal mute API: PUT / DELETE / unauthenticated / 404s", async () => {
    // 1. Signed-in PUT mutes post 1
    const putRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/1/mute`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(putRes.status).toBe(200);
    expect(putRes.body).toEqual({ muted: true });

    // 2. Signed-in DELETE unmutes post 1
    const delRes = await request(testApp.http)
      .delete(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/1/mute`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ muted: false });

    // 3. Unauthenticated PUT returns 401
    const unauthRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/1/mute`)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(unauthRes.status).toBe(401);

    // 4. Non-existent post number returns 404 post_not_found
    const notFoundRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/99999/mute`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.code).toBe("post_not_found");

    // 5. Invalid numeric format returns 404 post_not_found
    const invalidNumRes = await request(testApp.http)
      .put(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/abc/mute`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(invalidNumRes.status).toBe(404);
    expect(invalidNumRes.body.code).toBe("post_not_found");
  });
});
