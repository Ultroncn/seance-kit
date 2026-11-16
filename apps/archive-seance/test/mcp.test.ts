import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, prepare } from "@seance/mcp-server";
import { MemoryStorage } from "@seance/storage";
import { afterAll, describe, expect, it } from "vitest";
import { archiveMcp } from "../mcp/app";
import { createArchiveSearch, importConversations } from "../src/domain/store";
import { parseChatGPT } from "../src/importers";

const ROOT = resolve(import.meta.dirname, "../../..");
const SAMPLE = resolve(import.meta.dirname, "../public/sample/chatgpt-conversations.json");
const dirs: string[] = [];
const tempDir = async () => {
  const d = await mkdtemp(join(tmpdir(), "seance-mcp-"));
  dirs.push(d);
  return d;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

const text = (r: unknown) => (r as { content: { text: string }[] }).content[0]!.text;

describe("Archive Séance over MCP", () => {
  it("imports a raw ChatGPT export into a data folder and serves the same six tools", async () => {
    const dataDir = await tempDir();
    const { registry, storage } = await prepare(archiveMcp, {
      dataDir,
      imports: [SAMPLE],
      readOnly: false,
    });
    const server = createMcpServer({ name: "archive-seance", version: "0.1.0", registry, storage });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "kiro-like", version: "1.0.0" });
    await Promise.all([server.connect(a), client.connect(b)]);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      registry
        .list()
        .map((t) => t.name)
        .sort(),
    );
    expect(tools.find((t) => t.name === "banish_conversation")?.annotations?.destructiveHint).toBe(
      true,
    );

    const hit = await client.callTool({
      name: "search_conversations",
      arguments: { query: "sourdough" },
    });
    expect(hit.structuredContent).toMatchObject({
      total: 1,
      results: [{ title: "Sourdough starter keeps dying" }],
    });
  });

  it("imports a Séance export file (Settings → Export all data) and rebuilds search", async () => {
    const browser = new MemoryStorage();
    const search = createArchiveSearch(browser, 0);
    await importConversations(
      browser,
      search,
      parseChatGPT(JSON.parse(await (await import("node:fs/promises")).readFile(SAMPLE, "utf8")))
        .conversations,
    );
    const exportPath = join(await tempDir(), "archive-seance-export.json");
    await writeFile(exportPath, await (await browser.exportAll()).text());

    const { registry, storage } = await prepare(archiveMcp, {
      dataDir: await tempDir(),
      imports: [exportPath],
      readOnly: false,
    });
    const r = await registry.run(
      "search_conversations",
      { query: "Lisbon" },
      { storage, signal: new AbortController().signal, now: () => new Date() },
    );
    expect(r.ok && (r.value as { total: number }).total).toBe(1);
  });

  it("runs as a real stdio process, and resolves relative paths against the repo root from any cwd", async () => {
    const dataDir = await tempDir();
    const transport = new StdioClientTransport({
      // Started from an unrelated folder, with a repo-relative --import path.
      command: process.execPath,
      args: [
        "--import",
        pathToFileURL(createRequire(import.meta.url).resolve("tsx/esm")).href,
        resolve(ROOT, "apps/archive-seance/mcp/main.ts"),
        "--data",
        dataDir,
        "--import",
        "apps/archive-seance/public/sample/chatgpt-conversations.json",
        "--read-only",
      ],
      cwd: tmpdir(),
      stderr: "pipe",
    });
    const client = new Client({ name: "stdio-test", version: "1.0.0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        "read_conversation",
        "search_conversations",
      ]);
      const r = await client.callTool({
        name: "search_conversations",
        arguments: { query: "regex" },
      });
      expect(text(r)).toContain("Regex for dates in a log file");
    } finally {
      await client.close();
    }
  }, 60_000);
});
