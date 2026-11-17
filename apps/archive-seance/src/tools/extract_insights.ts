import { defineTool } from "@seance/core";
import { z } from "zod";
import type { ArchiveDeps } from "./shared";
import { requireConversation } from "./shared";

export interface CodeReview {
  issues: Array<{
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    code?: string;
    suggestion?: string;
  }>;
  summary: string;
}

const input = z.object({
  conversation_id: z.string().min(1).describe("The conversation ID to review"),
});

export function extractInsights(deps: ArchiveDeps) {
  return defineTool(
    {
      name: "extract_insights",
      description:
        "Review code from conversation and identify issues: performance problems, security risks, bugs, improvements. Returns structured code review.",
      input,
    },
    async (params) => {
      const conv = await requireConversation(deps, params.conversation_id);
      const messages = conv.messages || [];
      const codeBlocks: Array<{ code: string; language: string; context: string }> = [];

      // Extract code blocks
      for (const msg of messages) {
        const text = msg.content || "";
        const regex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          codeBlocks.push({
            language: match[1] || "unknown",
            code: match[2].trim(),
            context: msg.role === "user" ? "question" : "answer",
          });
        }
      }

      if (codeBlocks.length === 0) {
        return `No code blocks found in "${conv.title}".`;
      }

      // Simulate intelligent code review with heuristics
      const review: CodeReview = {
        issues: [],
        summary: "",
      };

      codeBlocks.forEach((block, idx) => {
        const code = block.code.toLowerCase();

        // Performance issues
        if (code.includes("for") && code.includes("for") && code.match(/for.*for/)) {
          review.issues.push({
            severity: "warning",
            title: `Nested Loop in Block ${idx + 1}`,
            description: "Nested loops detected. Consider optimization using data structures.",
            code: block.code.substring(0, 80) + "...",
            suggestion: "Use hashmaps or sets for O(1) lookups instead of nested iterations.",
          });
        }

        // Security issues
        if (code.includes("eval") || code.includes("exec") || code.includes("innerHTML")) {
          review.issues.push({
            severity: "critical",
            title: `Security Risk in Block ${idx + 1}`,
            description: "Dangerous API detected that could lead to injection attacks.",
            code: block.code.substring(0, 80) + "...",
            suggestion: "Use safer alternatives (e.g., textContent instead of innerHTML).",
          });
        }

        // N+1 Query Pattern
        if (
          code.includes("select") &&
          code.includes("from") &&
          code.includes("where") &&
          code.match(/for.*query|query.*for/)
        ) {
          review.issues.push({
            severity: "warning",
            title: `N+1 Query Pattern in Block ${idx + 1}`,
            description: "Potential N+1 query issue detected.",
            suggestion: "Use JOIN or batch queries instead of looping queries.",
          });
        }

        // Missing error handling
        if (code.includes("fetch") || code.includes("await")) {
          if (!code.includes("catch") && !code.includes("try")) {
            review.issues.push({
              severity: "warning",
              title: `Missing Error Handling in Block ${idx + 1}`,
              description: "Async operation without try-catch block.",
              suggestion: "Wrap await calls in try-catch for proper error handling.",
            });
          }
        }
      });

      review.summary = `Found ${review.issues.length} code review issues in ${codeBlocks.length} code blocks: ${review.issues.length > 0 ? review.issues.filter((i) => i.severity === "critical").length + " critical, " : ""}${review.issues.filter((i) => i.severity === "warning").length} warnings.`;

      return `## Code Review for "${conv.title}"

${review.summary}

### Issues Found:
${review.issues
  .map(
    (issue, i) => `
${i + 1}. **[${issue.severity.toUpperCase()}] ${issue.title}**
   - ${issue.description}
   - Suggestion: ${issue.suggestion}
`
  )
  .join("\n")}`;
    }
  );
}
