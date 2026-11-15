#!/usr/bin/env node
// Local stand-in for the Cloudflare deployment, used by Playwright. Not shipped.
// It runs the real worker/index.js against a minimal ASSETS binding backed by dist/, so the
// per-app SPA fallback is exercised exactly as in production.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import worker from "../worker/index.js";

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

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Minimal ASSETS binding: exact files, plus "/dir/" -> "/dir/index.html". 404 otherwise. */
const ASSETS = {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const path = normalize(decodeURIComponent(pathname));
    if (path.includes("..")) return new Response("Bad request", { status: 400 });
    const file = path.endsWith("/") ? join(dist, path, "index.html") : join(dist, path);
    if (!(await isFile(file))) return new Response("Not found", { status: 404 });
    return new Response(await readFile(file), {
      headers: { "content-type": types[extname(file)] ?? "application/octet-stream" },
    });
  },
};

createServer(async (req, res) => {
  const request = new Request(new URL(req.url ?? "/", `http://localhost:${port}`), {
    method: req.method,
  });
  const response = await worker.fetch(request, { ASSETS });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`serve-dist: http://localhost:${port}`));
