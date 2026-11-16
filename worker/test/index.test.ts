import { describe, expect, it } from "vitest";
import worker from "../index.js";

/** Fake ASSETS binding: serves only the listed paths, 404 for everything else. */
function makeEnv(files: Record<string, string>) {
  const calls: string[] = [];
  const ASSETS = {
    async fetch(req: Request) {
      const { pathname } = new URL(req.url);
      calls.push(pathname);
      const body = files[pathname];
      return body === undefined ? new Response("nf", { status: 404 }) : new Response(body);
    },
  };
  return { env: { ASSETS }, calls };
}

const files = {
  "/": "landing",
  "/archive/": "archive-shell",
  "/inbox/": "inbox-shell",
  "/archive/assets/app.js": "js",
};

const get = (path: string, init?: RequestInit) => new Request(`https://example.test${path}`, init);

describe("worker SPA fallback", () => {
  it("passes through existing assets", async () => {
    const { env } = makeEnv(files);
    const res = await worker.fetch(get("/archive/assets/app.js"), env);
    expect(await res.text()).toBe("js");
  });

  it("serves the archive shell on /archive/ deep links", async () => {
    const { env } = makeEnv(files);
    const res = await worker.fetch(get("/archive/some/deep/link"), env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("archive-shell");
  });

  it("serves the inbox shell on /inbox/ deep links, not the archive or landing page", async () => {
    const { env } = makeEnv(files);
    const res = await worker.fetch(get("/inbox/messages/42"), env);
    expect(await res.text()).toBe("inbox-shell");
  });

  it("keeps unknown root URLs as 404", async () => {
    const { env } = makeEnv(files);
    const res = await worker.fetch(get("/nope"), env);
    expect(res.status).toBe(404);
  });

  it("keeps missing files under an app as 404 instead of returning HTML", async () => {
    const { env } = makeEnv(files);
    const res = await worker.fetch(get("/archive/assets/missing.js"), env);
    expect(res.status).toBe(404);
  });

  it("does not fall back for non-GET requests", async () => {
    const { env } = makeEnv(files);
    const res = await worker.fetch(get("/archive/x", { method: "POST", body: "{}" }), env);
    expect(res.status).toBe(404);
  });
});
