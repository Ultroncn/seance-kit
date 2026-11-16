import fc from "fast-check";
import { MemoryStorage } from "@seance/storage";
import { describe, expect, it } from "vitest";
import { createAgent, type AgentEvent } from "../src/index";
import {
  historyIsValid,
  makeRegistry,
  scriptedProvider,
  type RunLog,
  type ScriptedTurn,
} from "./helpers";

async function collect(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

function setup(turns: ScriptedTurn[], maxSteps?: number, endless = false) {
  const log: RunLog = { entries: [] };
  const agent = createAgent({
    provider: scriptedProvider(turns, endless),
    registry: makeRegistry(log),
    storage: new MemoryStorage(),
    maxSteps,
  });
  return { log, agent };
}

const call = (name: string, input: unknown = { n: 1 }) => ({ name, input });

describe("agent loop", () => {
  it("runs read tools without approval and finishes with the model's text", async () => {
    const { agent, log } = setup([
      { text: "looking", calls: [call("read_tool")] },
      { text: "all done", calls: [] },
    ]);
    const events = await collect(agent.run("hi"));
    expect(log.entries).toEqual(["run:read_tool"]);
    expect(events.map((e) => e.type)).toEqual([
      "run_started",
      "step_started",
      "message",
      "tool_called",
      "tool_result",
      "step_started",
      "message",
      "run_finished",
    ]);
    expect(events.at(-1)).toEqual({ type: "run_finished", reason: "complete" });
  });

  it("rejects write tools when no approval handler is given", async () => {
    const { agent, log } = setup([{ text: "", calls: [call("write_tool")] }]);
    const events = await collect(agent.run("go"));
    expect(log.entries).toEqual([]);
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({
      ok: false,
      error: { type: "Rejected" },
    });
  });

  it("runs a write tool after approval, and passes the request to the handler", async () => {
    const { agent, log } = setup([{ text: "", calls: [call("write_tool", { n: 4 })] }]);
    const seen: unknown[] = [];
    const events = await collect(
      agent.run("go", {
        approve: (req) => {
          seen.push(req);
          return true;
        },
      }),
    );
    expect(log.entries).toEqual(["run:write_tool"]);
    expect(seen).toEqual([{ callId: "c1-0", name: "write_tool", input: { n: 4 }, risk: "write" }]);
    const types = events.map((e) => e.type);
    expect(types.indexOf("approval_requested")).toBeLessThan(types.indexOf("tool_result"));
  });

  it("treats a throwing approval handler as a rejection", async () => {
    const { agent, log } = setup([{ text: "", calls: [call("destructive_tool")] }]);
    await collect(
      agent.run("go", {
        approve: () => {
          throw new Error("dialog crashed");
        },
      }),
    );
    expect(log.entries).toEqual([]);
  });

  it("returns invalid input to the model without asking approval or running the tool", async () => {
    const { agent, log } = setup([
      { text: "", calls: [call("write_tool", { n: "not a number" })] },
      { text: "sorry", calls: [] },
    ]);
    let asked = 0;
    const events = await collect(agent.run("go", { approve: () => (asked++, true) }));
    expect(asked).toBe(0);
    expect(log.entries).toEqual([]);
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({
      ok: false,
      error: { type: "InvalidInput" },
    });
    expect(agent.messages.some((m) => m.role === "tool" && m.isError)).toBe(true);
  });

  it("surfaces the undo token of a destructive tool", async () => {
    const { agent } = setup([{ text: "", calls: [call("destructive_tool")] }]);
    const events = await collect(agent.run("go", { approve: () => true }));
    expect(events.find((e) => e.type === "tool_result")).toMatchObject({
      ok: true,
      undoToken: "undo-1",
    });
  });

  it("stops at the step budget and still answers every tool call", async () => {
    const { agent, log } = setup(
      [{ text: "", calls: [call("read_tool"), call("read_tool"), call("read_tool")] }],
      2,
    );
    const events = await collect(agent.run("go"));
    expect(log.entries).toEqual(["run:read_tool", "run:read_tool"]);
    expect(events).toContainEqual(expect.objectContaining({ type: "error", code: "StepBudget" }));
    expect(events.at(-1)).toEqual({ type: "run_finished", reason: "budget" });
    expect(historyIsValid(agent.messages)).toBe(true);
  });

  it("reports a provider failure as an error event", async () => {
    const agent = createAgent({
      provider: {
        id: "broken",
        isMock: false,
        complete: async () => {
          throw new Error("network down");
        },
      },
      registry: makeRegistry({ entries: [] }),
      storage: new MemoryStorage(),
    });
    const events = await collect(agent.run("hi"));
    expect(events).toContainEqual({ type: "error", code: "Provider", message: "network down" });
    expect(events.at(-1)).toEqual({ type: "run_finished", reason: "error" });
  });

  it("stops when the signal is aborted", async () => {
    const { agent } = setup([{ text: "", calls: [call("read_tool")] }], 8, true);
    const ac = new AbortController();
    ac.abort();
    const events = await collect(agent.run("go", { signal: ac.signal }));
    expect(events.at(-1)).toEqual({ type: "run_finished", reason: "aborted" });
  });
});

const turnArb = fc.record({
  text: fc.constantFrom("", "thinking"),
  calls: fc.array(
    fc.record({
      name: fc.constantFrom("read_tool", "write_tool", "destructive_tool", "missing_tool"),
      input: fc.oneof(fc.record({ n: fc.integer() }), fc.constant({ n: "bad" }), fc.anything()),
    }),
    { maxLength: 4 },
  ),
});

const scenario = fc.record({
  turns: fc.array(turnArb, { minLength: 1, maxLength: 6 }),
  maxSteps: fc.integer({ min: 0, max: 6 }),
  endless: fc.boolean(),
  approvals: fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
});

type ArbValue<A> = A extends fc.Arbitrary<infer T> ? T : never;
type Scenario = ArbValue<typeof scenario>;

async function play(s: Scenario) {
  const { agent, log } = setup(s.turns, s.maxSteps, s.endless);
  let k = 0;
  const events = await collect(
    agent.run("go", {
      approve: (req) => {
        const ok = s.approvals[k++ % s.approvals.length] === true;
        if (ok) log.entries.push(`approved:${req.name}`);
        return ok;
      },
    }),
  );
  return { agent, log, events };
}

describe("agent loop properties", () => {
  it("P8 tool runs never exceed maxSteps, even if the model never stops", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        const { log, events, agent } = await play(s);
        const runs = log.entries.filter((e) => e.startsWith("run:")).length;
        const called = events.filter((e) => e.type === "tool_called").length;
        expect(runs).toBeLessThanOrEqual(s.maxSteps);
        expect(called).toBeLessThanOrEqual(s.maxSteps);
        expect(events.at(-1)?.type).toBe("run_finished");
        expect(historyIsValid(agent.messages)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("P9 no non-read tool runs without a fresh approval for it", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        const { log } = await play(s);
        const approvals = new Map<string, number>();
        const runs = new Map<string, number>();
        for (const entry of log.entries) {
          const [kind, name = ""] = entry.split(":");
          if (kind === "approved") approvals.set(name, (approvals.get(name) ?? 0) + 1);
          if (kind === "run" && name !== "read_tool") {
            const ran = (runs.get(name) ?? 0) + 1;
            runs.set(name, ran);
            expect(approvals.get(name) ?? 0).toBeGreaterThanOrEqual(ran);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("P9 every non-read tool that ran was approved for that exact call id", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        const { events } = await play(s);
        const approved = new Set<string>();
        const risk = new Map<string, string | null>();
        for (const e of events) {
          if (e.type === "tool_called") risk.set(e.callId, e.risk);
          if (e.type === "approval_resolved" && e.approved) approved.add(e.callId);
          if (e.type === "tool_result" && e.ok && risk.get(e.callId) !== "read")
            expect(approved.has(e.callId)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("P9 approval is never requested for read tools", async () => {
    await fc.assert(
      fc.asyncProperty(scenario, async (s) => {
        const { events } = await play(s);
        for (const e of events) {
          if (e.type === "approval_requested") expect(e.risk).not.toBe("read");
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("agent loop regressions (review)", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("reset while an approval is pending leaves the new conversation clean and valid", async () => {
    const { agent, log } = setup([
      { text: "", calls: [call("write_tool")] },
      { text: "ok", calls: [] },
    ]);
    let release: ((ok: boolean) => void) | undefined;
    const first = collect(
      agent.run("go", { approve: () => new Promise<boolean>((r) => (release = r)) }),
    );
    while (!release) await tick();
    agent.reset();
    release(false);
    await first;
    expect(agent.messages).toEqual([]);
    expect(log.entries).toEqual([]);

    await collect(agent.run("again"));
    expect(agent.messages[0]).toEqual({ role: "user", content: "again" });
    expect(historyIsValid(agent.messages)).toBe(true);
  });

  it("gives every tool call a unique id even when the provider repeats or omits ids", async () => {
    let turn = 0;
    const agent = createAgent({
      provider: {
        id: "sloppy",
        isMock: false,
        async complete() {
          turn++;
          if (turn > 3) return { text: "done", toolCalls: [] };
          return {
            text: "",
            toolCalls: [
              { id: turn === 3 ? "" : "call-0", name: "read_tool", input: { n: 1 } },
              { id: "call-0", name: "read_tool", input: { n: 2 } },
            ],
          };
        },
      },
      registry: makeRegistry({ entries: [] }),
      storage: new MemoryStorage(),
    });
    const events = await collect(agent.run("go"));
    const ids = events
      .filter((e) => e.type === "tool_called")
      .map((e) => (e.type === "tool_called" ? e.callId : ""));
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect(ids.every((id) => id !== "")).toBe(true);
    expect(historyIsValid(agent.messages)).toBe(true);
  });

  it("reports Stop during a provider request as Aborted, not as a provider error", async () => {
    const ac = new AbortController();
    const agent = createAgent({
      provider: {
        id: "slow",
        isMock: false,
        complete: ({ signal }) =>
          new Promise((_, reject) =>
            signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            ),
          ),
      },
      registry: makeRegistry({ entries: [] }),
      storage: new MemoryStorage(),
    });
    const done = collect(agent.run("go", { signal: ac.signal }));
    await tick();
    ac.abort();
    const events = await done;
    expect(events).toContainEqual(expect.objectContaining({ type: "error", code: "Aborted" }));
    expect(events.at(-1)).toEqual({ type: "run_finished", reason: "aborted" });
  });

  it("does not run the remaining calls of a reply after Stop", async () => {
    const ac = new AbortController();
    const { agent, log } = setup([{ text: "", calls: [call("write_tool"), call("read_tool")] }]);
    const events = await collect(
      agent.run("go", {
        signal: ac.signal,
        approve: () => {
          ac.abort();
          return false;
        },
      }),
    );
    expect(log.entries).toEqual([]);
    expect(events.at(-1)).toEqual({ type: "run_finished", reason: "aborted" });
    expect(historyIsValid(agent.messages)).toBe(true);
  });

  it("keeps the step budget when maxSteps is not a finite number", async () => {
    const { agent, log } = setup([{ text: "", calls: [call("read_tool")] }], Number.NaN, true);
    await collect(agent.run("go"));
    expect(log.entries.length).toBeLessThanOrEqual(8);
  });
});
