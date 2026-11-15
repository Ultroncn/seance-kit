import fc from "fast-check";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { createAgent, reduceTimeline, timelineFromEvents, type AgentEvent } from "../src/index";
import { makeRegistry, scriptedProvider, type ScriptedTurn } from "./helpers";

async function runScenario(turns: ScriptedTurn[], maxSteps: number, approvals: boolean[]) {
  const agent = createAgent({
    provider: scriptedProvider(turns, true),
    registry: makeRegistry({ entries: [] }),
    storage: new MemoryStorage(),
    maxSteps,
  });
  const events: AgentEvent[] = [];
  let k = 0;
  for await (const e of agent.run("summon", {
    approve: () => approvals[k++ % approvals.length] === true,
  })) {
    events.push(e);
  }
  return events;
}

const turnArb = fc.record({
  text: fc.constantFrom("", "hmm"),
  calls: fc.array(
    fc.record({
      name: fc.constantFrom("read_tool", "write_tool", "destructive_tool", "missing_tool"),
      input: fc.oneof(fc.record({ n: fc.integer() }), fc.constant({ n: "bad" })),
    }),
    { maxLength: 3 },
  ),
});

describe("timeline", () => {
  it("shows the prompt, the tool step and the reply in order", async () => {
    const events = await runScenario(
      [
        { text: "", calls: [{ name: "write_tool", input: { n: 1 } }] },
        { text: "Done", calls: [] },
      ],
      8,
      [true],
    );
    const entries = timelineFromEvents(events.filter((e) => e.type !== "message" || e.text !== ""));
    expect(entries.map((e) => e.kind)).toEqual(["user", "tool", "message"]);
    expect(entries[0]).toMatchObject({ kind: "user", text: "summon" });
    expect(entries[1]).toMatchObject({
      kind: "tool",
      name: "write_tool",
      status: "done",
      risk: "write",
    });
  });

  it("shows a pending approval while waiting, then the outcome", () => {
    const base: AgentEvent[] = [
      { type: "run_started", runId: "r1", prompt: "go" },
      {
        type: "tool_called",
        callId: "c1",
        name: "banish",
        input: { ids: ["a"] },
        risk: "destructive",
      },
      {
        type: "approval_requested",
        callId: "c1",
        name: "banish",
        input: { ids: ["a"] },
        risk: "destructive",
      },
    ];
    expect(timelineFromEvents(base)[1]).toMatchObject({ status: "awaiting_approval" });
    const rejected = timelineFromEvents([
      ...base,
      { type: "approval_resolved", callId: "c1", approved: false },
      {
        type: "tool_result",
        callId: "c1",
        name: "banish",
        ok: false,
        error: { type: "Rejected", message: "no" },
        durationMs: 3,
      },
    ]);
    expect(rejected[1]).toMatchObject({ status: "rejected", error: { type: "Rejected" } });
    const done = timelineFromEvents([
      ...base,
      { type: "approval_resolved", callId: "c1", approved: true },
      {
        type: "tool_result",
        callId: "c1",
        name: "banish",
        ok: true,
        output: { undoToken: "u1" },
        durationMs: 5,
        undoToken: "u1",
      },
    ]);
    expect(done[1]).toMatchObject({ status: "done", undoToken: "u1", durationMs: 5 });
  });

  it("never mutates the previous timeline", () => {
    const before = Object.freeze([]) as never[];
    const after = reduceTimeline(before, { type: "run_started", runId: "r", prompt: "p" });
    expect(before).toEqual([]);
    expect(after).toHaveLength(1);
  });

  it("after any finished run, every tool step is settled and matches the events", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(turnArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        async (turns, maxSteps, approvals) => {
          const events = await runScenario(turns, maxSteps, approvals);
          const entries = timelineFromEvents(events);
          const tools = entries.filter((e) => e.kind === "tool");
          const called = events.filter((e) => e.type === "tool_called");

          expect(tools.map((t) => t.id)).toEqual(called.map((c) => c.callId));
          expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
          for (const t of tools) {
            expect(["done", "failed", "rejected"]).toContain(t.status);
            expect(typeof t.durationMs).toBe("number");
            const resolved = events.find(
              (e) => e.type === "approval_resolved" && e.callId === t.id,
            );
            if (resolved?.type === "approval_resolved" && !resolved.approved) {
              expect(t.status).toBe("rejected");
            }
            if (t.status === "done" && t.risk !== "read")
              expect(resolved).toMatchObject({ approved: true });
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
