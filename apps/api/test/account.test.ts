import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import {
  user,
  session,
  account,
  votes,
  comments,
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
      ownedWorkspaces: [
        {
          slug: wsSlug,
          name: "Account Workspace",
          logoUrl: null,
          productCount: 1,
          postCount: 0,
          members: [],
        },
      ],
    });
    expect(getRes.body.email).toBeUndefined();
    expect(Object.keys(getRes.body).sort()).toEqual([
      "commentEmails",
      "image",
      "isPlatformOwner",
      "name",
      "ownedWorkspaces",
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

describe("Account deletion (Plan 03-15)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let rand: string;
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;
  let statusId: string;
  let ownerId: string;

  const mkUser = async (name: string) => {
    const email = `del-${randomBytes(4).toString("hex")}@mail.test`;
    return {
      ...(await signedInCookie(testApp.test, { name, email, emailVerified: true })),
      email,
      name,
    };
  };
  const mkPost = async (authorId: string, number: number, title: string) => {
    const [p] = await testApp.db
      .insert(posts)
      .values({ productId: prodId, number, title, statusId, authorId })
      .returning();
    return p;
  };
  const del = (cookie: string, workspacesInput: unknown[] = []) =>
    request(testApp.http)
      .post("/api/v1/account/delete")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ workspaces: workspacesInput });
  const portalUrl = (n: number) =>
    `/api/v1/portal/${wsSlug}/${prodSlug}/posts/${n}`;

  const mkWorkspace = async (slug: string, ownerUserId: string, members: string[] = []) => {
    const [w] = await testApp.db
      .insert(workspaces)
      .values({ name: `WS ${slug}`, slug })
      .returning();
    await testApp.db.insert(workspaceMembers).values([
      { workspaceId: w.id, userId: ownerUserId, role: "owner" as const },
      ...members.map((m) => ({ workspaceId: w.id, userId: m, role: "admin" as const })),
    ]);
    return w;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    rand = randomBytes(4).toString("hex");
    const owner = await mkUser("Board Owner");
    ownerId = owner.userId;
    wsSlug = `del-ws-${rand}`;
    const w = await mkWorkspace(wsSlug, ownerId);
    wsId = w.id;
    prodSlug = `del-prod-${rand}`;
    const [prod] = await testApp.db
      .insert(products)
      .values({ workspaceId: wsId, name: "Del Product", slug: prodSlug })
      .returning();
    prodId = prod.id;
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
    statusId = seeded.find((s) => s.isDefault)!.id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: deleting an account scrubs identity and keeps content and votes", async () => {
    const u = await mkUser("Doomed Dana");
    const other = await mkUser("Other Olive");
    const p1 = await mkPost(u.userId, 1, "Dana's idea");
    const p2 = await mkPost(other.userId, 2, "Olive's idea");
    const p3 = await mkPost(other.userId, 3, "Olive's second idea");

    const cRes = await request(testApp.http)
      .post(`${portalUrl(2)}/comments`)
      .set("Cookie", u.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ body: "Dana was here" });
    expect(cRes.status).toBe(201);
    const vRes = await request(testApp.http)
      .put(`${portalUrl(3)}/vote`)
      .set("Cookie", u.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(vRes.status).toBe(200);
    const votesBefore = vRes.body.voteCount;

    const res = await del(u.cookie);
    expect(res.status).toBe(204);

    const [row] = await testApp.db.select().from(user).where(eq(user.id, u.userId));
    expect(row.name).toBe("");
    expect(row.image).toBeNull();
    expect(row.email).toBe(`deleted-${u.userId}@deleted.invalid`);
    expect(row.emailVerified).toBe(false);
    expect(row.commentEmails).toBe(false);
    expect(row.deletedAt).not.toBeNull();
    expect(await testApp.db.select().from(session).where(eq(session.userId, u.userId))).toHaveLength(0);
    expect(await testApp.db.select().from(account).where(eq(account.userId, u.userId))).toHaveLength(0);

    // Old cookie is dead, and a second delete is a 401 (scrubbed exactly once)
    const me = await request(testApp.http).get("/api/v1/account").set("Cookie", u.cookie);
    expect(me.status).toBe(401);
    expect((await del(u.cookie)).status).toBe(401);

    // Content stays, shown as Deleted user
    const post1 = await request(testApp.http).get(portalUrl(1));
    expect(post1.status).toBe(200);
    expect(post1.body.post.author).toMatchObject({ name: null, image: null, isAdmin: false, deleted: true });
    expect(JSON.stringify(post1.body)).not.toContain("Doomed Dana");
    const post2 = await request(testApp.http).get(portalUrl(2));
    const mine = post2.body.timeline.find(
      (t: any) => t.kind === "comment" && t.comment.body === "Dana was here"
    );
    expect(mine.comment.author).toMatchObject({ name: null, deleted: true });
    expect(JSON.stringify(post2.body)).not.toContain(u.email);

    // Votes and content rows are untouched
    const post3 = await request(testApp.http).get(portalUrl(3));
    expect(post3.body.post.voteCount).toBe(votesBefore);
    expect(await testApp.db.select().from(votes).where(eq(votes.userId, u.userId))).toHaveLength(1);
    expect(await testApp.db.select().from(comments).where(eq(comments.authorId, u.userId))).toHaveLength(1);
    expect(p1.id && p2.id && p3.id).toBeTruthy();
  });

  it("refuses the platform owner account", async () => {
    const owner = await signedInCookie(testApp.test, {
      name: "Platform Owner",
      email: testApp.env.PLATFORM_OWNER_EMAIL,
      emailVerified: true,
    });
    const res = await del(owner.cookie);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("platform_owner_account");
    const [row] = await testApp.db.select().from(user).where(eq(user.id, owner.userId));
    expect(row.deletedAt).toBeNull();
  });

  it("Better Auth's own delete-user endpoint is not available", async () => {
    const u = await mkUser("Survivor Sam");
    const res = await request(testApp.http)
      .post("/api/auth/delete-user")
      .set("Cookie", u.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    const [row] = await testApp.db.select().from(user).where(eq(user.id, u.userId));
    expect(row.deletedAt).toBeNull();
    expect(row.email).toBe(u.email);
  });
});
