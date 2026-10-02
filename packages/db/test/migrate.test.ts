import { spawn } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
const { Client } = pg;
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const distMigratePath = path.resolve(packageRoot, "dist/migrate.js");

function runMigrateCli(
  env: Record<string, string>
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("node", [distMigratePath], {
      env: { ...process.env, ...env },
      cwd: packageRoot,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function createTempDb(): Promise<{
  url: string;
  drop: () => Promise<void>;
}> {
  const adminUrl =
    process.env.TEST_DATABASE_ADMIN_URL ??
    "postgres://userhq:userhq@127.0.0.1:5432/postgres";
  const dbName = `migrate_test_${crypto.randomBytes(4).toString("hex")}`;
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  const parsed = new URL(adminUrl);
  parsed.pathname = `/${dbName}`;
  const url = parsed.toString();

  const drop = async () => {
    const c = new Client({ connectionString: adminUrl });
    await c.connect();
    await c
      .query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => {});
    await c.end();
  };

  return { url, drop };
}

describe("Migration Runner Properties (Plan 01-09)", () => {
  it("concurrent start: two racing migrate processes apply migrations once without crash", async () => {
    const tempDb = await createTempDb();
    try {
      // Start both processes simultaneously before awaiting either
      const [res1, res2] = await Promise.all([
        runMigrateCli({ DATABASE_URL: tempDb.url }),
        runMigrateCli({ DATABASE_URL: tempDb.url }),
      ]);

      expect(res1.code).toBe(0);
      expect(res2.code).toBe(0);

      const client = new Client({ connectionString: tempDb.url });
      await client.connect();
      try {
        const rowsRes = await client.query<{
          count: string;
          distinct_hashes: string;
        }>(
          "SELECT count(*)::int as count, count(distinct hash)::int as distinct_hashes FROM drizzle.__drizzle_migrations"
        );
        expect(Number(rowsRes.rows[0].count)).toBe(2);
        expect(Number(rowsRes.rows[0].distinct_hashes)).toBe(2);
      } finally {
        await client.end();
      }
    } finally {
      await tempDb.drop();
    }
  });

  it("idempotent restart: subsequent run applies nothing and row count stays unchanged", async () => {
    const tempDb = await createTempDb();
    try {
      const initialRun = await runMigrateCli({ DATABASE_URL: tempDb.url });
      expect(initialRun.code).toBe(0);

      const thirdRun = await runMigrateCli({ DATABASE_URL: tempDb.url });
      expect(thirdRun.code).toBe(0);
      expect(thirdRun.stdout).toContain("up to date (2 applied in total)");

      const client = new Client({ connectionString: tempDb.url });
      await client.connect();
      try {
        const rowsRes = await client.query<{ count: string }>(
          "SELECT count(*)::int as count FROM drizzle.__drizzle_migrations"
        );
        expect(Number(rowsRes.rows[0].count)).toBe(2);
      } finally {
        await client.end();
      }
    } finally {
      await tempDb.drop();
    }
  });

  it("new migration applied: partial folder applies 1, full folder applies second", async () => {
    const tempDb = await createTempDb();
    const tempMigrationsDir = path.join(
      os.tmpdir(),
      `userhq-temp-migrations-${crypto.randomBytes(4).toString("hex")}`
    );

    try {
      const originalMigrationsDir = path.resolve(packageRoot, "migrations");
      fs.cpSync(originalMigrationsDir, tempMigrationsDir, { recursive: true });

      // Rewrite copy's journal to have only entry 0000_auth
      const journalPath = path.join(tempMigrationsDir, "meta/_journal.json");
      const journalContent = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      journalContent.entries = [journalContent.entries[0]];
      fs.writeFileSync(journalPath, JSON.stringify(journalContent, null, 2));

      // 1. Run with partial folder (1 migration)
      const res1 = await runMigrateCli({
        DATABASE_URL: tempDb.url,
        MIGRATIONS_FOLDER: tempMigrationsDir,
      });
      expect(res1.code).toBe(0);

      const client = new Client({ connectionString: tempDb.url });
      await client.connect();
      try {
        const rows1 = await client.query<{ count: string }>(
          "SELECT count(*)::int as count FROM drizzle.__drizzle_migrations"
        );
        expect(Number(rows1.rows[0].count)).toBe(1);

        // 2. Run with real folder (adds second migration)
        const res2 = await runMigrateCli({ DATABASE_URL: tempDb.url });
        expect(res2.code).toBe(0);

        const rows2 = await client.query<{ count: string }>(
          "SELECT count(*)::int as count FROM drizzle.__drizzle_migrations"
        );
        expect(Number(rows2.rows[0].count)).toBe(2);
      } finally {
        await client.end();
      }
    } finally {
      if (fs.existsSync(tempMigrationsDir)) {
        fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
      }
      await tempDb.drop();
    }
  });

  it("failure exit: non-existent database exits with code 1, reports failure, never leaks password", async () => {
    const secretPassword = "super_secret_p@ss_12345";
    const invalidDbUrl = `postgres://userhq:${secretPassword}@127.0.0.1:5432/non_existent_db_${crypto.randomBytes(4).toString("hex")}`;

    const res = await runMigrateCli({ DATABASE_URL: invalidDbUrl });
    expect(res.code).toBe(1);

    const combinedOutput = res.stdout + res.stderr;
    expect(combinedOutput).toContain("migrations: failed");
    expect(combinedOutput).not.toContain(secretPassword);
  });
});
