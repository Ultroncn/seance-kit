import { defineTool, isBanished } from "@seance/core";
import { z } from "zod";
import { CATEGORIES, DRAFTS, type Draft } from "../domain/types";
import { formatAddress, requireEmail } from "./shared";

const input = z.object({
  id: z.string().min(1),
  maxChars: z
    .number()
    .int()
    .min(300)
    .max(20000)
    .default(4000)
    .describe("Cut the body after this many characters."),
});

const output = z.object({
  id: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  subject: z.string(),
  date: z.string(),
  category: z.enum(CATEGORIES).optional(),
  labels: z.array(z.string()),
  attachments: z.number().int(),
  drafts: z.number().int(),
  banished: z.boolean(),
  truncated: z.boolean(),
  text: z.string(),
});

export const readEmail = () =>
  defineTool({
    name: "read_email",
    description:
      "Read one email: headers and plain-text body. Long bodies are cut at maxChars and marked truncated.",
    risk: "read",
    input,
    output,
    async run({ id, maxChars }, { storage }) {
      const e = await requireEmail(storage, id);
      const drafts = (await storage.list<Draft>(DRAFTS)).filter((d) => d.emailId === id).length;
      const truncated = e.text.length > maxChars;
      return {
        id: e.id,
        from: formatAddress(e.from),
        to: e.to.map(formatAddress),
        cc: e.cc.map(formatAddress),
        subject: e.subject,
        date: e.date,
        ...(e.category ? { category: e.category } : {}),
        labels: e.labels,
        attachments: e.attachments,
        drafts,
        banished: isBanished(e),
        truncated,
        text: truncated ? `${e.text.slice(0, maxChars)}…` : e.text,
      };
    },
  });
