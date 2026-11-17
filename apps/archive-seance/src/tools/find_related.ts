import { defineTool } from "@seance/core";
import { z } from "zod";
import type { ArchiveDeps } from "./shared";
import { requireConversation } from "./shared";

export interface RelatedConversation {
  id: string;
  title: string;
  relevance: number;
  reason: string;
}

const input = z.object({
  conversation_id: z.string().min(1).describe("The reference conversation ID"),
  limit: z.number().int().min(1).max(20).default(5).describe("Maximum number of related conversations"),
});

export function findRelatedConversations(deps: ArchiveDeps) {
  return defineTool(
    {
      name: "find_related_conversations",
      description:
        "Find conversations related to a given conversation by topic, code patterns, or decision themes. Useful for building knowledge connections across your chat history.",
      input,
    },
    async (params) => {
      const reference = await requireConversation(deps, params.conversation_id);
      const limit = params.limit || 5;

      // Extract keywords from reference conversation
      const text = (reference.messages || []).map((m) => m.content).join(" ").toLowerCase();
      const keywords = text
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 20);

      // Search for related conversations
      const related: RelatedConversation[] = [];
      const allConversations = await deps.storage.listConversations();

      for (const conv of allConversations) {
        if (conv.id === params.conversation_id) continue;

        const convText = (conv.messages || []).map((m) => m.content).join(" ").toLowerCase();
        let matchCount = 0;

        // Count keyword matches
        keywords.forEach((kw) => {
          if (convText.includes(kw)) matchCount++;
        });

        if (matchCount > 0) {
          const relevance = matchCount / keywords.length;
          related.push({
            id: conv.id,
            title: conv.title,
            relevance: Math.min(relevance, 1),
            reason: `Shared ${matchCount} keywords (${(relevance * 100).toFixed(0)}% match)`,
          });
        }
      }

      // Sort by relevance and limit
      related.sort((a, b) => b.relevance - a.relevance);
      const topRelated = related.slice(0, limit);

      if (topRelated.length === 0) {
        return `No related conversations found for "${reference.title}".`;
      }

      return `Found ${topRelated.length} related conversations:\n\n${topRelated
        .map((r) => `- "${r.title}" (${(r.relevance * 100).toFixed(0)}% match): ${r.reason}`)
        .join("\n")}`;
    }
  );
}
