import type { MockScript, MockStepContext } from "@seance/llm";
import { tNow } from "@seance/ui";
import type { Category } from "../domain/types";
import { inboxDemoMessages, inboxMessages } from "../messages";

/**
 * Scripted demo runs for the Mock provider. They call the real tools on the real (sample or
 * imported) mail, so results, approvals and changes are genuine. The judgement calls (which
 * category, what the reply says) are scripted for the sample inbox, and the Demo badge says so.
 */

/** The English prompts. Tests use these; the UI shows the reader's language. */
export const DEMO_PROMPTS = inboxDemoMessages.en.prompts;
type PromptId = keyof typeof DEMO_PROMPTS;
/** A script answers its prompt in either language. */
const both = (id: PromptId) => [inboxDemoMessages.en.prompts[id], inboxDemoMessages.zh.prompts[id]];
const m = () => tNow(inboxDemoMessages);

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

const inSample = (r: Hit) => r.id.replace(/^mid:/, "") in SAMPLE_CATEGORIES;
const categoryOf = (r: Hit) => SAMPLE_CATEGORIES[r.id.replace(/^mid:/, "")] ?? guess(r);
/** The one email the scripted reply was written for. */
const SAMPLE_DINNER = "mid:dinner-saturday@example.com";
const outputs = <T>(ctx: MockStepContext, name: string) =>
  ctx.toolResults
    .filter((r) => r.name === name && !r.isError)
    .map((r) => JSON.parse(r.content) as T);
const rejected = (ctx: MockStepContext, name: string) =>
  ctx.toolResults.some((r) => r.name === name && r.isError);
const sender = (from: string) => from.replace(/\s*<.*>$/, "");

export const inboxScripts: MockScript[] = [
  {
    match: both("sort"),
    steps: [
      () => ({
        text: m().readingInbox,
        toolCalls: [{ name: "search_emails", input: { limit: 50 } }],
      }),
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? [];
        if (hits.length === 0) return { text: m().empty };
        return {
          text: m().sorted(hits.length),
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
        if (!out) return { text: m().keptCategories };
        const guessed = (outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? []).some(
          (h) => !inSample(h),
        );
        const counts = new Map<Category, number>();
        for (const u of out.updated) counts.set(u.category, (counts.get(u.category) ?? 0) + 1);
        const label = tNow(inboxMessages).category;
        const parts = [...counts].map(([c, n]) => m().countPart(n, label[c]));
        return {
          text: m().sortDone(parts.join(m().listSep)) + (guessed ? m().gap + m().guessNote : ""),
        };
      },
    ],
  },
  {
    match: both("replies"),
    steps: [
      { toolCalls: [{ name: "search_emails", input: { limit: 50 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? [];
        if (hits.length === 0) return { text: m().empty };
        const waiting = hits.filter((h) => (h.category ?? categoryOf(h)) === "needs-reply");
        if (waiting.length === 0) return { text: m().nothingWaiting };
        const list = waiting.map((h) => `• ${sender(h.from)}: “${h.subject}”`).join("\n");
        const guessed = waiting.some((h) => !h.category && !inSample(h));
        return {
          text: m().waiting(waiting.length, list) + (guessed ? `\n\n${m().guessNote}` : ""),
        };
      },
    ],
  },
  {
    match: both("draft"),
    steps: [
      { toolCalls: [{ name: "search_emails", input: { query: "Maya dinner", limit: 3 } }] },
      (ctx) => {
        const hit = outputs<SearchOut>(ctx, "search_emails")[0]?.results[0];
        if (!hit) return { text: m().noMaya };
        if (hit.id !== SAMPLE_DINNER) return { text: m().notSampleMaya };
        return { toolCalls: [{ name: "read_email", input: { id: hit.id } }] };
      },
      (ctx) => {
        const mail = outputs<{ id: string; subject: string }>(ctx, "read_email")[0];
        if (!mail) return { text: m().cantRead };
        return {
          text: m().hereIsDraft,
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
          text: d ? m().draftSaved(d.subject, d.to) : m().noDraft,
        };
      },
    ],
  },
  {
    match: both("banish"),
    steps: [
      { toolCalls: [{ name: "search_emails", input: { query: "unsubscribe", limit: 50 } }] },
      (ctx) => {
        const hits = outputs<SearchOut>(ctx, "search_emails")[0]?.results ?? [];
        if (hits.length === 0) return { text: m().noNewsletters };
        return {
          text: m().foundNewsletters(hits.length),
          toolCalls: [{ name: "banish_emails", input: { ids: hits.map((h) => h.id) } }],
        };
      },
      (ctx) => {
        const out = outputs<{ banished: unknown[] }>(ctx, "banish_emails")[0];
        if (!out)
          return {
            text: rejected(ctx, "banish_emails") ? m().keptAll : m().nothingHidden,
          };
        return {
          text: m().banishedDone(out.banished.length),
        };
      },
    ],
  },
  {
    match: both("travel"),
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
        if (unique.length === 0) return { text: m().noTravel };
        return {
          text: m().labelling(unique.length),
          toolCalls: unique.map((h) => ({
            name: "label_email",
            input: { id: h.id, add: ["travel"] },
          })),
        };
      },
      (ctx) => {
        const n = outputs<unknown>(ctx, "label_email").length;
        return {
          text: n > 0 ? m().labelled(n) : m().noLabels,
        };
      },
    ],
  },
];
