import type { MockScript, MockStepContext } from "@seance/llm";
import { clip, monthYear } from "../tools/shared";

/**
 * Scripted demo runs for the Mock provider. They call the real tools on the real (sample or
 * imported) data, so tool results, approvals and side effects are genuine. Only the model's
 * wording is scripted, and the UI says so with the Demo-mode badge.
 */

export const DEMO_PROMPTS = {
  summarize: "Summarize my oldest chats",
  tag: "Find my sourdough chats and tag them baking",
  banish: "Banish my empty test chats",
  resurrect: "Resurrect my Lisbon trip planning",
  regex: "What did I ask about regex?",
} as const;

const NOISE = /^(untitled chat|test( test)*( 123)?)$/i;
/** An empty test chat: a throwaway title and almost nothing said. Real untitled chats are kept. */
const isEmptyTest = (r: { title: string; snippet?: string }) =>
  NOISE.test(r.title) && (r.snippet ?? "").trim().length <= 40;

const CANNED_SUMMARIES: Record<string, string> = {
  "Sourdough starter keeps dying":
    "A starter smelled of acetone and barely rose. Advice: feed it 1:1:1 twice a day, swap in some rye, and keep it near 24–26 °C. In an 18 °C kitchen it is slow, not dead.",
  "Regex for dates in a log file":
    "Finding YYYY-MM-DD dates in a server log. Started with \\b\\d{4}-\\d{2}-\\d{2}\\b, then tightened months and days; real calendar checks belong in code.",
  "Birthday poem for Grandma Rosa":
    "A short, warm poem for Grandma Rosa's 90th birthday, built around her garden and her plum cake.",
  "Lisbon trip planning":
    "A four-day walking and food plan for Lisbon: Alfama, Belém, a Sintra day trip, Bairro Alto. Ride tram 28 early or walk the route.",
};

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
const titles = (items: { title: string }[]) => items.map((i) => `“${i.title}”`).join(" and ");
const EMPTY = "I couldn't find matching chats. Load the sample archive or import an export first.";

export const archiveScripts: MockScript[] = [
  {
    match: DEMO_PROMPTS.summarize,
    steps: [
      {
        text: "Looking for your oldest chats.",
        toolCalls: [{ name: "search_conversations", input: { sort: "oldest", limit: 5 } }],
      },
      (ctx) => {
        const picks = (outputs<SearchOut>(ctx, "search_conversations")[0]?.results ?? [])
          .filter((r) => !NOISE.test(r.title))
          .slice(0, 2);
        if (picks.length === 0) return { text: EMPTY };
        return {
          text: `Reading ${titles(picks)}.`,
          toolCalls: picks.map((p) => ({ name: "read_conversation", input: { id: p.id } })),
        };
      },
      (ctx) => {
        const reads = outputs<ReadOut>(ctx, "read_conversation");
        return {
          text: "Here are short summaries. Each one waits for your approval.",
          toolCalls: reads.map((r) => ({
            name: "summarize_conversation",
            input: {
              id: r.id,
              summary:
                CANNED_SUMMARIES[r.title] ?? `${r.title}: ${clip(r.messages[0]?.text ?? "", 160)}`,
            },
          })),
        };
      },
      (ctx) => {
        const saved = outputs<{ title: string }>(ctx, "summarize_conversation");
        const no = rejected(ctx, "summarize_conversation");
        const parts = [];
        if (saved.length > 0)
          parts.push(
            `Saved summaries for ${titles(saved)}. You'll see them at the top of each chat.`,
          );
        const reads = outputs<ReadOut>(ctx, "read_conversation");
        if (reads.some((r) => !CANNED_SUMMARIES[r.title]))
          parts.push(
            "Demo mode can only quote the first message of chats outside the sample. A real model writes real summaries.",
          );
        if (no > 0)
          parts.push(
            `You rejected ${no === 1 ? "one summary" : `${no} summaries`}, so I left ${no === 1 ? "that chat" : "those chats"} alone.`,
          );
        return { text: parts.join(" ") || "Nothing was saved." };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.tag,
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "sourdough", limit: 10 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_conversations")[0]?.results ?? [];
        if (hits.length === 0) return { text: EMPTY };
        return {
          text: `Found ${hits.length === 1 ? "one chat" : `${hits.length} chats`}. Tagging ${hits.length === 1 ? "it" : "them"} “baking”.`,
          toolCalls: hits.map((h) => ({
            name: "tag_conversation",
            input: { id: h.id, add: ["baking"] },
          })),
        };
      },
      (ctx) => {
        const done = outputs<{ title: string }>(ctx, "tag_conversation");
        return {
          text: done.length > 0 ? `Tagged ${titles(done)} with “baking”.` : "No tags were changed.",
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.banish,
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "test", limit: 20 } }] },
      (ctx) => {
        const noise = (outputs<SearchOut>(ctx, "search_conversations")[0]?.results ?? []).filter(
          (r) => isEmptyTest(r),
        );
        if (noise.length === 0) return { text: "I found no empty test chats to banish." };
        return {
          text: `These look like empty test chats: ${titles(noise)}.`,
          toolCalls: [{ name: "banish_conversation", input: { ids: noise.map((n) => n.id) } }],
        };
      },
      (ctx) => {
        const out = outputs<{ banished: { title: string }[] }>(ctx, "banish_conversation")[0];
        if (!out) return { text: "Okay, I left them where they are." };
        return {
          text: `Banished ${titles(out.banished)}. Nothing was deleted: undo it here, or restore them from the Banished view.`,
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.resurrect,
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "Lisbon trip", limit: 3 } }] },
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: EMPTY };
        return {
          text: `Found “${hit.title}” from ${monthYear(hit.createdAt)}.`,
          toolCalls: [
            {
              name: "resurrect_conversation",
              input: { id: hit.id, note: "I'm going back in May and want a rainy-day plan too." },
            },
          ],
        };
      },
      (ctx) => {
        const r = outputs<{ title: string }>(ctx, "resurrect_conversation")[0];
        return {
          text: r
            ? `“${r.title}” is back. Open the chat and copy the resurrection prompt into any chat app to continue where you left off.`
            : "Okay, I didn't resurrect it.",
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.regex,
    steps: [
      { toolCalls: [{ name: "search_conversations", input: { query: "regex", limit: 3 } }] },
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_conversations")[0]?.results[0];
        if (!hit) return { text: EMPTY };
        return { toolCalls: [{ name: "read_conversation", input: { id: hit.id } }] };
      },
      (ctx) => {
        const r = outputs<ReadOut>(ctx, "read_conversation")[0];
        if (!r) return { text: EMPTY };
        const asks = r.messages
          .filter((m) => m.role === "user")
          .map((m, i) => `${i + 1}. ${clip(m.text, 140)}`);
        return {
          text: `In “${r.title}” (${monthYear(r.createdAt)}) you asked:\n${asks.join("\n")}`,
        };
      },
    ],
  },
];
