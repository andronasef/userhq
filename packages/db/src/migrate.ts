import { runMigrations, MIGRATION_LOCK_KEY, MIGRATIONS_DIR } from "./index.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("migrations: DATABASE_URL is required");
  process.exit(1);
}

const migrationsFolder = process.env.MIGRATIONS_FOLDER || MIGRATIONS_DIR;

console.log(`migrations: waiting for advisory lock ${MIGRATION_LOCK_KEY}`);

try {
  const { appliedTotal } = await runMigrations({
    connectionString: databaseUrl,
    migrationsFolder,
  });
  console.log(`migrations: up to date (${appliedTotal} applied in total)`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`migrations: failed: ${message}`);
  process.exit(1);
}
