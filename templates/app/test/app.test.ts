import { createAgent, type AgentEvent } from "@seance/core";
import { MockProvider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { DEMO_PROMPTS, scripts } from "../src/demo/scripts";
import { NOTES, createNotesSearch, createRegistry } from "../src/tools";

// Step 5: test your tools and demo scripts. Keep these when you change the app.
async function play(storage: MemoryStorage, prompt: string, approve = true) {
  const search = createNotesSearch(storage, 0);
  await search.load();
  const agent = createAgent({
    provider: new MockProvider({ scripts }),
    registry: createRegistry({ search }),
    storage,
  });
  const events: AgentEvent[] = [];
  for await (const e of agent.run(prompt, { approve: () => approve })) events.push(e);
  return events;
}

describe("template app", () => {
  it("has a read, a write and a destructive tool, all convertible to JSON Schema", () => {
    const registry = createRegistry({ search: createNotesSearch(new MemoryStorage(), 0) });
    expect(
      registry
        .list()
        .map((t) => t.risk)
        .sort(),
    ).toEqual(["destructive", "read", "write"]);
    expect(registry.toJsonSchema()).toHaveLength(3);
  });

  it("demo scripts add a note after approval, then hide it", async () => {
    const storage = new MemoryStorage();
    await play(storage, DEMO_PROMPTS.add);
    expect((await storage.list(NOTES)).map((n) => n.title)).toEqual(["Séance on Friday"]);
    const events = await play(storage, DEMO_PROMPTS.tidy);
    expect(events.some((e) => e.type === "tool_result" && e.undoToken)).toBe(true);
    expect((await storage.list(NOTES)).every((n) => n.banishedAt)).toBe(true);
  });

  it("rejecting the write leaves the notebook empty", async () => {
    const storage = new MemoryStorage();
    await play(storage, DEMO_PROMPTS.add, false);
    expect(await storage.list(NOTES)).toEqual([]);
  });
});
