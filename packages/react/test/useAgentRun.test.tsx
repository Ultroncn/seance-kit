// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { banishItems, defineTool, ToolRegistry } from "@seance/core";
import { MockProvider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useAgentRun } from "../src/index";

function setup() {
  const storage = new MemoryStorage();
  const registry = new ToolRegistry()
    .register(
      defineTool({
        name: "hide_note",
        description: "Hide a note",
        risk: "destructive",
        input: z.object({ id: z.string() }),
        output: z.object({ undoToken: z.string() }),
        async run({ id }, ctx) {
          const r = await banishItems(ctx.storage, "notes", [id], ctx.now());
          return { undoToken: r.undoToken };
        },
      }),
    )
    .register(
      defineTool({
        name: "count_notes",
        description: "Count notes",
        risk: "read",
        input: z.object({}),
        output: z.object({ n: z.number() }),
        async run(_i, ctx) {
          return { n: (await ctx.storage.list("notes")).length };
        },
      }),
    );
  const provider = new MockProvider({
    scripts: [
      {
        match: "hide",
        steps: [{ toolCalls: [{ name: "hide_note", input: { id: "n1" } }] }],
        finalText: "Hidden.",
      },
      {
        match: "count",
        steps: [{ toolCalls: [{ name: "count_notes", input: {} }] }],
        finalText: "Counted.",
      },
    ],
  });
  return { storage, registry, provider };
}

describe("useAgentRun", () => {
  it("waits for Allow, runs the tool, reports the data change, and can undo", async () => {
    const { storage, registry, provider } = setup();
    await storage.put("notes", { id: "n1" });
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useAgentRun({ provider, registry, storage, onDataChange }));

    let done!: Promise<void>;
    act(() => {
      done = result.current.run("hide it");
    });
    await waitFor(() =>
      expect(result.current.entries.find((e) => e.kind === "tool")).toMatchObject({
        status: "awaiting_approval",
      }),
    );
    expect(result.current.busy).toBe(true);
    expect(await storage.get("notes", "n1")).toEqual({ id: "n1" });

    act(() => result.current.approve(result.current.entries.find((e) => e.kind === "tool")!.id));
    await act(() => done);
    const step = result.current.entries.find((e) => e.kind === "tool");
    expect(step).toMatchObject({ status: "done" });
    expect(result.current.entries.at(-1)).toMatchObject({ kind: "message", text: "Hidden." });
    expect(onDataChange).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);

    const token = step?.kind === "tool" ? step.undoToken! : "";
    await act(() => result.current.undo(token));
    expect(await storage.get("notes", "n1")).toEqual({ id: "n1" });
    expect(result.current.undone.has(token)).toBe(true);
    expect(onDataChange).toHaveBeenCalledTimes(2);
  });

  it("Reject leaves data alone; read tools do not report a data change", async () => {
    const { storage, registry, provider } = setup();
    await storage.put("notes", { id: "n1" });
    const onDataChange = vi.fn();
    const { result } = renderHook(() => useAgentRun({ provider, registry, storage, onDataChange }));

    let done!: Promise<void>;
    act(() => {
      done = result.current.run("hide it");
    });
    await waitFor(() => expect(result.current.entries.some((e) => e.kind === "tool")).toBe(true));
    act(() => result.current.reject(result.current.entries.find((e) => e.kind === "tool")!.id));
    await act(() => done);
    expect(result.current.entries.find((e) => e.kind === "tool")).toMatchObject({
      status: "rejected",
    });
    expect(await storage.get("notes", "n1")).toEqual({ id: "n1" });

    await act(() => result.current.run("count them"));
    expect(onDataChange).not.toHaveBeenCalled();
  });

  it("Stop ends a run waiting for approval and counts it as rejected", async () => {
    const { storage, registry, provider } = setup();
    await storage.put("notes", { id: "n1" });
    const { result } = renderHook(() => useAgentRun({ provider, registry, storage }));
    let done!: Promise<void>;
    act(() => {
      done = result.current.run("hide it");
    });
    await waitFor(() => expect(result.current.entries.some((e) => e.kind === "tool")).toBe(true));
    act(() => result.current.stop());
    await act(() => done);
    expect(result.current.busy).toBe(false);
    expect(await storage.get("notes", "n1")).toEqual({ id: "n1" });
  });
});
