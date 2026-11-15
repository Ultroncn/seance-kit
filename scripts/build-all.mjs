#!/usr/bin/env node
// Builds the landing page and both apps, then assembles one deployable dist/:
//   /          site/
//   /archive/  apps/archive-seance
//   /inbox/    apps/inbox-exorcist
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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

// Cloudflare Pages: SPA fallbacks per app. The root has no catch-all, so unknown URLs 404.
writeFileSync(
  resolve(dist, "_redirects"),
  ["/archive/* /archive/index.html 200", "/inbox/* /inbox/index.html 200", ""].join("\n"),
);

console.log("build-all: dist/ ready");
