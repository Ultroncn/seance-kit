import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "{packages,apps,site,scripts,templates}/**/*.test.ts",
      "{packages,apps,site,scripts,templates}/**/test/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
