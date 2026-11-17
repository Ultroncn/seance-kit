import { defineTool } from "@seance/core";
import { z } from "zod";
import { requireConversation } from "./shared";

const input = z.object({
  id: z.string().min(1).describe("The conversation ID to generate tasks from"),
});

const output = z.string();

export const buildKnowledgeGraph = () =>
  defineTool({
    name: "build_knowledge_graph",
    description:
      "Task Agent: generate GitHub-formatted issues from a development conversation. Identifies action items, todos, and follow-ups with priority labels.",
    risk: "read",
    input,
    output,
    async run({ id }, { storage }) {
      const conv = await requireConversation(storage, id);
      const fullText = conv.messages.map((m) => m.text).join("\n");

      interface Issue {
        priority: "P0" | "P1" | "P2";
        label: string;
        title: string;
      }

      const issues: Issue[] = [];
      const seen = new Set<string>();

      const patterns: Array<{ re: RegExp; priority: "P0" | "P1" | "P2"; label: string }> = [
        { re: /fix\s+(.{10,70})/gi, priority: "P0", label: "bug" },
        { re: /(?:security|xss|injection|vulnerability)\s*[-:]?\s*(.{10,70})/gi, priority: "P0", label: "security" },
        { re: /(?:optimize|performance|slow)\s+(.{10,70})/gi, priority: "P1", label: "performance" },
        { re: /(?:add|implement|create)\s+(.{10,70})/gi, priority: "P1", label: "feature" },
        { re: /(?:refactor|cleanup|clean up)\s+(.{10,70})/gi, priority: "P2", label: "refactor" },
        { re: /(?:test|tests for)\s+(.{10,70})/gi, priority: "P2", label: "testing" },
        { re: /todo[:\s]+(.{10,70})/gi, priority: "P1", label: "todo" },
        { re: /should\s+(?:add|implement|fix|update)\s+(.{10,70})/gi, priority: "P2", label: "enhancement" },
      ];

      patterns.forEach(({ re, priority, label }) => {
        let m;
        while ((m = re.exec(fullText)) !== null) {
          const text = (m[1]?.trim() ?? "").substring(0, 70);
          const key = text.substring(0, 25).toLowerCase();
          if (text.length >= 10 && !seen.has(key)) {
            seen.add(key);
            issues.push({ priority, label, title: text });
          }
        }
      });

      // Fallback: generate sensible issues from title
      if (issues.length === 0) {
        const title = conv.title;
        issues.push(
          { priority: "P1", label: "implementation", title: `Implement: ${title.substring(0, 60)}` },
          { priority: "P2", label: "review", title: `Code review: ${title.substring(0, 55)}` },
          { priority: "P2", label: "testing", title: `Add tests for: ${title.substring(0, 55)}` },
        );
      }

      const top = issues.slice(0, 6);

      return `## Generated GitHub Issues from "${conv.title}"\n\n**${top.length} issue${top.length > 1 ? "s" : ""} ready to create:**\n\n${top
        .map(
          (issue, i) =>
            `### ${i + 1}. ${issue.title}\n- **Priority:** ${issue.priority}\n- **Labels:** ${issue.label}, from-ai-discussion`,
        )
        .join("\n\n")}`;
    },
  });
