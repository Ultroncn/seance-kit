import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Wait until timeline fade-ins are over, then require zero serious or critical axe violations. */
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

const switchToChinese = (page: Page) =>
  page.getByRole("group", { name: "Language" }).getByRole("button", { name: "中文" }).click();

test("landing: switch to Chinese, remembered on reload and in the apps", async ({ page }) => {
  await page.goto("/");
  await switchToChinese(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "一个下午，做出你自己的 Agent 应用。",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("button", { name: "允许" })).toBeVisible();
  await expect(page.getByRole("link", { name: "试用对话降灵" })).toHaveAttribute(
    "href",
    "/archive/",
  );
  await expect(page.getByRole("link", { name: "试用收件箱驱魔" })).toHaveAttribute(
    "href",
    "/inbox/",
  );
  await expectAccessible(page);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("一个下午");

  // The choice is per origin, so the apps open in Chinese too.
  await page.goto("/archive/");
  await expect(page.getByText("你的存档还是空的")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("对话降灵");
  await expect(page).toHaveTitle("对话降灵");
  await expect(page.getByTestId("demo-badge")).toHaveText(/演示模式/);

  await page.getByRole("group", { name: "语言" }).getByRole("button", { name: "EN" }).click();
  await expect(page.getByText("Your archive is empty")).toBeVisible();
  await expect(page).toHaveTitle("Archive Séance");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("archive in Chinese: a scripted run approves in Chinese and passes axe", async ({ page }) => {
  await page.goto("/archive/");
  await switchToChinese(page);
  await page.getByRole("button", { name: "加载示例存档" }).click();
  await expect(page.getByRole("list", { name: "对话" }).getByRole("listitem")).toHaveCount(12);
  await page
    .getByRole("group", { name: "推荐提问" })
    .getByRole("button", { name: "放逐那些空的测试对话" })
    .click();
  const card = page.getByRole("group", { name: /允许 隐藏对话/ });
  await expect(card).toContainText("隐藏 2 个对话");
  await expectAccessible(page);
  await card.getByRole("button", { name: "允许" }).click();
  await expect(page.getByText(/^已放逐“/)).toBeVisible();
  await expect(page.getByTestId("demo-badge")).toBeVisible();
});

test("inbox in Chinese: sample loads, categories and badge are translated", async ({ page }) => {
  await page.goto("/inbox/");
  await switchToChinese(page);
  await expect(page.getByText("你的收件箱还是空的")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("收件箱驱魔");
  await page.getByRole("button", { name: "加载示例收件箱" }).click();
  await expect(page.getByRole("list", { name: "邮件" }).getByRole("listitem")).toHaveCount(18);
  await page
    .getByRole("group", { name: "推荐提问" })
    .getByRole("button", { name: "给我的收件箱分类" })
    .click();
  const card = page.getByRole("group", { name: /允许 归入分类/ });
  await expect(card).toContainText("待回复");
  await expectAccessible(page);
  await card.getByRole("button", { name: "允许" }).click();
  await expect(page.getByText(/^完成：/)).toBeVisible();
  await expect(page.getByTestId("demo-badge")).toHaveText(/演示模式/);
});
