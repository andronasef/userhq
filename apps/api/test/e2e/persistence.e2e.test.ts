import { execSync } from "node:child_process";
import * as crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { testUtils } from "better-auth/plugins";
import { createDb, schema } from "@userhq/db";
import { eq, sql } from "drizzle-orm";
import { createAuth } from "../../src/auth/auth.js";
import type { Env } from "../../src/env.js";
import { signedInCookie } from "../support/test-app.js";
import { pngOfSize } from "../support/images.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const databaseUrl = process.env.E2E_DATABASE_URL!;

describe("Redeploy Persistence E2E (Plan 01-09)", () => {
  it(
    "preserves accounts, uploads and migration count across docker compose down and up",
    async () => {
      let dbInstance = createDb(databaseUrl);

      const env: Env = {
        NODE_ENV: "production",
        PORT: 4000,
        DATABASE_URL: databaseUrl,
        PUBLIC_URL: baseUrl,
        BETTER_AUTH_SECRET:
          process.env.BETTER_AUTH_SECRET ??
          "428905b3e64f89d34cb01676f112e472652b0475f32ebf25091bcae52d3eb03a",
        GOOGLE_CLIENT_ID:
          process.env.GOOGLE_CLIENT_ID ?? "dummy-google-client-id",
        GOOGLE_CLIENT_SECRET:
          process.env.GOOGLE_CLIENT_SECRET ?? "dummy-google-client-secret",
        GITHUB_CLIENT_ID:
          process.env.GITHUB_CLIENT_ID ?? "dummy-github-client-id",
        GITHUB_CLIENT_SECRET:
          process.env.GITHUB_CLIENT_SECRET ?? "dummy-github-client-secret",
        UPLOAD_DIR: "/data/uploads",
      };

      const auth = createAuth(dbInstance.db, env, [testUtils()]);
      const ctx = await (auth as any).$context;
      const sessionData = await signedInCookie(ctx.test, {
        name: "Persistence User",
      });

      // 1. Upload a PNG
      const pngBuffer = await pngOfSize(200, 200);
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([pngBuffer], { type: "image/png" }),
        "persist-test.png"
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
      const uploadJson = await uploadRes.json();
      const storageKey = uploadJson.url.replace(/^\/uploads\//, "");

      // Download WebP and compute sha256 before restart
      const getBefore = await fetch(`${baseUrl}${uploadJson.url}`);
      expect(getBefore.status).toBe(200);
      const bytesBefore = Buffer.from(await getBefore.arrayBuffer());
      const hashBefore = crypto
        .createHash("sha256")
        .update(bytesBefore)
        .digest("hex");

      // Record migration count before restart
      const countResBefore = await dbInstance.db.execute<{ count: number }>(
        sql`SELECT count(*)::int as count FROM drizzle.__drizzle_migrations`
      );
      const migrationCountBefore = countResBefore.rows[0].count;
      expect(migrationCountBefore).toBeGreaterThanOrEqual(2);

      // Close all DB connections before tearing down containers
      await dbInstance.pool.end();

      // 2. Perform compose down and up without --volumes
      const downCmd =
        "docker compose -f compose.yaml -f compose.local.yaml --env-file .env.docker down";
      expect(downCmd).not.toContain("--volumes");
      expect(downCmd).not.toContain("-v ");
      execSync(downCmd, { cwd: repoRoot, stdio: "inherit" });

      const upCmd =
        "docker compose -f compose.yaml -f compose.local.yaml --env-file .env.docker up -d --build --force-recreate --wait";
      expect(upCmd).not.toContain("--volumes");
      expect(upCmd).not.toContain("-v ");
      execSync(upCmd, { cwd: repoRoot, stdio: "inherit" });

      // 3. Reconnect to DB and verify persistence
      dbInstance = createDb(databaseUrl);
      try {
        // Verify health endpoint with retry to gracefully handle post-restart TCP reconnects
        let healthRes: Response | null = null;
        for (let attempt = 0; attempt < 30; attempt++) {
          try {
            const res = await fetch(`${baseUrl}/api/v1/health`, {
              headers: { Connection: "close" },
            });
            if (res.status === 200) {
              healthRes = res;
              break;
            }
          } catch {
            // Transient connection reset while new container sockets establish
          }
          await new Promise((r) => setTimeout(r, 1000));
        }

        expect(healthRes).not.toBeNull();
        expect(healthRes!.status).toBe(200);
        const healthJson = await healthRes!.json();
        expect(healthJson.status).toBe("ok");

        // Verify image download has identical bytes and hash
        const getAfter = await fetch(`${baseUrl}${uploadJson.url}`);
        expect(getAfter.status).toBe(200);
        expect(getAfter.headers.get("content-type")).toContain("image/webp");
        const bytesAfter = Buffer.from(await getAfter.arrayBuffer());
        const hashAfter = crypto
          .createHash("sha256")
          .update(bytesAfter)
          .digest("hex");
        expect(hashAfter).toBe(hashBefore);

        // Verify uploads row exists with same storage key and uploaderId
        const uploadRows = await dbInstance.db
          .select()
          .from(schema.uploads)
          .where(eq(schema.uploads.storageKey, storageKey));
        expect(uploadRows).toHaveLength(1);
        expect(uploadRows[0].uploaderId).toBe(sessionData.userId);

        // Verify user row exists
        const userRows = await dbInstance.db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, sessionData.userId));
        expect(userRows).toHaveLength(1);

        // Verify migration count is unchanged (idempotency check)
        const countResAfter = await dbInstance.db.execute<{ count: number }>(
          sql`SELECT count(*)::int as count FROM drizzle.__drizzle_migrations`
        );
        const migrationCountAfter = countResAfter.rows[0].count;
        expect(migrationCountAfter).toBe(migrationCountBefore);

        // Clean up test rows
        await dbInstance.db
          .delete(schema.uploads)
          .where(eq(schema.uploads.storageKey, storageKey));
        await dbInstance.db
          .delete(schema.user)
          .where(eq(schema.user.id, sessionData.userId));
      } finally {
        await dbInstance.pool.end();
      }
    },
    900000 // 15 minutes timeout
  );
});
