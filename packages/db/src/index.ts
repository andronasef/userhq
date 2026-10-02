import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
const { Pool, Client } = pg;
import { fileURLToPath } from "node:url";
import * as authSchema from "./schema/auth.js";
import * as uploadsSchema from "./schema/uploads.js";

export const schema = {
  ...authSchema,
  ...uploadsSchema,
};

export * from "./schema/auth.js";
export * from "./schema/uploads.js";

export type Db = NodePgDatabase<typeof schema>;
export const DB: unique symbol = Symbol.for("@userhq/db");

export function createDb(
  connectionString: string,
  opts?: { max?: number }
): { db: Db; pool: pg.Pool } {
  const max = opts?.max ?? 10;
  const pool = new Pool({ connectionString, max });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export const MIGRATIONS_DIR: string = fileURLToPath(
  new URL("../migrations", import.meta.url)
);
export const MIGRATION_LOCK_KEY = 727001;

export async function runMigrations(opts: {
  connectionString: string;
  migrationsFolder?: string;
}): Promise<{ appliedTotal: number }> {
  const migrationsFolder = opts.migrationsFolder ?? MIGRATIONS_DIR;
  const client = new Client({ connectionString: opts.connectionString });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    await migrate(drizzle(client), { migrationsFolder });
    const res = await client.query<{ count: string }>(
      "SELECT count(*) FROM drizzle.__drizzle_migrations"
    );
    const appliedTotal = Number(res.rows[0]?.count ?? 0);
    return { appliedTotal };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    await client.end();
  }
}
