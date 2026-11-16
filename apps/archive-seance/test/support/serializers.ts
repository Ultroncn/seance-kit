// Test-only writers for the ChatGPT and Claude export formats, used by the P1 round-trip
// properties. They produce the same shapes the real exports use.
import type { NormalizedConversation } from "../../src/domain/types";

const seconds = (iso: string) => Date.parse(iso) / 1000;

export function toChatGPT(convs: NormalizedConversation[]): unknown[] {
  return convs.map((c) => {
    const mapping: Record<string, unknown> = {
      root: { id: "root", message: null, parent: null, children: c.messages.length ? ["n0"] : [] },
    };
    c.messages.forEach((m, i) => {
      mapping[`n${i}`] = {
        id: `n${i}`,
        parent: i === 0 ? "root" : `n${i - 1}`,
        children: i < c.messages.length - 1 ? [`n${i + 1}`] : [],
        message: {
          id: `n${i}`,
          author: { role: m.role },
          ...(m.at ? { create_time: seconds(m.at) } : {}),
          content: { content_type: "text", parts: [m.text] },
        },
      };
    });
    return {
      id: c.sourceId,
      title: c.title,
      create_time: seconds(c.createdAt),
      update_time: seconds(c.updatedAt),
      current_node: c.messages.length ? `n${c.messages.length - 1}` : "root",
      mapping,
    };
  });
}

export function toClaude(convs: NormalizedConversation[]): unknown[] {
  return convs.map((c) => ({
    uuid: c.sourceId,
    name: c.title,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    chat_messages: c.messages.map((m, i) => ({
      uuid: `m${i}`,
      sender: m.role === "user" ? "human" : "assistant",
      text: m.text,
      ...(m.at ? { created_at: m.at } : {}),
    })),
  }));
}
