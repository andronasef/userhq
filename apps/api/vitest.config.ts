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
    // beforeAll/afterAll create and drop a temporary database; the 10s default can be exceeded under full-suite load.
    hookTimeout: 30000,
  },
});
