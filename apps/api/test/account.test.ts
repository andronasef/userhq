import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  user,
  workspaces,
  products,
  statuses,
  posts,
  workspaceMembers,
  commentEmailBatches,
} from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { EmailWorker } from "../src/email/worker.js";

describe("Account Settings & Preferences (Plan 03-14)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let emailWorker: EmailWorker;
  let userA: { cookie: string; userId: string; email: string };
  let userB: { cookie: string; userId: string; email: string };
  let ownerUser: { cookie: string; userId: string; email: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let defaultStatusId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    emailWorker = testApp.app.get(EmailWorker);

    const rand = randomBytes(4).toString("hex");
    const emailA = `account-a-${rand}@mail.test`;
    const emailB = `account-b-${rand}@mail.test`;
    const ownerEmail = testApp.env.PLATFORM_OWNER_EMAIL;

    userA = {
      ...(await signedInCookie(testApp.test, {
        name: "Account Alice",
        email: emailA,
        emailVerified: true,
      })),
      email: emailA,
    };

    userB = {
      ...(await signedInCookie(testApp.test, {
        name: "Account Bob",
        email: emailB,
        emailVerified: true,
      })),
      email: emailB,
    };

    ownerUser = {
      ...(await signedInCookie(testApp.test, {
        name: "Platform Owner",
        email: ownerEmail,
        emailVerified: true,
      })),
      email: ownerEmail,
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
        name: "Account Workspace",
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
        name: "Account Product",
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

  it("tracer: a user turns comment emails off and on", async () => {
    // 1. GET /api/v1/account returns commentEmails true and NO email key
    const getRes = await request(testApp.http)
      .get("/api/v1/account")
      .set("Cookie", userA.cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual({
      name: "Account Alice",
      image: null,
      commentEmails: true,
      isPlatformOwner: false,
    });
    expect(getRes.body.email).toBeUndefined();
    expect(Object.keys(getRes.body).sort()).toEqual([
      "commentEmails",
      "image",
      "isPlatformOwner",
      "name",
    ]);

    // 2. Setup a post and a comment while commentEmails is true -> batch is enqueued
    await testApp.db
      .insert(posts)
      .values({
        productId: prodId,
        number: 1,
        title: "Preferences notification test",
        statusId: defaultStatusId,
        authorId: userA.userId,
      });

    const commentRes = await request(testApp.http)
      .post(`/api/v1/portal/${wsSlug}/${prodSlug}/posts/1/comments`)
      .set("Cookie", userB.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "A notification-triggering comment" });
    expect(commentRes.status).toBe(201);

    const [batchBefore] = await testApp.db
      .select()
      .from(commentEmailBatches)
      .where(
        and(
          eq(commentEmailBatches.userId, userA.userId),
          eq(commentEmailBatches.status, "pending")
        )
      );
    expect(batchBefore).toBeDefined();

    // 3. User turns comment emails off via PATCH /preferences
    const patchRes = await request(testApp.http)
      .patch("/api/v1/account/preferences")
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ commentEmails: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.commentEmails).toBe(false);

    const [dbUserAfterPatch] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserAfterPatch.commentEmails).toBe(false);

    // 4. Pending batch is cancelled at send time by worker
    const futureDate = new Date(Date.now() + 25 * 3600_000);
    const workerResult = await emailWorker.runOnce(futureDate);
    expect(workerResult.sent).toBe(0);

    const [batchAfter] = await testApp.db
      .select()
      .from(commentEmailBatches)
      .where(eq(commentEmailBatches.id, batchBefore.id));
    expect(batchAfter.status).toBe("cancelled");

    // 5. User turns comment emails back on
    const patchBackRes = await request(testApp.http)
      .patch("/api/v1/account/preferences")
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ commentEmails: true });
    expect(patchBackRes.status).toBe(200);
    expect(patchBackRes.body.commentEmails).toBe(true);

    const [dbUserFinal] = await testApp.db
      .select({ commentEmails: user.commentEmails })
      .from(user)
      .where(eq(user.id, userA.userId));
    expect(dbUserFinal.commentEmails).toBe(true);
  });

  it("requires authentication and recognizes platform owner", async () => {
    // 1. Signed-out GET /account returns 401
    const unauthGetRes = await request(testApp.http).get("/api/v1/account");
    expect(unauthGetRes.status).toBe(401);

    // 2. Signed-out PATCH returns 401
    const unauthPatchRes = await request(testApp.http)
      .patch("/api/v1/account/preferences")
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ commentEmails: false });
    expect(unauthPatchRes.status).toBe(401);

    // 3. Platform owner's GET returns isPlatformOwner: true
    const ownerRes = await request(testApp.http)
      .get("/api/v1/account")
      .set("Cookie", ownerUser.cookie);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.isPlatformOwner).toBe(true);
  });
});
