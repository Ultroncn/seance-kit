import type { MockScript, MockStepContext } from "@seance/llm";
import { tNow } from "@seance/ui";
import { archiveDemoMessages } from "../messages";
import { clip } from "../tools/shared";

/**
 * Scripted demo runs for the Mock provider. They call the real tools on the real (sample or
 * imported) data, so tool results, approvals and side effects are genuine. Only the model's
 * wording is scripted, and the UI says so with the Demo-mode badge.
 */

export const DEMO_PROMPTS = archiveDemoMessages.en.prompts;
type PromptId = keyof typeof DEMO_PROMPTS;
const both = (id: PromptId) => [
  archiveDemoMessages.en.prompts[id],
  archiveDemoMessages.zh.prompts[id],
];
const m = () => tNow(archiveDemoMessages);

interface SearchOut {
  results: { id: string; title: string; createdAt: string; snippet?: string }[];
}
interface ReadOut {
  id: string;
  title: string;
  createdAt: string;
  messages: { role: string; text: string }[];
}

function outputs<T>(ctx: MockStepContext, name: string): T[] {
  return ctx.toolResults
    .filter((r) => r.name === name && !r.isError)
    .map((r) => JSON.parse(r.content) as T);
}
const rejected = (ctx: MockStepContext, name: string) =>
  ctx.toolResults.filter((r) => r.name === name && r.isError).length;
const titles = (items: { title: string }[]) => items.map((i) => `"${i.title}"`).join(m().and);

export const archiveScripts: MockScript[] = [
  // Code Review demo
  {
    match: both("codeReview"),
    steps: [
      () => ({
        text: m().lookingOldest,
        toolCalls: [{ name: "search_conversations", input: { query: "react", limit: 3 } }],
      }),
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: m().empty };
        return {
          text: m().reading(titles([hit])),
          toolCalls: [{ name: "extract_insights", input: { id: hit.id } }],
        };
      },
      (ctx) => {
        const r = outputs<string>(ctx, "extract_insights")[0];
        return { text: r ?? m().extractInsightsResult };
      },
    ],
  },
  // Decision Log demo
  {
    match: both("decisions"),
    steps: [
      () => ({
        text: m().lookingOldest,
        toolCalls: [{ name: "search_conversations", input: { query: "database", limit: 3 } }],
      }),
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: m().empty };
        return {
          text: m().reading(titles([hit])),
          toolCalls: [{ name: "find_related_conversations", input: { id: hit.id } }],
        };
      },
      (ctx) => {
        const r = outputs<string>(ctx, "find_related_conversations")[0];
        return { text: r ?? m().relatedResult };
      },
    ],
  },
  // Task Generation demo
  {
    match: both("tasks"),
    steps: [
      () => ({
        text: m().lookingOldest,
        toolCalls: [{ name: "search_conversations", input: { query: "api", limit: 3 } }],
      }),
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: m().empty };
        return {
          text: m().reading(titles([hit])),
          toolCalls: [{ name: "build_knowledge_graph", input: { id: hit.id } }],
        };
      },
      (ctx) => {
        const r = outputs<string>(ctx, "build_knowledge_graph")[0];
        return { text: r ?? m().graphResult };
      },
    ],
  },
];
