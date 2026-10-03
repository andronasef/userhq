import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envDockerPath = path.resolve(__dirname, "../../.env.docker");

if (fs.existsSync(envDockerPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envDockerPath);
}

const postgresUser = process.env.POSTGRES_USER ?? "userhq";
const postgresPassword = process.env.POSTGRES_PASSWORD ?? "userhq";
const postgresDb = process.env.POSTGRES_DB ?? "userhq";

process.env.E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? process.env.PUBLIC_URL ?? "http://localhost:8080";
process.env.E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://${postgresUser}:${postgresPassword}@127.0.0.1:5433/${postgresDb}`;

export default defineConfig({
  testDir: "test/browser",
  testMatch: "**/*.spec.ts",
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: "test-results",
});
