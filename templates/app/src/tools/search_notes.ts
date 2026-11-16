import { defineTool, listActive } from "@seance/core";
import { z } from "zod";
import { NOTES, type Note, type NotebookDeps } from "./shared";

// A read tool: it never changes data, so it runs without asking.
export const searchNotes = ({ search }: NotebookDeps) =>
  defineTool({
    name: "search_notes",
    description: "Find notes by words in the title or body. An empty query lists the newest notes.",
    risk: "read",
    input: z.object({
      query: z.string().max(200).default(""),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    output: z.object({
      results: z.array(z.object({ id: z.string(), title: z.string(), createdAt: z.string() })),
    }),
    async run({ query, limit }, { storage }) {
      const notes =
        query.trim() === ""
          ? (await listActive<Note>(storage, NOTES)).sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt),
            )
          : (
              await Promise.all(
                (await search.search(query, { limit })).map((h) => storage.get<Note>(NOTES, h.id)),
              )
            ).filter((n): n is Note => n !== undefined);
      return {
        results: notes
          .slice(0, limit)
          .map((n) => ({ id: n.id, title: n.title, createdAt: n.createdAt })),
      };
    },
  });
