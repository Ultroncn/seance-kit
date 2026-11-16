import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool, ToolRegistry } from "../src/index";
import { ctx } from "./helpers";

const ERROR_TYPES = ["UnknownTool", "InvalidInput", "InvalidOutput", "ToolFailed"];

function fixtureRegistry(): ToolRegistry {
  return new ToolRegistry()
    .register(
      defineTool({
        name: "echo",
        description: "Echo text",
        risk: "read",
        input: z.object({ text: z.string(), times: z.number().int().min(1).max(3).default(1) }),
        output: z.object({ text: z.string() }),
        async run(i) {
          return { text: i.text.repeat(i.times) };
        },
      }),
    )
    .register(
      defineTool({
        name: "explodes",
        description: "Always throws",
        risk: "write",
        input: z.unknown(),
        output: z.unknown(),
        async run() {
          throw new Error("boom");
        },
      }),
    )
    .register(
      defineTool({
        name: "wrong_output",
        description: "Returns the wrong shape",
        risk: "read",
        input: z.unknown(),
        output: z.object({ ok: z.literal(true) }),
        async run() {
          return { ok: false } as never;
        },
      }),
    );
}

describe("ToolRegistry", () => {
  it("rejects duplicate names, bad names and empty descriptions", () => {
    const r = fixtureRegistry();
    const dup = defineTool({
      name: "echo",
      description: "x",
      risk: "read",
      input: z.object({}),
      output: z.object({}),
      run: async () => ({}),
    });
    expect(() => r.register(dup)).toThrow(/already registered/);
    expect(() => r.register({ ...dup, name: "BadName" })).toThrow(/snake_case/);
    expect(() => r.register({ ...dup, name: "fine_name", description: " " })).toThrow(
      /description/,
    );
  });

  it("runs a valid call and applies schema defaults", async () => {
    const out = await fixtureRegistry().run("echo", { text: "ab", times: 2 }, ctx());
    expect(out).toEqual({ ok: true, value: { text: "abab" } });
    expect(await fixtureRegistry().run("echo", { text: "x" }, ctx())).toEqual({
      ok: true,
      value: { text: "x" },
    });
  });

  it("maps failures to typed errors", async () => {
    const r = fixtureRegistry();
    const bad = await r.run("echo", { text: 5 }, ctx());
    expect(bad).toMatchObject({ ok: false, error: { type: "InvalidInput" } });
    expect(await r.run("nope", {}, ctx())).toMatchObject({ error: { type: "UnknownTool" } });
    expect(await r.run("explodes", {}, ctx())).toMatchObject({
      error: { type: "ToolFailed", message: "boom" },
    });
    expect(await r.run("wrong_output", {}, ctx())).toMatchObject({
      error: { type: "InvalidOutput" },
    });
  });

  it("derives JSON Schema without a $schema key", () => {
    const [echo] = fixtureRegistry().toJsonSchema();
    expect(echo?.name).toBe("echo");
    expect(echo?.inputSchema).toMatchObject({ type: "object" });
    expect(echo?.inputSchema).not.toHaveProperty("$schema");
    expect(JSON.stringify(echo?.inputSchema)).toContain("text");
  });

  it("treats fields with defaults as optional inputs, and lists object outputs for MCP", () => {
    const [echo] = fixtureRegistry().toJsonSchema();
    expect(echo?.inputSchema.required).toEqual(["text"]);
    const mcp = fixtureRegistry().toMcpTools();
    expect(mcp.find((t) => t.name === "echo")?.outputSchema).toMatchObject({
      type: "object",
      required: ["text"],
    });
    expect(mcp.find((t) => t.name === "explodes")?.outputSchema).toBeUndefined();
  });

  it("refuses a destructive tool that does not promise an undo token (R2.7)", () => {
    const bad = defineTool({
      name: "wipe_all",
      description: "Delete things",
      risk: "destructive",
      input: z.object({}),
      output: z.object({ ok: z.boolean() }),
      run: async () => ({ ok: true }),
    });
    expect(() => new ToolRegistry().register(bad)).toThrow(/undoToken/);
  });

  it("undo_banish brings back what a banish hid", async () => {
    const c = ctx();
    await c.storage.put("notes", { id: "n1" });
    const { banishItems: banish, undoBanishTool: tool } = await import("../src/index");
    const { undoToken } = await banish(c.storage, "notes", ["n1"], new Date());
    const r = await new ToolRegistry().register(tool()).run("undo_banish", { undoToken }, c);
    expect(r).toEqual({ ok: true, value: { restored: ["n1"], skipped: [] } });
    expect(await c.storage.get("notes", "n1")).toEqual({ id: "n1" });
  });

  it("marks MCP annotations from risk", () => {
    const byName = Object.fromEntries(
      fixtureRegistry()
        .toMcpTools()
        .map((t) => [t.name, t]),
    );
    expect(byName["echo"]?.annotations).toEqual({ readOnlyHint: true, destructiveHint: false });
    expect(byName["explodes"]?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
    });
  });

  it("P7 any input yields a result or a typed error and never throws", async () => {
    const r = fixtureRegistry();
    const names = fc.oneof(
      fc.constantFrom("echo", "explodes", "wrong_output", "nope"),
      fc.string(),
    );
    await fc.assert(
      fc.asyncProperty(names, fc.anything(), async (name, input) => {
        const out = await r.run(name, input, ctx());
        if (!out.ok) expect(ERROR_TYPES).toContain(out.error.type);
      }),
      { numRuns: 300 },
    );
  });

  it("P11 toJsonSchema and toMcpTools list exactly the registered tools", () => {
    const name = fc.stringMatching(/^[a-z][a-z0-9]{0,6}(_[a-z0-9]{1,4}){0,2}$/);
    fc.assert(
      fc.property(fc.uniqueArray(name, { maxLength: 12 }), (names) => {
        const r = new ToolRegistry();
        for (const n of names) {
          r.register(
            defineTool({
              name: n,
              description: `tool ${n}`,
              risk: "read",
              input: z.object({}),
              output: z.object({}),
              run: async () => ({}),
            }),
          );
        }
        expect(r.toJsonSchema().map((t) => t.name)).toEqual(names);
        expect(r.toMcpTools().map((t) => t.name)).toEqual(names);
        expect(r.list().map((t) => t.name)).toEqual(names);
      }),
    );
  });
});
