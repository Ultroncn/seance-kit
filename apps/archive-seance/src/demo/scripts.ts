import type { MockScript, MockStepContext } from "@seance/llm";
import { formatDate, tNow } from "@seance/ui";
import { archiveDemoMessages } from "../messages";
import { clip } from "../tools/shared";

/**
 * Scripted demo runs for the Mock provider. They call the real tools on the real (sample or
 * imported) data, so tool results, approvals and side effects are genuine. Only the model's
 * wording is scripted, and the UI says so with the Demo-mode badge.
 */

/** The English prompts. Tests and the MCP docs use these; the UI shows the reader's language. */
export const DEMO_PROMPTS = archiveDemoMessages.en.prompts;
type PromptId = keyof typeof DEMO_PROMPTS;
/** A script answers its prompt in either language. */
const both = (id: PromptId) => [
  archiveDemoMessages.en.prompts[id],
  archiveDemoMessages.zh.prompts[id],
];
const m = () => tNow(archiveDemoMessages);
const month = (iso: string) => formatDate(iso, "month");

const NOISE = /^(untitled chat|test( test)*( 123)?)$/i;
/** An empty test chat: a throwaway title and almost nothing said. Real untitled chats are kept. */
const isEmptyTest = (r: { title: string; snippet?: string }) =>
  NOISE.test(r.title) && (r.snippet ?? "").trim().length <= 40;

interface SearchOut {
  results: { id: string; title: string; createdAt: string; snippet?: string }[];
}
interface ReadOut {
  id: string;
  title: string;
  createdAt: string;
  messages: { role: string; text: string }[];
}

/** Successful outputs of one tool in this turn, oldest first. */
function outputs<T>(ctx: MockStepContext, name: string): T[] {
  return ctx.toolResults
    .filter((r) => r.name === name && !r.isError)
    .map((r) => JSON.parse(r.content) as T);
}
const rejected = (ctx: MockStepContext, name: string) =>
  ctx.toolResults.filter((r) => r.name === name && r.isError).length;
const titles = (items: { title: string }[]) => items.map((i) => `“${i.title}”`).join(m().and);

export const archiveScripts: MockScript[] = [
  {
    match: both("summarize"),
    steps: [
      () => ({
        text: m().lookingOldest,
        toolCalls: [{ name: "search_conversations", input: { sort: "oldest", limit: 5 } }],
      }),
      (ctx) => {
        const picks = (outputs<SearchOut>(ctx, "search_conversations")[0]?.results ?? [])
          .filter((r) => !NOISE.test(r.title))
          .slice(0, 2);
        if (picks.length === 0) return { text: m().empty };
        return {
          text: m().reading(titles(picks)),
          toolCalls: picks.map((p) => ({ name: "read_conversation", input: { id: p.id } })),
        };
      },
      (ctx) => {
        const reads = outputs<ReadOut>(ctx, "read_conversation");
        return {
          text: m().summariesWait,
          toolCalls: reads.map((r) => ({
            name: "summarize_conversation",
            input: {
              id: r.id,
              summary:
                m().summaries[r.title] ?? `${r.title}: ${clip(r.messages[0]?.text ?? "", 160)}`,
            },
          })),
        };
      },
      (ctx) => {
        const saved = outputs<{ title: string }>(ctx, "summarize_conversation");
        const no = rejected(ctx, "summarize_conversation");
        const parts = [];
        if (saved.length > 0) parts.push(m().savedSummaries(titles(saved)));
        const reads = outputs<ReadOut>(ctx, "read_conversation");
        if (reads.some((r) => !m().summaries[r.title])) parts.push(m().quoteOnly);
        if (no > 0) parts.push(m().rejectedSummaries(no));
        return { text: parts.join(m().sentenceGap) || m().nothingSaved };
      },
    ],
  },
  {
    match: both("tag"),
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "sourdough", limit: 10 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_conversations")[0]?.results ?? [];
        if (hits.length === 0) return { text: m().empty };
        return {
          text: m().foundTagging(hits.length),
          toolCalls: hits.map((h) => ({
            name: "tag_conversation",
            input: { id: h.id, add: ["baking"] },
          })),
        };
      },
      (ctx) => {
        const done = outputs<{ title: string }>(ctx, "tag_conversation");
        return {
          text: done.length > 0 ? m().tagged(titles(done)) : m().noTags,
        };
      },
    ],
  },
  {
    match: both("banish"),
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "test", limit: 20 } }] },
      (ctx) => {
        const noise = (outputs<SearchOut>(ctx, "search_conversations")[0]?.results ?? []).filter(
          (r) => isEmptyTest(r),
        );
        if (noise.length === 0) return { text: m().noTests };
        return {
          text: m().looksLikeTests(titles(noise)),
          toolCalls: [{ name: "banish_conversation", input: { ids: noise.map((n) => n.id) } }],
        };
      },
      (ctx) => {
        const out = outputs<{ banished: { title: string }[] }>(ctx, "banish_conversation")[0];
        if (!out) return { text: m().leftAlone };
        return {
          text: m().banishedDone(titles(out.banished)),
        };
      },
    ],
  },
  {
    match: both("resurrect"),
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "Lisbon trip", limit: 3 } }] },
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: m().empty };
        return {
          text: m().foundFrom(hit.title, month(hit.createdAt)),
          toolCalls: [
            {
              name: "resurrect_conversation",
              input: { id: hit.id, note: m().resurrectNote },
            },
          ],
        };
      },
      (ctx) => {
        const r = outputs<{ title: string }>(ctx, "resurrect_conversation")[0];
        return {
          text: r ? m().isBack(r.title) : m().notResurrected,
        };
      },
    ],
  },
  {
    match: both("regex"),
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "regex", limit: 3 } }] },
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: m().empty };
        return { toolCalls: [{ name: "read_conversation", input: { id: hit.id } }] };
      },
      (ctx) => {
        const r = outputs<ReadOut>(ctx, "read_conversation")[0];
        if (!r) return { text: m().empty };
        const asks = r.messages
          .filter((m) => m.role === "user")
          .map((m, i) => `${i + 1}. ${clip(m.text, 140)}`);
        return {
          text: m().youAsked(r.title, month(r.createdAt), asks.join("\n")),
        };
      },
    ],
  },
];
