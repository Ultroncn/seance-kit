import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** R7.6: zero serious or critical axe violations, with color contrast checked in a real browser. */
async function expectNoSeriousViolations(page: Page) {
  // Entries fade in over ~160 ms. Contrast is only meaningful once they are fully opaque.
  await page.waitForFunction(() =>
    [...document.querySelectorAll("li")].every((li) => getComputedStyle(li).opacity === "1"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
}

for (const path of ["/", "/archive/", "/inbox/", "/kit/"]) {
  test(`axe: ${path} has no serious or critical violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSeriousViolations(page);
  });
}

test("kit: approving a pending write settles the step", async ({ page }) => {
  await page.goto("/kit/");
  const card = page.getByRole("group", { name: /Allow Add tags/ });
  await expect(card).toBeFocused();
  await card.getByRole("button", { name: "Allow" }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "tag_conversation" })).toContainText(
    "Done",
  );
});

test("kit: ⌘K / Ctrl+K opens the palette and a destructive approval lists the items", async ({
  page,
}) => {
  await page.goto("/kit/");
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await page.keyboard.type("delete");
  await expect(page.getByRole("option", { name: "Show a destructive approval" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  const card = page.getByRole("group", { name: /Allow Hide chats/ });
  await expect(card).toContainText("Untitled chat (Nov 2018)");
  await expectNoSeriousViolations(page);
  await card.getByRole("button", { name: "Allow" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Restored")).toBeVisible();
});

test.describe("reduced motion", () => {
  const animationName = (page: Page) =>
    page
      .getByRole("group", { name: /Allow Add tags/ })
      .evaluate((el) => getComputedStyle(el).animationName);

  test("pending approval pulses by default", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/kit/");
    expect(await animationName(page)).toBe("candle-pulse");
  });

  test("pending approval shows a static ring when the user prefers reduced motion", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kit/");
    const card = page.getByRole("group", { name: /Allow Add tags/ });
    expect(await animationName(page)).toBe("none");
    const ring = await card.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe("none");
  });
});
