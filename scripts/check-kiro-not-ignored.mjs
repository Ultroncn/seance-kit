#!/usr/bin/env node
// Fails if /.kiro is missing, not tracked by git, or matched by any ignore rule.
// Hackathon rule: the repo root must contain /.kiro and it must not be in .gitignore.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const errors = [];

const kiro = resolve(root, ".kiro");
if (!existsSync(kiro) || !statSync(kiro).isDirectory()) {
  errors.push(".kiro/ directory is missing at the repo root.");
} else {
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  // Ignored? `git check-ignore` exits 0 when the path is ignored, 1 when not.
  let ignored = false;
  try {
    git("check-ignore", "-q", ".kiro/specs/seance-kit/requirements.md");
    ignored = true;
  } catch {
    ignored = false;
  }
  if (ignored) errors.push(".kiro is matched by an ignore rule (.gitignore or similar).");

  const tracked = git("ls-files", ".kiro").split("\n").filter(Boolean);
  if (tracked.length === 0) errors.push("No files under .kiro/ are tracked by git.");
}

if (errors.length > 0) {
  for (const e of errors) console.error(`check-kiro-not-ignored: ${e}`);
  process.exit(1);
}
console.log("check-kiro-not-ignored: ok");
