import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@userhq/db";
import { UPLOAD_URL_PATTERN } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import {
  pngOfSize,
  padPngTo,
  jpegWithExif,
  animatedGif,
  apngFrom,
  svgText,
  htmlAsPng,
  pdfBytes,
  pixelBombPng,
  truncatedPng,
} from "./support/images.js";
import { writeUpload, assertWritable } from "../src/uploads/storage.js";

describe("Uploads Pipeline (Plan 01-07)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let cookie: string;
  let userId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    const authUser = await signedInCookie(testApp.test, {
      name: "Upload User",
    });
    cookie = authUser.cookie;
    userId = authUser.userId;
  });

  afterAll(async () => {
    await testApp.close();
  });

  // Task 1 tracer case
  it("tracer: signed-in PNG upload is stored as WebP and served", async () => {
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

    const getRes = await request(testApp.http).get(uploadRes.body.url);
    expect(getRes.status).toBe(200);
    expect(getRes.headers["content-type"]).toMatch(/image\/webp/);
    expect(getRes.headers["cache-control"]).toContain("immutable");

    const rows = await testApp.db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.storageKey, storageKey));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.uploaderId).toBe(userId);
    expect(rows[0]!.width).toBe(1600);
    expect(rows[0]!.height).toBe(800);
  });

  // UPLD-01: exact size boundary
  it("exact size: 2097152 accepted", async () => {
    const base = await pngOfSize(10, 10);
    const padded = padPngTo(base, 2_097_152);
    expect(padded.length).toBe(2_097_152);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", padded, "boundary-exact.png");

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(UPLOAD_URL_PATTERN);
  });

  it("exact size: 2097153 rejected with file_too_large", async () => {
    const base = await pngOfSize(10, 10);
    const oversized = padPngTo(base, 2_097_153);
    expect(oversized.length).toBe(2_097_153);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", oversized, "boundary-over.png");

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("file_too_large");
    expect(res.body.message).toBe("Images must be 2 MB or smaller.");
  });

  // UPLD-01: width cap and no upscale
  it("width cap: 1600 unchanged", async () => {
    const img = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "1600x900.png");

    expect(res.status).toBe(201);
    expect(res.body.width).toBe(1600);
    expect(res.body.height).toBe(900);
  });

  it("width cap: 1601 downscaled to 1600", async () => {
    const img = await sharp({
      create: { width: 1601, height: 900, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "1601x900.png");

    expect(res.status).toBe(201);
    expect(res.body.width).toBe(1600);
  });

  it("width cap: 800x600 no upscale", async () => {
    const img = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "800x600.png");

    expect(res.status).toBe(201);
    expect(res.body.width).toBe(800);
    expect(res.body.height).toBe(600);
  });

  // UPLD-01: aspect ratio preservation
  it("aspect ratio: 3000x2000 downscaled keeps aspect ratio", async () => {
    const img = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "3000x2000.png");

    expect(res.status).toBe(201);
    expect(res.body.width).toBe(1600);
    expect(Math.abs(res.body.height - 1067)).toBeLessThanOrEqual(1);
  });

  it("aspect ratio: 1601x1000 downscaled keeps aspect ratio within 1px", async () => {
    const img = await sharp({
      create: { width: 1601, height: 1000, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "1601x1000.png");

    expect(res.status).toBe(201);
    expect(res.body.width).toBe(1600);
    expect(Math.abs(res.body.height - 999)).toBeLessThanOrEqual(1);
  });

  // UPLD-01: first frame only
  it("first frame: animated gif single frame stored as 1 page", async () => {
    const gif = animatedGif();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", gif, "anim.gif");

    expect(res.status).toBe(201);

    const getRes = await request(testApp.http).get(res.body.url);
    const meta = await sharp(getRes.body, { animated: true }).metadata();
    expect(meta.pages ?? 1).toBe(1);
  });

  it("first frame: apng accepted and stored as 1 page", async () => {
    const base = await pngOfSize(20, 20);
    const apng = apngFrom(base);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", apng, "anim.png");

    expect(res.status).toBe(201);

    const getRes = await request(testApp.http).get(res.body.url);
    const meta = await sharp(getRes.body, { animated: true }).metadata();
    expect(meta.pages ?? 1).toBe(1);
  });

  // UPLD-01: metadata stripping
  it("metadata: exif stripped from JPEG with GPS", async () => {
    const jpeg = await jpegWithExif(100, 100);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", jpeg, "photo.jpg");

    expect(res.status).toBe(201);

    const getRes = await request(testApp.http).get(res.body.url);
    const meta = await sharp(getRes.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
  });

  // UPLD-01: type sniffing
  it("sniffing: svg rejected with unsupported_type", async () => {
    const svg = svgText();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", svg, "vector.svg");

    expect(res.status).toBe(415);
    expect(res.body.code).toBe("unsupported_type");
  });

  it("sniffing: renamed html rejected with unsupported_type", async () => {
    const html = htmlAsPng();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", html, "photo.png");

    expect(res.status).toBe(415);
    expect(res.body.code).toBe("unsupported_type");
  });

  it("sniffing: pdf rejected with unsupported_type", async () => {
    const pdf = pdfBytes();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", pdf, "document.pdf");

    expect(res.status).toBe(415);
    expect(res.body.code).toBe("unsupported_type");
  });

  it("sniffing: valid webp accepted", async () => {
    const webp = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 50, g: 50, b: 50 } },
    })
      .webp()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", webp, "image.webp");

    expect(res.status).toBe(201);
    expect(res.body.format).toBe("webp");
  });

  it("sniffing: valid jpeg accepted", async () => {
    const jpeg = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 50, g: 50, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", jpeg, "image.jpeg");

    expect(res.status).toBe(201);
    expect(res.body.format).toBe("webp");
  });

  // UPLD-01: limits
  it("limits: pixel bomb 48MP rejected with image_too_large", async () => {
    const bomb = await pixelBombPng();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", bomb, "bomb.png");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("image_too_large");
  });

  it("limits: truncated png rejected with image_unreadable", async () => {
    const trunc = await truncatedPng();

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", trunc, "corrupt.png");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("image_unreadable");
  });

  // UPLD-01: fields
  it("fields: no file part rejected with no_file", async () => {
    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_file");
  });

  it("fields: empty multipart rejected with no_file", async () => {
    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .set("Content-Type", "multipart/form-data; boundary=----WebKitFormBoundaryDummy")
      .send("------WebKitFormBoundaryDummy--\r\n");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_file");
  });

  it("fields: JSON body rejected with no_file", async () => {
    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ notAFile: true }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_file");
  });

  it("fields: multiple files rejected with no_file", async () => {
    const img1 = await pngOfSize(10, 10);
    const img2 = await pngOfSize(10, 10);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img1, "one.png")
      .attach("file2", img2, "two.png");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_file");
  });

  it("fields: extra field like purpose rejected with no_file", async () => {
    const img = await pngOfSize(10, 10);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "photo.png")
      .field("purpose", "avatar");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("no_file");
  });

  // UPLD-01: authentication and origin
  it("auth: anonymous upload rejected with unauthorized", async () => {
    const img = await pngOfSize(10, 10);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "anon.png");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("unauthorized");
  });

  it("auth: forbidden origin rejected with forbidden", async () => {
    const img = await pngOfSize(10, 10);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", "https://evil.example")
      .attach("file", img, "csrf.png");

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("forbidden");
  });

  // UPLD-01: naming and traversal guard
  it("naming: traversal name does not escape and URL matches pattern", async () => {
    const img = await pngOfSize(10, 10);

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "../../etc/passwd.png");

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(UPLOAD_URL_PATTERN);

    const storageKey = res.body.url.replace(/^\/uploads\//, "");
    expect(storageKey).not.toContain("..");
    expect(storageKey).not.toContain("passwd");

    const filePath = path.join(testApp.env.UPLOAD_DIR, storageKey);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  // UPLD-01: concurrency
  it("concurrency: 8 parallel uploads produce distinct stored files and empty .tmp", async () => {
    const images = await Promise.all(
      Array.from({ length: 8 }, () => pngOfSize(20, 20))
    );

    const tasks = images.map((buf, i) =>
      request(testApp.http)
        .post("/api/v1/uploads")
        .set("Cookie", cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .attach("file", buf, `concurrent-${i}.png`)
    );

    const results = await Promise.all(tasks);

    for (const r of results) {
      expect(r.status).toBe(201);
    }

    const urls = results.map((r) => r.body.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(8);

    const storageKeys = urls.map((u) => u.replace(/^\/uploads\//, ""));
    const rows = await testApp.db
      .select()
      .from(schema.uploads)
      .where(inArray(schema.uploads.storageKey, storageKeys));
    expect(rows).toHaveLength(8);

    const tmpDir = path.join(testApp.env.UPLOAD_DIR, ".tmp");
    if (fs.existsSync(tmpDir)) {
      expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    }
  });

  // UPLD-01: partial write cleanup
  it("partial write: writeUpload cleans temp on rename failure", async () => {
    const buf = await pngOfSize(10, 10);
    const failingFs = {
      ...fs.promises,
      rename: vi.fn().mockRejectedValue(new Error("Disk error during rename")),
    };

    await expect(
      writeUpload(testApp.env.UPLOAD_DIR, buf, new Date(), failingFs as any)
    ).rejects.toThrow("Disk error during rename");

    const tmpDir = path.join(testApp.env.UPLOAD_DIR, ".tmp");
    if (fs.existsSync(tmpDir)) {
      expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    }
  });

  it("partial write: controller rolls back file and returns 500 on db insert failure", async () => {
    const img = await pngOfSize(10, 10);

    const spy = vi.spyOn(testApp.db, "insert").mockImplementationOnce(() => {
      throw new Error("Simulated database failure");
    });

    const res = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "db-fail.png");

    expect(res.status).toBe(500);
    expect(res.body.code).toBe("internal_error");
    spy.mockRestore();

    const tmpDir = path.join(testApp.env.UPLOAD_DIR, ".tmp");
    if (fs.existsSync(tmpDir)) {
      expect(fs.readdirSync(tmpDir)).toHaveLength(0);
    }
  });

  // Serving and headers
  it("serving headers: GET /uploads/ has nosniff, csp, and immutable cache-control", async () => {
    const img = await pngOfSize(10, 10);
    const uploadRes = await request(testApp.http)
      .post("/api/v1/uploads")
      .set("Cookie", cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .attach("file", img, "headers.png");

    expect(uploadRes.status).toBe(201);

    const getRes = await request(testApp.http).get(uploadRes.body.url);
    expect(getRes.status).toBe(200);
    expect(getRes.headers["x-content-type-options"]).toBe("nosniff");
    expect(getRes.headers["content-security-policy"]).toBe("default-src 'none'");
    expect(getRes.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(getRes.headers["cache-control"]).toContain("immutable");
    expect(getRes.headers["cache-control"]).toContain("max-age=31536000");
  });

  it("serving headers: no listing for /uploads/ returns 404", async () => {
    const res = await request(testApp.http).get("/uploads/");
    expect(res.status).toBe(404);
  });

  it("serving headers: GET /uploads/.tmp/ returns 404", async () => {
    const res = await request(testApp.http).get("/uploads/.tmp/probe");
    expect([403, 404]).toContain(res.status);
  });

  // Boot probe
  it("boot probe: assertWritable succeeds on valid dir", async () => {
    await expect(assertWritable(testApp.env.UPLOAD_DIR)).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(testApp.env.UPLOAD_DIR, ".tmp"))).toBe(true);
  });

  it("boot probe: assertWritable fails on non-writable or invalid path", async () => {
    const failingFs = {
      ...fs.promises,
      writeFile: vi.fn().mockRejectedValue(new Error("EACCES")),
    };

    await expect(
      assertWritable(testApp.env.UPLOAD_DIR, failingFs as any)
    ).rejects.toThrow(/UPLOAD_DIR is not writable/);
  });
});
