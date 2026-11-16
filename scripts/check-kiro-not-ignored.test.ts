import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without type declarations.
import { checkKiro } from "./check-kiro-not-ignored.mjs";

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function repo() {
  const d = mkdtempSync(join(tmpdir(), "seance-kiro-check-"));
  dirs.push(d);
  const git = (...a: string[]) => execFileSync("git", a, { cwd: d, stdio: "ignore" });
  git("init", "-q");
  mkdirSync(join(d, ".kiro/specs/seance-kit"), { recursive: true });
  writeFileSync(join(d, ".kiro/specs/seance-kit/requirements.md"), "# r\n");
  git("add", ".");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "-m", "init");
  return d;
}

describe("check-kiro-not-ignored", () => {
  it("passes when .kiro is tracked and not ignored", () => {
    expect(checkKiro(repo())).toEqual([]);
  });

  it("fails when .kiro is added to .gitignore after being committed", () => {
    const d = repo();
    appendFileSync(join(d, ".gitignore"), ".kiro/\n");
    expect(checkKiro(d).join(" ")).toMatch(/ignore rule/);
  });

  it("fails when .kiro is missing", () => {
    const d = mkdtempSync(join(tmpdir(), "seance-kiro-none-"));
    dirs.push(d);
    expect(checkKiro(d)).toEqual([".kiro/ directory is missing at the repo root."]);
  });
});
