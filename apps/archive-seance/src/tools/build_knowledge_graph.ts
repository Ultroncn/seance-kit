import { defineTool } from "@seance/core";
import { z } from "zod";
import type { ArchiveDeps } from "./shared";

export interface KnowledgeNode {
  id: string;
  label: string;
  type: "topic" | "technology" | "decision" | "person";
  frequency: number;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  weight: number;
  conversationIds: string[];
}

const input = z.object({
  conversation_ids: z
    .array(z.string())
    .optional()
    .describe("List of conversation IDs to analyze (if empty, uses all)"),
  extract_entities: z.boolean().optional().default(true).describe("Whether to extract specific entities"),
});

export function buildKnowledgeGraph(deps: ArchiveDeps) {
  return defineTool(
    {
      name: "build_knowledge_graph",
      description:
        "Build a knowledge graph from multiple conversations. Identifies key topics, technologies, decisions, and how they relate to each other. Returns nodes and edges for visualization.",
      input,
    },
    async (params) => {
      const conversationIds = params.conversation_ids || [];
      const extractEntities = params.extract_entities !== false;

      // Get conversations to analyze
      let conversations = [];
      if (conversationIds.length === 0) {
        conversations = await deps.storage.listConversations();
      } else {
        conversations = (
          await Promise.all(
            conversationIds.map((id) => deps.storage.getConversation(id))
          )
        ).filter(Boolean);
      }

      const nodes = new Map<string, KnowledgeNode>();
      const edges = new Map<string, KnowledgeEdge>();

      // Common tech keywords to extract
      const techKeywords = [
        "react",
        "vue",
        "angular",
        "typescript",
        "javascript",
        "python",
        "rust",
        "golang",
        "nodejs",
        "nextjs",
        "vite",
        "webpack",
        "graphql",
        "rest",
        "sql",
        "mongodb",
        "postgres",
        "docker",
        "kubernetes",
        "aws",
        "gcp",
        "azure",
        "claude",
        "chatgpt",
        "ai",
        "ml",
        "llm",
      ];

      for (const conv of conversations) {
        const text = (conv.messages || []).map((m) => m.content).join(" ").toLowerCase();

        // Extract technologies
        const foundTechs = new Set<string>();

        if (extractEntities) {
          techKeywords.forEach((tech) => {
            if (text.includes(tech)) {
              foundTechs.add(tech);

              if (!nodes.has(tech)) {
                nodes.set(tech, {
                  id: tech,
                  label: tech.toUpperCase(),
                  type: "technology",
                  frequency: 1,
                });
              } else {
                nodes.get(tech)!.frequency++;
              }
            }
          });
        }

        // Extract general topics (frequent multi-word phrases)
        const phrases = text.match(/\b[a-z]{4,}\s+[a-z]{4,}\b/g) || [];
        const phraseFreq = new Map<string, number>();
        phrases.forEach((phrase) => {
          phraseFreq.set(phrase, (phraseFreq.get(phrase) || 0) + 1);
        });

        phraseFreq.forEach((freq, phrase) => {
          if (freq >= 2) {
            const nodeId = `topic:${phrase}`;
            if (!nodes.has(nodeId)) {
              nodes.set(nodeId, {
                id: nodeId,
                label: phrase,
                type: "topic",
                frequency: freq,
              });
            } else {
              nodes.get(nodeId)!.frequency += freq;
            }
          }
        });

        // Create edges between found technologies
        const techArray = Array.from(foundTechs);
        for (let i = 0; i < techArray.length; i++) {
          for (let j = i + 1; j < techArray.length; j++) {
            const edgeId = `${techArray[i]}-${techArray[j]}`;
            if (!edges.has(edgeId)) {
              edges.set(edgeId, {
                source: techArray[i],
                target: techArray[j],
                weight: 1,
                conversationIds: [conv.id],
              });
            } else {
              const edge = edges.get(edgeId)!;
              edge.weight++;
              if (!edge.conversationIds.includes(conv.id)) {
                edge.conversationIds.push(conv.id);
              }
            }
          }
        }
      }

      // Convert to sortable array
      const nodesArray = Array.from(nodes.values())
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 20);

      const edgesArray = Array.from(edges.values())
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 15);

      return `Built knowledge graph from ${conversations.length} conversations:\n\n**Key Topics & Technologies (${nodesArray.length} nodes):**\n${nodesArray
        .map((n) => `- ${n.label} (appears ${n.frequency} times, type: ${n.type})`)
        .join("\n")}\n\n**Connections (${edgesArray.length} edges):**\n${edgesArray
        .map((e) => `- ${e.source} ↔ ${e.target} (connected in ${e.conversationIds.length} conversations)`)
        .join("\n")}`;
    }
  );
}
