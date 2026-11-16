#!/usr/bin/env node
// Fails if /.kiro is missing, not tracked by git, or matched by any ignore rule.
// Hackathon rule: the repo root must contain /.kiro and it must not be in .gitignore.
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Problems with `.kiro` in the repo at `root`. Empty when everything is fine. */
export function checkKiro(root) {
  const errors = [];
  const kiro = resolve(root, ".kiro");
  if (!existsSync(kiro) || !statSync(kiro).isDirectory())
    return [".kiro/ directory is missing at the repo root."];

  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  // --no-index: also test tracked files. Without it git never reports a tracked path as ignored,
  // so a ".kiro/" rule added later would slip through. Exit 0 means "ignored".
  for (const path of [".kiro", ".kiro/", ".kiro/specs/seance-kit/requirements.md"]) {
    try {
      git("check-ignore", "-q", "--no-index", path);
      errors.push(`${path} is matched by an ignore rule (.gitignore or similar).`);
      break;
    } catch {
      // Not ignored.
    }
  }
  const tracked = git("ls-files", ".kiro").split("\n").filter(Boolean);
  if (tracked.length === 0) errors.push("No files under .kiro/ are tracked by git.");
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkKiro(resolve(import.meta.dirname, ".."));
  for (const e of errors) console.error(`check-kiro-not-ignored: ${e}`);
  if (errors.length > 0) process.exit(1);
  console.log("check-kiro-not-ignored: ok");
}
