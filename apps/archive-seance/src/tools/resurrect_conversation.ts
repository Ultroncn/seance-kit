import { defineTool } from "@seance/core";
import { z } from "zod";
import { RESURRECTIONS, type Conversation, type Resurrection } from "../domain/types";
import { clip, monthYear, requireConversation } from "./shared";

const input = z.object({
  id: z.string().min(1),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .describe("What the user wants to do next, in their words."),
});

const output = z.object({
  resurrectionId: z.string(),
  conversationId: z.string(),
  title: z.string(),
  prompt: z.string(),
});

/** A prompt the user can paste into any chat app to continue where the old chat stopped. */
export function resurrectionPrompt(c: Conversation, note?: string): string {
  const lastUser = [...c.messages].reverse().find((m) => m.role === "user");
  const lastAssistant = [...c.messages].reverse().find((m) => m.role === "assistant");
  const about = c.summary ?? clip(c.messages.find((m) => m.role === "user")?.text ?? c.title, 300);
  const lines = [
    `I'd like to continue an earlier conversation, "${c.title}", from ${monthYear(c.createdAt)}.`,
    "",
    `What it was about: ${about}`,
  ];
  if (lastUser || lastAssistant) {
    lines.push("", "Where we left off:");
    if (lastUser) lines.push(`Me: ${clip(lastUser.text, 600)}`);
    if (lastAssistant) lines.push(`You: ${clip(lastAssistant.text, 600)}`);
  }
  if (note) lines.push("", `What I want now: ${note}`);
  lines.push("", "Please pick up from there.");
  return lines.join("\n");
}

export const resurrectConversation = () =>
  defineTool({
    name: "resurrect_conversation",
    description:
      "Bring an old chat back: write a ready-to-paste prompt that restarts it in any chat app with its context. Saved with the chat.",
    risk: "write",
    input,
    output,
    async run({ id, note }, { storage, now }) {
      const c = await requireConversation(storage, id);
      const at = now();
      const r: Resurrection = {
        id: `${c.id}@${at.getTime()}`,
        conversationId: c.id,
        title: c.title,
        prompt: resurrectionPrompt(c, note),
        createdAt: at.toISOString(),
      };
      await storage.put(RESURRECTIONS, r);
      return { resurrectionId: r.id, conversationId: c.id, title: c.title, prompt: r.prompt };
    },
  });
