import { ensureOk, parseToolArguments, type FetchLike } from "./http";
import type { ChatMessage, CompleteRequest, Provider, ProviderReply, ToolCall } from "./types";

export interface OpenAiCompatibleOptions {
  /** Provider id shown in the UI. "openai-compatible" by default, "ollama" for Ollama. */
  id?: string;
  /** Base URL that serves `/chat/completions`, for example https://api.openai.com/v1. */
  baseUrl: string;
  /** Omit for local servers such as Ollama. */
  apiKey?: string;
  model: string;
  fetch?: FetchLike;
}

interface WireToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: WireToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAiMessages(messages: ChatMessage[], system?: string): WireMessage[] {
  const out: WireMessage[] = system ? [{ role: "system", content: system }] : [];
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    } else {
      out.push({
        role: "assistant",
        content: m.content === "" && m.toolCalls?.length ? null : m.content,
        ...(m.toolCalls?.length
          ? {
              tool_calls: m.toolCalls.map((c): WireToolCall => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
              })),
            }
          : {}),
      });
    }
  }
  return out;
}

/** Works with OpenAI and any server that speaks the same API, including Ollama's `/v1`. */
export class OpenAiCompatibleProvider implements Provider {
  readonly id: string;
  readonly isMock = false;
  private readonly doFetch: FetchLike;

  constructor(private readonly options: OpenAiCompatibleOptions) {
    this.id = options.id ?? "openai-compatible";
    this.doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async complete(request: CompleteRequest): Promise<ProviderReply> {
    const { baseUrl, apiKey, model } = this.options;
    const res = await this.doFetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: request.signal,
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(request.messages, request.system),
        ...(request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.inputSchema },
              })),
            }
          : {}),
      }),
    });
    await ensureOk(res, this.id === "ollama" ? "Ollama" : "Provider");
    const body = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: WireToolCall[] } }[];
    };
    const message = body.choices?.[0]?.message;
    const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((c, i) => ({
      id: c.id || `call-${i}`,
      name: c.function.name,
      input: parseToolArguments(c.function.arguments),
    }));
    return { text: message?.content ?? "", toolCalls };
  }
}

export interface OllamaOptions {
  model: string;
  /** Default http://localhost:11434. The page origin must be allowed via OLLAMA_ORIGINS. */
  host?: string;
  fetch?: FetchLike;
}

export function createOllamaProvider(options: OllamaOptions): OpenAiCompatibleProvider {
  const host = (options.host ?? "http://localhost:11434").replace(/\/+$/, "");
  return new OpenAiCompatibleProvider({
    id: "ollama",
    baseUrl: `${host}/v1`,
    model: options.model,
    fetch: options.fetch,
  });
}
