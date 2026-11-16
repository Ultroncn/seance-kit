import { parseToolArguments, readEvents } from "./http";
import type { CompleteRequest, ProviderReply, ToolCall } from "./types";

type Block = { type: string; [key: string]: unknown };
interface Delta {
  type: string;
  text?: string;
  partial_json?: string;
  thinking?: string;
  signature?: string;
}
interface StreamEvent {
  index?: number;
  content_block?: Block;
  delta?: Delta;
  error?: { message?: string };
}

/** Apply one delta to the block it belongs to. Tool input JSON is collected as text. */
function applyDelta(block: Block, d: Delta, json: string[], at: number) {
  if (d.type === "text_delta") block.text = `${String(block.text ?? "")}${d.text ?? ""}`;
  else if (d.type === "thinking_delta")
    block.thinking = `${String(block.thinking ?? "")}${d.thinking ?? ""}`;
  else if (d.type === "signature_delta") block.signature = d.signature ?? "";
  else if (d.type === "input_json_delta") json[at] = `${json[at] ?? ""}${d.partial_json ?? ""}`;
}

/**
 * Assemble a streamed Messages response. Blocks are rebuilt from their start event and deltas,
 * so thinking blocks keep their signature and go back unchanged on the next request.
 */
export async function readAnthropicStream(
  res: Response,
  onDelta: CompleteRequest["onDelta"],
): Promise<ProviderReply> {
  const blocks: Block[] = [];
  const json: string[] = [];
  for await (const { event, data } of readEvents(res)) {
    let msg: StreamEvent;
    try {
      msg = JSON.parse(data) as StreamEvent;
    } catch {
      continue;
    }
    if (event === "error") throw new Error(`Anthropic stream failed: ${msg.error?.message ?? ""}`);
    const at = msg.index ?? 0;
    if (event === "content_block_start" && msg.content_block) blocks[at] = { ...msg.content_block };
    else if (event === "content_block_delta" && msg.delta && blocks[at]) {
      applyDelta(blocks[at], msg.delta, json, at);
      if (msg.delta.type === "text_delta" && msg.delta.text)
        onDelta?.({ kind: "text", text: msg.delta.text });
      if (msg.delta.type === "thinking_delta" && msg.delta.thinking)
        onDelta?.({ kind: "reasoning", text: msg.delta.thinking });
    }
  }
  return toAnthropicReply(blocks, json);
}

/** Text, tool calls and signed thinking from a list of content blocks. */
export function toAnthropicReply(blocks: Block[], json: string[] = []): ProviderReply {
  let text = "";
  const toolCalls: ToolCall[] = [];
  const thinking: Block[] = [];
  blocks.forEach((b, i) => {
    if (!b) return;
    if (b.type === "thinking" || b.type === "redacted_thinking") thinking.push(b);
    else if (b.type === "text") text += String(b.text ?? "");
    else if (b.type === "tool_use") {
      const input = json[i] !== undefined ? parseToolArguments(json[i]) : (b.input ?? {});
      toolCalls.push({ id: String(b.id ?? ""), name: String(b.name ?? ""), input });
    }
  });
  return {
    text,
    toolCalls,
    ...(thinking.length > 0
      ? { reasoning: { format: "anthropic_thinking" as const, blocks: thinking } }
      : {}),
  };
}
