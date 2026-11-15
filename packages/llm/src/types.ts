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

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string; isError?: boolean };

export interface CompleteRequest {
  messages: ChatMessage[];
  tools: ToolSpec[];
  system?: string;
  signal?: AbortSignal;
}

export interface ProviderReply {
  text: string;
  toolCalls: ToolCall[];
}

export interface Provider {
  /** Stable id such as "mock", "anthropic", "openai-compatible", "ollama". */
  readonly id: string;
  /** True only for the scripted Mock provider. The UI shows the "Demo mode" badge when it is. */
  readonly isMock: boolean;
  complete(request: CompleteRequest): Promise<ProviderReply>;
}
