import { banishItems, defineTool } from "@seance/core";
import { z } from "zod";
import { NOTES } from "./shared";

// A destructive tool. It soft-deletes and returns an undo token, so the timeline offers Undo.
export const banishNotes = () =>
  defineTool({
    name: "banish_notes",
    description: "Hide notes. Nothing is deleted, and the user can undo it.",
    risk: "destructive",
    input: z.object({ ids: z.array(z.string().min(1)).min(1).max(50) }),
    output: z.object({ undoToken: z.string(), banished: z.array(z.string()) }),
    async run({ ids }, { storage, now }) {
      const r = await banishItems(storage, NOTES, ids, now());
      return { undoToken: r.undoToken, banished: r.banished };
    },
  });
