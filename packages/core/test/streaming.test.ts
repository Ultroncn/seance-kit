import fc from "fast-check";
import type { Provider } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { createAgent, reduceTimeline, type AgentEvent, type TimelineEntry } from "../src/index";
import { makeRegistry } from "./helpers";

/** A provider that streams some reasoning, then the reply, word by word. */
const streaming = (reasoning: string[], words: string[]): Provider => ({
  id: "fake",
  isMock: false,
  async complete({ onDelta }) {
    for (const r of reasoning) onDelta?.({ kind: "reasoning", text: r });
    for (const w of words) onDelta?.({ kind: "text", text: w });
    return { text: words.join(""), toolCalls: [] };
  },
});

async function play(provider: Provider) {
  let t = 0;
  const agent = createAgent({
    provider,
    registry: makeRegistry({ entries: [] }),
    storage: new MemoryStorage(),
    now: () => new Date((t += 250)),
  });
  const events: AgentEvent[] = [];
  for await (const e of agent.run("hi")) events.push(e);
  return events;
}

const fold = (events: AgentEvent[]) => events.reduce<TimelineEntry[]>(reduceTimeline, []);

describe("streaming", () => {
  it("passes deltas on in order, then the whole reply and how long the model thought", async () => {
    const events = await play(streaming(["Let me ", "think."], ["Hello ", "there."]));
    expect(events.map((e) => e.type)).toEqual([
      "run_started",
      "step_started",
      "reasoning_delta",
      "reasoning_delta",
      "message_delta",
      "message_delta",
      "reasoning",
      "message",
      "run_finished",
    ]);
    expect(events.find((e) => e.type === "reasoning")).toMatchObject({ text: "Let me think." });
  });

  it("folds into one finished thinking entry and one finished message", async () => {
    const entries = fold(await play(streaming(["Let me ", "think."], ["Hello ", "there."])));
    expect(entries.map((e) => e.kind)).toEqual(["user", "thinking", "message"]);
    expect(entries[1]).toMatchObject({ text: "Let me think." });
    expect((entries[1] as { streaming?: boolean }).streaming).toBeFalsy();
    expect((entries[1] as { durationMs?: number }).durationMs).toBeGreaterThan(0);
    expect(entries[2]).toEqual({ kind: "message", id: entries[2]?.id, text: "Hello there." });
  });

  it("P14 a stopped stream keeps what arrived and leaves nothing marked as streaming", () => {
    const delta = fc.oneof(
      fc.string().map((text): AgentEvent => ({ type: "message_delta", text })),
      fc.string().map((text): AgentEvent => ({ type: "reasoning_delta", text })),
    );
    fc.assert(
      fc.property(fc.array(delta, { maxLength: 12 }), fc.boolean(), (deltas, aborted) => {
        const start: AgentEvent = { type: "run_started", runId: "r", prompt: "hi" };
        const end: AgentEvent[] = aborted
          ? [
              { type: "error", code: "Aborted", message: "Run cancelled" },
              { type: "run_finished", reason: "aborted" },
            ]
          : [{ type: "run_finished", reason: "complete" }];
        const entries = fold([start, ...deltas, ...end]);
        expect(entries.some((e) => "streaming" in e && e.streaming)).toBe(false);
        const said = (kind: string) =>
          deltas
            .filter((d) => d.type === kind)
            .map((d) => ("text" in d ? d.text : ""))
            .join("");
        const kept = (kind: string) =>
          entries
            .filter((e) => e.kind === kind)
            .map((e) => ("text" in e ? e.text : ""))
            .join("");
        expect(kept("message")).toBe(said("message_delta"));
        expect(kept("thinking")).toBe(said("reasoning_delta"));
      }),
    );
  });
});
