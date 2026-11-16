import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { zipSync, strToU8 } from "fflate";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { normalizeConversation, type RawConversation } from "../src/domain/normalize";
import { createArchiveSearch, importConversations } from "../src/domain/store";
import { CONVERSATIONS, type NormalizedConversation, type Source } from "../src/domain/types";
import {
  ImportError,
  parseChatGPT,
  parseClaude,
  parseFile,
  parseMarkdown,
  toMarkdown,
  type FileLike,
} from "../src/importers";
import { toChatGPT, toClaude } from "./support/serializers";

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8");

function fakeFile(
  name: string,
  content: string | Uint8Array,
  lastModified = Date.parse("2023-03-08T12:00:00Z"),
): FileLike {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return {
    name,
    lastModified,
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

describe("ChatGPT importer (fixture)", () => {
  const { conversations, skipped } = parseChatGPT(JSON.parse(fixture("chatgpt-small.json")));

  it("follows the branch the user last saw and drops hidden, empty and image parts", () => {
    const a = conversations.find((c) => c.sourceId === "conv-a")!;
    expect(a.title).toBe("Starter questions");
    expect(a.messages).toEqual([
      {
        role: "user",
        text: "Why does my starter smell like nail polish?",
        at: "2019-04-12T11:53:21.000Z",
      },
      {
        role: "assistant",
        text: "It is hungry. Feed it more often.",
        at: "2019-04-12T11:53:40.000Z",
      },
    ]);
    expect(a.createdAt).toBe("2019-04-12T11:53:20.500Z");
  });

  it("accepts conversation_id, fences code, names untitled chats, and reports what it skipped", () => {
    const c = conversations.find((x) => x.sourceId === "conv-c")!;
    expect(c.title).toBe("Untitled chat");
    expect(c.messages[1]?.text).toBe("```\nprint(1)\n```");
    expect(skipped).toEqual([
      { where: "#2", title: "No id here", reason: "missing conversation id" },
    ]);
  });

  it("falls back to the newest leaf when current_node is missing", () => {
    const data = JSON.parse(fixture("chatgpt-small.json"));
    delete data[0].current_node;
    const a = parseChatGPT(data).conversations.find((c) => c.sourceId === "conv-a")!;
    expect(a.messages.at(-1)?.text).toBe("It is hungry. Feed it more often.");
  });
});

describe("Claude importer (fixture)", () => {
  const { conversations, skipped } = parseClaude(JSON.parse(fixture("claude-small.json")));
  it("reads text, falls back to text content blocks, and skips empty chats", () => {
    expect(conversations.map((c) => c.title)).toEqual([
      "Plain text messages",
      "Content blocks only",
    ]);
    expect(conversations[0]?.createdAt).toBe("2024-01-09T10:00:00.000Z");
    expect(conversations[1]?.messages.map((m) => m.text)).toEqual([
      "SUMIF by month?",
      "Part one.\n\nPart two.",
    ]);
    expect(skipped).toEqual([{ where: "#3", title: "Empty", reason: "no messages" }]);
  });
});

describe("Markdown importer", () => {
  it("reads bold and plain speaker labels and the # title", () => {
    const c = parseMarkdown(fixture("notes.md"), {
      fileName: "notes.md",
      lastModified: Date.parse("2023-03-08T12:00:00Z"),
    });
    expect(c.title).toBe("Tomato notes");
    expect(c.messages).toEqual([
      { role: "user", text: "My tomatoes split on the vine.\n\nIs it the rain?" },
      {
        role: "assistant",
        text: "Usually it is uneven watering.\nWater deeply and on a schedule.",
      },
      { role: "user", text: "Thanks!" },
    ]);
    expect(c.createdAt).toBe("2023-03-08T12:00:00.000Z");
  });

  it("treats a note without speakers as one message titled after the file", () => {
    const c = parseMarkdown("Just a thought\nover two lines", { fileName: "idea.txt" });
    expect(c.title).toBe("idea");
    expect(c.messages).toEqual([{ role: "user", text: "Just a thought\nover two lines" }]);
  });

  it("gives the same file the same id, so re-imports deduplicate", () => {
    const a = parseMarkdown(fixture("notes.md"));
    const b = parseMarkdown(fixture("notes.md"));
    expect(a.sourceId).toBe(b.sourceId);
  });
});

describe("parseFile", () => {
  it("detects ChatGPT, Claude and Markdown files", async () => {
    expect(
      (await parseFile(fakeFile("conversations.json", fixture("chatgpt-small.json")))).format,
    ).toBe("chatgpt");
    expect(
      (await parseFile(fakeFile("conversations.json", fixture("claude-small.json")))).format,
    ).toBe("claude");
    expect((await parseFile(fakeFile("notes.md", fixture("notes.md")))).conversations).toHaveLength(
      1,
    );
  });

  it("reads conversations.json and Markdown straight from an export zip", async () => {
    const zip = zipSync({
      "export/conversations.json": strToU8(fixture("chatgpt-small.json")),
      "export/chat.html": strToU8("<html></html>"),
      "notes/tomatoes.md": strToU8(fixture("notes.md")),
    });
    const r = await parseFile(fakeFile("chatgpt-export.zip", zip));
    expect(r.format).toBe("zip");
    expect(r.conversations.map((c) => c.title).sort()).toEqual([
      "Starter questions",
      "Tomato notes",
      "Untitled chat",
    ]);
  });

  it("explains unusable files", async () => {
    await expect(parseFile(fakeFile("data.json", "[1,2]"))).rejects.toThrow(
      /not a ChatGPT or Claude export/,
    );
    await expect(parseFile(fakeFile("data.json", "{oops"))).rejects.toThrow(/not valid JSON/);
    await expect(parseFile(fakeFile("scan.pdf", "x"))).rejects.toThrow(ImportError);
    await expect(
      parseFile(fakeFile("empty.zip", zipSync({ "a.html": strToU8("x") }))),
    ).rejects.toThrow(/no conversations\.json/);
  });
});

// ---------- Properties ----------

/** Text that stresses parsers: CRLF, markdown markers, backslashes, unicode. */
const trickyLine = fc.oneof(
  fc.string({ maxLength: 30 }),
  fc.constantFrom(
    "## User",
    "## Assistant",
    "# Title",
    "User: hi",
    "**Assistant:** yo",
    "\\escaped",
    "\\\\double",
    "<!-- seance: {} -->",
    "",
    "  indented",
    "émoji 👻",
    "line\r\nbreak",
  ),
);
const messageText = fc.array(trickyLine, { minLength: 1, maxLength: 5 }).map((ls) => ls.join("\n"));
const isoDate = fc
  .date({
    min: new Date("2015-01-01T00:00:00Z"),
    max: new Date("2030-01-01T00:00:00Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

function rawConversation(source: Source, withAt: boolean) {
  return fc.record({
    source: fc.constant(source),
    sourceId: fc.string({ minLength: 1, maxLength: 12 }),
    title: fc.oneof(fc.string({ maxLength: 40 }), fc.constant("   ")),
    createdAt: isoDate,
    updatedAt: isoDate,
    messages: fc.array(
      fc.record({
        role: fc.constantFrom("user", "assistant", "system"),
        text: messageText,
        ...(withAt ? { at: fc.option(isoDate, { nil: undefined }) } : {}),
      }),
      { maxLength: 6 },
    ),
  }) as fc.Arbitrary<RawConversation>;
}

const normalized = (source: Source, withAt: boolean) =>
  rawConversation(source, withAt).map(normalizeConversation);

describe("importer properties", () => {
  it("P1 ChatGPT: parse(serialize(c)) equals c", () => {
    fc.assert(
      fc.property(fc.array(normalized("chatgpt", true), { maxLength: 4 }), (convs) => {
        const withMessages = convs.filter((c) => c.messages.length > 0);
        expect(parseChatGPT(toChatGPT(withMessages)).conversations).toEqual(withMessages);
      }),
      { numRuns: 200 },
    );
  });

  it("P1 Claude: parse(serialize(c)) equals c", () => {
    fc.assert(
      fc.property(fc.array(normalized("claude", true), { maxLength: 4 }), (convs) => {
        const withMessages = convs.filter((c) => c.messages.length > 0);
        expect(parseClaude(toClaude(withMessages)).conversations).toEqual(withMessages);
      }),
      { numRuns: 200 },
    );
  });

  it("P1 Markdown: parseMarkdown(toMarkdown(c)) equals c, even with marker-like lines in messages", () => {
    fc.assert(
      fc.property(normalized("markdown", false), (c) => {
        expect(parseMarkdown(toMarkdown(c))).toEqual(c);
      }),
      { numRuns: 300 },
    );
  });

  it("P2 normalize is idempotent", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          rawConversation("chatgpt", true),
          rawConversation("claude", true),
          rawConversation("markdown", false),
        ),
        (raw) => {
          const once = normalizeConversation(raw);
          expect(normalizeConversation(once)).toEqual(once);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("P3 importing the same conversations N times stores the same set as importing once", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(normalized("chatgpt", true), normalized("claude", true)), {
          maxLength: 6,
        }),
        fc.integer({ min: 2, max: 4 }),
        async (convs, times) => {
          const once = new MemoryStorage();
          await importConversations(once, createArchiveSearch(once, 0), convs);
          const many = new MemoryStorage();
          const search = createArchiveSearch(many, 0);
          let last;
          for (let i = 0; i < times; i++) last = await importConversations(many, search, convs);
          expect(await many.list(CONVERSATIONS)).toEqual(await once.list(CONVERSATIONS));
          expect(last?.added).toBe(0);
          expect(last?.updated).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("P3 a re-import keeps tags, summary and banished state, and updates changed content", async () => {
    const storage = new MemoryStorage();
    const search = createArchiveSearch(storage, 0);
    const base: NormalizedConversation = normalizeConversation({
      source: "claude",
      sourceId: "x",
      title: "Old",
      createdAt: "2024-01-01T00:00:00Z",
      messages: [{ role: "user", text: "hi" }],
    });
    await importConversations(storage, search, [base]);
    const stored = (await storage.get(CONVERSATIONS, "claude:x"))!;
    await storage.put(CONVERSATIONS, {
      ...stored,
      tags: ["keep"],
      summary: "S",
      banishedAt: "2025-01-01T00:00:00.000Z",
    });

    const newer = {
      ...base,
      title: "New",
      messages: [...base.messages, { role: "assistant" as const, text: "hello" }],
    };
    expect(await importConversations(storage, search, [newer])).toEqual({
      added: 0,
      updated: 1,
      unchanged: 0,
    });
    expect(await storage.get(CONVERSATIONS, "claude:x")).toMatchObject({
      title: "New",
      tags: ["keep"],
      summary: "S",
      banishedAt: "2025-01-01T00:00:00.000Z",
      rev: 2,
    });
    expect(await storage.list(CONVERSATIONS)).toHaveLength(1);
  });
});
