import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** A fake OpenAI-compatible endpoint. No real key and no network are involved. */
const FAKE_BASE = "https://llm.example.test/v1";
const FAKE_KEY = "sk-fake-e2e-key";

async function fakeEndpoint(page: Page) {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "POST, OPTIONS",
  };
  await page.route(`${FAKE_BASE}/**`, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({
          status: 200,
          headers: { ...cors, "content-type": "application/json" },
          body: JSON.stringify({ choices: [{ message: { content: "OK" } }] }),
        }),
  );
}

const badge = (page: Page) => page.getByTestId("demo-badge");

/**
 * Open the model menu by keyboard (focus, Enter), the way it is built to be used without a mouse.
 * The pointer is parked first: resting over the menu, it would move the highlight.
 */
async function openModelMenu(page: Page) {
  await page.mouse.move(0, 0);
  await page.getByRole("button", { name: /^Model and reasoning:/ }).focus();
  await page.keyboard.press("Enter");
  return page.getByRole("menu");
}
async function choose(page: Page, name: string) {
  const menu = await openModelMenu(page);
  await menu.getByRole("menuitemradio", { name, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toHaveCount(0);
}
const pickModel = choose;

for (const app of [
  { path: "/archive/", title: "Archive Séance" },
  { path: "/inbox/", title: "Inbox Exorcist" },
]) {
  test.describe(app.title, () => {
    test("Demo badge shows under Mock and disappears under a real provider (R3.4, R3.5)", async ({
      page,
    }) => {
      await fakeEndpoint(page);
      await page.goto(app.path);
      await expect(badge(page)).toBeVisible();
      await expect(badge(page)).toContainText("Demo mode");

      await page.getByRole("button", { name: "Settings", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Settings" });
      await dialog.getByRole("button", { name: "Add a provider" }).click();
      await dialog.getByLabel("Vendor").selectOption("custom-openai");
      await dialog.getByLabel("Base URL").fill(FAKE_BASE);
      await dialog.getByLabel("API key").fill(FAKE_KEY);
      await dialog.getByLabel("Model").fill("fake-model");

      await dialog.getByRole("button", { name: "Test connection" }).click();
      await expect(dialog.getByRole("status")).toHaveText("Connected. The model replied: OK");
      await expect(badge(page)).toBeVisible(); // Testing does not save.

      await dialog.getByRole("button", { name: "Save and use" }).click();
      await expect(badge(page)).toHaveCount(0);

      // The agent must use the provider behind the badge: its reply comes from the fake endpoint.
      await page.keyboard.press("Escape");
      await page.getByRole("textbox", { name: /Ask/ }).fill("Hello from the test");
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.getByRole("list", { name: "Agent run" })).toContainText("OK");
      await expect(page.getByRole("list", { name: "Agent run" })).not.toContainText(
        "Demo mode only understands",
      );

      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: app.title })).toBeVisible();
      await expect(badge(page)).toHaveCount(0);

      // The picker by the prompt box goes back to demo mode, and the saved provider stays.
      await pickModel(page, "Demo (scripted)");
      await expect(badge(page)).toBeVisible();
      await pickModel(page, "fake-model");
      await expect(badge(page)).toHaveCount(0);
    });

    test("export never contains the API key, and settings pass axe", async ({ page }) => {
      await page.goto(app.path);
      await page.keyboard.press("ControlOrMeta+k");
      // Typing before the palette input has focus loses keystrokes, and Enter would run another command.
      await expect(
        page.getByRole("dialog", { name: "Command palette" }).getByRole("combobox"),
      ).toBeFocused();
      await page.keyboard.type("api key");
      // cmdk moves the highlight one render after filtering. Press Enter once it sits on the
      // command, as a person would after seeing it highlighted.
      await expect(page.getByRole("option", { name: "Open settings" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Settings" });
      await dialog.getByRole("button", { name: "Add a provider" }).click();
      await dialog.getByLabel("Vendor").selectOption("anthropic");
      await dialog.getByLabel("API key").fill(FAKE_KEY);
      await dialog.getByLabel("Model").fill("fake-model");
      await dialog.getByRole("button", { name: "Save and use" }).click();
      await expect(badge(page)).toHaveCount(0);

      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(
        violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => v.id),
      ).toEqual([]);

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        dialog.getByRole("button", { name: "Export all data" }).click(),
      ]);
      const stream = await download.createReadStream();
      let text = "";
      for await (const chunk of stream) text += chunk;
      expect(JSON.parse(text)).toMatchObject({ version: 1 });
      expect(text).not.toContain(FAKE_KEY);
    });
  });
}

test("the two apps keep separate settings on the shared origin", async ({ page }) => {
  await page.goto("/archive/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Add a provider" }).click();
  await page.getByLabel("Vendor").selectOption("ollama");
  await page.getByLabel("Model", { exact: true }).fill("llama-test");
  await page.getByRole("button", { name: "Save and use" }).click();
  await expect(badge(page)).toHaveCount(0);

  await page.goto("/inbox/");
  await expect(badge(page)).toBeVisible();
});

test("model picker: models grouped by provider, reasoning levels per model, sent with the request", async ({
  page,
}) => {
  const bodies: Record<string, unknown>[] = [];
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  await page.route(`${FAKE_BASE}/**`, (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.url().endsWith("/models"))
      return route.fulfill({
        headers: { ...cors, "content-type": "application/json" },
        body: JSON.stringify({ data: [{ id: "deepseek-v4-pro" }, { id: "deepseek-v4-flash" }] }),
      });
    bodies.push(JSON.parse(req.postData() ?? "{}") as Record<string, unknown>);
    return route.fulfill({
      headers: { ...cors, "content-type": "application/json" },
      body: JSON.stringify({ choices: [{ message: { content: "OK", reasoning_content: "hm" } }] }),
    });
  });
  await page.goto("/archive/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Add a provider" }).click();
  await dialog.getByLabel("Vendor").selectOption("deepseek");
  await expect(dialog.getByLabel("Model")).toHaveValue("");
  await dialog.getByLabel("Base URL").fill(FAKE_BASE);
  await dialog.getByLabel("API key").fill(FAKE_KEY);
  await dialog.getByRole("button", { name: "Load model list" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "2 models found. Pick one in the Model field.",
  );
  await dialog.getByLabel("Model").selectOption("deepseek-v4-flash");
  await dialog.getByRole("button", { name: "Save and use" }).click();
  await page.keyboard.press("Escape");

  // One menu: demo, then the provider's loaded models under its name, then the levels this
  // model documents (DeepSeek: off, low, high, max).
  const menu = await openModelMenu(page);
  await expect(menu.getByRole("menuitemradio")).toHaveText([
    "Demo (scripted)",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "Default",
    "Off",
    "Low",
    "High",
    "Max",
  ]);
  await expect(menu).toContainText("DeepSeek");
  await page.keyboard.press("Escape");
  await choose(page, "deepseek-v4-pro");
  await choose(page, "Low");
  await expect(page.getByRole("button", { name: /^Model and reasoning:/ })).toContainText(
    "deepseek-v4-pro · Low",
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
  ).toEqual([]);

  await page.getByRole("textbox", { name: /Ask/ }).fill("Hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("list", { name: "Agent run" })).toContainText("OK");
  expect(bodies.at(-1)).toMatchObject({
    model: "deepseek-v4-pro",
    reasoning_effort: "low",
    thinking: { type: "enabled" },
  });
});
