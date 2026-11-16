import { describe, expect, it } from "vitest";
import {
  AnthropicProvider,
  createOllamaProvider,
  createProvider,
  OpenAiCompatibleProvider,
  toAnthropicMessages,
  toOpenAiMessages,
  type ChatMessage,
  type FetchLike,
} from "../src/index";

const tools = [
  {
    name: "search",
    description: "Search",
    inputSchema: { type: "object", properties: { q: { type: "string" } } },
  },
];

const history: ChatMessage[] = [
  { role: "user", content: "find cats" },
  {
    role: "assistant",
    content: "",
    toolCalls: [
      { id: "t1", name: "search", input: { q: "cats" } },
      { id: "t2", name: "search", input: { q: "dogs" } },
    ],
  },
  { role: "tool", toolCallId: "t1", name: "search", content: '{"hits":1}' },
  { role: "tool", toolCallId: "t2", name: "search", content: '{"error":{}}', isError: true },
];

function fakeFetch(responseBody: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(responseBody), { status });
  };
  return { impl, calls };
}

const sentBody = (c: { init: RequestInit }) =>
  JSON.parse(String(c.init.body)) as Record<string, unknown>;

describe("Anthropic provider", () => {
  it("merges consecutive tool results into one user turn", () => {
    const wire = toAnthropicMessages(history);
    expect(wire).toHaveLength(3);
    expect(wire[1]?.content).toEqual([
      { type: "tool_use", id: "t1", name: "search", input: { q: "cats" } },
      { type: "tool_use", id: "t2", name: "search", input: { q: "dogs" } },
    ]);
    expect(wire[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: '{"hits":1}' },
        { type: "tool_result", tool_use_id: "t2", content: '{"error":{}}', is_error: true },
      ],
    });
  });

  it("never sends empty content, and keeps user and assistant turns alternating", () => {
    const wire = toAnthropicMessages([
      { role: "user", content: "first" },
      { role: "assistant", content: "" },
      { role: "user", content: "second" },
      { role: "assistant", content: "", toolCalls: [{ id: "t9", name: "search", input: {} }] },
      { role: "tool", toolCallId: "t9", name: "search", content: "{}" },
      { role: "assistant", content: "" },
      { role: "user", content: "third" },
    ]);
    for (const m of wire) {
      expect(m.content === "" || (Array.isArray(m.content) && m.content.length === 0)).toBe(false);
    }
    for (let i = 1; i < wire.length; i++) expect(wire[i]!.role).not.toBe(wire[i - 1]!.role);
    expect(wire[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    });
    expect(wire[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t9", content: "{}" },
        { type: "text", text: "third" },
      ],
    });
  });

  it("sends the key and browser header, and parses text and tool_use blocks", async () => {
    const { impl, calls } = fakeFetch({
      content: [
        { type: "text", text: "Checking" },
        { type: "tool_use", id: "x1", name: "search", input: { q: "a" } },
      ],
    });
    const p = new AnthropicProvider({ apiKey: "sk-secret", model: "m1", fetch: impl });
    const reply = await p.complete({ messages: history, tools, system: "be brief" });

    expect(reply).toEqual({
      text: "Checking",
      toolCalls: [{ id: "x1", name: "search", input: { q: "a" } }],
    });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers["x-api-key"]).toBe("sk-secret");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    const body = sentBody(calls[0]!);
    expect(body).toMatchObject({ model: "m1", system: "be brief" });
    expect(body["tools"]).toEqual([
      { name: "search", description: "Search", input_schema: tools[0]!.inputSchema },
    ]);
  });

  it("reports HTTP errors without leaking the key", async () => {
    const { impl } = fakeFetch({ error: { message: "invalid x-api-key" } }, 401);
    const p = new AnthropicProvider({ apiKey: "sk-secret", model: "m1", fetch: impl });
    const err = await p.complete({ messages: history, tools }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/HTTP 401/);
    expect((err as Error).message).not.toContain("sk-secret");
  });
});

describe("OpenAI-compatible provider", () => {
  it("maps history to chat messages with tool_calls", () => {
    const wire = toOpenAiMessages(history, "sys");
    expect(wire[0]).toEqual({ role: "system", content: "sys" });
    expect(wire[2]).toMatchObject({
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "t1", type: "function", function: { name: "search", arguments: '{"q":"cats"}' } },
        { id: "t2", type: "function", function: { name: "search", arguments: '{"q":"dogs"}' } },
      ],
    });
    expect(wire[3]).toEqual({ role: "tool", tool_call_id: "t1", content: '{"hits":1}' });
  });

  it("parses tool calls, and keeps unparseable arguments for validation to reject", async () => {
    const { impl, calls } = fakeFetch({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { id: "a", type: "function", function: { name: "search", arguments: '{"q":"x"}' } },
              { id: "b", type: "function", function: { name: "search", arguments: "{oops" } },
            ],
          },
        },
      ],
    });
    const p = new OpenAiCompatibleProvider({
      baseUrl: "https://api.example.com/v1/",
      apiKey: "sk-secret",
      model: "m",
      fetch: impl,
    });
    const reply = await p.complete({ messages: history, tools });
    expect(reply.toolCalls).toEqual([
      { id: "a", name: "search", input: { q: "x" } },
      { id: "b", name: "search", input: "{oops" },
    ]);
    expect(calls[0]!.url).toBe("https://api.example.com/v1/chat/completions");
    expect((calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe(
      "Bearer sk-secret",
    );
    expect(sentBody(calls[0]!)["tools"]).toEqual([
      {
        type: "function",
        function: { name: "search", description: "Search", parameters: tools[0]!.inputSchema },
      },
    ]);
  });

  it("Ollama uses the local /v1 endpoint with no key", async () => {
    const { impl, calls } = fakeFetch({ choices: [{ message: { content: "hi" } }] });
    const p = createOllamaProvider({ model: "llama", fetch: impl });
    expect(p.id).toBe("ollama");
    expect(await p.complete({ messages: [{ role: "user", content: "yo" }], tools: [] })).toEqual({
      text: "hi",
      toolCalls: [],
    });
    expect(calls[0]!.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(calls[0]!.init.headers as Record<string, string>).not.toHaveProperty("authorization");
    expect(sentBody(calls[0]!)).not.toHaveProperty("tools");
  });
});

describe("createProvider", () => {
  it("builds real providers that are not mock", () => {
    expect(createProvider({ kind: "anthropic", apiKey: "k", model: "m" }).isMock).toBe(false);
    expect(createProvider({ kind: "ollama", model: "m" }).id).toBe("ollama");
  });

  it("rejects incomplete settings with a readable error", () => {
    expect(() => createProvider({ kind: "anthropic", apiKey: " ", model: "m" })).toThrow(
      "Missing setting: apiKey",
    );
    expect(() =>
      createProvider({ kind: "openai-compatible", baseUrl: "", apiKey: "k", model: "m" }),
    ).toThrow("Missing setting: baseUrl");
  });
});
