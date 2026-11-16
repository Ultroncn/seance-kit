import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error: plain ESM script without type declarations.
import { TEMPLATE_NAME, createApp, renameText, titleFrom, validateName } from "./new-app.mjs";

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? allFiles(p) : [p];
  });
}

describe("new:app", () => {
  it("validates names", () => {
    expect(validateName("recipe-ghost")).toBeNull();
    for (const bad of ["", "Ab", "1app", "my_app", "a", "ends-", "dou--ble", TEMPLATE_NAME])
      expect(validateName(bad)).not.toBeNull();
  });

  it("titles and renames", () => {
    expect(titleFrom("recipe-ghost")).toBe("Recipe Ghost");
    expect(
      renameText(
        '"@seance/my-agent-app" My Agent App /my-agent-app/',
        "recipe-ghost",
        "Recipe Ghost",
      ),
    ).toBe('"@seance/recipe-ghost" Recipe Ghost /recipe-ghost/');
  });

  it("copies the template, renames every mention, and skips build output", () => {
    const appsDir = mkdtempSync(join(tmpdir(), "seance-new-app-"));
    dirs.push(appsDir);
    const target = createApp({ name: "recipe-ghost", appsDir });
    const files = allFiles(target);
    expect(
      files.some((f) => f.includes("node_modules") || f.includes(`${join("x", "dist")}`.slice(1))),
    ).toBe(false);
    for (const f of files) expect(readFileSync(f, "utf8")).not.toContain(TEMPLATE_NAME);
    expect(JSON.parse(readFileSync(join(target, "package.json"), "utf8")).name).toBe(
      "@seance/recipe-ghost",
    );
    expect(readFileSync(join(target, "vite.config.ts"), "utf8")).toContain(
      'base: "/recipe-ghost/"',
    );
    expect(readFileSync(join(target, "src/App.tsx"), "utf8")).toContain('title="Recipe Ghost"');
    expect(() => createApp({ name: "recipe-ghost", appsDir })).toThrow(/already exists/);
  });
});
