import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL },
  // Serve the built dist/. Skipped when testing a deployed URL via BASE_URL.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node scripts/serve-dist.mjs",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      },
});
