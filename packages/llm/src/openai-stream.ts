import { parseToolArguments, readEvents } from "./http";
import type { CompleteRequest, ProviderReply, ToolCall } from "./types";

/** An assistant message as OpenAI-compatible servers send it, whole or assembled from a stream. */
export interface WireReply {
  content?: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
  reasoning_content?: string | null;
}

export function toReply(message: WireReply): ProviderReply {
  const toolCalls: ToolCall[] = (message.tool_calls ?? []).map((c, i) => ({
    id: c.id || `call-${i}`,
    name: c.function.name,
    input: parseToolArguments(c.function.arguments),
  }));
  const reasoning = message.reasoning_content;
  return {
    text: message.content ?? "",
    toolCalls,
    ...(typeof reasoning === "string" && reasoning !== ""
      ? { reasoning: { format: "reasoning_content" as const, text: reasoning } }
      : {}),
  };
}

interface WireDelta {
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
}

/** Assemble a streamed chat completion. Tool calls arrive in pieces keyed by `index`. */
export async function readOpenAiStream(
  res: Response,
  onDelta: CompleteRequest["onDelta"],
): Promise<ProviderReply> {
  let content = "";
  let reasoning = "";
  const calls: { id: string; name: string; arguments: string }[] = [];
  for await (const { data } of readEvents(res)) {
    if (data === "[DONE]") break;
    let chunk: { choices?: { delta?: WireDelta }[] };
    try {
      chunk = JSON.parse(data) as typeof chunk;
    } catch {
      continue; // A keep-alive or vendor comment, not part of the reply.
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.reasoning_content) {
      reasoning += delta.reasoning_content;
      onDelta?.({ kind: "reasoning", text: delta.reasoning_content });
    }
    if (delta.content) {
      content += delta.content;
      onDelta?.({ kind: "text", text: delta.content });
    }
    for (const [n, c] of (delta.tool_calls ?? []).entries()) {
      const call = (calls[c.index ?? n] ??= { id: "", name: "", arguments: "" });
      if (c.id) call.id = c.id;
      if (c.function?.name) call.name += c.function.name;
      if (c.function?.arguments) call.arguments += c.function.arguments;
    }
  }
  return toReply({
    content,
    reasoning_content: reasoning,
    tool_calls: calls
      .filter((c) => c !== undefined && c.name !== "")
      .map((c) => ({ id: c.id, function: { name: c.name, arguments: c.arguments } })),
  });
}
