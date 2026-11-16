import { defineTool } from "@seance/core";
import { z } from "zod";
import { saveConversation } from "../domain/store";
import { requireConversation, type ArchiveDeps } from "./shared";

const input = z.object({
  id: z.string().min(1),
  summary: z
    .string()
    .trim()
    .min(1)
    .max(1500)
    .describe("Two or three plain sentences. Read the chat first."),
});

const output = z.object({ id: z.string(), title: z.string(), summary: z.string() });

export const summarizeConversation = ({ search }: ArchiveDeps) =>
  defineTool({
    name: "summarize_conversation",
    description:
      "Save a summary you wrote for a chat. It replaces any earlier summary and becomes searchable. Call read_conversation first.",
    risk: "write",
    input,
    output,
    async run({ id, summary }, { storage, now }) {
      const c = await requireConversation(storage, id);
      await saveConversation(storage, search, { ...c, summary, summarizedAt: now().toISOString() });
      return { id, title: c.title, summary };
    },
  });
