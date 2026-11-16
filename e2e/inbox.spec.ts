import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";

const FIXTURE = resolve(import.meta.dirname, "../apps/inbox-exorcist/test/fixtures/small.mbox");

const emails = (page: Page) => page.getByRole("list", { name: "Emails" }).getByRole("listitem");
const chip = (page: Page, name: string) =>
  page.getByRole("group", { name: "Suggested prompts" }).getByRole("button", { name });
const view = (page: Page, name: RegExp) =>
  page.getByRole("navigation", { name: "Views" }).getByRole("button", { name });

async function loadSample(page: Page) {
  await page.goto("/inbox/");
  await page.getByRole("button", { name: "Load the sample inbox" }).click();
  await expect(emails(page)).toHaveCount(18);
}

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

test("empty inbox explains what to do and shows the Demo badge", async ({ page }) => {
  await page.goto("/inbox/");
  await expect(page.getByText("Your inbox is empty")).toBeVisible();
  await expect(page.getByTestId("demo-badge")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download the sample .mbox" })).toHaveAttribute(
    "href",
    "/inbox/sample/inbox.mbox",
  );
});

test("importing the same mbox twice adds nothing and reports skipped entries (P3)", async ({
  page,
}) => {
  await page.goto("/inbox/");
  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  await expect(page.getByText("3 new emails, 1 already here.")).toBeVisible();
  await expect(page.getByText("Skipped 1 item")).toBeVisible();
  await expect(emails(page)).toHaveCount(3);
  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  await expect(page.getByText("0 new emails, 4 already here.")).toBeVisible();
  await expect(emails(page)).toHaveCount(3);
});

test("sample inbox: search, reader headers, and axe", async ({ page }) => {
  await loadSample(page);
  await page.getByRole("searchbox", { name: "Search mail" }).fill("boiler");
  await expect(emails(page)).toHaveCount(1);
  await emails(page).first().getByRole("button").click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Boiler service next Tuesday" }),
  ).toBeVisible();
  await expect(page.getByText("Sam Okafor <sam.okafor@example.net>")).toBeVisible();
  await expectAccessible(page);
});

test("sort: one batch approval, then the category filter works and survives a reload", async ({
  page,
}) => {
  await loadSample(page);
  await chip(page, "Sort my inbox").click();
  const card = page.getByRole("group", { name: /Allow Sort into categories/ });
  await expect(
    card.getByRole("table", { name: "Proposed categories" }).getByRole("row"),
  ).toHaveCount(19);
  await expectAccessible(page);
  await card.getByRole("button", { name: "Allow" }).click();
  await expect(page.getByRole("list", { name: "Agent run" }).getByText(/^Done: /)).toBeVisible();

  await page.getByLabel("Category", { exact: true }).first().selectOption("needs-reply");
  await expect(emails(page)).toHaveCount(3);
  await page.reload();
  await page.getByLabel("Category", { exact: true }).first().selectOption("needs-reply");
  await expect(emails(page)).toHaveCount(3);
});

test("banish newsletters: the card lists all five, undo restores them", async ({ page }) => {
  await loadSample(page);
  await chip(page, "Banish my newsletters").click();
  const card = page.getByRole("group", { name: /Allow Hide emails/ });
  await expect(card.getByRole("listitem")).toHaveCount(5);
  await expect(card).toContainText("Flash Deals: 48 hours only");
  await card.getByRole("button", { name: "Allow" }).click();
  await expect(emails(page)).toHaveCount(13);
  await expect(view(page, /Banished 5/)).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(emails(page)).toHaveCount(18);
});

test("Banished view restores mail banished from the reader", async ({ page }) => {
  await loadSample(page);
  await emails(page).filter({ hasText: "Prize Desk" }).getByRole("button").click();
  await page.getByRole("button", { name: "Banish", exact: true }).click();
  await expect(emails(page)).toHaveCount(17);
  await view(page, /Banished/).click();
  await expect(
    page.getByRole("list", { name: "Banished emails" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Restore all" }).click();
  await expect(page.getByText("Nothing is banished.")).toBeVisible();
  await view(page, /Inbox/).click();
  await expect(emails(page)).toHaveCount(18);
});

test("drafts: the agent drafts a reply that is saved, never sent, and opens in the mail app", async ({
  page,
}) => {
  await loadSample(page);
  await chip(page, "Draft a reply to Maya about dinner").click();
  const card = page.getByRole("group", { name: /Allow Draft a reply/ });
  await expect(card).toContainText("It will not be sent.");
  await card.getByRole("button", { name: "Allow" }).click();
  await expect(
    page.getByRole("list", { name: "Agent run" }).getByText(/Nothing was sent/),
  ).toBeVisible();

  await view(page, /Drafts 1/).click();
  await page
    .getByRole("list", { name: "Drafts" })
    .getByRole("button", { name: /Re: Dinner on Saturday\?/ })
    .click();
  const draft = page.getByRole("region", { name: "Draft: Re: Dinner on Saturday?" });
  await expect(draft).toContainText("Draft · not sent · scripted by demo mode");
  await expect(draft.getByRole("link", { name: "Open in mail app" })).toHaveAttribute(
    "href",
    /^mailto:maya%40example\.com\?subject=Re%3A%20Dinner/,
  );
});

test("a user can write and discard a draft by hand", async ({ page }) => {
  await loadSample(page);
  await emails(page).filter({ hasText: "Priya Raman" }).getByRole("button").click();
  await page.getByRole("button", { name: "Write a reply draft" }).click();
  await page.getByLabel("Reply to priya@example.com").fill("Happy to. Notes by Wednesday.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(view(page, /Drafts 1/)).toBeVisible();
  await page
    .getByRole("region", { name: /^Draft:/ })
    .getByRole("button", { name: "Discard" })
    .click();
  await expect(view(page, /Drafts 0/)).toBeVisible();
});

test("travel: labels flight and hotel mail, and the label filter finds them", async ({ page }) => {
  await loadSample(page);
  await chip(page, "Label my travel emails").click();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("group", { name: /Allow Change labels/ })
      .getByRole("button", { name: "Allow" })
      .click();
  }
  await expect(
    page.getByRole("list", { name: "Agent run" }).getByText(/Labelled 3 emails/),
  ).toBeVisible();
  await page.getByLabel("Label", { exact: true }).selectOption("travel");
  await expect(emails(page)).toHaveCount(3);
});

test("two mailboxes: each import keeps its own mailbox, and the mailbox filter separates them", async ({
  page,
}) => {
  await page.goto("/inbox/");
  await page.getByRole("button", { name: "Load the sample inbox" }).click();
  const rows = page.getByRole("list", { name: "Emails" }).getByRole("listitem");
  await expect(rows).toHaveCount(18);
  // One mailbox: no filter to clutter the pane.
  await expect(page.getByRole("combobox", { name: "Mailbox", exact: true })).toHaveCount(0);
  await page.getByTestId("file-input").setInputFiles(FIXTURE);
  const filter = page.getByRole("combobox", { name: "Mailbox", exact: true });
  await expect(filter).toBeVisible();
  const total = await rows.count();
  await filter.selectOption("alex@example.com");
  await expect(rows).toHaveCount(18);
  await filter.selectOption("you@example.com");
  await expect(rows).toHaveCount(total - 18);
  await rows.first().getByRole("button").click();
  await expect(page.locator("dl")).toContainText("you@example.com");
  await expectAccessible(page);
});
