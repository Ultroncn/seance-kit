#!/usr/bin/env node
// pnpm screenshots
// Renders the product screenshots the landing page shows, from the built apps, so the page never
// shows an old UI. Needs a build first (`pnpm build`); serves dist/ itself.
// Output: site/public/screens/{archive,inbox}-{en,zh}.png at 1440x900.
/* global localStorage -- used only inside page.evaluate, which runs in the browser. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = resolve(ROOT, "site/public/screens");
const PORT = 4183;
const BASE = `http://localhost:${PORT}`;

/** What each screenshot shows: sample data loaded, one item open, the agent at its approval gate. */
const SCENES = {
  archive: {
    path: "/archive/",
    load: { en: "Load the sample archive", zh: "加载示例存档" },
    list: { en: "Chats", zh: "对话" },
    open: 1,
    ask: { en: "Banish my empty test chats", zh: "放逐那些空的测试对话" },
  },
  inbox: {
    path: "/inbox/",
    load: { en: "Load the sample inbox", zh: "加载示例收件箱" },
    list: { en: "Emails", zh: "邮件" },
    open: 6,
    ask: { en: "Sort my inbox", zh: "给我的收件箱分类" },
  },
};
const SUGGESTED = { en: "Suggested prompts", zh: "推荐提问" };

const server = spawn(process.execPath, [resolve(ROOT, "scripts/serve-dist.mjs")], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});
try {
  await waitFor(BASE);
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, scene] of Object.entries(SCENES)) {
    for (const lang of ["en", "zh"]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(BASE + scene.path);
      await page.evaluate((l) => localStorage.setItem("seance.locale", l), lang);
      await page.reload();
      await page.getByRole("button", { name: scene.load[lang] }).click();
      await page
        .getByRole("list", { name: scene.list[lang] })
        .getByRole("button")
        .nth(scene.open)
        .click();
      await page
        .getByRole("group", { name: SUGGESTED[lang] })
        .getByRole("button", { name: scene.ask[lang] })
        .click();
      await page.locator("[data-pending-dot]").waitFor();
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      await page.screenshot({ path: resolve(OUT, `${name}-${lang}.png`) });
      await page.close();
      console.log(`screens/${name}-${lang}.png`);
    }
  }
  await browser.close();
} finally {
  server.kill();
}

async function waitFor(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not start`);
}
