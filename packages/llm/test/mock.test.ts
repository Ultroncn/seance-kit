import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MockProvider, type ChatMessage } from "../src/index";

const provider = new MockProvider({
  scripts: [
    {
      match: "summarize",
      steps: [
        { toolCalls: [{ name: "search", input: { q: "a" } }] },
        ({ toolResults }) => ({
          text: `got ${toolResults.length}`,
          toolCalls: [{ name: "read", input: { id: "1" } }],
        }),
      ],
      finalText: "All done.",
    },
  ],
});

const base = (req: ChatMessage[]) => provider.complete({ messages: req, tools: [] });

describe("MockProvider", () => {
  it("is always flagged as mock", () => {
    expect(provider.isMock).toBe(true);
    expect(provider.id).toBe("mock");
  });

  it("replays steps by turn, then the final text", async () => {
    const msgs: ChatMessage[] = [{ role: "user", content: "Please SUMMARIZE" }];
    const r1 = await base(msgs);
    expect(r1.toolCalls.map((c) => c.name)).toEqual(["search"]);

    msgs.push({ role: "assistant", content: r1.text, toolCalls: r1.toolCalls });
    msgs.push({ role: "tool", toolCallId: r1.toolCalls[0]!.id, name: "search", content: "[]" });
    const r2 = await base(msgs);
    expect(r2.text).toBe("got 1");
    expect(r2.toolCalls.map((c) => c.name)).toEqual(["read"]);

    msgs.push({ role: "assistant", content: r2.text, toolCalls: r2.toolCalls });
    const r3 = await base(msgs);
    expect(r3).toEqual({ text: "All done.", toolCalls: [] });
  });

  it("answers unknown prompts politely without tool calls", async () => {
    const r = await base([{ role: "user", content: "tell me a joke" }]);
    expect(r.toolCalls).toEqual([]);
    expect(r.text).toMatch(/Demo mode/);
  });

  it("is deterministic: the same messages always give the same reply", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (text) => {
        const msgs: ChatMessage[] = [{ role: "user", content: text }];
        expect(await base(msgs)).toEqual(await base(msgs));
      }),
    );
  });
  it("matches any phrasing in a list, and reads a dynamic fallback on every reply", async () => {
    let lang = "en";
    const p = new MockProvider({
      scripts: [{ match: ["Banish my tests", "隐藏测试对话"], steps: [{ text: "ok" }] }],
      unknownPromptText: () => (lang === "en" ? "unknown" : "不认识"),
    });
    const ask = (content: string) =>
      p.complete({ messages: [{ role: "user", content }], tools: [] });
    expect((await ask("请隐藏测试对话")).text).toBe("ok");
    expect((await ask("banish my tests now")).text).toBe("ok");
    expect((await ask("hello")).text).toBe("unknown");
    lang = "zh";
    expect((await ask("hello")).text).toBe("不认识");
    expect(p.suggestions).toEqual(["Banish my tests"]);
  });
});

it.each([/summarize/g, /summarize/y])(
  "replays stateful regex scripts deterministically: %s",
  async (match) => {
    match.lastIndex = 3;
    const p = new MockProvider({ scripts: [{ match, steps: [{ text: "matched" }] }] });
    const request = { messages: [{ role: "user" as const, content: "summarize" }], tools: [] };
    for (let i = 0; i < 3; i++) expect((await p.complete(request)).text).toBe("matched");
    expect(match.lastIndex).toBe(3);
  },
);
