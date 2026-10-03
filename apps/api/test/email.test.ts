import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { EmailWorker } from "../src/email/worker.js";

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
});
