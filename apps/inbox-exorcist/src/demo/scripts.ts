import type { MockScript, MockStepContext } from "@seance/llm";
import { CATEGORY_LABEL, type Category } from "../domain/types";

/**
 * Scripted demo runs for the Mock provider. They call the real tools on the real (sample or
 * imported) mail, so results, approvals and changes are genuine. The judgement calls (which
 * category, what the reply says) are scripted for the sample inbox, and the Demo badge says so.
 */

export const DEMO_PROMPTS = {
  sort: "Sort my inbox",
  replies: "What needs a reply?",
  draft: "Draft a reply to Maya about dinner",
  banish: "Banish my newsletters",
  travel: "Label my travel emails",
} as const;

/** Scripted categories for the sample inbox, keyed by Message-ID. */
const SAMPLE_CATEGORIES: Record<string, Category> = {
  "dinner-saturday@example.com": "needs-reply",
  "boiler-service@example.net": "needs-reply",
  "slides-review@example.com": "needs-reply",
  "garden-photos@example.org": "personal",
  "band-schedule@example.net": "personal",
  "booking-lx4821@northwind.example": "receipt",
  "res-55190@mirador.example": "receipt",
  "ship-77410@pixelparcel.example": "notification",
  "storage-w22@cloudnote.example": "notification",
  "due-soon-3381@library.example": "notification",
  "statement-may@ledgerbank.example": "notification",
  "checkin-lx4821@northwind.example": "notification",
  "sprout-112@sprout.example": "newsletter",
  "sprout-113@sprout.example": "newsletter",
  "deals-0601@flashdeals.example": "newsletter",
  "missyou-20@beanclub.example": "newsletter",
  "timetable-june@ironworks.example": "newsletter",
  "prize-claim@lucky-win.example": "noise",
};

/** Mail outside the sample gets a rough guess from the sender and subject. */
function guess(r: Hit): Category {
  const s = `${r.from} ${r.subject}`.toLowerCase();
  if (/no-?reply|notice|alert|report|shipped|due/.test(s)) return "notification";
  if (/newsletter|deals|unsubscribe|% off/.test(s)) return "newsletter";
  if (/receipt|invoice|booking|order|confirmed/.test(s)) return "receipt";
  if (/\?$/.test(r.subject)) return "needs-reply";
  return "personal";
}

interface Hit {
  id: string;
  from: string;
  subject: string;
  date: string;
  category?: Category;
}
interface SearchOut {
  total: number;
  results: Hit[];
}

const categoryOf = (r: Hit) => SAMPLE_CATEGORIES[r.id.replace(/^mid:/, "")] ?? guess(r);
const outputs = <T>(ctx: MockStepContext, name: string) =>
  ctx.toolResults
    .filter((r) => r.name === name && !r.isError)
    .map((r) => JSON.parse(r.content) as T);
const rejected = (ctx: MockStepContext, name: string) =>
  ctx.toolResults.some((r) => r.name === name && r.isError);
const sender = (from: string) => from.replace(/\s*<.*>$/, "");
const EMPTY = "I couldn't find any mail. Load the sample inbox or import an .mbox file first.";

