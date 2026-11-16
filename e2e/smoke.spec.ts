import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page loads and links to both apps", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("agent app in an afternoon");
  await expect(page.getByRole("link", { name: /Archive Séance/ }).first()).toHaveAttribute(
    "href",
    "/archive/",
  );
  await expect(page.getByRole("link", { name: /Inbox Exorcist/ }).first()).toHaveAttribute(
    "href",
    "/inbox/",
  );
  await expect(page.getByRole("heading", { name: /Built with Kiro/ })).toBeVisible();
});

test("archive shell loads", async ({ page }) => {
  await page.goto("/archive/");
  await expect(page.getByRole("heading", { level: 1, name: "Archive Séance" })).toBeVisible();
});

test("archive SPA fallback serves the shell on deep links", async ({ page }) => {
  const res = await page.goto("/archive/some/deep/link");
  await expect(page.getByRole("heading", { level: 1, name: "Archive Séance" })).toBeVisible();
  // Served in place, not redirected to /archive/: the address bar keeps the deep link.
  expect(res?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/archive/some/deep/link");
});

test("inbox SPA fallback serves the inbox shell, not the landing page", async ({ page }) => {
  await page.goto("/inbox/some/deep/link");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox Exorcist" })).toBeVisible();
});

test("unknown root URLs return 404", async ({ request }) => {
  const res = await request.get("/definitely-not-a-page");
  expect(res.status()).toBe(404);
});

test("inbox shell loads", async ({ page }) => {
  await page.goto("/inbox/");
  await expect(page.getByRole("heading", { level: 1, name: "Inbox Exorcist" })).toBeVisible();
});

test("landing demo: the approval gate works without stealing focus on load", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // The demo plays once it is scrolled into view, and ends at the approval gate.
  await page.getByRole("heading", { name: "Every change waits for you" }).scrollIntoViewIfNeeded();
  const card = page.getByRole("group", { name: /Allow Hide chats/ });
  await expect(card).toBeVisible();
  await expect(card).not.toBeFocused();
  await card.getByRole("button", { name: "Allow" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByRole("group", { name: /Allow Hide chats/ })).toBeVisible();
});

test("landing: every section appears once scrolled to, and the whole page passes axe", async ({
  page,
}) => {
  await page.goto("/");
  for (const h of await page.getByRole("heading", { level: 2 }).all()) {
    await h.scrollIntoViewIfNeeded();
    await expect(h).toBeInViewport();
  }
  // Revealed sections reach full opacity, so axe checks their real contrast.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("main section")].every(
      (s) => getComputedStyle(s).opacity === "1",
    ),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target}`),
  ).toEqual([]);
});
