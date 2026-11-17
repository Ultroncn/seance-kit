import { defineTool } from "@seance/core";
import { z } from "zod";
import { requireConversation } from "./shared";

const input = z.object({
  id: z.string().min(1).describe("The conversation ID to code review"),
});

const output = z.string();

export const extractInsights = () =>
  defineTool({
    name: "extract_insights",
    description:
      "Code Review Agent: analyze code blocks in a conversation for bugs, security risks, performance issues, and best practice violations.",
    risk: "read",
    input,
    output,
    async run({ id }, { storage }) {
      const conv = await requireConversation(storage, id);
      const messages = conv.messages ?? [];
      const issues: string[] = [];

      for (let i = 0; i < messages.length; i++) {
        const text = messages[i]?.text ?? "";
        const regex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const code = match[2]?.toLowerCase() ?? "";

          if (code.includes("innerhtml") || code.includes("eval(") || code.includes("exec(")) {
            issues.push(`[CRITICAL] Security - XSS/injection risk in code block ${i + 1}: use textContent or parameterized queries instead`);
          }
          if (code.match(/for.+\n.+for/s)) {
            issues.push(`[WARNING] Performance - nested loop in block ${i + 1}: consider Map/Set for O(1) lookups`);
          }
          if ((code.includes("fetch(") || code.includes("await ")) && !code.includes("try") && !code.includes("catch")) {
            issues.push(`[WARNING] Reliability - async call without try-catch in block ${i + 1}`);
          }
          if (code.includes("select") && code.match(/for.+select|select.+for/s)) {
            issues.push(`[WARNING] Performance - N+1 query pattern in block ${i + 1}: use JOIN or batch`);
          }
        }
      }

      if (issues.length === 0) {
        return `No obvious code issues found in "${conv.title}". ${messages.length} messages scanned.`;
      }

      return `## Code Review: "${conv.title}"\n\n**${issues.length} issue${issues.length > 1 ? "s" : ""} found:**\n\n${issues.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    },
  });
