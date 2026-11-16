import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { defineTool, ToolRegistry } from "@seance/core";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createMcpServer, parseCli } from "../src/index";

function registry() {
  return new ToolRegistry()
    .register(
      defineTool({
        name: "count_notes",
        description: "Count notes",
        risk: "read",
        input: z.object({ prefix: z.string().default("") }),
        output: z.object({ n: z.number() }),
        async run({ prefix }, ctx) {
          return {
            n: (await ctx.storage.list("notes")).filter((x) => x.id.startsWith(prefix)).length,
          };
        },
      }),
    )
    .register(
      defineTool({
        name: "add_note",
        description: "Add a note",
        risk: "write",
        input: z.object({ id: z.string().min(1) }),
        output: z.object({ id: z.string() }),
        async run({ id }, ctx) {
          await ctx.storage.put("notes", { id });
          return { id };
        },
      }),
    );
}

async function connect(readOnly = false) {
  const storage = new MemoryStorage();
  const reg = registry();
  const server = createMcpServer({
    name: "test-app",
    version: "1.0.0",
    instructions: "Be nice.",
    registry: reg,
    storage,
    readOnly,
  });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, storage, reg };
}

describe("MCP server", () => {
  it("lists exactly the registry's tools with derived schemas and risk annotations (P11, R9.3)", async () => {
    const { client, reg } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(reg.list().map((t) => t.name));
    const count = tools.find((t) => t.name === "count_notes")!;
    expect(count.inputSchema.required ?? []).toEqual([]);
    expect(count.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(count.outputSchema).toMatchObject({ type: "object" });
    expect(client.getInstructions()).toBe("Be nice.");
  });

  it("runs tools on the shared storage and returns text plus structured content", async () => {
    const { client, storage } = await connect();
    await client.callTool({ name: "add_note", arguments: { id: "n1" } });
    expect(await storage.get("notes", "n1")).toEqual({ id: "n1" });
    const r = await client.callTool({ name: "count_notes", arguments: {} });
    expect(r.structuredContent).toEqual({ n: 1 });
    expect(JSON.parse((r.content as { text: string }[])[0]!.text)).toEqual({ n: 1 });
  });

  it("returns typed errors instead of failing the request", async () => {
    const { client } = await connect();
    const bad = await client.callTool({ name: "add_note", arguments: { id: "" } });
    expect(bad.isError).toBe(true);
    expect((bad.content as { text: string }[])[0]!.text).toMatch(/^InvalidInput:/);
    const unknown = await client.callTool({ name: "nope", arguments: {} });
    expect(unknown.isError).toBe(true);
  });

  it("read-only mode hides and refuses write tools", async () => {
    const { client, storage } = await connect(true);
    expect((await client.listTools()).tools.map((t) => t.name)).toEqual(["count_notes"]);
    const r = await client.callTool({ name: "add_note", arguments: { id: "x" } });
    expect(r.isError).toBe(true);
    expect(await storage.list("notes")).toEqual([]);
  });
});

describe("parseCli", () => {
  it("requires --data and resolves paths", () => {
    expect(() => parseCli([])).toThrow(/--data/);
    const o = parseCli(["--data", "d", "--import", "a.json", "--import", "b.mbox", "--read-only"]);
    expect(o.dataDir.endsWith("/d")).toBe(true);
    expect(o.imports.map((p) => p.split("/").pop())).toEqual(["a.json", "b.mbox"]);
    expect(o.readOnly).toBe(true);
    expect(parseCli(["--data", "x"], "/repo").dataDir).toBe("/repo/x");
  });
});
