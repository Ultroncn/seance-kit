#!/usr/bin/env node
// pnpm new:app <name> [--title "Display Name"]
// Copies templates/app to apps/<name> and renames it. The result installs, builds and passes its
// tests with no manual edits (R10.2). CI checks this on every push.
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const TEMPLATE = join(ROOT, "templates", "app");
const SKIP = new Set(["node_modules", "dist", ".vite"]);
const TEXT = /\.(ts|tsx|js|mjs|json|html|css|md)$/;

export const TEMPLATE_NAME = "my-agent-app";
export const TEMPLATE_TITLE = "My Agent App";

/** Lower-case words joined by hyphens, 3–40 characters. */
export function validateName(name) {
  if (
    typeof name !== "string" ||
    !/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(name) ||
    name.includes("--")
  ) {
    return "Use 3–40 lower-case letters, digits and single hyphens, starting with a letter, e.g. recipe-ghost.";
  }
  if (name === TEMPLATE_NAME) return `"${TEMPLATE_NAME}" is the template's own name. Pick another.`;
  return null;
}

/** "recipe-ghost" → "Recipe Ghost" */
export const titleFrom = (name) =>
  name
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** Replace the template's name and title in one file's text. */
export const renameText = (text, name, title) =>
  text.split(TEMPLATE_NAME).join(name).split(TEMPLATE_TITLE).join(title);

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

/** Copy the template into `<appsDir>/<name>` and rename it. Returns the new folder. */
export function createApp({ name, title = titleFrom(name), appsDir = join(ROOT, "apps") }) {
  const problem = validateName(name);
  if (problem) throw new Error(problem);
  const target = join(appsDir, name);
  if (existsSync(target)) throw new Error(`${relative(ROOT, target) || target} already exists.`);
  cpSync(TEMPLATE, target, {
    recursive: true,
    filter: (src) => !SKIP.has(src.split(/[\\/]/).pop()),
  });
  for (const path of files(target)) {
    if (!TEXT.test(path)) continue;
    const before = readFileSync(path, "utf8");
    const after = renameText(before, name, title);
    if (after !== before) writeFileSync(path, after);
  }
  return target;
}

function main(argv) {
  const [name, ...rest] = argv;
  const t = rest.indexOf("--title");
  const title = t >= 0 ? rest[t + 1] : undefined;
  try {
    const target = createApp({ name, title });
    const rel = relative(ROOT, target);
    console.log(`Created ${rel}.

Next:
  1. pnpm install
  2. pnpm --filter @seance/${name} dev        (opens on http://localhost:5173/${name}/)
  3. Describe your data in ${rel}/src/tools/shared.ts and add tools next to it, one per file.
  4. Script a few demo prompts in ${rel}/src/demo/scripts.ts, and keep ${rel}/test/ green.
  5. To deploy with the others, add "/${name}/" to worker/index.js and a target in scripts/build-all.mjs.`);
  } catch (err) {
    console.error(`new:app: ${err instanceof Error ? err.message : err}`);
    console.error('Usage: pnpm new:app <name> [--title "Display Name"]');
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
