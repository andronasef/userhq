import path from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vinext()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000",
    },
  },
  resolve: {
    alias: {
      "@userhq/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
});
