#!/usr/bin/env node
// Tiny static server for dist/ that mimics the Cloudflare Pages _redirects behaviour.
// Used by Playwright. Not shipped.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
const port = Number(process.env.PORT ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function exists(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = normalize(decodeURIComponent(url.pathname));
  if (path.includes("..")) {
    res.writeHead(400).end();
    return;
  }
  let file = join(dist, path);
  if (path.endsWith("/")) file = join(file, "index.html");
  if (!(await exists(file))) {
    const app = ["/archive/", "/inbox/"].find((p) => path.startsWith(p));
    file = app ? join(dist, app, "index.html") : "";
  }
  if (!file || !(await exists(file))) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
}).listen(port, () => console.log(`serve-dist: http://localhost:${port}`));
