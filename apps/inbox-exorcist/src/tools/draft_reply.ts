import { defineTool } from "@seance/core";
import { z } from "zod";
import { DRAFTS, type Draft } from "../domain/types";
import { replyAddress, requireEmail } from "./shared";

const input = z.object({
  id: z.string().min(1).describe("The email to reply to."),
  body: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .describe("The reply text, ready for the user to edit and send themselves."),
});

const output = z.object({
  draftId: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  sent: z.literal(false),
});

export const replySubject = (subject: string) =>
  /^re:/i.test(subject) ? subject : `Re: ${subject}`;

export const draftReply = () =>
  defineTool({
    name: "draft_reply",
    description:
      "Save a reply draft for an email. It is never sent: the user copies it or opens it in their own mail app. Read the email first.",
    risk: "write",
    input,
    output,
    async run({ id, body }, { storage, now }) {
      const e = await requireEmail(storage, id);
      const at = now();
      const draft: Draft = {
        id: `draft:${id}:${at.getTime()}`,
        emailId: id,
        to: replyAddress(e),
        subject: replySubject(e.subject),
        body,
        createdAt: at.toISOString(),
      };
      await storage.put(DRAFTS, draft);
      return {
        draftId: draft.id,
        to: draft.to,
        subject: draft.subject,
        body,
        sent: false as const,
      };
    },
  });
