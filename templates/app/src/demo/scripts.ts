import type { MockScript, MockStepContext } from "@seance/llm";

// Step 3: script a few demo prompts. They run the real tools; only the wording is scripted,
// and the Demo-mode badge says so. Real providers ignore these.
export const DEMO_PROMPTS = {
  add: "Note that the séance is on Friday",
  tidy: "Hide my notes about Friday",
} as const;

const found = (ctx: MockStepContext) =>
  ctx.toolResults
    .filter((r) => r.name === "search_notes" && !r.isError)
    .flatMap((r) => (JSON.parse(r.content) as { results: { id: string }[] }).results);

export const scripts: MockScript[] = [
  {
    match: DEMO_PROMPTS.add,
    steps: [
      {
        toolCalls: [
          { name: "add_note", input: { title: "Séance on Friday", body: "Bring candles." } },
        ],
      },
    ],
    finalText: "Saved “Séance on Friday”.",
  },
  {
    match: DEMO_PROMPTS.tidy,
    steps: [
      { toolCalls: [{ name: "search_notes", input: { query: "Friday" } }] },
      (ctx) => {
        const ids = found(ctx).map((n) => n.id);
        return ids.length === 0
          ? { text: "There are no notes about Friday." }
          : {
              text: "Hiding them. You can undo it.",
              toolCalls: [{ name: "banish_notes", input: { ids } }],
            };
      },
      (ctx) => ({
        text: ctx.toolResults.some((r) => r.name === "banish_notes" && !r.isError)
          ? "Done."
          : "Okay, I kept them.",
      }),
    ],
  },
];
