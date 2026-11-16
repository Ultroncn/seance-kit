import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAgent, type AgentEvent, type ToolContext } from "@seance/core";
import { MockProvider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { archiveScripts, DEMO_PROMPTS } from "../src/demo/scripts";
import { createArchiveSearch, importConversations } from "../src/domain/store";
import { CONVERSATIONS, RESURRECTIONS, type Conversation } from "../src/domain/types";
import { parseChatGPT, parseClaude } from "../src/importers";
import { createArchiveRegistry } from "../src/tools";
import { normalizeTag } from "../src/tools/shared";

const sample = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../public/sample", name), "utf8"),
  ) as unknown;

async function seeded() {
  const storage = new MemoryStorage();
  const search = createArchiveSearch(storage, 0);
  await search.load();
  await importConversations(storage, search, [
    ...parseChatGPT(sample("chatgpt-conversations.json")).conversations,
    ...parseClaude(sample("claude-conversations.json")).conversations,
  ]);
  const registry = createArchiveRegistry({ search });
  const ctx: ToolContext = {
    storage,
    signal: new AbortController().signal,
    now: () => new Date("2026-11-16T12:00:00Z"),
  };
  return { storage, search, registry, ctx };
}

async function call(name: string, input: unknown) {
  const { registry, ctx, storage } = await seededOnce;
  return { out: await registry.run(name, input, ctx), storage };
}
const seededOnce = seeded();

const titleOf = async (storage: MemoryStorage, title: string) =>
  (await storage.list<Conversation>(CONVERSATIONS)).find((c) => c.title === title)!;

describe("sample archive", () => {
  it("imports all 12 sample chats", async () => {
    const { storage } = await seededOnce;
    expect(await storage.list(CONVERSATIONS)).toHaveLength(12);
  });
});

describe("archive tools", () => {
  it("search finds by words in messages, filters by source and date, and sorts", async () => {
    const { registry, ctx } = await seeded();
    // "pasteis" without the accent finds "pastéis" in the trip chat, and not "pastel" elsewhere.
    const byWord = await registry.run("search_conversations", { query: "pasteis", limit: 20 }, ctx);
    expect(
      byWord.ok && (byWord.value as { results: { title: string }[] }).results.map((r) => r.title),
    ).toEqual(["Lisbon trip planning"]);

    const claudeOnly = await registry.run(
      "search_conversations",
      { source: "claude", limit: 20 },
      ctx,
    );
    expect(claudeOnly.ok && (claudeOnly.value as { total: number }).total).toBe(4);

    const oldest = await registry.run("search_conversations", { sort: "oldest", limit: 1 }, ctx);
    expect(oldest.ok && (oldest.value as { results: { title: string }[] }).results[0]?.title).toBe(
      "Sourdough starter keeps dying",
    );

    const range = await registry.run(
      "search_conversations",
      { from: "2024-01-01", to: "2024-12-31", limit: 20 },
      ctx,
    );
    expect(
      range.ok &&
        (range.value as { results: { title: string }[] }).results.map((r) => r.title).sort(),
    ).toEqual([
      "Budget spreadsheet: SUMIF by month",
      "test test 123",
      "useEffect runs twice in dev",
    ]);

    const bad = await registry.run("search_conversations", { from: "last week" }, ctx);
    expect(bad).toMatchObject({ ok: false, error: { type: "InvalidInput" } });
  });

  it("read truncates long chats and says so", async () => {
    const { storage } = await seededOnce;
    const lisbon = await titleOf(storage, "Lisbon trip planning");
    const { out } = await call("read_conversation", { id: lisbon.id, maxChars: 500 });
    expect(out.ok && out.value).toMatchObject({ truncated: true, messageCount: 4 });
    const unknown = await call("read_conversation", { id: "nope" });
    expect(unknown.out).toMatchObject({ ok: false, error: { type: "ToolFailed" } });
  });

  it("summaries are saved and become searchable", async () => {
    const { registry, ctx, storage } = await seeded();
    const poem = await titleOf(storage, "Birthday poem for Grandma Rosa");
    await registry.run(
      "summarize_conversation",
      { id: poem.id, summary: "Verses about zinnias and kindness." },
      ctx,
    );
    expect((await storage.get<Conversation>(CONVERSATIONS, poem.id))?.summary).toBe(
      "Verses about zinnias and kindness.",
    );
    const hit = await registry.run("search_conversations", { query: "zinnias" }, ctx);
    expect(hit.ok && (hit.value as { results: { id: string }[] }).results.map((r) => r.id)).toEqual(
      [poem.id],
    );
  });

  it("tags are normalized, deduplicated and removable", async () => {
    const { registry, ctx, storage } = await seeded();
    const c = await titleOf(storage, "Tomatoes splitting on the vine");
    const a = await registry.run(
      "tag_conversation",
      { id: c.id, add: ["Garden Notes", "garden-notes", "Ñam!"] },
      ctx,
    );
    expect(a.ok && (a.value as { tags: string[] }).tags).toEqual(["garden-notes", "nam"]);
    const b = await registry.run("tag_conversation", { id: c.id, remove: ["NAM"] }, ctx);
    expect(b.ok && (b.value as { tags: string[] }).tags).toEqual(["garden-notes"]);
    expect(await registry.run("tag_conversation", { id: c.id }, ctx)).toMatchObject({
      ok: false,
      error: { type: "InvalidInput" },
    });
    expect(normalizeTag("  Baking   Ideas ")).toBe("baking-ideas");
  });

  it("banish hides chats from search and returns an undo token", async () => {
    const { registry, ctx, storage } = await seeded();
    const noise = await titleOf(storage, "Untitled chat");
    const r = await registry.run("banish_conversation", { ids: [noise.id, "missing"] }, ctx);
    expect(r.ok && r.value).toMatchObject({
      banished: [{ id: noise.id, title: "Untitled chat" }],
      skipped: ["missing"],
    });
    const all = await registry.run("search_conversations", { limit: 20 }, ctx);
    expect(all.ok && (all.value as { total: number }).total).toBe(11);
    expect(await storage.list(CONVERSATIONS)).toHaveLength(12);
  });

  it("resurrect writes a prompt with the summary and the last exchange, and saves it", async () => {
    const { registry, ctx, storage } = await seeded();
    const regex = await titleOf(storage, "Regex for dates in a log file");
    const r = await registry.run(
      "resurrect_conversation",
      { id: regex.id, note: "Now in Python" },
      ctx,
    );
    const prompt = (r.ok && (r.value as { prompt: string }).prompt) || "";
    expect(prompt).toContain('"Regex for dates in a log file", from June 2020');
    expect(prompt).toContain("Me: It also matches 2020-13-45");
    expect(prompt).toContain("What I want now: Now in Python");
    expect(await storage.list(RESURRECTIONS)).toHaveLength(1);
  });

  it("every tool schema converts to JSON Schema for providers and MCP", async () => {
    const { registry } = await seeded();
    expect(registry.toJsonSchema().map((t) => t.name)).toHaveLength(6);
    for (const t of registry.toMcpTools()) expect(t.inputSchema).toMatchObject({ type: "object" });
  });
});

