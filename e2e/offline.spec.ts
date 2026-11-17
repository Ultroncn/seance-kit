import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Use the app's existing dependency to build a tiny zip in memory, with no added dependency.
const { zipSync } = createRequire(new URL("../apps/archive-seance/package.json", import.meta.url))(
  "fflate",
) as { zipSync(files: Record<string, Uint8Array>): Uint8Array };

// R4.3: after the first load, both apps work offline (everything except real-provider calls).

/** First online visit, then wait until the app's service worker controls the page. */
async function firstVisit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** Go offline and prove it: a request the worker has not cached must fail. */
async function goOffline(page: Page, path: string) {
  await page.context().setOffline(true);
  const probe = await page.evaluate(
    (url) =>
      fetch(url).then(
        () => "reached the server",
        () => "offline",
      ),
    `${path}not-precached-probe.txt`,
  );
  expect(probe).toBe("offline");
}

const chip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Suggested prompts" }).getByRole("button", { name });

test("Archive Séance reloads, imports the sample and runs the demo agent offline", async ({
  page,
}) => {
  await firstVisit(page, "/archive/");
  await goOffline(page, "/archive/");
  await page.reload();
  await expect(page.getByTestId("demo-badge")).toBeVisible();
  await page.getByRole("button", { name: "Load the sample archive" }).click();
  await expect(page.getByRole("list", { name: "Chats" }).getByRole("listitem")).toHaveCount(12);
  await chip(page, "Summarize my oldest chats").click();
  await expect(page.getByRole("group", { name: /Allow Save a summary/ })).toBeVisible();
  // A deep link that was never opened online still gets the app, not the browser's error page.
  await page.goto("/archive/never/visited");
  await expect(page.getByTestId("demo-badge")).toBeVisible();
});

test("Inbox Exorcist reloads, imports the sample and runs the demo agent offline", async ({
  page,
}) => {
  await firstVisit(page, "/inbox/");
  await goOffline(page, "/inbox/");
  await page.reload();
  await expect(page.getByTestId("demo-badge")).toBeVisible();
  await page.getByRole("button", { name: "Load the sample inbox" }).click();
  await expect(page.getByRole("list", { name: "Emails" }).getByRole("listitem")).toHaveCount(18);
  await chip(page, "Banish my newsletters").click();
  await expect(page.getByRole("group", { name: /Allow Hide emails/ })).toBeVisible();
  await page.goto("/inbox/never/visited");
  await expect(page.getByTestId("demo-badge")).toBeVisible();
});

test("each app's worker stays inside its own path", async ({ page }) => {
  await firstVisit(page, "/archive/");
  const scopes = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).map((r) => new URL(r.scope).pathname),
  );
  expect(scopes).toEqual(["/archive/"]);
});

for (const app of [
  {
    path: "/archive/",
    fixture: "archive-seance/test/fixtures/chatgpt-small.json",
    name: "conversations.json",
    list: "Chats",
    count: 2,
  },
  {
    path: "/inbox/",
    fixture: "inbox-exorcist/test/fixtures/boiler.eml",
    name: "message.eml",
    list: "Emails",
    count: 1,
  },
]) {
  test(`${app.path} opens settings and imports a zip for the first time offline`, async ({
    page,
  }) => {
    await firstVisit(page, app.path);
    await goOffline(page, app.path);
    await page.reload();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await settings.getByRole("button", { name: "Close settings" }).click();
    await expect(settings).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
    if (app.path === "/archive/") {
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await page.getByRole("menuitem", { name: "One-click import…", exact: true }).click();
      const directoryImport = page.getByRole("dialog", { name: "One-click import", exact: true });
      await expect(directoryImport).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(directoryImport).toHaveCount(0);
    }
    const bytes = readFileSync(new URL(`../apps/${app.fixture}`, import.meta.url));
    await page.locator('input[type="file"]').setInputFiles({
      name: "export.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zipSync({ [app.name]: bytes })),
    });
    await expect(page.getByRole("list", { name: app.list }).getByRole("listitem")).toHaveCount(
      app.count,
    );
  });
}
