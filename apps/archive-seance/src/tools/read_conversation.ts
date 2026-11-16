import { defineTool, isBanished } from "@seance/core";
import { z } from "zod";
import { SOURCES } from "../domain/types";
import { requireConversation } from "./shared";

const input = z.object({
  id: z.string().min(1),
  maxChars: z
    .number()
    .int()
    .min(500)
    .max(20000)
    .default(6000)
    .describe("Stop after this many characters of messages."),
});

const output = z.object({
  id: z.string(),
  title: z.string(),
  source: z.enum(SOURCES),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  summary: z.string().optional(),
  banished: z.boolean(),
  messageCount: z.number().int(),
  truncated: z.boolean(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })),
});

export const readConversation = () =>
  defineTool({
    name: "read_conversation",
    description:
      "Read one chat's messages, oldest first. Long chats are cut at maxChars and marked truncated.",
    risk: "read",
    input,
    output,
    async run({ id, maxChars }, { storage }) {
      const c = await requireConversation(storage, id);
      const messages: { role: "user" | "assistant"; text: string }[] = [];
      let budget = maxChars;
      let truncated = false;
      for (const m of c.messages) {
        if (budget <= 0) {
          truncated = true;
          break;
        }
        const text = m.text.length > budget ? `${m.text.slice(0, budget)}…` : m.text;
        if (text !== m.text) truncated = true;
        messages.push({ role: m.role, text });
        budget -= m.text.length;
      }
      return {
        id: c.id,
        title: c.title,
        source: c.source,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        tags: c.tags,
        ...(c.summary ? { summary: c.summary } : {}),
        banished: isBanished(c),
        messageCount: c.messages.length,
        truncated,
        messages,
      };
    },
  });
