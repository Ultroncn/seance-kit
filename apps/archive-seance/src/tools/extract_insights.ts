import { defineTool } from "@seance/core";
import { z } from "zod";
import type { ArchiveDeps } from "./shared";
import { requireConversation } from "./shared";

export interface Insight {
  type: "code_snippet" | "decision" | "learning" | "question" | "todo";
  content: string;
  source: string;
  confidence: number;
}

const input = z.object({
  conversation_id: z.string().min(1).describe("The conversation ID to extract insights from"),
  types: z
    .array(z.enum(["code_snippet", "decision", "learning", "question", "todo"]))
    .optional()
    .describe("Types of insights to extract (default: all)"),
});

export function extractInsights(deps: ArchiveDeps) {
  return defineTool(
    {
      name: "extract_insights",
      description:
        "Extract structured knowledge from conversations: code snippets, decisions, learnings, questions, and todos. Analyzes the conversation content to identify key insights by type.",
      input,
    },
    async (params) => {
      const conv = await requireConversation(deps, params.conversation_id);
      const requestedTypes = params.types || [
        "code_snippet",
        "decision",
        "learning",
        "question",
        "todo",
      ];

      const insights: Insight[] = [];
      const messages = conv.messages || [];

      for (const msg of messages) {
        const text = msg.content || "";

        // Extract code snippets
        if (requestedTypes.includes("code_snippet")) {
          const codeMatches = text.match(/```[\w]*\n([\s\S]*?)```/g) || [];
          codeMatches.forEach((match) => {
            insights.push({
              type: "code_snippet",
              content: match.substring(0, 150) + (match.length > 150 ? "..." : ""),
              source: msg.role,
              confidence: 0.95,
            });
          });
        }

        // Extract decisions
        if (requestedTypes.includes("decision")) {
          const decisionKeywords = [
            "we decided",
            "we'll use",
            "we chose",
            "decision:",
            "we will",
            "architecture:",
            "approach:",
          ];
          if (decisionKeywords.some((kw) => text.toLowerCase().includes(kw))) {
            const lines = text.split("\n");
            lines.forEach((line) => {
              if (decisionKeywords.some((kw) => line.toLowerCase().includes(kw))) {
                insights.push({
                  type: "decision",
                  content: line.substring(0, 150) + (line.length > 150 ? "..." : ""),
                  source: msg.role,
                  confidence: 0.8,
                });
              }
            });
          }
        }

        // Extract learnings
        if (requestedTypes.includes("learning")) {
          const learningKeywords = [
            "learned",
            "important",
            "note that",
            "remember",
            "key point",
            "understand",
            "insight:",
          ];
          if (learningKeywords.some((kw) => text.toLowerCase().includes(kw))) {
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
            sentences.forEach((sentence) => {
              if (learningKeywords.some((kw) => sentence.toLowerCase().includes(kw))) {
                insights.push({
                  type: "learning",
                  content: sentence.trim().substring(0, 150),
                  source: msg.role,
                  confidence: 0.75,
                });
              }
            });
          }
        }

        // Extract questions
        if (requestedTypes.includes("question")) {
          const questions = text.match(/[^.!?]*\?/g) || [];
          questions.forEach((q) => {
            if (q.length > 10) {
              insights.push({
                type: "question",
                content: q.trim().substring(0, 150),
                source: msg.role,
                confidence: 0.9,
              });
            }
          });
        }

        // Extract todos
        if (requestedTypes.includes("todo")) {
          const todoKeywords = ["todo:", "- [ ]", "need to", "should", "must"];
          if (todoKeywords.some((kw) => text.toLowerCase().includes(kw))) {
            const lines = text.split("\n");
            lines.forEach((line) => {
              if (todoKeywords.some((kw) => line.toLowerCase().includes(kw))) {
                insights.push({
                  type: "todo",
                  content: line.trim().substring(0, 150),
                  source: msg.role,
                  confidence: 0.85,
                });
              }
            });
          }
        }
      }

      return `Extracted ${insights.length} insights from "${conv.title}":\n\n${insights
        .slice(0, 10)
        .map(
          (i) =>
            `[${i.type}] (${i.source}) "${i.content}" (confidence: ${(i.confidence * 100).toFixed(0)}%)`
        )
        .join("\n")}\n\n${insights.length > 10 ? `... and ${insights.length - 10} more` : ""}`;
    }
  );
}
