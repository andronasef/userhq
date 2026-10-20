import path from "node:path";
import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vinext()],
  resolve: {
    alias: {
      "@userhq/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
});
