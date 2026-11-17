import { ensureOk, isEventStream, type FetchLike } from "./http";
import {
  readResponsesStream,
  toResponsesReply,
  type ResponsesBody,
  type ResponsesItem,
} from "./openai-responses-stream";
import type { ChatMessage, CompleteRequest, Provider, ProviderReply } from "./types";

export const OPENAI_BASE_URL = "https://api.openai.com/v1";

export interface OpenAiResponsesOptions {
  apiKey: string;
  model: string;
  /** Default https://api.openai.com/v1. */
  baseUrl?: string;
  /** `reasoning.effort`. Omit to use the model's default. */
  reasoningEffort?: string;
  fetch?: FetchLike;
}

/** A Responses API input item. Shapes vary by `type`; the API validates them. */
export type ResponsesInputItem = Record<string, unknown>;

/** True when a base URL is OpenAI's own API, which gets the Responses API instead of Chat. */
export function isOpenAiPlatform(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === "api.openai.com";
  } catch {
    return false;
  }
}

/**
 * Convert our history to Responses input items. An assistant turn that came from this API is
 * replayed from its own items, so reasoning keeps its `encrypted_content` and stays paired with
 * the message or call after it. Call ids follow the history, which the agent may have renamed.
 */
export function toResponsesInput(messages: ChatMessage[]): ResponsesInputItem[] {
  const out: ResponsesInputItem[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ type: "message", role: "user", content: m.content });
    else if (m.role === "tool")
      out.push({ type: "function_call_output", call_id: m.toolCallId, output: m.content });
    else if (m.reasoning?.format === "openai_responses") {
      const ids = (m.toolCalls ?? []).map((c) => c.id);
      let call = 0;
      for (const raw of m.reasoning.items as ResponsesItem[]) {
        if (raw.type !== "function_call") out.push(raw);
        else out.push({ ...raw, call_id: ids[call++] ?? raw.call_id });
      }
    } else {
      if (m.content !== "") out.push({ type: "message", role: "assistant", content: m.content });
      for (const c of m.toolCalls ?? [])
        out.push({
          type: "function_call",
          call_id: c.id,
          name: c.name,
          arguments: JSON.stringify(c.input ?? {}),
        });
    }
  }
  return out;
}

/**
 * OpenAI's Responses API. Chat Completions refuses tool calls on newer models (GPT-6 Astra,
 * GPT-6.1 Sol) and with reasoning on GPT-5.4 and later, and the agent always sends tools.
 * Requests use `store: false`, so nothing is kept on OpenAI's side between turns.
 */
export class OpenAiResponsesProvider implements Provider {
  readonly id = "openai";
  readonly isMock = false;
  private readonly doFetch: FetchLike;

  constructor(private readonly options: OpenAiResponsesOptions) {
    this.doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async complete(request: CompleteRequest): Promise<ProviderReply> {
    const { apiKey, model, reasoningEffort, baseUrl = OPENAI_BASE_URL } = this.options;
    const res = await this.doFetch(`${baseUrl.replace(/\/+$/, "")}/responses`, {
      method: "POST",
      signal: request.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        store: false,
        ...(request.system ? { instructions: request.system } : {}),
        input: toResponsesInput(request.messages),
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
        ...(request.onDelta ? { stream: true } : {}),
        ...(request.tools.length > 0
          ? {
              tools: request.tools.map((t) => ({
                type: "function",
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
                // Responses tries strict mode by default, which turns optional fields into
                // required nullable ones. Our zod schemas validate the input instead.
                strict: false,
              })),
            }
          : {}),
      }),
    });
    await ensureOk(res, "OpenAI");
    if (isEventStream(res)) return readResponsesStream(res, request.onDelta);
    return toResponsesReply((await res.json()) as ResponsesBody);
  }
}
