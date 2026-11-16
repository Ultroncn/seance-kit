import { normalizeConversation } from "../domain/normalize";
import type { NormalizedConversation } from "../domain/types";
import { ImportError, isRecord, type ImportResult, type SkippedItem } from "./types";

/**
 * Claude export (`conversations.json`): an array of conversations with `uuid`, `name` and a flat
 * `chat_messages` list. Newer exports put text in `content` blocks as well as, or instead of, `text`.
 */

function messageText(m: Record<string, unknown>): string {
  if (typeof m.text === "string" && m.text.trim() !== "") return m.text;
  const blocks = Array.isArray(m.content) ? m.content : [];
  return blocks
    .filter(
      (b): b is Record<string, unknown> =>
        isRecord(b) && b.type === "text" && typeof b.text === "string",
    )
    .map((b) => b.text as string)
    .join("\n\n");
}

function parseOne(conv: unknown): NormalizedConversation | string {
  if (!isRecord(conv)) return "not an object";
  if (typeof conv.uuid !== "string" || conv.uuid === "") return "missing conversation uuid";
  const list = Array.isArray(conv.chat_messages) ? conv.chat_messages : [];
  const messages = list.filter(isRecord).map((m) => ({
    role: m.sender === "human" ? "user" : m.sender === "assistant" ? "assistant" : m.sender,
    text: messageText(m),
    at: m.created_at,
  }));
  const normalized = normalizeConversation({
    source: "claude",
    sourceId: conv.uuid,
    title: conv.name,
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    messages,
  });
  return normalized.messages.length === 0 ? "no messages" : normalized;
}

export function looksLikeClaude(data: unknown): boolean {
  return Array.isArray(data) && data.some((c) => isRecord(c) && Array.isArray(c.chat_messages));
}

export function parseClaude(data: unknown): ImportResult {
  if (!Array.isArray(data))
    throw new ImportError("This is not a Claude export: expected a list of conversations.");
  const conversations: NormalizedConversation[] = [];
  const skipped: SkippedItem[] = [];
  data.forEach((conv, i) => {
    const out = parseOne(conv);
    if (typeof out === "string") {
      const title = isRecord(conv) && typeof conv.name === "string" ? conv.name : undefined;
      skipped.push({ where: `#${i + 1}`, ...(title ? { title } : {}), reason: out });
    } else {
      conversations.push(out);
    }
  });
  return { conversations, skipped };
}
