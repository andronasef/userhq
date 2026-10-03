import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createTestApp } from "./support/test-app.js";
import { seedTenants, type Seed } from "./support/seed.js";

describe("Portal Isolation (Plan 03-02)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let seed: Seed;

  beforeAll(async () => {
    testApp = await createTestApp();
    seed = await seedTenants(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("workspace A's product never serves workspace B's post number (404 post_not_found)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${seed.a.slug}/${seed.a.productSlug}/posts/${seed.b.postNumber}`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("post_not_found");
  });

  it("workspace A's workspace slug never serves workspace B's product (404 not_found)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${seed.a.slug}/${seed.b.productSlug}/posts/1`)
      .set("Origin", "http://localhost:3000");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });
});