describe("demo scripts run end to end on the sample archive", () => {
  async function play(prompt: string, approve = true) {
    const s = await seeded();
    const agent = createAgent({
      provider: new MockProvider({ scripts: archiveScripts }),
      registry: s.registry,
      storage: s.storage,
      now: s.ctx.now,
    });
    const events: AgentEvent[] = [];
    for await (const e of agent.run(prompt, { approve: () => approve })) events.push(e);
    const failed = events.filter(
      (e) => e.type === "tool_result" && !e.ok && e.error?.type !== "Rejected",
    );
    const messages = events
      .filter((e) => e.type === "message")
      .map((e) => (e.type === "message" ? e.text : ""));
    return { ...s, events, failed, final: messages.at(-1) ?? "" };
  }

  it("summarize: reads and summarizes the two oldest real chats", async () => {
    const r = await play(DEMO_PROMPTS.summarize);
    expect(r.failed).toEqual([]);
    const summarized = (await r.storage.list<Conversation>(CONVERSATIONS))
      .filter((c) => c.summary)
      .map((c) => c.title);
    expect(summarized.sort()).toEqual([
      "Regex for dates in a log file",
      "Sourdough starter keeps dying",
    ]);
    expect(r.final).toContain("Saved summaries");
  });

  it("summarize: when the user rejects, nothing is saved and the reply says so", async () => {
    const r = await play(DEMO_PROMPTS.summarize, false);
    expect((await r.storage.list<Conversation>(CONVERSATIONS)).some((c) => c.summary)).toBe(false);
    expect(r.final).toContain("You rejected 2 summaries");
  });

  it("tag: tags the sourdough chat", async () => {
    const r = await play(DEMO_PROMPTS.tag);
    expect(r.failed).toEqual([]);
    expect((await titleOf(r.storage, "Sourdough starter keeps dying")).tags).toEqual(["baking"]);
  });

  it("banish: hides exactly the two empty test chats", async () => {
    const r = await play(DEMO_PROMPTS.banish);
    expect(r.failed).toEqual([]);
    const hidden = (await r.storage.list<Conversation>(CONVERSATIONS))
      .filter((c) => c.banishedAt)
      .map((c) => c.title);
    expect(hidden.sort()).toEqual(["Untitled chat", "test test 123"]);
    expect(r.events.some((e) => e.type === "tool_result" && e.undoToken)).toBe(true);
  });

  it("resurrect: saves a resurrection prompt for the Lisbon chat", async () => {
    const r = await play(DEMO_PROMPTS.resurrect);
    expect(r.failed).toEqual([]);
    const [res] = await r.storage.list<{ id: string; title: string; prompt: string }>(
      RESURRECTIONS,
    );
    expect(res?.title).toBe("Lisbon trip planning");
    expect(res?.prompt).toContain("rainy-day plan");
  });

  it("regex: quotes the user's own questions from the chat", async () => {
    const r = await play(DEMO_PROMPTS.regex);
    expect(r.failed).toEqual([]);
    expect(r.final).toContain("It also matches 2020-13-45");
  });
});
