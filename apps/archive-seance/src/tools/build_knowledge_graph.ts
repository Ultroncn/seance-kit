import { defineTool } from "@seance/core";
import { z } from "zod";
import type { ArchiveDeps } from "./shared";
import { requireConversation } from "./shared";

export interface GitHubIssue {
  title: string;
  description: string;
  labels: string[];
  priority: "P0" | "P1" | "P2";
  assignee?: string;
}

export interface TaskList {
  issues: GitHubIssue[];
  summary: string;
}

const input = z.object({
  conversation_id: z.string().min(1).describe("The conversation ID to extract tasks from"),
});

export function buildKnowledgeGraph(deps: ArchiveDeps) {
  return defineTool(
    {
      name: "build_knowledge_graph",
      description:
        "Extract actionable tasks from conversation and generate GitHub-formatted issues. Identifies next steps, todos, and followups.",
      input,
    },
    async (params) => {
      const conv = await requireConversation(deps, params.conversation_id);
      const messages = conv.messages || [];
      const fullText = messages.map((m) => m.content).join("\n");

      const taskList: TaskList = {
        issues: [],
        summary: "",
      };

      // Task extraction patterns
      const taskPatterns = [
        {
          regex: /need to[\s:]([^.!?]{10,100})/gi,
          label: "task",
          priority: "P1" as const,
        },
        {
          regex: /should[\s:]?([^.!?]{10,100})/gi,
          label: "enhancement",
          priority: "P2" as const,
        },
        {
          regex: /todo[\s:]([^.!?]{10,100})/gi,
          label: "todo",
          priority: "P1" as const,
        },
        {
          regex: /fix[\s:]?([^.!?]{10,100})/gi,
          label: "bug",
          priority: "P0" as const,
        },
        {
          regex: /optimize[\s:]?([^.!?]{10,100})/gi,
          label: "performance",
          priority: "P1" as const,
        },
        {
          regex: /refactor[\s:]?([^.!?]{10,100})/gi,
          label: "refactor",
          priority: "P2" as const,
        },
      ];

      const processedTasks = new Set<string>();

      taskPatterns.forEach((pattern) => {
        let match;
        while ((match = pattern.regex.exec(fullText)) !== null) {
          const taskText = match[1].trim();
          if (!processedTasks.has(taskText) && taskText.length > 5) {
            processedTasks.add(taskText);

            taskList.issues.push({
              title: taskText.substring(0, 70),
              description: `**Context from conversation:** "${conv.title}"\n\n${taskText}\n\nOriginal task identified in discussion.`,
              labels: [pattern.label, "from-ai-discussion"],
              priority: pattern.priority,
            });
          }
        }
      });

      // If no explicit tasks found, generate from summary
      if (taskList.issues.length === 0) {
        const summary = conv.title;
        taskList.issues.push(
          {
            title: `Implement: ${summary.substring(0, 50)}`,
            description: `Based on conversation: "${conv.title}"\n\nImplement the discussed feature/fix.`,
            labels: ["implementation", "from-ai-discussion"],
            priority: "P1",
          },
          {
            title: `Review: ${summary.substring(0, 50)}`,
            description: `Code review needed for changes discussed in "${conv.title}"`,
            labels: ["review", "from-ai-discussion"],
            priority: "P2",
          },
          {
            title: `Test: ${summary.substring(0, 50)}`,
            description: `Add tests for functionality discussed in "${conv.title}"`,
            labels: ["testing", "from-ai-discussion"],
            priority: "P2",
          }
        );
      }

      // Limit to top 6 issues
      taskList.issues = taskList.issues.slice(0, 6);
      taskList.summary = `Generated ${taskList.issues.length} GitHub issues from "${conv.title}"`;

      return `## Generated GitHub Issues from "${conv.title}"

${taskList.summary}

${taskList.issues
  .map(
    (issue, i) => `
### ${i + 1}. ${issue.title}
- **Priority:** ${issue.priority}
- **Labels:** ${issue.labels.join(", ")}
- **Description:**
  ${issue.description.split("\n").join("\n  ")}
`
  )
  .join("\n")}`;
    }
  );
}
