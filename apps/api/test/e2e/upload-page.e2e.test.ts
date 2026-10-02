import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testUtils } from "better-auth/plugins";
import { createDb, schema } from "@userhq/db";
import { eq } from "drizzle-orm";
import { createAuth } from "../../src/auth/auth.js";
import type { Env } from "../../src/env.js";
import { signedInCookie } from "../support/test-app.js";
import { pngOfSize } from "../support/images.js";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const databaseUrl = process.env.E2E_DATABASE_URL!;

describe("Dev Upload Page E2E (Plan 01-08)", () => {
  let dbInstance: ReturnType<typeof createDb>;
  let sessionData: { cookie: string; userId: string; email: string };
  let uploadedStorageKey: string | null = null;

  beforeAll(async () => {
    dbInstance = createDb(databaseUrl);

    const env: Env = {
      NODE_ENV: "production",
      PORT: 4000,
      DATABASE_URL: databaseUrl,
      PUBLIC_URL: baseUrl,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "428905b3e64f89d34cb01676f112e472652b0475f32ebf25091bcae52d3eb03a",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "dummy-google-client-id",
      GOOGLE_CLIENT_SECRET:
        process.env.GOOGLE_CLIENT_SECRET ?? "dummy-google-client-secret",
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "dummy-github-client-id",
      GITHUB_CLIENT_SECRET:
        process.env.GITHUB_CLIENT_SECRET ?? "dummy-github-client-secret",
      UPLOAD_DIR: "/data/uploads",
    };

    const auth = createAuth(dbInstance.db, env, [testUtils()]);
    const ctx = await (auth as any).$context;
    sessionData = await signedInCookie(ctx.test, { name: "Dev Uploader" });
  });

  afterAll(async () => {
    if (uploadedStorageKey && dbInstance) {
      await dbInstance.db
        .delete(schema.uploads)
        .where(eq(schema.uploads.storageKey, uploadedStorageKey));
    }
    if (sessionData?.userId && dbInstance) {
      await dbInstance.db
        .delete(schema.user)
        .where(eq(schema.user.id, sessionData.userId));
    }
    if (dbInstance?.pool) {
      await dbInstance.pool.end();
    }
  });

  it("case 1: anonymous GET /dev/upload returns 307 redirect to /login?next=%2Fdev%2Fupload", async () => {
    const res = await fetch(`${baseUrl}/dev/upload`, {
      redirect: "manual",
    });
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location.endsWith("/login?next=%2Fdev%2Fupload")).toBe(true);
  });

  it("case 2: signed-in GET /dev/upload returns 200 with dev header, input without accept", async () => {
    const res = await fetch(`${baseUrl}/dev/upload`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Upload test");
    expect(html).toContain("Dev only");
    expect(html).toContain('id="upload-file"');

    const inputTagMatch = html.match(/<input[^>]*id="upload-file"[^>]*>/);
    expect(inputTagMatch).not.toBeNull();
    expect(inputTagMatch![0]).not.toContain("accept=");
  });

  it("case 3: signed-in GET / contains Test image uploads link", async () => {
    const res = await fetch(`${baseUrl}/`, {
      headers: { Cookie: sessionData.cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Test image uploads");
  });

  it("case 4: routed upload contract: 2000x1000 PNG POST returns 201 with 1600x800 webp", async () => {
    const pngBuffer = await pngOfSize(2000, 1000);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pngBuffer], { type: "image/png" }),
      "test-2000x1000.png"
    );

    const uploadRes = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: {
        Cookie: sessionData.cookie,
        Origin: baseUrl,
      },
      body: formData,
    });

    expect(uploadRes.status).toBe(201);
    const body = await uploadRes.json();
    expect(body.width).toBe(1600);
    expect(body.height).toBe(800);
    expect(body.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);

    uploadedStorageKey = body.url.replace(/^\/uploads\//, "");

    // Check GET of returned url through Caddy /uploads
    const getRes = await fetch(`${baseUrl}${body.url}`);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("content-type")).toContain("image/webp");
    expect(getRes.headers.get("cache-control")).toContain("immutable");

    // Check database row carries minted user's id
    const rows = await dbInstance.db
      .select()
      .from(schema.uploads)
      .where(eq(schema.uploads.storageKey, uploadedStorageKey));
    expect(rows).toHaveLength(1);
    expect(rows[0].uploaderId).toBe(sessionData.userId);
  });

  it("case 5: anonymous upload POST returns 401 unauthorized", async () => {
    const pngBuffer = await pngOfSize(10, 10);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pngBuffer], { type: "image/png" }),
      "anon.png"
    );

    const anonRes = await fetch(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers: {
        Origin: baseUrl,
      },
      body: formData,
    });

    expect(anonRes.status).toBe(401);
    const json = await anonRes.json();
    expect(json.code).toBe("unauthorized");
  });
});
