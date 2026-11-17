import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// Count executable JS fetched by the page, including modulepreloads, but not the service
// worker's background precache. Splitting files alone must not make this budget pass.
for (const [path, budget] of [
  ["/", 130_000],
  ["/archive/", 280_000],
  ["/inbox/", 280_000],
] as const) {
  test(`initial JavaScript budget: ${path}`, async ({ page }) => {
    const scripts = new Map<string, Promise<number>>();
    page.on("response", (response) => {
      const request = response.request();
      if (request.resourceType() === "script" && !request.serviceWorker()) {
        scripts.set(
          response.url(),
          response.body().then((body) => gzipSync(body).length),
        );
      }
    });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Include automatic startup imports that may finish after the heading appears.
    await page.waitForLoadState("networkidle");
    const bytes = (await Promise.all(scripts.values())).reduce((sum, size) => sum + size, 0);
    expect(
      bytes,
      `initial executable JS, gzip bytes (${[...scripts.keys()].join(", ")})`,
    ).toBeLessThan(budget);
  });
}
