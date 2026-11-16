import { defineTool, listActive } from "@seance/core";
import { z } from "zod";
import { CONVERSATIONS, SOURCES, type Conversation } from "../domain/types";
import { snippetFor, type ArchiveDeps } from "./shared";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const input = z.object({
  query: z
    .string()
    .max(200)
    .default("")
    .describe("Words to find in titles, messages, summaries and tags. Empty lists everything."),
  source: z.enum(SOURCES).optional().describe("Only chats from this export."),
  from: day.optional().describe("Only chats started on or after this day (YYYY-MM-DD)."),
  to: day.optional().describe("Only chats started on or before this day (YYYY-MM-DD)."),
  sort: z
    .enum(["relevance", "oldest", "newest"])
    .default("relevance")
    .describe("relevance needs a query; otherwise newest is used."),
  limit: z.number().int().min(1).max(20).default(5),
});

const result = z.object({
  id: z.string(),
  title: z.string(),
  source: z.enum(SOURCES),
  createdAt: z.string(),
  tags: z.array(z.string()),
  hasSummary: z.boolean(),
  snippet: z.string(),
});

const output = z.object({ total: z.number().int(), results: z.array(result) });

export const searchConversations = ({ search }: ArchiveDeps) =>
  defineTool({
    name: "search_conversations",
    description:
      "Find chats in the user's archive. Returns ids, titles, dates and a snippet. Banished chats are never returned.",
    risk: "read",
    input,
    output,
    async run(i, { storage }) {
      const query = i.query.trim();
      let items: Conversation[];
      if (query !== "") {
        const hits = await search.search(query, { limit: 500 });
        const found = await Promise.all(
          hits.map((h) => storage.get<Conversation>(CONVERSATIONS, h.id)),
        );
        items = found.filter((c): c is Conversation => c !== undefined);
      } else {
        items = await listActive<Conversation>(storage, CONVERSATIONS);
      }
      const inRange = items.filter((c) => {
        const d = c.createdAt.slice(0, 10);
        return (
          (!i.source || c.source === i.source) && (!i.from || d >= i.from) && (!i.to || d <= i.to)
        );
      });
      const sort = query === "" && i.sort === "relevance" ? "newest" : i.sort;
      if (sort !== "relevance") {
        inRange.sort(
          (a, b) => (sort === "oldest" ? 1 : -1) * a.createdAt.localeCompare(b.createdAt),
        );
      }
      return {
        total: inRange.length,
        results: inRange.slice(0, i.limit).map((c) => ({
          id: c.id,
          title: c.title,
          source: c.source,
          createdAt: c.createdAt,
          tags: c.tags,
          hasSummary: Boolean(c.summary),
          snippet: snippetFor(c, query),
        })),
      };
    },
  });
