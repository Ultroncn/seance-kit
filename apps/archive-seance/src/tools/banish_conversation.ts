import { banishItems, defineTool } from "@seance/core";
import { z } from "zod";
import { getConversation } from "../domain/store";
import { CONVERSATIONS } from "../domain/types";

const input = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50).describe("Chats to hide."),
});

const output = z.object({
  undoToken: z.string(),
  banished: z.array(z.object({ id: z.string(), title: z.string() })),
  skipped: z.array(z.string()),
});

export const banishConversation = () =>
  defineTool({
    name: "banish_conversation",
    description:
      "Hide chats from the archive and search. Nothing is deleted: the user can undo it or restore chats from the Banished view.",
    risk: "destructive",
    input,
    output,
    async run({ ids }, { storage, now }) {
      const titles = new Map<string, string>();
      for (const id of ids) {
        const c = await getConversation(storage, id);
        if (c) titles.set(id, c.title);
      }
      const r = await banishItems(storage, CONVERSATIONS, ids, now());
      return {
        undoToken: r.undoToken,
        banished: r.banished.map((id) => ({ id, title: titles.get(id) ?? id })),
        skipped: r.skipped,
      };
    },
  });
