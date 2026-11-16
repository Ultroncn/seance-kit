import { defineTool } from "@seance/core";
import { z } from "zod";
import { saveConversation } from "../domain/store";
import { normalizeTag, requireConversation, type ArchiveDeps } from "./shared";

const tagList = z.array(z.string().max(40)).max(10).default([]);

const input = z
  .object({
    id: z.string().min(1),
    add: tagList.describe(
      "Tags to add. They are lower-cased and hyphenated, e.g. 'Baking Ideas' → 'baking-ideas'.",
    ),
    remove: tagList.describe("Tags to remove."),
  })
  .refine((v) => v.add.length + v.remove.length > 0, "Give at least one tag to add or remove");

const output = z.object({ id: z.string(), title: z.string(), tags: z.array(z.string()) });

export const tagConversation = ({ search }: ArchiveDeps) =>
  defineTool({
    name: "tag_conversation",
    description: "Add or remove tags on a chat. Returns the chat's tags afterwards.",
    risk: "write",
    input,
    output,
    async run({ id, add, remove }, { storage }) {
      const c = await requireConversation(storage, id);
      const drop = new Set(remove.map(normalizeTag));
      const tags = [...new Set([...c.tags, ...add.map(normalizeTag)])]
        .filter((t) => t !== "" && !drop.has(t))
        .sort();
      if (JSON.stringify(tags) !== JSON.stringify(c.tags)) {
        await saveConversation(storage, search, { ...c, tags });
      }
      return { id, title: c.title, tags };
    },
  });
