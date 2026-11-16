#!/usr/bin/env node
/* global window, document -- used inside page.evaluate, which runs in the browser */
// Performance check for large imports (task 4.8). Not part of CI: run `pnpm build && node scripts/perf.mjs`.
// Generates a synthetic ChatGPT export and mbox, imports them in Chromium against dist/, and
// reports import time, the longest main-thread block, search latency and JS heap.
import { spawn } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const CHATS = Number(process.env.CHATS ?? 2000);
const MAILS = Number(process.env.MAILS ?? 5000);
const dir = join(tmpdir(), "seance-perf");
mkdirSync(dir, { recursive: true });

const words = "ghost lantern candle archive spirit summon whisper attic raven moon fog hollow echo garden recipe travel invoice meeting draft".split(" ");
const sentence = (i, n) => Array.from({ length: n }, (_, k) => words[(i * 7 + k * 3) % words.length]).join(" ");

function chatgpt() {
  const convs = [];
  for (let i = 0; i < CHATS; i++) {
    const t = 1_550_000_000 + i * 3600;
    const mapping = { root: { id: "root", message: null, parent: null, children: ["n0"] } };
    for (let k = 0; k < 12; k++) {
      mapping[`n${k}`] = {
        id: `n${k}`,
        parent: k ? `n${k - 1}` : "root",
        children: k < 11 ? [`n${k + 1}`] : [],
        message: { author: { role: k % 2 ? "assistant" : "user" }, create_time: t + k, content: { content_type: "text", parts: [`${sentence(i + k, 60)} #${i}`] } },
      };
    }
    convs.push({ id: `perf-${i}`, title: `Perf chat ${i}: ${sentence(i, 4)}`, create_time: t, update_time: t + 12, current_node: "n11", mapping });
  }
  const path = join(dir, "conversations.json");
  writeFileSync(path, JSON.stringify(convs));
  return path;
}

function mbox() {
  const parts = [];
  for (let i = 0; i < MAILS; i++) {
    const date = new Date(Date.UTC(2024, 0, 1) + i * 600_000).toUTCString();
    parts.push(
      `From MAILER-DAEMON Thu Jan  1 00:00:00 1970\nMessage-ID: <perf-${i}@example.com>\nFrom: Sender ${i % 50} <s${i % 50}@example.com>\nTo: you@example.com\nSubject: Perf mail ${i}: ${sentence(i, 4)}\nDate: ${date}\nContent-Type: text/plain; charset=utf-8\n\n${sentence(i, 120)}\n>From the archive, line ${i}\n\n`,
    );
  }
  const path = join(dir, "inbox.mbox");
  writeFileSync(path, parts.join(""));
  return path;
}

const mb = (p) => `${(statSync(p).size / 1_048_576).toFixed(1)} MB`;

async function measure(page, { url, file, listName, reportText, query, expectCount, expectTotal }) {
  await page.goto(url);
  await page.evaluate(() => {
    window.__longest = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__longest = Math.max(window.__longest, e.duration);
    }).observe({ type: "longtask", buffered: false });
  });
  const t0 = Date.now();
  await page.getByTestId("file-input").setInputFiles(file);
  await page.getByText(reportText).waitFor({ timeout: 600_000 });
  const importMs = Date.now() - t0;
  // After the report, the app reloads the full list once. Time that separately from search.
  // The list's own count label ("30000 emails"), not the import report ("30000 new emails").
  await page.waitForFunction((label) => [...document.querySelectorAll("[aria-live=polite]")].some((el) => el.textContent === label), expectTotal);
  const ready = Date.now() - t0;
  const longest = await page.evaluate(() => Math.round(window.__longest));

  const search = page.getByRole("searchbox").first();
  const t1 = Date.now();
  await search.fill(query);
  await page.getByRole("list", { name: listName }).getByRole("listitem").first().waitFor();
  await page.waitForFunction(
    ([name, n]) => document.querySelector(`[aria-label="${name}"]`)?.querySelectorAll("li").length === n,
    [listName, expectCount],
  );
  const searchMs = Date.now() - t1;
  const heap = await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1_048_576));
  return { importMs, ready, longest, searchMs, heap };
}

const server = spawn(process.execPath, [resolve(import.meta.dirname, "serve-dist.mjs")], { env: { ...process.env, PORT: "4199" }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 500));
try {
  const archiveFile = chatgpt();
  const inboxFile = mbox();
  const browser = await chromium.launch();
  const rows = [];
  {
    const page = await (await browser.newContext()).newPage();
    const r = await measure(page, { url: "http://localhost:4199/archive/", file: archiveFile, listName: "Chats", reportText: `${CHATS} new chats`, query: "Perf chat 1234:", expectCount: 1, expectTotal: `${CHATS} chats` });
    rows.push([`Archive: ${CHATS} chats × 12 messages (${mb(archiveFile)})`, r]);
  }
  {
    const page = await (await browser.newContext()).newPage();
    const r = await measure(page, { url: "http://localhost:4199/inbox/", file: inboxFile, listName: "Emails", reportText: `${MAILS} new emails`, query: "Perf mail 4321:", expectCount: 1, expectTotal: `${MAILS} emails` });
    rows.push([`Inbox: ${MAILS} messages (${mb(inboxFile)})`, r]);
  }
  await browser.close();
  console.log("| Import | Imported | List ready | Longest block | Search | JS heap |\n|---|---|---|---|---|---|");
  for (const [name, r] of rows) console.log(`| ${name} | ${(r.importMs / 1000).toFixed(1)} s | ${(r.ready / 1000).toFixed(1)} s | ${r.longest} ms | ${r.searchMs} ms | ${r.heap} MB |`);
} finally {
  server.kill();
}
