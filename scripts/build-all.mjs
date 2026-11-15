#!/usr/bin/env node
// Builds the landing page and both apps, then assembles one deployable dist/:
//   /          site/
//   /archive/  apps/archive-seance
//   /inbox/    apps/inbox-exorcist
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

const targets = [
  { filter: "@seance/site", dir: "site", out: "" },
  { filter: "@seance/archive-seance", dir: "apps/archive-seance", out: "archive" },
  { filter: "@seance/inbox-exorcist", dir: "apps/inbox-exorcist", out: "inbox" },
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const t of targets) {
  execFileSync("pnpm", ["--filter", t.filter, "build"], { cwd: root, stdio: "inherit" });
  cpSync(resolve(root, t.dir, "dist"), resolve(dist, t.out), { recursive: true });
}

// No _redirects file on purpose. Workers static assets rejects SPA rewrites such as
// "/archive/* /archive/index.html 200" (API error 100324, "infinite loop"). Per-app SPA
// fallback lives in worker/index.js instead.

console.log("build-all: dist/ ready");
