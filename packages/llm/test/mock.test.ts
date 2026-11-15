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
});
