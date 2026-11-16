import { expect, test, type Page } from "@playwright/test";

// R7.4: primary flows work with the keyboard alone. No mouse clicks in this file.

/** Press Tab until the focused element matches, or fail after `max` presses. */
async function tabTo(page: Page, name: RegExp, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? (el.getAttribute("aria-label") ?? el.textContent ?? "").trim() : "";
    });
    if (name.test(label)) return;
  }
  throw new Error(`Never reached ${name} with Tab`);
}

/** The focused element shows a visible focus ring (outline or box-shadow ring). */
async function expectVisibleFocus(page: Page) {
  const style = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement as Element);
    return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow };
  });
  expect((style.outline !== "none" && style.width > 0) || style.shadow !== "none").toBe(true);
}

test("landing: skip-free page is reachable by Tab with visible focus", async ({ page }) => {
  await page.goto("/");
  await tabTo(page, /^Try Archive Séance$/);
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/archive\/$/);
});

test("archive: load, search, open, ask, approve and undo with the keyboard only", async ({
  page,
}) => {
  await page.goto("/archive/");

  // Skip link first.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await expect(page.getByRole("button", { name: "Load the sample archive" })).toBeVisible();
  await tabTo(page, /^Load the sample archive$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Chats" }).getByRole("listitem")).toHaveCount(12);

  // "/" jumps to search.
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Search chats" })).toBeFocused();
  await page.keyboard.type("sourdough");
  await expect(page.getByRole("list", { name: "Chats" }).getByRole("listitem")).toHaveCount(1);
  await tabTo(page, /^Sourdough starter keeps dying/);
  await expectVisibleFocus(page);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 2, name: "Sourdough starter keeps dying" }),
  ).toBeVisible();

  // Ask the agent from the palette.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }).getByRole("combobox"),
  ).toBeFocused();
  await page.keyboard.type("banish my empty");
  await expect(page.getByRole("option", { name: "Banish my empty test chats" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");

  // Focus lands on the approval card. Enter alone must not approve; Tab to Allow does.
  const card = page.getByRole("group", { name: /Allow Hide chats/ });
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card).toBeVisible();
  await tabTo(page, /^Allow$/);
  await page.keyboard.press("Enter");
  // The card is gone; focus stays in the timeline instead of falling to <body>.
  await expect(page.getByRole("list", { name: "Agent run" })).toBeFocused();
  await expect(
    page
      .getByRole("list", { name: "Agent run" })
      .getByText(/^Banished “.+” and “.+”\. Nothing was deleted/),
  ).toBeVisible();

  await tabTo(page, /^Undo$/, 60);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /^Banished/ })).toContainText("0");
});

test("inbox: Escape rejects a pending approval", async ({ page }) => {
  await page.goto("/inbox/");
  // The button appears once IndexedDB is read. Tabbing earlier can never reach it.
  await expect(page.getByRole("button", { name: "Load the sample inbox" })).toBeVisible();
  await tabTo(page, /^Load the sample inbox$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Emails" }).getByRole("listitem")).toHaveCount(18);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }).getByRole("combobox"),
  ).toBeFocused();
  await page.keyboard.type("banish my newsletters");
  await expect(page.getByRole("option", { name: "Banish my newsletters" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");

  const card = page.getByRole("group", { name: /Allow Hide emails/ });
  await expect(card).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("list", { name: "Agent run" }).getByText("Okay, I kept them all."),
  ).toBeVisible();
  await expect(page.getByRole("list", { name: "Emails" }).getByRole("listitem")).toHaveCount(18);
});

test("settings dialog traps focus and closes with Escape", async ({ page }) => {
  await page.goto("/inbox/");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(
    page.getByRole("dialog", { name: "Command palette" }).getByRole("combobox"),
  ).toBeFocused();
  await page.keyboard.type("settings");
  await expect(page.getByRole("option", { name: "Open settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
