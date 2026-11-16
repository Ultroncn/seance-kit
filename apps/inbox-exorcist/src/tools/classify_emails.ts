import { defineTool } from "@seance/core";
import { z } from "zod";
import { getEmail, saveEmail } from "../domain/store";
import { CATEGORIES } from "../domain/types";
import type { InboxDeps } from "./shared";

const input = z.object({
  assignments: z
    .array(z.object({ id: z.string().min(1), category: z.enum(CATEGORIES) }))
    .min(1)
    .max(50)
    .describe("One category per email. The user approves the whole batch at once."),
});

const output = z.object({
  updated: z.array(z.object({ id: z.string(), subject: z.string(), category: z.enum(CATEGORIES) })),
  skipped: z.array(z.string()),
});

export const classifyEmails = ({ search }: InboxDeps) =>
  defineTool({
    name: "classify_emails",
    description:
      "Put emails into categories: needs-reply, personal, receipt, notification, newsletter or noise. Read or search them first.",
    risk: "write",
    input,
    output,
    async run({ assignments }, { storage, now }) {
      const updated: { id: string; subject: string; category: (typeof CATEGORIES)[number] }[] = [];
      const skipped: string[] = [];
      const at = now().toISOString();
      for (const { id, category } of assignments) {
        const e = await getEmail(storage, id);
        if (!e) {
          skipped.push(id);
          continue;
        }
        if (e.category !== category)
          await saveEmail(storage, search, { ...e, category, categorizedAt: at });
        updated.push({ id, subject: e.subject, category });
      }
      return { updated, skipped };
    },
  });
