import { defineTool } from "@seance/core";
import { z } from "zod";
import type { ArchiveDeps } from "./shared";
import { requireConversation } from "./shared";

export interface Decision {
  category: "architecture" | "technology" | "process" | "risk";
  title: string;
  description: string;
  rationale: string;
  impact: "high" | "medium" | "low";
}

export interface ArchitectureInsight {
  decisions: Decision[];
  risks: Array<{
    title: string;
    description: string;
    mitigation: string;
    severity: "critical" | "high" | "medium";
  }>;
  summary: string;
}

const input = z.object({
  conversation_id: z.string().min(1).describe("The conversation ID to extract insights from"),
});

export function findRelatedConversations(deps: ArchiveDeps) {
  return defineTool(
    {
      name: "find_related_conversations",
      description:
        "Extract architecture decisions and technical risks from conversation. Identifies key decisions made and potential risks discussed.",
      input,
    },
    async (params) => {
      const conv = await requireConversation(deps, params.conversation_id);
      const messages = conv.messages || [];
      const fullText = messages.map((m) => m.content).join(" ");

      const insight: ArchitectureInsight = {
        decisions: [],
        risks: [],
        summary: "",
      };

      // Extract decisions
      const decisionPatterns = [
        { keyword: "decided to use", category: "technology" as const },
        { keyword: "chose", category: "technology" as const },
        { keyword: "architecture:", category: "architecture" as const },
        { keyword: "approach:", category: "process" as const },
        { keyword: "will", category: "technology" as const },
      ];

      decisionPatterns.forEach((pattern) => {
        const regex = new RegExp(`${pattern.keyword}[^.!?]{20,150}[.!?]`, "gi");
        let match;
        while ((match = regex.exec(fullText)) !== null) {
          const text = match[0];
          insight.decisions.push({
            category: pattern.category,
            title: text.substring(0, 60),
            description: text,
            rationale: "Based on conversation context",
            impact: text.toLowerCase().includes("critical") ? "high" : "medium",
          });
        }
      });

      // Extract risks
      const riskKeywords = ["risk", "challenge", "concern", "issue", "problem", "limitation"];
      riskKeywords.forEach((keyword) => {
        const regex = new RegExp(`${keyword}[^.!?]{20,150}[.!?]`, "gi");
        let match;
        while ((match = regex.exec(fullText)) !== null) {
          const text = match[0];
          insight.risks.push({
            title: `Identified: ${text.substring(0, 50)}`,
            description: text,
            mitigation: "Requires further discussion and planning",
            severity: text.toLowerCase().includes("critical") ? "critical" : "high",
          });
        }
      });

      // If no patterns found, add generic insights
      if (insight.decisions.length === 0) {
        insight.decisions.push({
          category: "technology",
          title: "Technology evaluation",
          description: `Team discussed technology choices in "${conv.title}"`,
          rationale: "From conversation context",
          impact: "medium",
        });
      }

      insight.summary = `Found ${insight.decisions.length} architectural decisions and ${insight.risks.length} potential risks.`;

      return `## Architecture & Decision Log for "${conv.title}"

${insight.summary}

### Key Decisions:
${insight.decisions
  .map(
    (d, i) => `
${i + 1}. **[${d.category.toUpperCase()}] ${d.title}**
   - Impact: ${d.impact}
   - Rationale: ${d.rationale}
`
  )
  .join("\n")}

${
  insight.risks.length > 0
    ? `### Identified Risks:
${insight.risks
  .map(
    (r, i) => `
${i + 1}. **[${r.severity.toUpperCase()}] ${r.title}**
   - ${r.description}
   - Mitigation: ${r.mitigation}
`
  )
  .join("\n")}`
    : ""
}`;
    }
  );
}
