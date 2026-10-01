import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Auth Tracer (Task 1)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("anonymous GET /api/v1/me returns { user: null }", async () => {
    const res = await request(testApp.http).get("/api/v1/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("signed-in GET /api/v1/me returns the user with exactly id, name, image (no email)", async () => {
    const { cookie, userId } = await signedInCookie(testApp.test, {
      name: "Tracer User",
      image: "https://example.com/avatar.png",
    });

    const res = await request(testApp.http)
      .get("/api/v1/me")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.name).toBe("Tracer User");
    expect(res.body.user.image).toBe("https://example.com/avatar.png");
    expect(Object.keys(res.body.user).sort()).toEqual(["id", "image", "name"]);
    expect(res.body.user.email).toBeUndefined();
  });
});
