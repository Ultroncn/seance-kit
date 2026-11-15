import { defineConfig } from "vitest/config";

const roots = "{packages,apps,site,scripts,templates,worker}";

export default defineConfig({
  test: {
    include: [`${roots}/**/*.test.{ts,tsx}`],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    // jsdom polyfills and cleanup for component tests. A no-op in node-environment tests.
    setupFiles: ["packages/ui/test/setup.ts"],
  },
});
