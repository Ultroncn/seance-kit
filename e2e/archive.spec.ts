import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const FIXTURE = resolve(
  import.meta.dirname,
  "../apps/archive-seance/test/fixtures/chatgpt-small.json",
);

const chats = (page: Page) => page.getByRole("list", { name: "Chats" }).getByRole("listitem");
const chip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Suggested prompts" }).getByRole("button", { name });
const openChat = (page: Page, title: RegExp) =>
  page.getByRole("list", { name: "Chats" }).getByRole("button", { name: title }).click();

async function loadSample(page: Page) {
  await page.goto("/archive/");
  await page.getByRole("button", { name: "Load the sample archive" }).click();
  await expect(chats(page)).toHaveCount(12);
}

/** Wait until the fade-in of new timeline entries is over, then run axe. */
async function expectAccessible(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("li")].every((li) => getComputedStyle(li).opacity === "1"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes[0]?.target}`),
  ).toEqual([]);
}

test("empty archive explains what to do and shows the Demo badge", async ({ page }) => {
  await page.goto("/archive/");
  await expect(page.getByText("Your archive is empty")).toBeVisible();
  await expect(page.getByTestId("demo-badge")).toBeVisible();
  await expect(chip(page, "Summarize my oldest chats")).toBeDisabled();
  await expect(page.getByRole("link", { name: "Download a sample export" })).toHaveAttribute(
    "href",
    "/archive/sample/chatgpt-conversations.json",
  );
});

test("sample archive: search, filters, reader, persistence and axe", async ({ page }) => {
  await loadSample(page);
  await expect(page.getByText("8 new chats, 0 updated, 0 already here.")).toBeVisible();

  await page.getByRole("searchbox", { name: "Search chats" }).fill("sourdough");
  await expect(chats(page)).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search chats" }).fill("qqzzxx");
  await expect(page.getByText("No chats match.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search chats" }).fill("");
  await page.getByLabel("Source").selectOption("claude");
  await expect(chats(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(chats(page)).toHaveCount(12);

  await openChat(page, /^Regex for dates/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Regex for dates in a log file" }),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Messages" }).getByRole("listitem")).toHaveCount(4);
  await expectAccessible(page);

  await page.reload();
  await expect(chats(page)).toHaveCount(12);
});

test("importing the same file twice does not create duplicates (P3)", async ({ page }) => {
  await page.goto("/archive/");
  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  await expect(page.getByText("2 new chats, 0 updated, 0 already here.")).toBeVisible();
  await expect(page.getByText("Skipped 1 item")).toBeVisible();
  await expect(chats(page)).toHaveCount(2);

  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  await expect(page.getByText("0 new chats, 0 updated, 2 already here.")).toBeVisible();
  await expect(chats(page)).toHaveCount(2);
});

test("agent summaries wait for approval, then show in the reader", async ({ page }) => {
  await loadSample(page);
  await chip(page, "Summarize my oldest chats").click();
  for (let i = 0; i < 2; i++) {
    const card = page.getByRole("group", { name: /Allow Save a summary/ });
    await expect(card).toBeVisible();
    await expectAccessible(page);
    await card.getByRole("button", { name: "Allow" }).click();
  }
  await expect(
    page.getByRole("list", { name: "Agent run" }).getByText(/Saved summaries for/),
  ).toBeVisible();
  await openChat(page, /^Sourdough starter keeps dying/);
  await expect(page.getByRole("region", { name: "Summary and tags" })).toContainText("acetone");
  await expect(page.getByRole("region", { name: "Summary and tags" })).toContainText(
    "scripted by demo mode",
  );
});

test("rejecting changes nothing and the agent says so", async ({ page }) => {
  await loadSample(page);
  await chip(page, "Summarize my oldest chats").click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("group", { name: /Allow Save a summary/ })
      .getByRole("button", { name: "Reject" })
      .click();
  }
  await expect(
    page.getByRole("list", { name: "Agent run" }).getByText("You rejected 2 summaries"),
  ).toBeVisible();
  await expectAccessible(page); // Rejected steps must still meet contrast.
  await openChat(page, /^Sourdough starter keeps dying/);
  await expect(page.getByRole("region", { name: "Summary and tags" })).toHaveCount(0);
});

test("banish lists the chats, hides them, and undo brings them back", async ({ page }) => {
  await loadSample(page);
  await chip(page, "Banish my empty test chats").click();
  const card = page.getByRole("group", { name: /Allow Hide chats/ });
  await expect(card).toContainText("Untitled chat");
  await expect(card).toContainText("test test 123");
  await card.getByRole("button", { name: "Allow" }).click();
  await expect(chats(page)).toHaveCount(10);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(chats(page)).toHaveCount(12);
});

test("Banished view restores chats banished from the reader", async ({ page }) => {
  await loadSample(page);
  await openChat(page, /^Birthday poem/);
  await page.getByRole("button", { name: "Banish", exact: true }).click();
  await expect(chats(page)).toHaveCount(11);

  await page.getByRole("button", { name: /^Banished/ }).click();
  const banished = page.getByRole("list", { name: "Banished chats" }).getByRole("listitem");
  await expect(banished).toHaveCount(1);
  await page.getByRole("button", { name: "Restore all" }).click();
  await expect(banished).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByRole("button", { name: /^All/ })
    .click();
  await expect(chats(page)).toHaveCount(12);
});

test("resurrect from the reader writes a prompt to copy", async ({ page }) => {
  await loadSample(page);
  await openChat(page, /^Lisbon trip planning/);
  await page.getByRole("button", { name: "Resurrect", exact: true }).click();
  const prompt = page.getByRole("region", { name: "Resurrection prompt" });
  await expect(prompt).toContainText('"Lisbon trip planning", from September 2022');
  await expect(prompt.getByRole("button", { name: "Copy" })).toBeVisible();
});

test("the agent's resurrect and tag scripts change real data", async ({ page }) => {
  await loadSample(page);
  await chip(page, "Find my sourdough chats and tag them baking").click();
  await page
    .getByRole("group", { name: /Allow Change tags/ })
    .getByRole("button", { name: "Allow" })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Agent run" })
      .getByText(/Tagged “Sourdough starter keeps dying”/),
  ).toBeVisible();
  await openChat(page, /^Sourdough starter keeps dying/);
  await expect(page.getByRole("region", { name: "Summary and tags" })).toContainText("baking");
});

test("an Undo toast stays while hovered, then goes", async ({ page }) => {
  test.slow();
  await loadSample(page);
  await openChat(page, /^Birthday poem/);
  await page.getByRole("button", { name: "Banish", exact: true }).click();
  const toast = page.getByText("Banished “Birthday poem for Grandma Rosa”.");
  await toast.hover();
  await page.waitForTimeout(7000);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0, { timeout: 9000 });
});
