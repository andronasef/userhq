import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { UPLOAD_URL_PATTERN } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Uploads Pipeline (Plan 01-07)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: signed-in PNG upload is stored as WebP and served", async () => {
    const { cookie, userId } = await signedInCookie(testApp.test, {
      name: "Upload User",
    });

    const pngBuffer = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // 1. Successful upload
    const uploadRes = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", pngBuffer, "test-2000x1000.png");

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.url).toMatch(UPLOAD_URL_PATTERN);
    expect(uploadRes.body.width).toBe(1600);
    expect(uploadRes.body.height).toBe(800);
    expect(uploadRes.body.format).toBe("webp");
    expect(uploadRes.body.bytes).toBeGreaterThan(0);

    const storageKey = uploadRes.body.url.replace(/^\/uploads\//, "");

    // 2. GET the served static asset
    const getRes = await request(testApp.http).get(uploadRes.body.url);
    expect(getRes.status).toBe(200);
    expect(getRes.headers["content-type"]).toMatch(/image\/webp/);
    expect(getRes.headers["cache-control"]).toContain("immutable");

    // 3. Database row verification
    const rows = await testApp.db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.storageKey, storageKey));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.uploaderId).toBe(userId);
    expect(rows[0]!.width).toBe(1600);
    expect(rows[0]!.height).toBe(800);
    expect(rows[0]!.bytes).toBe(uploadRes.body.bytes);

    // 4. Anonymous POST gets 401
    const anonRes = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", pngBuffer, "anon.png");

    expect(anonRes.status).toBe(401);
    expect(anonRes.body.code).toBe("unauthorized");
  });
});
