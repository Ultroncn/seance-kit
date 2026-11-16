import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, prepare } from "@seance/mcp-server";
import { FileStorage } from "@seance/storage/file";
import { afterAll, describe, expect, it } from "vitest";
import { inboxMcp } from "../mcp/app";

const SAMPLE = resolve(import.meta.dirname, "../public/sample/inbox.mbox");
const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

describe("Inbox Exorcist over MCP", () => {
  it("imports an mbox, keeps data across restarts, and never offers a send tool", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "seance-mcp-inbox-"));
    dirs.push(dataDir);
    const first = await prepare(inboxMcp, { dataDir, imports: [SAMPLE], readOnly: false });
    expect(await first.storage.list("emails")).toHaveLength(18);

    // A second start with the same file adds nothing (P3) and finds the saved data.
    const again = await prepare(inboxMcp, { dataDir, imports: [SAMPLE], readOnly: false });
    expect(await new FileStorage(dataDir).list("emails")).toHaveLength(18);

    const server = createMcpServer({
      name: "inbox-exorcist",
      version: "0.1.0",
      registry: again.registry,
      storage: again.storage,
    });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "kiro-like", version: "1.0.0" });
    await Promise.all([server.connect(a), client.connect(b)]);

    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toHaveLength(6);
    expect(names.some((n) => /send|forward|smtp/i.test(n))).toBe(false);

    const r = await client.callTool({ name: "search_emails", arguments: { query: "boiler" } });
    expect(r.structuredContent).toMatchObject({
      total: 1,
      results: [{ subject: "Boiler service next Tuesday" }],
    });
  });
});
