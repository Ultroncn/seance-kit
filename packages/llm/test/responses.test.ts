import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  OpenAiCompatibleProvider,
  OpenAiResponsesProvider,
  createProvider,
  listModels,
  reasoningOptions,
  toResponsesInput,
  type ChatMessage,
  type FetchLike,
} from "../src/index";
import { chunked } from "./sse";

const tools = [
  {
    name: "search_conversations",
    description: "Search",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
  },
];

/** A finished response: encrypted reasoning, a preamble message, then one function call. */
const output = [
  { id: "rs_1", type: "reasoning", summary: [], encrypted_content: "enc-1" },
  {
    id: "msg_1",
    type: "message",
    role: "assistant",
    status: "completed",
    phase: "commentary",
    content: [{ type: "output_text", text: "Searching.", annotations: [] }],
  },
  {
    id: "fc_1",
    type: "function_call",
    call_id: "call_1",
    name: "search_conversations",
    arguments: '{"query":"sourdough"}',
    status: "completed",
    created_by: "model",
  },
];

const expectedReply = {
  text: "Searching.",
  toolCalls: [{ id: "call_1", name: "search_conversations", input: { query: "sourdough" } }],
  reasoning: {
    format: "openai_responses",
    // `created_by` is output-only, so it is dropped before it can be replayed.
    items: [output[0], output[1], { ...output[2], created_by: undefined }].map((i) =>
      JSON.parse(JSON.stringify(i)),
    ),
  },
};

function recorder(respond: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return respond();
  };
  const body = (i = 0) => JSON.parse(String(calls[i]?.init.body)) as Record<string, unknown>;
  return { impl, calls, body };
}

const json = (v: unknown) =>
  new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });

const events = (list: object[]) => list.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

const streamed = events([
  { type: "response.created", response: { status: "in_progress", output: [] } },
  { type: "response.output_item.done", output_index: 0, item: output[0] },
  { type: "response.output_text.delta", output_index: 1, delta: "Search" },
  { type: "response.output_text.delta", output_index: 1, delta: "ing." },
  { type: "response.output_item.done", output_index: 1, item: output[1] },
  { type: "response.function_call_arguments.delta", output_index: 2, delta: '{"query":' },
  { type: "response.output_item.done", output_index: 2, item: output[2] },
  { type: "response.completed", response: { status: "completed", output } },
]);

