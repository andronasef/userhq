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
  env: Record<string, string>,
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

const journalPath = path.resolve(packageRoot, "migrations/meta/_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
const totalMigrations = (journal.entries as unknown[]).length;

describe("Migration Runner Properties (Plan 01-09)", () => {
  it("upgrades existing products with enabled features without changing their content", async () => {
    const tempDb = await createTempDb();
    const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "userhq-feature-migrations-"),
    );
    try {
      fs.cpSync(path.resolve(packageRoot, "migrations"), folder, {
        recursive: true,
      });
      const beforeFeatures = journal.entries.findIndex(
        (entry: { tag: string }) => entry.tag.endsWith("_product_features"),
      );
      expect(beforeFeatures).toBeGreaterThan(0);
      fs.writeFileSync(
        path.join(folder, "meta/_journal.json"),
        JSON.stringify({
          ...journal,
          entries: journal.entries.slice(0, beforeFeatures),
        }),
      );
      expect(
        (
          await runMigrateCli({
            DATABASE_URL: tempDb.url,
            MIGRATIONS_FOLDER: folder,
          })
        ).code,
      ).toBe(0);
      const client = new Client({ connectionString: tempDb.url });
      await client.connect();
      try {
        const ws = await client.query(
          "INSERT INTO workspaces (name, slug) VALUES ('Existing', 'existing') RETURNING id",
        );
        await client.query(
          "INSERT INTO products (workspace_id, name, slug, tagline) VALUES ($1, 'Existing product', 'existing', 'Keep this')",
          [ws.rows[0].id],
        );
        expect((await runMigrateCli({ DATABASE_URL: tempDb.url })).code).toBe(
          0,
        );
        const result = await client.query(
          "SELECT name, tagline, board_enabled, roadmap_enabled, changelog_enabled, faq_enabled FROM products WHERE workspace_id=$1",
          [ws.rows[0].id],
        );
        expect(result.rows).toEqual([
          {
            name: "Existing product",
            tagline: "Keep this",
            board_enabled: true,
            roadmap_enabled: true,
            changelog_enabled: true,
            faq_enabled: true,
          },
        ]);
      } finally {
        await client.end();
      }
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
      await tempDb.drop();
    }
  });
  it("backfills handled state for customer comments that already have a later admin reply in their thread", async () => {
    const tempDb = await createTempDb();
    const folder = fs.mkdtempSync(
      path.join(os.tmpdir(), "userhq-attention-migrations-"),
    );
    try {
      fs.cpSync(path.resolve(packageRoot, "migrations"), folder, {
        recursive: true,
      });
      const backfillIdx = journal.entries.findIndex((entry: { tag: string }) =>
        entry.tag.endsWith("_backfill_comment_attention"),
      );
      expect(backfillIdx, "backfill migration must be in the journal").toBeGreaterThan(0);
      fs.writeFileSync(
        path.join(folder, "meta/_journal.json"),
        JSON.stringify({
          ...journal,
          entries: journal.entries.slice(0, backfillIdx),
        }),
      );
      expect(
        (
          await runMigrateCli({
            DATABASE_URL: tempDb.url,
            MIGRATIONS_FOLDER: folder,
          })
        ).code,
      ).toBe(0);

      const client = new Client({ connectionString: tempDb.url });
      await client.connect();
      try {
        for (const [id, name] of [
          ["u-cust", "Customer"],
          ["u-admin-a", "Admin A"],
          ["u-admin-b", "Admin B"],
        ]) {
          await client.query(
            'INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)',
            [id, name, `${id}@backfill.test`],
          );
        }
        const ws = await client.query(
          "INSERT INTO workspaces (name, slug) VALUES ('Backfill', 'backfill') RETURNING id",
        );
        const prod = await client.query(
          "INSERT INTO products (workspace_id, name, slug) VALUES ($1, 'Backfill product', 'backfill') RETURNING id",
          [ws.rows[0].id],
        );
        const status = await client.query(
          "INSERT INTO statuses (product_id, name, color, type, position) VALUES ($1, 'Open', '#2563EB', 'review', 0) RETURNING id",
          [prod.rows[0].id],
        );
        const mkPost = async (n: number) =>
          (
            await client.query(
              "INSERT INTO posts (product_id, number, title, status_id, author_id) VALUES ($1, $2, $3, $4, 'u-cust') RETURNING id",
              [prod.rows[0].id, n, `Post ${n}`, status.rows[0].id],
            )
          ).rows[0].id as string;
        const post1 = await mkPost(1);
        const post2 = await mkPost(2);

        const ids: Record<string, string> = {};
        const mk = async (
          name: string,
          postId: string,
          author: string,
          isAdmin: boolean,
          at: string,
          extra: { parent?: string; handledAt?: string; handledBy?: string; deletedAt?: string } = {},
        ) => {
          const res = await client.query(
            `INSERT INTO comments (post_id, parent_id, author_id, is_admin, body, created_at, handled_at, handled_by_id, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
              postId,
              extra.parent ? ids[extra.parent] : null,
              author,
              isAdmin,
              name,
              at,
              extra.handledAt ?? null,
              extra.handledBy ?? null,
              extra.deletedAt ?? null,
            ],
          );
          ids[name] = res.rows[0].id;
        };

        // T1: admin replies after the customer root; a later customer reply stays open
        await mk("t1-root", post1, "u-cust", false, "2026-05-01T10:00:00Z");
        await mk("t1-admin", post1, "u-admin-a", true, "2026-05-01T11:00:00Z", { parent: "t1-root" });
        await mk("t1-later-customer", post1, "u-cust", false, "2026-05-01T12:00:00Z", { parent: "t1-root" });
        // T2: the only admin comment is the root and it came first
        await mk("t2-admin-root", post1, "u-admin-a", true, "2026-05-02T10:00:00Z");
        await mk("t2-customer", post1, "u-cust", false, "2026-05-02T11:00:00Z", { parent: "t2-admin-root" });
        // T3: the only later admin comment is soft-deleted
        await mk("t3-root", post1, "u-cust", false, "2026-05-03T10:00:00Z");
        await mk("t3-deleted-admin", post1, "u-admin-a", true, "2026-05-03T11:00:00Z", {
          parent: "t3-root",
          deletedAt: "2026-05-03T12:00:00Z",
        });
        // T4: a post with no admin comment at all
        await mk("t4-only-customer", post2, "u-cust", false, "2026-05-04T10:00:00Z");
        // T5: an admin comment in a different thread of the same post must not resolve this one
        await mk("t5-root", post1, "u-cust", false, "2026-05-05T10:00:00Z");
        await mk("t5-other-admin-root", post1, "u-admin-a", true, "2026-05-05T11:00:00Z");
        // T6: existing handler and time are preserved even though a later admin reply exists
        await mk("t6-root", post1, "u-cust", false, "2026-05-06T10:00:00Z", {
          handledAt: "2026-05-06T10:30:00Z",
          handledBy: "u-admin-b",
        });
        await mk("t6-admin", post1, "u-admin-a", true, "2026-05-06T11:00:00Z", { parent: "t6-root" });
        // T7: the earliest later admin comment wins, regardless of insertion order
        await mk("t7-root", post1, "u-cust", false, "2026-05-07T10:00:00Z");
        await mk("t7-late-admin", post1, "u-admin-a", true, "2026-05-07T13:00:00Z", { parent: "t7-root" });
        await mk("t7-early-admin", post1, "u-admin-b", true, "2026-05-07T11:00:00Z", { parent: "t7-root" });

        const snapshot = async () =>
          Object.fromEntries(
            (
              await client.query(
                "SELECT body, handled_at, handled_by_id FROM comments ORDER BY body",
              )
            ).rows.map((r) => [
              r.body as string,
              {
                at: r.handled_at ? (r.handled_at as Date).toISOString() : null,
                by: r.handled_by_id as string | null,
              },
            ]),
          );
        const none = { at: null, by: null };

        expect((await runMigrateCli({ DATABASE_URL: tempDb.url })).code).toBe(0);
        const after = await snapshot();
        expect(after["t1-root"]).toEqual({ at: "2026-05-01T11:00:00.000Z", by: "u-admin-a" });
        expect(after["t1-later-customer"]).toEqual(none);
        expect(after["t2-customer"]).toEqual(none);
        expect(after["t3-root"]).toEqual(none);
        expect(after["t4-only-customer"]).toEqual(none);
        expect(after["t5-root"]).toEqual(none);
        expect(after["t6-root"]).toEqual({ at: "2026-05-06T10:30:00.000Z", by: "u-admin-b" });
        expect(after["t7-root"]).toEqual({ at: "2026-05-07T11:00:00.000Z", by: "u-admin-b" });
        for (const adminComment of [
          "t1-admin",
          "t2-admin-root",
          "t3-deleted-admin",
          "t5-other-admin-root",
          "t6-admin",
          "t7-late-admin",
          "t7-early-admin",
        ]) {
          expect(after[adminComment], adminComment).toEqual(none);
        }

        // Re-executing the backfill SQL changes nothing further
        const file = path.resolve(
          packageRoot,
          "migrations",
          `${journal.entries[backfillIdx].tag}.sql`,
        );
        for (const statement of fs
          .readFileSync(file, "utf-8")
          .split("--> statement-breakpoint")
          .filter((part) => part.trim())) {
          await client.query(statement);
        }
        expect(await snapshot()).toEqual(after);

        // The needs-attention partial index mirrors the service predicate
        const index = await client.query(
          "SELECT indexdef FROM pg_indexes WHERE indexname = 'comments_needs_attention_idx'",
        );
        expect(index.rows).toHaveLength(1);
        const def = index.rows[0].indexdef as string;
        expect(def).toMatch(/is_admin = false/);
        expect(def).toMatch(/handled_at IS NULL/);
        expect(def).toMatch(/deleted_at IS NULL/);
        expect(def).toMatch(/created_at DESC/);
      } finally {
        await client.end();
      }
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
      await tempDb.drop();
    }
  });
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
          "SELECT count(*)::int as count, count(distinct hash)::int as distinct_hashes FROM drizzle.__drizzle_migrations",
        );
        expect(Number(rowsRes.rows[0].count)).toBe(totalMigrations);
        expect(Number(rowsRes.rows[0].distinct_hashes)).toBe(totalMigrations);
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
      expect(thirdRun.stdout).toContain(
        `up to date (${totalMigrations} applied in total)`,
      );

      const client = new Client({ connectionString: tempDb.url });
      await client.connect();
      try {
        const rowsRes = await client.query<{ count: string }>(
          "SELECT count(*)::int as count FROM drizzle.__drizzle_migrations",
        );
        expect(Number(rowsRes.rows[0].count)).toBe(totalMigrations);
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
      `userhq-temp-migrations-${crypto.randomBytes(4).toString("hex")}`,
    );

    try {
      const originalMigrationsDir = path.resolve(packageRoot, "migrations");
      fs.cpSync(originalMigrationsDir, tempMigrationsDir, { recursive: true });

      // Rewrite copy's journal to have only entry 0000_auth
      const journalCopyPath = path.join(
        tempMigrationsDir,
        "meta/_journal.json",
      );
      const journalContent = JSON.parse(
        fs.readFileSync(journalCopyPath, "utf-8"),
      );
      journalContent.entries = [journalContent.entries[0]];
      fs.writeFileSync(
        journalCopyPath,
        JSON.stringify(journalContent, null, 2),
      );

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
          "SELECT count(*)::int as count FROM drizzle.__drizzle_migrations",
        );
        expect(Number(rows1.rows[0].count)).toBe(1);

        // 2. Run with real folder (adds remaining migrations)
        const res2 = await runMigrateCli({ DATABASE_URL: tempDb.url });
        expect(res2.code).toBe(0);

        const rows2 = await client.query<{ count: string }>(
          "SELECT count(*)::int as count FROM drizzle.__drizzle_migrations",
        );
        expect(Number(rows2.rows[0].count)).toBe(totalMigrations);
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
