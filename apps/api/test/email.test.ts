import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { EmailWorker } from "../src/email/worker.js";
import { loadEnv } from "../src/env.js";

const mailpitHost = process.env.MAILPIT_HOST || "127.0.0.1";
const mailpitApiUrl = `http://${mailpitHost}:8025/api/v1`;

async function getMailpitMessagesFor(email: string) {
  const res = await fetch(`${mailpitApiUrl}/messages`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Mailpit messages: ${res.status}`);
  }
  const data = (await res.json()) as {
    messages?: Array<{
      ID: string;
      To: Array<{ Address: string; Name: string }>;
      Subject: string;
      Snippet: string;
    }>;
  };
  return (data.messages ?? []).filter((m) =>
    m.To.some((to) => to.Address.toLowerCase() === email.toLowerCase())
  );
}

async function getMailpitMessageDetail(id: string) {
  const res = await fetch(`${mailpitApiUrl}/message/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Mailpit message detail: ${res.status}`);
  }
  return res.json() as Promise<{
    Text: string;
    HTML: string;
    Headers: Record<string, string[]>;
    Subject: string;
    From: { Address: string; Name: string };
  }>;
}

describe("Email Outbox and Worker (Plan 03-10)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let emailWorker: EmailWorker;
  let userA: { cookie: string; userId: string; name: string; email: string };
  let userB: { cookie: string; userId: string; name: string; email: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;

  beforeAll(async () => {
    const rand = randomBytes(4).toString("hex");
    const emailA = `a-${rand}@mail.test`;
    const emailB = `b-${rand}@mail.test`;

    testApp = await createTestApp({
      SMTP_HOST: mailpitHost,
      SMTP_PORT: 1025,
      SMTP_REQUIRE_TLS: false,
      SMTP_FROM: "notifications@userhq.test",
      SMTP_USER: "mailpituser",
      SMTP_PASS: "super-secret-password-xyz",
    });

    emailWorker = testApp.app.get(EmailWorker);

    userA = {
      ...(await signedInCookie(testApp.test, {
        name: "Author Alice",
        email: emailA,
        emailVerified: true,
      })),
      email: emailA,
    };

    userB = {
      ...(await signedInCookie(testApp.test, {
        name: "Commenter Bob",
        email: emailB,
        emailVerified: true,
      })),
      email: emailB,
    };

    wsSlug = `ws-email-${rand}`;
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Email Test Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: userA.userId,
      role: "owner",
    });

    prodSlug = `email-prod-${rand}`;
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Email Test Product",
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

    // Create a post by user A
    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Tracer Feature Request",
        description: "Need email notifications for feedback",
        statusId: def.id,
        authorId: userA.userId,
        authorIsAdmin: true,
        voteCount: 1,
      })
      .returning();

    // Auto-vote by author A
    await testApp.db.insert(schema.votes).values({
      postId: post.id,
      userId: userA.userId,
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: a comment by B produces one Mailpit email to A after the window", async () => {
    // User B comments on User A's post
    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/1/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        body: "Same problem here",
      });

    expect(commentRes.status).toBe(201);

    // Verify outbox: exactly one pending batch for User A, due ~24 hours ahead
    const batches = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, userA.userId));

    expect(batches).toHaveLength(1);
    const batch = batches[0];
    expect(batch.status).toBe("pending");
    expect(batch.workspaceId).toBe(wsId);

    const now = new Date();
    const sendAfterMs = new Date(batch.sendAfter).getTime();
    const diffHours = (sendAfterMs - now.getTime()) / (1000 * 3600);
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThan(25);

    // Immediate runOnce: nothing due yet -> 0 sent
    const immediateRun = await emailWorker.runOnce(new Date());
    expect(immediateRun.claimed).toBe(0);
    expect(immediateRun.sent).toBe(0);

    // 25 hours later runOnce: batch is due -> 1 sent
    const futureDate = new Date(Date.now() + 25 * 3600_000);
    const futureRun = await emailWorker.runOnce(futureDate);
    expect(futureRun.claimed).toBe(1);
    expect(futureRun.sent).toBe(1);

    // Batch status in DB is now "sent"
    const [updatedBatch] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.id, batch.id));
    expect(updatedBatch.status).toBe("sent");
    expect(updatedBatch.sentAt).not.toBeNull();

    // Fetch messages from Mailpit for User A
    const messages = await getMailpitMessagesFor(userA.email);
    expect(messages.length).toBeGreaterThanOrEqual(1);

    const tracerMessage = messages[messages.length - 1];
    const detail = await getMailpitMessageDetail(tracerMessage.ID);

    expect(detail.Subject).toContain("Tracer Feature Request");
    expect(detail.Text).toContain("Tracer Feature Request");
    expect(detail.Text).toContain("Commenter Bob");
    expect(detail.Text).toContain("Same problem here");
    expect(detail.Text).toContain(`/${wsSlug}/${prodSlug}/p/1-tracer-feature-request`);
  });

  it("recipient exclusions: muted, opted-out, deleted, banned, and actor himself", async () => {
    const rand = randomBytes(4).toString("hex");
    const author = await signedInCookie(testApp.test, {
      name: "Exclusion Author",
      email: `author-${rand}@mail.test`,
      emailVerified: true,
    });
    const commenterOptOut = await signedInCookie(testApp.test, {
      name: "OptOut User",
      email: `optout-${rand}@mail.test`,
      emailVerified: true,
    });
    const commenterMuted = await signedInCookie(testApp.test, {
      name: "Muted User",
      email: `muted-${rand}@mail.test`,
      emailVerified: true,
    });
    const commenterDeleted = await signedInCookie(testApp.test, {
      name: "Deleted User",
      email: `deleted-${rand}@mail.test`,
      emailVerified: true,
    });
    const commenterBanned = await signedInCookie(testApp.test, {
      name: "Banned User",
      email: `banned-${rand}@mail.test`,
      emailVerified: true,
    });
    const commenterActive = await signedInCookie(testApp.test, {
      name: "Active User",
      email: `active-${rand}@mail.test`,
      emailVerified: true,
    });
    const actor = await signedInCookie(testApp.test, {
      name: "Actor User",
      email: `actor-${rand}@mail.test`,
      emailVerified: true,
    });

    const [defStatus] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodId))
      .limit(1);

    const [{ count }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const postNum = count + 1;

    const [testPost] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: postNum,
        title: `Exclusion Test Post ${rand}`,
        description: "Exclusion test description",
        statusId: defStatus.id,
        authorId: author.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();

    await testApp.db.insert(schema.votes).values({
      postId: testPost.id,
      userId: author.userId,
    });

    const postComment = async (cookie: string, body: string) => {
      const res = await request(testApp.http)
        .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNum}/comments`)
        .set("Cookie", cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ body });
      expect(res.status).toBe(201);
      return res.body;
    };

    await postComment(commenterOptOut.cookie, "Opt out comment");
    await postComment(commenterMuted.cookie, "Muted comment");
    await postComment(commenterDeleted.cookie, "Deleted comment");
    await postComment(commenterBanned.cookie, "Banned comment");
    await postComment(commenterActive.cookie, "Active comment");

    // Clear setup batches so we only test actor's new comment
    await testApp.db.delete(schema.commentEmailBatches);

    // Apply exclusion states
    await testApp.db
      .update(schema.user)
      .set({ commentEmails: false })
      .where(eq(schema.user.id, commenterOptOut.userId));

    await testApp.db.insert(schema.postMutes).values({
      userId: commenterMuted.userId,
      postId: testPost.id,
    });

    await testApp.db
      .update(schema.user)
      .set({ deletedAt: new Date() })
      .where(eq(schema.user.id, commenterDeleted.userId));

    await testApp.db
      .update(schema.user)
      .set({ bannedAt: new Date() })
      .where(eq(schema.user.id, commenterBanned.userId));

    // Actor comments
    await postComment(actor.cookie, "Actor new comment");

    // Check recipients who got pending batches
    const allBatches = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.workspaceId, wsId));

    const recipientIds = allBatches.map((b) => b.userId);

    expect(recipientIds).toContain(author.userId);
    expect(recipientIds).toContain(commenterActive.userId);

    expect(recipientIds).not.toContain(actor.userId);
    expect(recipientIds).not.toContain(commenterOptOut.userId);
    expect(recipientIds).not.toContain(commenterMuted.userId);
    expect(recipientIds).not.toContain(commenterDeleted.userId);
    expect(recipientIds).not.toContain(commenterBanned.userId);

    await testApp.db.delete(schema.commentEmailBatches);
  });

  it("cross-workspace batching and multi-product batching coalesces pending batches", async () => {
    const rand = randomBytes(4).toString("hex");
    const recipient = await signedInCookie(testApp.test, {
      name: "Batch Recipient",
      email: `recipient-${rand}@mail.test`,
      emailVerified: true,
    });

    // Create second product in workspace 1
    const prod1bSlug = `prod-1b-${rand}`;
    const [prod1b] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prod1bSlug,
        name: "Second Product W1",
        accentColor: "#10B981",
      })
      .returning();

    await testApp.db.insert(schema.statuses).values(
      SEEDED_STATUSES.map((s, idx) => ({
        productId: prod1b.id,
        name: s.name,
        type: s.type,
        color: s.color,
        position: idx,
        isDefault: s.type === "review",
      }))
    );

    // Create second workspace and product
    const ws2Slug = `ws2-${rand}`;
    const [ws2] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: ws2Slug,
        name: "Second Workspace",
      })
      .returning();

    const prod2Slug = `prod-2-${rand}`;
    const [prod2] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws2.id,
        slug: prod2Slug,
        name: "Product W2",
        accentColor: "#F59E0B",
      })
      .returning();

    await testApp.db.insert(schema.statuses).values(
      SEEDED_STATUSES.map((s, idx) => ({
        productId: prod2.id,
        name: s.name,
        type: s.type,
        color: s.color,
        position: idx,
        isDefault: s.type === "review",
      }))
    );

    const [defStatusProd1] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodId))
      .limit(1);
    const [defStatusProd1b] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prod1b.id))
      .limit(1);
    const [defStatusProd2] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prod2.id))
      .limit(1);

    const [{ count: c1 }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const [p1] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: c1 + 1,
        title: `Post W1-P1 ${rand}`,
        description: "desc",
        statusId: defStatusProd1.id,
        authorId: recipient.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: p1.id, userId: recipient.userId });

    const [p2] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prod1b.id,
        number: 1,
        title: `Post W1-P2 ${rand}`,
        description: "desc",
        statusId: defStatusProd1b.id,
        authorId: recipient.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: p2.id, userId: recipient.userId });

    const [p3] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prod2.id,
        number: 1,
        title: `Post W2-P3 ${rand}`,
        description: "desc",
        statusId: defStatusProd2.id,
        authorId: recipient.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: p3.id, userId: recipient.userId });

    await testApp.db.delete(schema.commentEmailBatches);

    const commenter2 = await signedInCookie(testApp.test, {
      name: "Commenter 2",
      email: `commenter2-${rand}@mail.test`,
      emailVerified: true,
    });

    // Comment on P1 (W1)
    const cRes1 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${p1.number}/comments`)
      .set("Cookie", commenter2.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment 1 on P1" });
    expect(cRes1.status).toBe(201);

    // Comment on P2 (W1, different product)
    const cRes2 = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prod1bSlug}/posts/1/comments`)
      .set("Cookie", commenter2.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment 2 on P2" });
    expect(cRes2.status).toBe(201);

    // Exactly one batch in W1 for recipient, with 2 items
    const w1Batches = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(
        and(
          eq(schema.commentEmailBatches.userId, recipient.userId),
          eq(schema.commentEmailBatches.workspaceId, wsId)
        )
      );
    expect(w1Batches).toHaveLength(1);
    const w1Items = await testApp.db
      .select()
      .from(schema.commentEmailItems)
      .where(eq(schema.commentEmailItems.batchId, w1Batches[0].id));
    expect(w1Items).toHaveLength(2);

    // Comment on P3 (W2)
    const cRes3 = await request(testApp.http)
      .post(`/api/v1/portal/${ws2Slug}/${prod2Slug}/posts/1/comments`)
      .set("Cookie", commenter2.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment 3 on P3" });
    expect(cRes3.status).toBe(201);

    // Separate batch in W2 with 1 item
    const w2Batches = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(
        and(
          eq(schema.commentEmailBatches.userId, recipient.userId),
          eq(schema.commentEmailBatches.workspaceId, ws2.id)
        )
      );
    expect(w2Batches).toHaveLength(1);
    const w2Items = await testApp.db
      .select()
      .from(schema.commentEmailItems)
      .where(eq(schema.commentEmailItems.batchId, w2Batches[0].id));
    expect(w2Items).toHaveLength(1);

    await testApp.db.delete(schema.commentEmailBatches);
  });

  it("batch in sending + new comment opens fresh pending batch 24h out", async () => {
    const rand = randomBytes(4).toString("hex");
    const recipient = await signedInCookie(testApp.test, {
      name: "Fresh Batch Recipient",
      email: `fresh-${rand}@mail.test`,
      emailVerified: true,
    });

    const commenter3 = await signedInCookie(testApp.test, {
      name: "Commenter 3",
      email: `commenter3-${rand}@mail.test`,
      emailVerified: true,
    });

    const [defStatus] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodId))
      .limit(1);

    const [{ count }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const postNum = count + 1;

    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: postNum,
        title: `Fresh Batch Post ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: recipient.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post.id, userId: recipient.userId });

    await testApp.db.delete(schema.commentEmailBatches);

    // First comment creates pending batch
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNum}/comments`)
      .set("Cookie", commenter3.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "First comment" });

    const [firstBatch] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, recipient.userId));
    expect(firstBatch.status).toBe("pending");

    // Move first batch to 'sending'
    await testApp.db
      .update(schema.commentEmailBatches)
      .set({ status: "sending", claimedAt: new Date() })
      .where(eq(schema.commentEmailBatches.id, firstBatch.id));

    // Second comment arrives while first batch is sending
    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNum}/comments`)
      .set("Cookie", commenter3.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Second comment while sending" });

    const batches = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, recipient.userId))
      .orderBy(asc(schema.commentEmailBatches.createdAt));

    expect(batches).toHaveLength(2);
    expect(batches[0].id).toBe(firstBatch.id);
    expect(batches[0].status).toBe("sending");

    expect(batches[1].id).not.toBe(firstBatch.id);
    expect(batches[1].status).toBe("pending");

    const diffHours =
      (new Date(batches[1].sendAfter).getTime() - Date.now()) / (3600 * 1000);
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThan(25);

    await testApp.db.delete(schema.commentEmailBatches);
  });

  it("send-time rules: drops deleted comments, cancels when all deleted or opted-out, cancels on suspended workspace, drops muted posts, and follows merged comments", async () => {
    const rand = randomBytes(4).toString("hex");

    const commenter4 = await signedInCookie(testApp.test, {
      name: "Commenter 4",
      email: `commenter4-${rand}@mail.test`,
      emailVerified: true,
    });

    // 1. Drops deleted comment when another non-deleted comment exists in the batch
    const user4a = await signedInCookie(testApp.test, {
      name: "User 4a",
      email: `user4a-${rand}@mail.test`,
      emailVerified: true,
    });
    const [defStatus] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodId))
      .limit(1);

    const [{ count: cntA }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const [post4a] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: cntA + 1,
        title: `Post 4a ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: user4a.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post4a.id, userId: user4a.userId });

    await testApp.db.delete(schema.commentEmailBatches);

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post4a.number}/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment to delete later" });

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post4a.number}/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment to keep alive" });

    // Soft-delete first comment
    const [cToDel] = await testApp.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.body, "Comment to delete later"));
    await testApp.db
      .update(schema.comments)
      .set({ deletedAt: new Date() })
      .where(eq(schema.comments.id, cToDel.id));

    // Run worker in future
    const futureDate = new Date(Date.now() + 25 * 3600_000);
    const run4a = await emailWorker.runOnce(futureDate);
    expect(run4a.claimed).toBe(1);
    expect(run4a.sent).toBe(1);

    const msgs4a = await getMailpitMessagesFor(user4a.email);
    expect(msgs4a.length).toBe(1);
    const detail4a = await getMailpitMessageDetail(msgs4a[0].ID);
    expect(detail4a.Text).toContain("Comment to keep alive");
    expect(detail4a.Text).not.toContain("Comment to delete later");

    await testApp.db.delete(schema.commentEmailBatches);

    // 2. Cancels when all comments in batch are deleted
    const user4b = await signedInCookie(testApp.test, {
      name: "User 4b",
      email: `user4b-${rand}@mail.test`,
      emailVerified: true,
    });
    const [{ count: cntB }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const [post4b] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: cntB + 1,
        title: `Post 4b ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: user4b.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post4b.id, userId: user4b.userId });

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post4b.number}/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Solo comment to delete" });

    const [cSolo] = await testApp.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.body, "Solo comment to delete"));
    await testApp.db
      .update(schema.comments)
      .set({ deletedAt: new Date() })
      .where(eq(schema.comments.id, cSolo.id));

    const run4b = await emailWorker.runOnce(futureDate);
    expect(run4b.claimed).toBe(1);
    expect(run4b.cancelled).toBe(1);
    expect(run4b.sent).toBe(0);

    const [batch4b] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, user4b.userId));
    expect(batch4b.status).toBe("cancelled");

    await testApp.db.delete(schema.commentEmailBatches);

    // 3. Cancels when recipient turns comment_emails off after enqueue
    const user4c = await signedInCookie(testApp.test, {
      name: "User 4c",
      email: `user4c-${rand}@mail.test`,
      emailVerified: true,
    });
    const [{ count: cntC }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const [post4c] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: cntC + 1,
        title: `Post 4c ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: user4c.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post4c.id, userId: user4c.userId });

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post4c.number}/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment before opt-out" });

    // Recipient opts out before send
    await testApp.db
      .update(schema.user)
      .set({ commentEmails: false })
      .where(eq(schema.user.id, user4c.userId));

    const run4c = await emailWorker.runOnce(futureDate);
    expect(run4c.claimed).toBe(1);
    expect(run4c.cancelled).toBe(1);

    const [batch4c] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, user4c.userId));
    expect(batch4c.status).toBe("cancelled");

    await testApp.db.delete(schema.commentEmailBatches);

    // 4. Cancels when workspace is suspended after enqueue
    const ws4dSlug = `ws4d-${rand}`;
    const [ws4d] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: ws4dSlug,
        name: "Workspace 4d",
      })
      .returning();

    const prod4dSlug = `prod4d-${rand}`;
    const [prod4d] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws4d.id,
        slug: prod4dSlug,
        name: "Product 4d",
      })
      .returning();

    const [status4d] = await testApp.db
      .insert(schema.statuses)
      .values({
        productId: prod4d.id,
        name: "Review",
        type: "review",
        color: "#6B7280",
        position: 0,
        isDefault: true,
      })
      .returning();

    const user4d = await signedInCookie(testApp.test, {
      name: "User 4d",
      email: `user4d-${rand}@mail.test`,
      emailVerified: true,
    });

    const [post4d] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prod4d.id,
        number: 1,
        title: `Post 4d ${rand}`,
        description: "desc",
        statusId: status4d.id,
        authorId: user4d.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post4d.id, userId: user4d.userId });

    const c4dRes = await request(testApp.http)
      .post(`/api/v1/portal/${ws4dSlug}/${prod4dSlug}/posts/1/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment before suspension" });
    expect(c4dRes.status).toBe(201);

    // Suspend workspace
    await testApp.db
      .update(schema.workspaces)
      .set({ suspendedAt: new Date() })
      .where(eq(schema.workspaces.id, ws4d.id));

    const run4d = await emailWorker.runOnce(futureDate);
    expect(run4d.claimed).toBe(1);
    expect(run4d.cancelled).toBe(1);

    const [batch4d] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, user4d.userId));
    expect(batch4d.status).toBe("cancelled");

    await testApp.db.delete(schema.commentEmailBatches);

    // 5. Drops muted post (cancels batch when all posts are muted after enqueue)
    const user4e = await signedInCookie(testApp.test, {
      name: "User 4e",
      email: `user4e-${rand}@mail.test`,
      emailVerified: true,
    });
    const [{ count: cntE }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const [post4e] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: cntE + 1,
        title: `Post 4e ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: user4e.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post4e.id, userId: user4e.userId });

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${post4e.number}/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment on post to be muted" });

    // Recipient mutes post after enqueue
    await testApp.db.insert(schema.postMutes).values({
      userId: user4e.userId,
      postId: post4e.id,
    });

    const run4e = await emailWorker.runOnce(futureDate);
    expect(run4e.claimed).toBe(1);
    expect(run4e.cancelled).toBe(1);

    const [batch4e] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, user4e.userId));
    expect(batch4e.status).toBe("cancelled");

    await testApp.db.delete(schema.commentEmailBatches);

    // 6. Follows merged comments: resolves to target post
    const user4f = await signedInCookie(testApp.test, {
      name: "User 4f",
      email: `user4f-${rand}@mail.test`,
      emailVerified: true,
    });
    const [{ count: cntF }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));

    const [postOrig] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: cntF + 1,
        title: `Source Post ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: user4f.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postOrig.id, userId: user4f.userId });

    const [postTarget] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: cntF + 2,
        title: `Canonical Target Post ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: user4f.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: postTarget.id, userId: user4f.userId });

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postOrig.number}/comments`)
      .set("Cookie", commenter4.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Comment before post merge" });

    // Merged comment: comment is reparented to target post
    const [commentToMerge] = await testApp.db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.body, "Comment before post merge"));

    await testApp.db
      .update(schema.comments)
      .set({ postId: postTarget.id })
      .where(eq(schema.comments.id, commentToMerge.id));

    const run4f = await emailWorker.runOnce(futureDate);
    expect(run4f.claimed).toBe(1);
    expect(run4f.sent).toBe(1);

    const msgs4f = await getMailpitMessagesFor(user4f.email);
    expect(msgs4f.length).toBe(1);
    const detail4f = await getMailpitMessageDetail(msgs4f[0].ID);
    expect(detail4f.Subject).toContain(`Canonical Target Post ${rand}`);
    expect(detail4f.Text).toContain(`Canonical Target Post ${rand}`);
    expect(detail4f.Text).toContain("Comment before post merge");

    await testApp.db.delete(schema.commentEmailBatches);
  });

  it("retry backoff on SMTP failure, redaction of SMTP_PASS, and mark failed after 5 attempts", async () => {
    const rand = randomBytes(4).toString("hex");
    const recipient = await signedInCookie(testApp.test, {
      name: "Retry Recipient",
      email: `retry-${rand}@mail.test`,
      emailVerified: true,
    });

    const commenter5 = await signedInCookie(testApp.test, {
      name: "Commenter 5",
      email: `commenter5-${rand}@mail.test`,
      emailVerified: true,
    });

    const [defStatus] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodId))
      .limit(1);

    const [{ count }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const postNum = count + 1;

    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: postNum,
        title: `Retry Post ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: recipient.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post.id, userId: recipient.userId });

    await testApp.db.delete(schema.commentEmailBatches);

    // Comment POST returns 201 before SMTP is ever touched
    const res = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNum}/comments`)
      .set("Cookie", commenter5.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Retry test comment" });
    expect(res.status).toBe(201);

    const [batch] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, recipient.userId));
    expect(batch.status).toBe("pending");
    expect(batch.attempts).toBe(0);

    // Simulate unreachable SMTP on port 1
    const origPort = (emailWorker as any).env.SMTP_PORT;
    (emailWorker as any).env.SMTP_PORT = 1;

    try {
      const t0 = new Date(Date.now() + 25 * 3600_000);

      // Attempt 1: backoff 5 minutes
      const run1 = await emailWorker.runOnce(t0);
      expect(run1.claimed).toBe(1);
      expect(run1.failed).toBe(1);

      const [b1] = await testApp.db
        .select()
        .from(schema.commentEmailBatches)
        .where(eq(schema.commentEmailBatches.id, batch.id));
      expect(b1.status).toBe("retrying");
      expect(b1.attempts).toBe(1);
      expect(b1.lastError).toBeTruthy();
      expect(b1.lastError).not.toContain("super-secret-password-xyz");
      const diff1 = (new Date(b1.sendAfter).getTime() - t0.getTime()) / 60_000;
      expect(diff1).toBeCloseTo(5, 0);

      // Attempt 2: at t0 + 6m -> backoff 30 minutes
      const t1 = new Date(t0.getTime() + 6 * 60_000);
      const run2 = await emailWorker.runOnce(t1);
      expect(run2.claimed).toBe(1);

      const [b2] = await testApp.db
        .select()
        .from(schema.commentEmailBatches)
        .where(eq(schema.commentEmailBatches.id, batch.id));
      expect(b2.status).toBe("retrying");
      expect(b2.attempts).toBe(2);
      const diff2 = (new Date(b2.sendAfter).getTime() - t1.getTime()) / 60_000;
      expect(diff2).toBeCloseTo(30, 0);

      // Attempt 3: at t1 + 31m -> backoff 120 minutes (2h)
      const t2 = new Date(t1.getTime() + 31 * 60_000);
      const run3 = await emailWorker.runOnce(t2);
      expect(run3.claimed).toBe(1);

      const [b3] = await testApp.db
        .select()
        .from(schema.commentEmailBatches)
        .where(eq(schema.commentEmailBatches.id, batch.id));
      expect(b3.status).toBe("retrying");
      expect(b3.attempts).toBe(3);
      const diff3 = (new Date(b3.sendAfter).getTime() - t2.getTime()) / 60_000;
      expect(diff3).toBeCloseTo(120, 0);

      // Attempt 4: at t2 + 121m -> backoff 360 minutes (6h)
      const t3 = new Date(t2.getTime() + 121 * 60_000);
      const run4 = await emailWorker.runOnce(t3);
      expect(run4.claimed).toBe(1);

      const [b4] = await testApp.db
        .select()
        .from(schema.commentEmailBatches)
        .where(eq(schema.commentEmailBatches.id, batch.id));
      expect(b4.status).toBe("retrying");
      expect(b4.attempts).toBe(4);
      const diff4 = (new Date(b4.sendAfter).getTime() - t3.getTime()) / 60_000;
      expect(diff4).toBeCloseTo(360, 0);

      // Attempt 5: at t3 + 361m -> marks failed
      const t4 = new Date(t3.getTime() + 361 * 60_000);
      const run5 = await emailWorker.runOnce(t4);
      expect(run5.claimed).toBe(1);

      const [b5] = await testApp.db
        .select()
        .from(schema.commentEmailBatches)
        .where(eq(schema.commentEmailBatches.id, batch.id));
      expect(b5.status).toBe("failed");
      expect(b5.attempts).toBe(5);
      expect(b5.lastError).toBeTruthy();
      expect(b5.lastError).not.toContain("super-secret-password-xyz");
    } finally {
      (emailWorker as any).env.SMTP_PORT = origPort;
      await testApp.db.delete(schema.commentEmailBatches);
    }
  });

  it("reclaim: a batch in sending with claimed_at > 10 minutes ago is reclaimed and sent", async () => {
    const rand = randomBytes(4).toString("hex");
    const recipient = await signedInCookie(testApp.test, {
      name: "Reclaim Recipient",
      email: `reclaim-${rand}@mail.test`,
      emailVerified: true,
    });

    const commenter6 = await signedInCookie(testApp.test, {
      name: "Commenter 6",
      email: `commenter6-${rand}@mail.test`,
      emailVerified: true,
    });

    const [defStatus] = await testApp.db
      .select()
      .from(schema.statuses)
      .where(eq(schema.statuses.productId, prodId))
      .limit(1);

    const [{ count }] = await testApp.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.posts)
      .where(eq(schema.posts.productId, prodId));
    const postNum = count + 1;

    const [post] = await testApp.db
      .insert(schema.posts)
      .values({
        productId: prodId,
        number: postNum,
        title: `Reclaim Post ${rand}`,
        description: "desc",
        statusId: defStatus.id,
        authorId: recipient.userId,
        authorIsAdmin: false,
        voteCount: 1,
      })
      .returning();
    await testApp.db.insert(schema.votes).values({ postId: post.id, userId: recipient.userId });

    await testApp.db.delete(schema.commentEmailBatches);

    await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/${postNum}/comments`)
      .set("Cookie", commenter6.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Reclaim comment" });

    const [batch] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.userId, recipient.userId));

    // Put batch in 'sending' state claimed 11 minutes ago
    const elevenMinutesAgo = new Date(Date.now() - 11 * 60_000);
    await testApp.db
      .update(schema.commentEmailBatches)
      .set({
        status: "sending",
        claimedAt: elevenMinutesAgo,
      })
      .where(eq(schema.commentEmailBatches.id, batch.id));

    // Run now: elevenMinutesAgo < reclaimThreshold (now - 10m)
    const result = await emailWorker.runOnce(new Date());
    expect(result.claimed).toBe(1);
    expect(result.sent).toBe(1);

    const [updated] = await testApp.db
      .select()
      .from(schema.commentEmailBatches)
      .where(eq(schema.commentEmailBatches.id, batch.id));
    expect(updated.status).toBe("sent");

    const msgs = await getMailpitMessagesFor(recipient.email);
    expect(msgs.length).toBeGreaterThanOrEqual(1);

    await testApp.db.delete(schema.commentEmailBatches);
  });

  it("startup and config: SMTP_HOST unset disables worker interval; missing SMTP_FROM throws", () => {
    // 1. Worker reports disabled when SMTP_HOST is unset
    const disabledWorker = new EmailWorker(testApp.db, {
      ...testApp.env,
      SMTP_HOST: undefined,
    });
    expect(disabledWorker.enabled).toBe(false);

    // 2. loadEnv throws when SMTP_HOST is set but SMTP_FROM is missing
    const baseEnv = {
      DATABASE_URL: testApp.env.DATABASE_URL,
      PUBLIC_URL: testApp.env.PUBLIC_URL,
      BETTER_AUTH_SECRET: testApp.env.BETTER_AUTH_SECRET,
      GOOGLE_CLIENT_ID: "dummy",
      GOOGLE_CLIENT_SECRET: "dummy",
      GITHUB_CLIENT_ID: "dummy",
      GITHUB_CLIENT_SECRET: "dummy",
      PLATFORM_OWNER_EMAIL: "owner@test.com",
    };

    expect(() =>
      loadEnv({
        ...baseEnv,
        SMTP_HOST: "mail.example.com",
        SMTP_FROM: "",
      })
    ).toThrow(/SMTP_FROM/);

    expect(() =>
      loadEnv({
        ...baseEnv,
        SMTP_HOST: "mail.example.com",
      })
    ).toThrow(/SMTP_FROM/);
  });
});
