import { expect, test, type Page } from "@playwright/test";

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
