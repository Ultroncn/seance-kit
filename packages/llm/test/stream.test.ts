import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readEvents } from "../src/http";
import { AnthropicProvider, OpenAiCompatibleProvider } from "../src/index";
import { chunked } from "./sse";

const collect = async (res: Response) => {
  const out: { event: string; data: string }[] = [];
  for await (const e of readEvents(res)) out.push(e);
  return out;
};

describe("Server-Sent Events", () => {
  it("P13 events are the same however the stream is chunked", async () => {
    const event = fc.record({
      event: fc.constantFrom("", "message_start", "content_block_delta"),
      data: fc.string({ unit: "grapheme", minLength: 1 }).filter((d) => !/[\r\n]/.test(d)),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.array(event, { maxLength: 6 }),
        fc.array(fc.nat()),
        async (events, cuts) => {
          const text = events
            .map((e) => `${e.event ? `event: ${e.event}\n` : ""}data: ${e.data}\n\n`)
            .join("");
          expect(await collect(chunked(text, cuts))).toEqual(await collect(chunked(text)));
          expect(await collect(chunked(text, cuts))).toEqual(events);
        },
      ),
    );
  });

  it("joins multi-line data, skips comments, accepts CRLF and a last event without a blank line", async () => {
    const text = ": keep-alive\r\ndata: a\r\ndata: b\r\n\r\nevent: x\ndata: c";
    expect(await collect(chunked(text, [3, 17]))).toEqual([
      { event: "", data: "a\nb" },
      { event: "x", data: "c" },
    ]);
  });
});

const sse = (chunks: unknown[], named = false) =>
  chunks
    .map((c) =>
      named
        ? `event: ${(c as { type: string }).type}\ndata: ${JSON.stringify(c)}\n\n`
        : `data: ${JSON.stringify(c)}\n\n`,
    )
    .join("") + (named ? "" : "data: [DONE]\n\n");

describe("streamed replies", () => {
  it("OpenAI-compatible: text and reasoning arrive in order; tool calls are rebuilt from pieces", async () => {
    const d = (delta: unknown) => ({ choices: [{ delta }] });
    const body = sse([
      d({ reasoning_content: "Find " }),
      d({ reasoning_content: "them." }),
      d({ content: "Looking" }),
      d({ content: " now." }),
      d({ tool_calls: [{ index: 0, id: "c1", function: { name: "search", arguments: '{"q":' } }] }),
      d({ tool_calls: [{ index: 0, function: { arguments: '"x"}' } }] }),
    ]);
    const seen: string[] = [];
    let sent: Record<string, unknown> = {};
    const p = new OpenAiCompatibleProvider({
      baseUrl: "https://x.test",
      apiKey: "k",
      model: "m",
      fetch: async (_u, init) => {
        sent = JSON.parse(String(init.body)) as Record<string, unknown>;
        return chunked(body, [7, 50, 51, 120]);
      },
    });
    const reply = await p.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      onDelta: (x) => seen.push(`${x.kind}:${x.text}`),
    });
    expect(sent.stream).toBe(true);
    expect(seen).toEqual(["reasoning:Find ", "reasoning:them.", "text:Looking", "text: now."]);
    expect(reply).toEqual({
      text: "Looking now.",
      toolCalls: [{ id: "c1", name: "search", input: { q: "x" } }],
      reasoning: { format: "reasoning_content", text: "Find them." },
    });
  });

  it("Anthropic: thinking keeps its signature, tool input JSON is joined, text streams", async () => {
    const ev = (type: string, rest: object) => ({ type, ...rest });
    const body = sse(
      [
        ev("message_start", { message: {} }),
        ev("content_block_start", { index: 0, content_block: { type: "thinking", thinking: "" } }),
        ev("content_block_delta", {
          index: 0,
          delta: { type: "thinking_delta", thinking: "Plan." },
        }),
        ev("content_block_delta", {
          index: 0,
          delta: { type: "signature_delta", signature: "sig" },
        }),
        ev("content_block_start", { index: 1, content_block: { type: "text", text: "" } }),
        ev("content_block_delta", { index: 1, delta: { type: "text_delta", text: "On it." } }),
        ev("content_block_start", {
          index: 2,
          content_block: { type: "tool_use", id: "t1", name: "search", input: {} },
        }),
        ev("content_block_delta", {
          index: 2,
          delta: { type: "input_json_delta", partial_json: '{"q":"a' },
        }),
        ev("content_block_delta", {
          index: 2,
          delta: { type: "input_json_delta", partial_json: 'b"}' },
        }),
        ev("message_stop", {}),
      ],
      true,
    );
    const seen: string[] = [];
    const p = new AnthropicProvider({
      apiKey: "k",
      model: "m",
      fetch: async () => chunked(body, [99, 300]),
    });
    const reply = await p.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      onDelta: (x) => seen.push(`${x.kind}:${x.text}`),
    });
    expect(seen).toEqual(["reasoning:Plan.", "text:On it."]);
    expect(reply).toEqual({
      text: "On it.",
      toolCalls: [{ id: "t1", name: "search", input: { q: "ab" } }],
      reasoning: {
        format: "anthropic_thinking",
        blocks: [{ type: "thinking", thinking: "Plan.", signature: "sig" }],
      },
    });
  });

  it("an error event in the stream fails the call with its message", async () => {
    const body = sse(
      [{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }],
      true,
    );
    const p = new AnthropicProvider({ apiKey: "k", model: "m", fetch: async () => chunked(body) });
    await expect(
      p.complete({ messages: [{ role: "user", content: "hi" }], tools: [], onDelta: () => {} }),
    ).rejects.toThrow(/Overloaded/);
  });

  it("a server that ignores `stream` and answers with JSON still works, and shows its reasoning", async () => {
    const seen: string[] = [];
    const p = new OpenAiCompatibleProvider({
      baseUrl: "https://x.test",
      apiKey: "k",
      model: "m",
      fetch: async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "OK", reasoning_content: "hm" } }] }),
          { headers: { "content-type": "application/json" } },
        ),
    });
    const reply = await p.complete({
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      onDelta: (x) => seen.push(`${x.kind}:${x.text}`),
    });
    expect(reply.text).toBe("OK");
    expect(seen).toEqual(["reasoning:hm"]);
  });
});
