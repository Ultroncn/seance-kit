// Vite plugin that makes an app work offline after the first load (requirement R4.3).
// On build it writes <outDir>/sw.js from scripts/offline-sw.js with the list of built files,
// and adds a script to index.html that registers it at <base>sw.js. Dev servers are untouched.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

export const SW_FILE = "sw.js";

export interface BuiltFile {
  /** Path relative to the build output, with forward slashes. */
  path: string;
  content: Uint8Array;
}

/**
 * URLs to precache, relative to the app's scope, and a version that changes whenever any
 * file changes. "index.html" becomes "./": the scope URL is what navigations ask for, and
 * Cloudflare answers ".../index.html" with a redirect.
 */
export function offlineManifest(built: readonly BuiltFile[]): { files: string[]; version: string } {
  const sorted = built
    .filter((f) => f.path !== SW_FILE)
    .toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const version = createHash("sha256");
  for (const f of sorted) {
    version.update(f.path).update("\0").update(createHash("sha256").update(f.content).digest());
  }
  const files = sorted.map((f) =>
    f.path === "index.html" ? "./" : f.path.endsWith("/index.html") ? f.path.slice(0, -10) : f.path,
  );
  return { files, version: version.digest("hex").slice(0, 16) };
}

/** The service worker source: the template with its two build-time constants in front. */
export function renderServiceWorker(
  template: string,
  manifest: { files: string[]; version: string },
): string {
  return (
    `const OFFLINE_VERSION = ${JSON.stringify(manifest.version)};\n` +
    `const OFFLINE_FILES = ${JSON.stringify(manifest.files)};\n` +
    template
  );
}

/** Inline registration script for index.html. Registration failure only means no offline use. */
export function registrationScript(base: string): string {
  const url = JSON.stringify(`${base}${SW_FILE}`);
  return `if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register(${url}).catch(() => {}));`;
}

function readTree(dir: string): BuiltFile[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => statSync(join(dir, path)).isFile())
    .map((path) => ({ path: path.split(sep).join("/"), content: readFileSync(join(dir, path)) }));
}

/**
 * The part of Vite's Plugin type this plugin uses. Declared here because scripts/ cannot
 * resolve the "vite" package; each vite.config.ts checks it against the real type.
 */
interface OfflinePlugin {
  name: string;
  apply: "build";
  configResolved(config: { base: string; root: string; build: { outDir: string } }): void;
  transformIndexHtml(): { tag: string; children: string; injectTo: "body" }[];
  closeBundle(error?: Error): void;
}

export function offline(): OfflinePlugin {
  let base = "/";
  let outDir = "dist";
  return {
    name: "seance-offline",
    apply: "build",
    configResolved(config) {
      base = config.base;
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml() {
      return [{ tag: "script", children: registrationScript(base), injectTo: "body" }];
    },
    closeBundle(error) {
      if (error) return;
      const template = readFileSync(resolve(import.meta.dirname, "offline-sw.js"), "utf8");
      const sw = renderServiceWorker(template, offlineManifest(readTree(outDir)));
      writeFileSync(join(outDir, SW_FILE), sw);
    },
  };
}
