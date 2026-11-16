import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAgent, type ToolContext } from "@seance/core";
import { MockProvider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { archiveScripts, DEMO_PROMPTS } from "../src/demo/scripts";
import { normalizeConversation } from "../src/domain/normalize";
import { createArchiveSearch, importConversations } from "../src/domain/store";
import { CONVERSATIONS, type Conversation } from "../src/domain/types";
import { parseFile } from "../src/importers";
import { createArchiveRegistry } from "../src/tools";
import { normalizeTag } from "../src/tools/shared";

const fixture = (n: string) => readFileSync(resolve(import.meta.dirname, "fixtures", n), "utf8");
const file = (name: string, bytes: Uint8Array) =>
  new File([new Uint8Array(bytes).buffer as ArrayBuffer], name);

describe("review regressions: import", () => {
  it("ignores macOS junk and attachments in an export zip, and reports them", async () => {
    const zip = zipSync({
      "export/conversations.json": strToU8(fixture("chatgpt-small.json")),
      "__MACOSX/export/._conversations.json": new Uint8Array([0, 5, 22, 7]),
      "__MACOSX/._notes.md": new Uint8Array([0, 5, 22, 7]),
      "export/.DS_Store": new Uint8Array([1, 2]),
      "export/file-AbC123-requirements.txt": strToU8("pip install requests"),
    });
    const r = await parseFile(file("chatgpt.zip", zip));
    expect(r.conversations.map((c) => c.title).sort()).toEqual([
      "Starter questions",
      "Untitled chat",
    ]);
    expect(r.skipped).toContainEqual({
      where: "file-AbC123-requirements.txt",
      reason: "attachment next to conversations.json, not a chat",
    });
  });

  it("reports an empty Markdown file instead of importing an empty chat", async () => {
    const r = await parseFile(file("empty.md", strToU8("\n\n")));
    expect(r.conversations).toEqual([]);
    expect(r.skipped).toEqual([{ where: "empty.md", reason: "empty file" }]);
  });
});

describe("review regressions: tools", () => {
  it("keeps tags written in any script", () => {
    expect(normalizeTag("料理")).toBe("料理");
    expect(normalizeTag("요리")).toBe("요리".normalize("NFC"));
    expect(normalizeTag(" Café Notes ")).toBe("cafe-notes");
  });

  it("filters by source across every match, not just the top-ranked hundreds", async () => {
    const storage = new MemoryStorage();
    const search = createArchiveSearch(storage, 0);
    const base = {
      createdAt: "2024-01-01T00:00:00Z",
      messages: [{ role: "user", text: "lantern lantern lantern" }],
    };
    const many = Array.from({ length: 600 }, (_, i) =>
      normalizeConversation({
        source: "chatgpt",
        sourceId: `g${i}`,
        title: `Lantern ${i}`,
        ...base,
      }),
    );
    const rare = normalizeConversation({
      source: "claude",
      sourceId: "c1",
      title: "Notes",
      createdAt: "2024-01-01T00:00:00Z",
      messages: [
        {
          role: "user",
          text: "a long chat that mentions a lantern once among many other words here",
        },
      ],
    });
    await importConversations(storage, search, [...many, rare]);
    const ctx: ToolContext = {
      storage,
      signal: new AbortController().signal,
      now: () => new Date(),
    };
    const r = await createArchiveRegistry({ search }).run(
      "search_conversations",
      { query: "lantern", source: "claude" },
      ctx,
    );
    expect(r.ok && (r.value as { total: number; results: { id: string }[] })).toMatchObject({
      total: 1,
      results: [{ id: "claude:c1" }],
    });
    const all = await createArchiveRegistry({ search }).run(
      "search_conversations",
      { query: "lantern" },
      ctx,
    );
    expect(r.ok && all.ok && (all.value as { total: number }).total).toBe(601);
  });

  it("the demo banish prompt never targets untitled chats that have real content", async () => {
    const storage = new MemoryStorage();
    const search = createArchiveSearch(storage, 0);
    await importConversations(storage, search, [
      normalizeConversation({
        source: "claude",
        sourceId: "u1",
        title: "",
        createdAt: "2024-01-01T00:00:00Z",
        messages: [
          {
            role: "user",
            text: "How do I write a unit test for this reducer? Here is the code I have so far.",
          },
        ],
      }),
      normalizeConversation({
        source: "claude",
        sourceId: "u2",
        title: "",
        createdAt: "2024-02-01T00:00:00Z",
        messages: [{ role: "user", text: "test" }],
      }),
    ]);
    const agent = createAgent({
      provider: new MockProvider({ scripts: archiveScripts }),
      registry: createArchiveRegistry({ search }),
      storage,
    });
    for await (const _ of agent.run(DEMO_PROMPTS.banish, { approve: () => true })) void _;
    const hidden = (await storage.list<Conversation>(CONVERSATIONS))
      .filter((c) => c.banishedAt)
      .map((c) => c.id);
    expect(hidden).toEqual(["claude:u2"]);
  });
});

describe("review regressions: demo honesty in saved data", () => {
  it("marks summaries written by the scripted demo, and not those written by a real model", async () => {
    const sample = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../public/sample/chatgpt-conversations.json"),
        "utf8",
      ),
    );
    const { parseChatGPT } = await import("../src/importers");
    const storage = new MemoryStorage();
    const search = createArchiveSearch(storage, 0);
    await importConversations(storage, search, parseChatGPT(sample).conversations);
    const agent = createAgent({
      provider: new MockProvider({ scripts: archiveScripts }),
      registry: createArchiveRegistry({ search }),
      storage,
    });
    for await (const _ of agent.run(DEMO_PROMPTS.summarize, { approve: () => true })) void _;
    const summarized = (await storage.list<Conversation>(CONVERSATIONS)).filter((c) => c.summary);
    expect(summarized.length).toBe(2);
    expect(summarized.every((c) => c.summarizedBy === "demo")).toBe(true);

    const ctx: ToolContext = {
      storage,
      signal: new AbortController().signal,
      now: () => new Date(),
      actor: { providerId: "anthropic", isMock: false },
    };
    const id = summarized[0]!.id;
    await createArchiveRegistry({ search }).run(
      "summarize_conversation",
      { id, summary: "Real words." },
      ctx,
    );
    expect((await storage.get<Conversation>(CONVERSATIONS, id))?.summarizedBy).toBe("anthropic");
  });
});
