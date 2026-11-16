import { readAnthropicStream, toAnthropicReply } from "./anthropic-stream";
import { ensureOk, isEventStream, type FetchLike, type ToolMessage } from "./http";
import type { ChatMessage, CompleteRequest, Provider, ProviderReply } from "./types";

export interface AnthropicOptions {
  apiKey: string;
  /** Model id, for example one listed in your Anthropic console. Required: models change often. */
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  /** Vendor-specific request fields, such as `output_config.effort`. */
  extraBody?: Record<string, unknown>;
  fetch?: FetchLike;
}

type Block =
  | { type: "text"; text: string }
  /** thinking and redacted_thinking blocks, kept exactly as the API sent them. */
  | { type: "thinking" | "redacted_thinking"; [key: string]: unknown }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

interface WireMessage {
  role: "user" | "assistant";
  content: string | Block[];
}

/** Convert our chat history to Anthropic's format. Consecutive tool results share one user turn. */
export function toAnthropicMessages(messages: ChatMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  let pending: ToolMessage[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    out.push({
      role: "user",
      content: pending.map((m): Block => ({
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      })),
    });
    pending = [];
  };
  for (const m of messages) {
    if (m.role === "tool") {
      pending.push(m);
      continue;
    }
    flush();
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else {
      // Signed thinking blocks come first, unchanged, as the API requires.
      const blocks: Block[] =
        m.reasoning?.format === "anthropic_thinking" ? [...(m.reasoning.blocks as Block[])] : [];
      if (m.content !== "") blocks.push({ type: "text", text: m.content });
      for (const c of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      }
      // An empty assistant turn is rejected by the API anywhere but last, so it is dropped.
      if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
    }
  }
  flush();
  return mergeSameRole(out);
}

const asBlocks = (c: string | Block[]): Block[] =>
  typeof c === "string" ? [{ type: "text", text: c }] : c;

/** Turns must alternate. Join neighbours with the same role, e.g. tool results then a new prompt. */
function mergeSameRole(messages: WireMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  for (const m of messages) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role)
      prev.content = [...asBlocks(prev.content), ...asBlocks(m.content)];
    else out.push({ ...m });
  }
  return out;
}

export class AnthropicProvider implements Provider {
  readonly id = "anthropic";
  readonly isMock = false;
  private readonly doFetch: FetchLike;

  constructor(private readonly options: AnthropicOptions) {
    // Bind so the browser's fetch is not called with a foreign `this`.
    this.doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async complete(request: CompleteRequest): Promise<ProviderReply> {
    const { apiKey, model, maxTokens = 4096, baseUrl = "https://api.anthropic.com" } = this.options;
    const res = await this.doFetch(`${baseUrl.replace(/\/+$/, "")}/v1/messages`, {
      method: "POST",
      signal: request.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required for calls straight from a browser. The key stays on this device.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        ...this.options.extraBody,
        model,
        max_tokens: maxTokens,
        ...(request.onDelta ? { stream: true } : {}),
        ...(request.system ? { system: request.system } : {}),
        messages: toAnthropicMessages(request.messages),
        ...(request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
              })),
            }
          : {}),
      }),
    });
    await ensureOk(res, "Anthropic");
    if (isEventStream(res)) return readAnthropicStream(res, request.onDelta);
    const body = (await res.json()) as { content?: Block[] };
    const reply = toAnthropicReply(body.content ?? []);
    if (reply.reasoning?.format === "anthropic_thinking") {
      const said = reply.reasoning.blocks
        .map((b) => String((b as { thinking?: unknown }).thinking ?? ""))
        .join("");
      if (said) request.onDelta?.({ kind: "reasoning", text: said });
    }
    return reply;
  }
}