export const inboxScripts: MockScript[] = [
  {
    match: DEMO_PROMPTS.sort,
    steps: [
      { text: "Reading your inbox.", toolCalls: [{ name: "search_emails", input: { limit: 50 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? [];
        if (hits.length === 0) return { text: EMPTY };
        return {
          text: `I sorted ${hits.length} emails into categories. Check the batch before it is saved.`,
          toolCalls: [
            {
              name: "classify_emails",
              input: { assignments: hits.map((h) => ({ id: h.id, category: categoryOf(h) })) },
            },
          ],
        };
      },
      (ctx) => {
        const out = outputs<{ updated: { category: Category }[] }>(ctx, "classify_emails")[0];
        if (!out) return { text: "Okay, I left the categories as they were." };
        const counts = new Map<Category, number>();
        for (const u of out.updated) counts.set(u.category, (counts.get(u.category) ?? 0) + 1);
        const parts = [...counts].map(([c, n]) => `${n} ${CATEGORY_LABEL[c].toLowerCase()}`);
        return {
          text: `Done: ${parts.join(", ")}. Use the category filter on the left to see each group.`,
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.replies,
    steps: [
      { toolCalls: [{ name: "search_emails", input: { limit: 50 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? [];
        if (hits.length === 0) return { text: EMPTY };
        const waiting = hits.filter((h) => (h.category ?? categoryOf(h)) === "needs-reply");
        if (waiting.length === 0) return { text: "Nothing is waiting for a reply." };
        const list = waiting.map((h) => `• ${sender(h.from)}: “${h.subject}”`).join("\n");
        return {
          text: `${waiting.length} people are waiting on you:\n${list}\n\nAsk me to draft any of these.`,
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.draft,
    steps: [
      { toolCalls: [{ name: "search_emails", input: { query: "Maya dinner", limit: 3 } }] },
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_emails")[0]?.results[0];
        if (!hit) return { text: "I couldn't find an email from Maya about dinner." };
        return { toolCalls: [{ name: "read_email", input: { id: hit.id } }] };
      },
      (ctx) => {
        const mail = outputs<{ id: string; subject: string }>(ctx, "read_email")[0];
        if (!mail) return { text: "I couldn't read that email." };
        return {
          text: "Here's a short reply. It will be saved as a draft, not sent.",
          toolCalls: [
            {
              name: "draft_reply",
              input: {
                id: mail.id,
                body: "Hi Maya,\n\nSaturday at 8 works for me, and the Lebanese place sounds great. Please book the table.\n\nSee you then,\nAlex",
              },
            },
          ],
        };
      },
      (ctx) => {
        const d = outputs<{ to: string; subject: string }>(ctx, "draft_reply")[0];
        return {
          text: d
            ? `Draft saved: “${d.subject}” to ${d.to}. Nothing was sent. Copy it or open it in your mail app from the email.`
            : "Okay, no draft saved.",
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.banish,
    steps: [
      { toolCalls: [{ name: "search_emails", input: { query: "unsubscribe", limit: 50 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? [];
        if (hits.length === 0) return { text: "I found no newsletters to banish." };
        return {
          text: `I found ${hits.length} newsletters and promotions. You'll see the full list before anything is hidden.`,
          toolCalls: [{ name: "banish_emails", input: { ids: hits.map((h) => h.id) } }],
        };
      },
      (ctx) => {
        const out = outputs<{ banished: unknown[] }>(ctx, "banish_emails")[0];
        if (!out)
          return {
            text: rejected(ctx, "banish_emails") ? "Okay, I kept them all." : "Nothing was hidden.",
          };
        return {
          text: `Banished ${out.banished.length} emails. Nothing was deleted and your mail server was not touched. Undo it here, or restore them from the Banished view.`,
        };
      },
    ],
  },
  {
    match: DEMO_PROMPTS.travel,
    steps: [
      {
        toolCalls: [
          { name: "search_emails", input: { query: "Northwind", limit: 10 } },
          { name: "search_emails", input: { query: "Mirador", limit: 10 } },
        ],
      },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails").flatMap((o) => o.results);
        const unique = [...new Map(hits.map((h) => [h.id, h])).values()];
        if (unique.length === 0) return { text: "I found no flight or hotel emails." };
        return {
          text: `Labelling ${unique.length} flight and hotel emails “travel”.`,
          toolCalls: unique.map((h) => ({
            name: "label_email",
            input: { id: h.id, add: ["travel"] },
          })),
        };
      },
      (ctx) => {
        const n = outputs<unknown>(ctx, "label_email").length;
        return {
          text:
            n > 0
              ? `Labelled ${n} emails “travel”. Filter by the label on the left to see them together.`
              : "No labels were changed.",
        };
      },
    ],
  },
];
