import { parseToolArguments, readEvents } from "./http";
import type { CompleteRequest, ProviderReply, ToolCall } from "./types";

/** One output item of a Responses API response. Only the fields read here are typed. */
export interface ResponsesItem {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type?: string; text?: string; refusal?: string }[];
  [key: string]: unknown;
}

/** The parts of a Response object this provider reads. */
export interface ResponsesBody {
  status?: string;
  output?: ResponsesItem[];
  error?: { code?: string | null; message?: string } | null;
  incomplete_details?: { reason?: string } | null;
}

/**
 * Text, tool calls and the items to replay from a finished response. A failed or incomplete
 * response throws: its tool arguments may be cut off, so it must not reach the agent loop.
 */
export function toResponsesReply(body: ResponsesBody): ProviderReply {
  if (body.status === "failed" || body.error)
    throw new Error(`OpenAI response failed: ${body.error?.message ?? body.error?.code ?? ""}`);
  if (body.status === "incomplete")
    throw new Error(`OpenAI response incomplete: ${body.incomplete_details?.reason ?? "unknown"}`);
  const items = (body.output ?? []).filter((i): i is ResponsesItem => !!i && !!i.type);
  let text = "";
  const toolCalls: ToolCall[] = [];
  for (const item of items) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text") text += part.text ?? "";
        else if (part.type === "refusal") text += part.refusal ?? "";
      }
    } else if (item.type === "function_call") {
      toolCalls.push({
        id: item.call_id ?? "",
        name: item.name ?? "",
        input: parseToolArguments(item.arguments ?? ""),
      });
    }
  }
  return {
    text,
    toolCalls,
    ...(items.length > 0
      ? { reasoning: { format: "openai_responses" as const, items: items.map(stripOutputOnly) } }
      : {}),
  };
}

/** `created_by` is output-only; the API rejects it on replay. Everything else goes back as is. */
function stripOutputOnly(item: ResponsesItem): ResponsesItem {
  const { created_by: _createdBy, ...rest } = item;
  return rest;
}

interface StreamEvent {
  type?: string;
  delta?: string;
  output_index?: number;
  item?: ResponsesItem;
  response?: ResponsesBody;
  code?: string | null;
  message?: string;
}

/**
 * Read a streamed response. Deltas go to the UI as they arrive; the reply is built from the
 * final `response.completed` object, so it matches what a non-streamed call would return.
 */
export async function readResponsesStream(
  res: Response,
  onDelta: CompleteRequest["onDelta"],
): Promise<ProviderReply> {
  const done: ResponsesItem[] = [];
  for await (const { data } of readEvents(res)) {
    let ev: StreamEvent;
    try {
      ev = JSON.parse(data) as StreamEvent;
    } catch {
      continue;
    }
    switch (ev.type) {
      case "response.output_text.delta":
      case "response.refusal.delta":
        if (ev.delta) onDelta?.({ kind: "text", text: ev.delta });
        break;
      case "response.reasoning_summary_text.delta":
      case "response.reasoning_text.delta":
        if (ev.delta) onDelta?.({ kind: "reasoning", text: ev.delta });
        break;
      case "response.output_item.done":
        if (ev.item) done[ev.output_index ?? done.length] = ev.item;
        break;
      case "response.completed": {
        const output = ev.response?.output;
        return toResponsesReply({
          ...ev.response,
          output: output && output.length > 0 ? output : done,
        });
      }
      case "response.failed":
      case "response.incomplete":
        return toResponsesReply(ev.response ?? { status: "failed" });
      case "error":
        throw new Error(`OpenAI stream failed: ${ev.message ?? ev.code ?? ""}`);
    }
  }
  throw new Error("OpenAI stream ended before the response completed");
}