describe("OpenAI Responses provider", () => {
  it("sends one stateless /v1/responses request with instructions, input items and flat tools", async () => {
    const r = recorder(() => json({ status: "completed", output }));
    const p = new OpenAiResponsesProvider({
      apiKey: "sk-test",
      model: "gpt-6-astra",
      reasoningEffort: "low",
      fetch: r.impl,
    });
    await p.complete({
      system: "Be brief.",
      tools,
      messages: [
        { role: "user", content: "find bread" },
        {
          role: "assistant",
          content: "Looking.",
          toolCalls: [{ id: "t1", name: "search_conversations", input: { query: "bread" } }],
        },
        { role: "tool", toolCallId: "t1", name: "search_conversations", content: '{"total":0}' },
      ],
    });
    expect(r.calls[0]?.url).toBe("https://api.openai.com/v1/responses");
    expect((r.calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer sk-test",
    );
    expect(r.body()).toEqual({
      model: "gpt-6-astra",
      store: false,
      instructions: "Be brief.",
      reasoning: { effort: "low" },
      input: [
        { type: "message", role: "user", content: "find bread" },
        { type: "message", role: "assistant", content: "Looking." },
        {
          type: "function_call",
          call_id: "t1",
          name: "search_conversations",
          arguments: '{"query":"bread"}',
        },
        { type: "function_call_output", call_id: "t1", output: '{"total":0}' },
      ],
      tools: [
        {
          type: "function",
          name: "search_conversations",
          description: "Search",
          parameters: tools[0]!.inputSchema,
          strict: false,
        },
      ],
    });
  });

  it("reads text, tool calls and replayable items from a JSON response", async () => {
    const p = new OpenAiResponsesProvider({
      apiKey: "k",
      model: "m",
      fetch: recorder(() => json({ status: "completed", output })).impl,
    });
    const reply = await p.complete({ messages: [{ role: "user", content: "hi" }], tools });
    expect(reply).toEqual(expectedReply);
  });

  it("replays a turn's own items in order, with the call ids the agent kept", () => {
    const turn: ChatMessage = {
      role: "assistant",
      content: expectedReply.text,
      // The agent renames an id it has already seen in this run.
      toolCalls: [{ id: "run-t1-c0", name: "search_conversations", input: { query: "sourdough" } }],
      reasoning: expectedReply.reasoning as Extract<
        ChatMessage,
        { role: "assistant" }
      >["reasoning"],
    };
    const input = toResponsesInput([
      { role: "user", content: "hi" },
      turn,
      { role: "tool", toolCallId: "run-t1-c0", name: "search_conversations", content: "{}" },
    ]);
    expect(input.map((i) => i.type)).toEqual([
      "message",
      "reasoning",
      "message",
      "function_call",
      "function_call_output",
    ]);
    expect(input[1]).toEqual(output[0]);
    expect(input[2]).toEqual(output[1]);
    expect(input[3]).toMatchObject({ id: "fc_1", call_id: "run-t1-c0" });
    expect(input[3]).not.toHaveProperty("created_by");
    expect(input[4]).toEqual({ type: "function_call_output", call_id: "run-t1-c0", output: "{}" });
  });

  it("P13 a streamed reply is the same however the stream is split, and deltas arrive in order", async () => {
    const seen: string[] = [];
    const first = await new OpenAiResponsesProvider({
      apiKey: "k",
      model: "m",
      fetch: async () => chunked(streamed),
    }).complete({
      messages: [{ role: "user", content: "hi" }],
      tools,
      onDelta: (d) => seen.push(`${d.kind}:${d.text}`),
    });
    expect(first).toEqual(expectedReply);
    expect(seen).toEqual(["text:Search", "text:ing."]);
    await fc.assert(
      fc.asyncProperty(fc.array(fc.nat()), async (cuts) => {
        const reply = await new OpenAiResponsesProvider({
          apiKey: "k",
          model: "m",
          fetch: async () => chunked(streamed, cuts),
        }).complete({ messages: [{ role: "user", content: "hi" }], tools, onDelta: () => {} });
        expect(reply).toEqual(first);
      }),
      { numRuns: 50 },
    );
  });

  it("fails loudly on an error event, a failed or incomplete response, or a cut-off stream", async () => {
    const run = (text: string) =>
      new OpenAiResponsesProvider({
        apiKey: "k",
        model: "m",
        fetch: async () => chunked(text),
      }).complete({ messages: [{ role: "user", content: "hi" }], tools, onDelta: () => {} });
    await expect(
      run(events([{ type: "error", code: "x", message: "Overloaded" }])),
    ).rejects.toThrow(/Overloaded/);
    await expect(
      run(
        events([
          {
            type: "response.failed",
            response: { status: "failed", error: { code: "server_error", message: "Boom" } },
          },
        ]),
      ),
    ).rejects.toThrow(/Boom/);
    await expect(
      run(
        events([
          {
            type: "response.incomplete",
            response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
          },
        ]),
      ),
    ).rejects.toThrow(/max_output_tokens/);
    await expect(
      run(events([{ type: "response.output_text.delta", delta: "Hal" }])),
    ).rejects.toThrow(/ended before/);
  });

  it("reports HTTP failures without echoing the key", async () => {
    const p = new OpenAiResponsesProvider({
      apiKey: "sk-secret-9",
      model: "m",
      fetch: async () =>
        new Response('{"error":{"code":"credit_balance_exhausted"}}', { status: 429 }),
    });
    const err = await p.complete({ messages: [], tools: [] }).catch((e: Error) => e);
    expect(String(err)).toMatch(/OpenAI request failed \(HTTP 429\).*credit_balance_exhausted/);
    expect(String(err)).not.toContain("sk-secret-9");
  });
});

describe("choosing the OpenAI API", () => {
  it("uses Responses for api.openai.com and Chat Completions for every other URL", async () => {
    const official = createProvider({
      kind: "openai-compatible",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "k",
      model: "gpt-6-astra",
      reasoning: { style: "openai", level: "high" },
    });
    expect(official).toBeInstanceOf(OpenAiResponsesProvider);
    expect(official.id).toBe("openai");
    const other = createProvider({
      kind: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "k",
      model: "m",
    });
    expect(other).toBeInstanceOf(OpenAiCompatibleProvider);

    const r = recorder(() => json({ status: "completed", output: [] }));
    await createProvider(
      {
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1/",
        apiKey: "k",
        model: "gpt-6-astra",
        reasoning: { style: "openai", level: "high" },
      },
      r.impl,
    ).complete({ messages: [{ role: "user", content: "hi" }], tools: [] });
    expect(r.calls[0]?.url).toBe("https://api.openai.com/v1/responses");
    expect(r.body().reasoning).toEqual({ effort: "high" });
    expect(r.body()).not.toHaveProperty("reasoning_effort");
  });

  it("needs a key for OpenAI itself", () => {
    expect(() =>
      createProvider({
        kind: "openai-compatible",
        baseUrl: "https://api.openai.com/v1",
        apiKey: " ",
        model: "m",
      }),
    ).toThrow(/apiKey/);
  });

  it("lists only OpenAI models that can chat, and leaves other vendors' lists alone", async () => {
    const ids = [
      "gpt-6-astra",
      "text-embedding-3-small",
      "whisper-1",
      "gpt-image-2",
      "o3",
      "tts-1",
    ];
    const fake: FetchLike = async () => json({ data: ids.map((id) => ({ id })) });
    const config = { kind: "openai-compatible" as const, apiKey: "k", model: "" };
    expect(
      (await listModels({ ...config, baseUrl: "https://api.openai.com/v1" }, fake)).map(
        (m) => m.id,
      ),
    ).toEqual(["gpt-6-astra", "o3"]);
    expect(
      await listModels({ ...config, baseUrl: "https://api.groq.com/openai/v1" }, fake),
    ).toHaveLength(ids.length);
  });

  it("offers reasoning levels on GPT-5 and later, but not on chat snapshots", () => {
    expect(reasoningOptions("openai", "gpt-6-astra")?.levels).toEqual(["low", "medium", "high"]);
    expect(reasoningOptions("openai", "gpt-6.1-sol")?.style).toBe("openai");
    expect(reasoningOptions("openai", "gpt-4.1")).toBeNull();
    expect(reasoningOptions("openai", "gpt-5.1-chat-latest")).toBeNull();
  });
});
