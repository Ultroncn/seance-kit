import { describe, expect, it } from "vitest";
import { offlineManifest, registrationScript, renderServiceWorker } from "./vite-offline";

const file = (path: string, text = path) => ({ path, content: new TextEncoder().encode(text) });

describe("offline service worker", () => {
  it("precaches every built file, with the shell under the scope URL and without sw.js", () => {
    const { files } = offlineManifest([
      file("sw.js"),
      file("sample/inbox.mbox"),
      file("index.html"),
      file("assets/index-abc.js"),
      file("nested/index.html"),
    ]);
    expect(files).toEqual(["assets/index-abc.js", "./", "nested/", "sample/inbox.mbox"]);
  });

  it("keeps the version when nothing changes, whatever the file order", () => {
    const a = offlineManifest([file("index.html"), file("assets/a.js")]);
    const b = offlineManifest([file("assets/a.js"), file("index.html")]);
    expect(a.version).toBe(b.version);
  });

  it("changes the version when a file's content, name or presence changes", () => {
    const base = offlineManifest([file("index.html"), file("sample/x.json", "1")]).version;
    expect(offlineManifest([file("index.html"), file("sample/x.json", "2")]).version).not.toBe(
      base,
    );
    expect(offlineManifest([file("index.html"), file("sample/y.json", "1")]).version).not.toBe(
      base,
    );
    expect(offlineManifest([file("index.html")]).version).not.toBe(base);
  });

  it("ignores sw.js itself, so writing it does not change the version", () => {
    const before = offlineManifest([file("index.html")]).version;
    expect(offlineManifest([file("index.html"), file("sw.js", "anything")]).version).toBe(before);
  });

  it("defines the template's build-time constants", () => {
    const sw = renderServiceWorker("/* template */", { files: ["./", "a.js"], version: "v1" });
    expect(sw).toBe(
      'const OFFLINE_VERSION = "v1";\nconst OFFLINE_FILES = ["./","a.js"];\n/* template */',
    );
  });

  it("registers the worker under the app's own base path", () => {
    expect(registrationScript("/inbox/")).toContain('register("/inbox/sw.js")');
  });
});
