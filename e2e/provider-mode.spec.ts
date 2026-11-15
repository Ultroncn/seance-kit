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
      await dialog.getByRole("radio", { name: "OpenAI-compatible" }).check();
      await dialog.getByLabel("Base URL").fill(FAKE_BASE);
      await dialog.getByLabel("API key").fill(FAKE_KEY);
      await dialog.getByLabel("Model").fill("fake-model");

      await dialog.getByRole("button", { name: "Test connection" }).click();
      await expect(dialog.getByRole("status")).toHaveText("Connected. The model replied: OK");
      await expect(badge(page)).toBeVisible(); // Testing does not save.

      await dialog.getByRole("button", { name: "Save" }).click();
      await expect(badge(page)).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: app.title })).toBeVisible();
      await expect(badge(page)).toHaveCount(0);

      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByRole("radio", { name: "Demo (scripted)" }).check();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(badge(page)).toBeVisible();
    });

    test("export never contains the API key, and settings pass axe", async ({ page }) => {
      await page.goto(app.path);
      await page.keyboard.press("ControlOrMeta+k");
      await page.keyboard.type("api key");
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Settings" });
      await dialog.getByRole("radio", { name: "Anthropic" }).check();
      await dialog.getByLabel("API key").fill(FAKE_KEY);
      await dialog.getByLabel("Model").fill("fake-model");
      await dialog.getByRole("button", { name: "Save" }).click();
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
  await page.getByRole("radio", { name: "Ollama (local)" }).check();
  await page.getByLabel("Model").fill("llama-test");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(badge(page)).toHaveCount(0);

  await page.goto("/inbox/");
  await expect(badge(page)).toBeVisible();
});
