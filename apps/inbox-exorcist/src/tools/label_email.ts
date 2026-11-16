import { defineTool } from "@seance/core";
import { z } from "zod";
import { saveEmail } from "../domain/store";
import { normalizeLabel, requireEmail, type InboxDeps } from "./shared";

const labels = z.array(z.string().max(40)).max(10).default([]);

const input = z
  .object({
    id: z.string().min(1),
    add: labels.describe("Labels to add, e.g. 'travel'. They are lower-cased and hyphenated."),
    remove: labels.describe("Labels to remove."),
  })
  .refine((v) => v.add.length + v.remove.length > 0, "Give at least one label to add or remove");

const output = z.object({ id: z.string(), subject: z.string(), labels: z.array(z.string()) });

export const labelEmail = ({ search }: InboxDeps) =>
  defineTool({
    name: "label_email",
    description: "Add or remove labels on an email. Returns its labels afterwards.",
    risk: "write",
    input,
    output,
    async run({ id, add, remove }, { storage }) {
      const e = await requireEmail(storage, id);
      const drop = new Set(remove.map(normalizeLabel));
      const next = [...new Set([...e.labels, ...add.map(normalizeLabel)])]
        .filter((l) => l !== "" && !drop.has(l))
        .sort();
      if (JSON.stringify(next) !== JSON.stringify(e.labels))
        await saveEmail(storage, search, { ...e, labels: next });
      return { id, subject: e.subject, labels: next };
    },
  });
