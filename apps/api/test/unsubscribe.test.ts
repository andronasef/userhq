import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { user } from "@userhq/db";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { signToken } from "../src/email/tokens.js";

describe("Unsubscribe & Mute (Plan 03-13)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let userA: { cookie: string; userId: string; email: string };
  let wsSlug: string;
  let prodSlug: string;

  beforeAll(async () => {
    testApp = await createTestApp();

    const rand = randomBytes(4).toString("hex");
    const emailA = `unsub-a-${rand}@mail.test`;

    userA = {
      ...(await signedInCookie(testApp.test, {
        name: "Unsub Alice",
        email: emailA,
        emailVerified: true,
      })),
      email: emailA,
    };

    // Ensure user has commentEmails = true initially
    await testApp.db
      .update(user)
      .set({ commentEmails: true })
      .where(eq(user.id, userA.userId));

    wsSlug = `ws-${rand}`;
    prodSlug = `prod-${rand}`;

    await request(testApp.http)
      .post("/api/v1/workspaces")
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Unsub Workspace", slug: wsSlug });

    await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products`)
      .set("Cookie", userA.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Unsub Product", slug: prodSlug });
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
});
