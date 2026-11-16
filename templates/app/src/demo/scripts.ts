import type { MockScript, MockStepContext } from "@seance/llm";
import { tNow } from "@seance/ui";
import { demoMessages } from "../messages";

// Step 3: script a few demo prompts. They run the real tools; only the wording is scripted,
// and the Demo-mode badge says so. Real providers ignore these.
export const DEMO_PROMPTS = demoMessages.en.prompts;
/** A script answers its prompt in either language. */
const both = (id: keyof typeof DEMO_PROMPTS) => [
  demoMessages.en.prompts[id],
  demoMessages.zh.prompts[id],
];
const m = () => tNow(demoMessages);

const found = (ctx: MockStepContext) =>
  ctx.toolResults
    .filter((r) => r.name === "search_notes" && !r.isError)
    .flatMap((r) => (JSON.parse(r.content) as { results: { id: string }[] }).results);

export const scripts: MockScript[] = [
  {
    match: both("add"),
    steps: [
      {
        toolCalls: [
          { name: "add_note", input: { title: "Séance on Friday", body: "Bring candles." } },
        ],
      },
      () => ({ text: m().saved }),
    ],
  },
  {
    match: both("tidy"),
    steps: [
      { toolCalls: [{ name: "search_notes", input: { query: "Friday" } }] },
      (ctx) => {
        const ids = found(ctx).map((n) => n.id);
        return ids.length === 0
          ? { text: m().none }
          : {
              text: m().hiding,
              toolCalls: [{ name: "banish_notes", input: { ids } }],
            };
      },
      (ctx) => ({
        text: ctx.toolResults.some((r) => r.name === "banish_notes" && !r.isError)
          ? m().done
          : m().kept,
      }),
    ],
  },
];
