import { normalizeConversation } from "../domain/normalize";
import type { NormalizedConversation } from "../domain/types";
import { ImportError, isRecord, type ImportResult, type SkippedItem } from "./types";

/**
 * ChatGPT export (`conversations.json`): an array of conversations, each holding a `mapping` of
 * message nodes linked by `parent`/`children`. Regenerated replies create branches. We follow the
 * branch the user last saw: from `current_node` up to the root.
 */

interface Node {
  parent?: unknown;
  children?: unknown;
  message?: unknown;
}

function messageText(message: Record<string, unknown>): string | null {
  const content = message.content;
  if (!isRecord(content)) return null;
  const type = content.content_type;
  if (type === "text" || type === "multimodal_text") {
    const parts = Array.isArray(content.parts) ? content.parts : [];
    // Images and files arrive as objects. Only text parts are kept.
    return parts.filter((p): p is string => typeof p === "string").join("\n");
  }
  if (type === "code" && typeof content.text === "string") return "```\n" + content.text + "\n```";
  return null;
}

/** Leaf with the latest message time. Used when `current_node` is missing or broken. */
function latestLeaf(mapping: Record<string, Node>): string | undefined {
  let best: string | undefined;
  let bestTime = -Infinity;
  for (const [id, node] of Object.entries(mapping)) {
    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) continue;
    const m = isRecord(node.message) ? node.message : {};
    const t = typeof m.create_time === "number" ? m.create_time : 0;
    if (t >= bestTime) {
      bestTime = t;
      best = id;
    }
  }
  return best;
}

function walk(mapping: Record<string, Node>, start: string): Record<string, unknown>[] {
  const chain: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let id: unknown = start;
  while (typeof id === "string" && mapping[id] && !seen.has(id)) {
    seen.add(id);
    const node: Node = mapping[id];
    if (isRecord(node.message)) chain.push(node.message);
    id = node.parent;
  }
  return chain.reverse();
}

function parseOne(conv: unknown): NormalizedConversation | string {
  if (!isRecord(conv)) return "not an object";
  const id = conv.id ?? conv.conversation_id;
  if (typeof id !== "string" || id === "") return "missing conversation id";
  if (!isRecord(conv.mapping)) return "missing message mapping";
  const mapping = conv.mapping as Record<string, Node>;
  const current =
    typeof conv.current_node === "string" && mapping[conv.current_node]
      ? conv.current_node
      : latestLeaf(mapping);
  if (!current) return "no messages";

  const messages = walk(mapping, current).flatMap((m) => {
    const author = isRecord(m.author) ? m.author.role : undefined;
    if (author !== "user" && author !== "assistant") return [];
    const meta = isRecord(m.metadata) ? m.metadata : {};
    if (meta.is_visually_hidden_from_conversation === true) return [];
    const text = messageText(m);
    return text === null ? [] : [{ role: author, text, at: m.create_time }];
  });

  const normalized = normalizeConversation({
    source: "chatgpt",
    sourceId: id,
    title: conv.title,
    createdAt: conv.create_time,
    updatedAt: conv.update_time,
    messages,
  });
  return normalized.messages.length === 0 ? "no visible messages" : normalized;
}

export function looksLikeChatGPT(data: unknown): boolean {
  return Array.isArray(data) && data.some((c) => isRecord(c) && isRecord(c.mapping));
}

export function parseChatGPT(data: unknown): ImportResult {
  if (!Array.isArray(data))
    throw new ImportError("This is not a ChatGPT export: expected a list of conversations.");
  const conversations: NormalizedConversation[] = [];
  const skipped: SkippedItem[] = [];
  data.forEach((conv, i) => {
    const out = parseOne(conv);
    if (typeof out === "string") {
      const title = isRecord(conv) && typeof conv.title === "string" ? conv.title : undefined;
      skipped.push({ where: `#${i + 1}`, ...(title ? { title } : {}), reason: out });
    } else {
      conversations.push(out);
    }
  });
  return { conversations, skipped };
}
