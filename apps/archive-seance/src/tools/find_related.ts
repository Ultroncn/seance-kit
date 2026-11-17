import { defineTool } from "@seance/core";
import { z } from "zod";
import { requireConversation } from "./shared";

const input = z.object({
  id: z.string().min(1).describe("The conversation ID to extract decisions from"),
});

const output = z.string();

export const findRelatedConversations = () =>
  defineTool({
    name: "find_related_conversations",
    description:
      "Decision Log Agent: extract architecture decisions, technology choices, and technical risks from a conversation.",
    risk: "read",
    input,
    output,
    async run({ id }, { storage }) {
      const conv = await requireConversation(storage, id);
      const fullText = conv.messages.map((m) => m.text).join("\n");

      const decisions: string[] = [];
      const risks: string[] = [];

      const decisionPatterns = [
        /(?:decided?|choose|chose|going with|use|using)\s+(.{10,80})/gi,
        /(?:architecture|approach|pattern|strategy):\s*(.{10,80})/gi,
        /(?:instead of|rather than|over)\s+(.{10,80})/gi,
      ];

      const riskPatterns = [
        /(?:risk|concern|problem|issue|challenge|warning|careful):\s*(.{10,100})/gi,
        /(?:might|could|may)\s+(?:cause|fail|break|slow)\s+(.{10,80})/gi,
      ];

      decisionPatterns.forEach((re) => {
        let m;
        while ((m = re.exec(fullText)) !== null) {
          const text = m[1]?.trim() ?? "";
          if (text && !decisions.some((d) => d.includes(text.substring(0, 20)))) {
            decisions.push(text.substring(0, 120));
          }
        }
      });

      riskPatterns.forEach((re) => {
        let m;
        while ((m = re.exec(fullText)) !== null) {
          const text = m[1]?.trim() ?? "";
          if (text && !risks.some((r) => r.includes(text.substring(0, 20)))) {
            risks.push(text.substring(0, 120));
          }
        }
      });

      const topDecisions = decisions.slice(0, 5);
      const topRisks = risks.slice(0, 3);

      if (topDecisions.length === 0 && topRisks.length === 0) {
        return `No explicit decisions or risks found in "${conv.title}". Try reading the conversation for manual review.`;
      }

      const parts: string[] = [`## Decision Log: "${conv.title}"\n`];

      if (topDecisions.length > 0) {
        parts.push(`**Decisions (${topDecisions.length}):**\n${topDecisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}`);
      }

      if (topRisks.length > 0) {
        parts.push(`\n**Risks (${topRisks.length}):**\n${topRisks.map((r, i) => `${i + 1}. [RISK] ${r}`).join("\n")}`);
      }

      return parts.join("\n");
    },
  });
