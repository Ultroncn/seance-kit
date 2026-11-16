import { banishItems, defineTool } from "@seance/core";
import { z } from "zod";
import { getEmail } from "../domain/store";
import { EMAILS } from "../domain/types";
import { formatAddress } from "./shared";

const input = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200).describe("Emails to hide."),
});

const output = z.object({
  undoToken: z.string(),
  banished: z.array(z.object({ id: z.string(), from: z.string(), subject: z.string() })),
  skipped: z.array(z.string()),
});

export const banishEmails = () =>
  defineTool({
    name: "banish_emails",
    description:
      "Hide emails from the inbox and search, in bulk. Nothing is deleted and nothing is touched on the mail server: the user can undo it.",
    risk: "destructive",
    input,
    output,
    async run({ ids }, { storage, now }) {
      const info = new Map<string, { from: string; subject: string }>();
      for (const id of ids) {
        const e = await getEmail(storage, id);
        if (e) info.set(id, { from: formatAddress(e.from), subject: e.subject });
      }
      const r = await banishItems(storage, EMAILS, ids, now());
      return {
        undoToken: r.undoToken,
        banished: r.banished.map((id) => ({ id, ...(info.get(id) ?? { from: "", subject: id }) })),
        skipped: r.skipped,
      };
    },
  });
