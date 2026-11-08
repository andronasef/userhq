import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/e2e/**"],
    pool: "forks",
    testTimeout: 30000,
    // Real PostgreSQL setup/teardown includes migrations and database checkpoints. Measured parallel
    // runs exceeded Vitest's 10s hook budget (one DROP alone took 6.65s); see quick-261108-bzd diagnosis.
    hookTimeout: 30000,
  },
});
