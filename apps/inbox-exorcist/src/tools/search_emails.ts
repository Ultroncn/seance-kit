import { defineTool, listActive } from "@seance/core";
import { z } from "zod";
import { CATEGORIES, EMAILS, type Email } from "../domain/types";
import { formatAddress, snippetFor, type InboxDeps } from "./shared";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const input = z.object({
  query: z
    .string()
    .max(200)
    .default("")
    .describe("Words to find in subject, body, sender, labels. Empty lists everything."),
  category: z
    .enum([...CATEGORIES, "uncategorized"])
    .optional()
    .describe("Only mail in this category."),
  label: z.string().max(40).optional().describe("Only mail with this label."),
  from: z.string().max(100).optional().describe("Part of the sender's name or address."),
  after: day.optional().describe("Only mail sent on or after this day."),
  before: day.optional().describe("Only mail sent on or before this day."),
  sort: z
    .enum(["relevance", "newest", "oldest"])
    .default("relevance")
    .describe("relevance needs a query; otherwise newest is used."),
  limit: z.number().int().min(1).max(50).default(10),
});

const output = z.object({
  total: z.number().int(),
  results: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      subject: z.string(),
      date: z.string(),
      category: z.enum(CATEGORIES).optional(),
      labels: z.array(z.string()),
      snippet: z.string(),
    }),
  ),
});

export const searchEmails = ({ search }: InboxDeps) =>
  defineTool({
    name: "search_emails",
    description:
      "Find emails in the user's imported inbox. Returns ids, senders, subjects, dates and a snippet. Banished mail is never returned.",
    risk: "read",
    input,
    output,
    async run(i, { storage }) {
      const query = i.query.trim();
      let items: Email[];
      if (query !== "") {
        const hits = await search.search(query, { limit: 1000 });
        const found = await Promise.all(hits.map((h) => storage.get<Email>(EMAILS, h.id)));
        items = found.filter((e): e is Email => e !== undefined);
      } else {
        items = await listActive<Email>(storage, EMAILS);
      }
      const from = i.from?.toLowerCase();
      const filtered = items.filter((e) => {
        const d = e.date.slice(0, 10);
        return (
          (!i.category ||
            (i.category === "uncategorized" ? !e.category : e.category === i.category)) &&
          (!i.label || e.labels.includes(i.label.toLowerCase())) &&
          (!from || `${e.from.name} ${e.from.address}`.toLowerCase().includes(from)) &&
          (!i.after || d >= i.after) &&
          (!i.before || d <= i.before)
        );
      });
      const sort = query === "" && i.sort === "relevance" ? "newest" : i.sort;
      if (sort !== "relevance")
        filtered.sort((a, b) => (sort === "oldest" ? 1 : -1) * a.date.localeCompare(b.date));
      return {
        total: filtered.length,
        results: filtered.slice(0, i.limit).map((e) => ({
          id: e.id,
          from: formatAddress(e.from),
          subject: e.subject,
          date: e.date,
          ...(e.category ? { category: e.category } : {}),
          labels: e.labels,
          snippet: snippetFor(e, query),
        })),
      };
    },
  });
