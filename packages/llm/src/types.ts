/** A tool as a model sees it: a name, a description and a JSON Schema for the input. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  /** Unique within a conversation. Tool results refer back to it. */
  id: string;
  name: string;
  /** Raw model output. Not validated yet. */
  input: unknown;
}

/**
 * A model's reasoning that its API wants back, unchanged, on later requests: DeepSeek and Qwen
 * return `reasoning_content` and reject tool follow-ups without it; Claude signs `thinking` blocks.
 * Tagged by format so a provider only ever sends back its own kind.
 */
export type Reasoning =
  | { format: "reasoning_content"; text: string }
  | { format: "anthropic_thinking"; blocks: unknown[] }
  /**
   * The OpenAI Responses API's output items for the turn (reasoning with `encrypted_content`,
   * message, function_call), replayed in order because requests use `store: false`.
   */
  | { format: "openai_responses"; items: unknown[] };

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[]; reasoning?: Reasoning }
  | { role: "tool"; toolCallId: string; name: string; content: string; isError?: boolean };

/** A piece of a reply as it arrives. */
export interface StreamDelta {
  kind: "text" | "reasoning";
  text: string;
}

export interface CompleteRequest {
  messages: ChatMessage[];
  tools: ToolSpec[];
  system?: string;
  signal?: AbortSignal;
  /**
   * Called with each piece of text and reasoning as it arrives. A provider that cannot stream
   * still reports its reasoning here once, so the UI can show it. The resolved reply is complete
   * either way and is what goes into the history.
   */
  onDelta?: (delta: StreamDelta) => void;
}

export interface ProviderReply {
  text: string;
  toolCalls: ToolCall[];
  /** Pass back unchanged with this turn. See `Reasoning`. */
  reasoning?: Reasoning;
}

export interface Provider {
  /** Stable id such as "mock", "anthropic", "openai-compatible", "ollama". */
  readonly id: string;
  /** True only for the scripted Mock provider. The UI shows the "Demo mode" badge when it is. */
  readonly isMock: boolean;
  complete(request: CompleteRequest): Promise<ProviderReply>;
}
