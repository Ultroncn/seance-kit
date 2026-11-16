import type { ChatMessage, Provider, ProviderReply } from "@seance/llm";
import { MemoryStorage } from "@seance/storage";
import { z } from "zod";
import { defineTool, ToolRegistry, type Risk, type ToolContext } from "../src/index";

export const ctx = (): ToolContext => ({
  storage: new MemoryStorage(),
  signal: new AbortController().signal,
  now: () => new Date("2026-11-16T12:00:00Z"),
});

export interface RunLog {
  /** Order of events across approvals and tool runs, for ordering checks. */
  entries: string[];
}

/** One tool per risk level plus a tool with strict input, all logging into `log`. */
export function makeRegistry(log: RunLog): ToolRegistry {
  const make = (name: string, risk: Risk) =>
    defineTool({
      name,
      description: `${name} tool`,
      risk,
      input: z.object({ n: z.number().int() }),
      output:
        risk === "destructive"
          ? z.object({ ok: z.literal(true), undoToken: z.string() })
          : z.object({ ok: z.literal(true), undoToken: z.string().optional() }),
      async run() {
        log.entries.push(`run:${name}`);
        return risk === "destructive"
          ? { ok: true as const, undoToken: "undo-1" }
          : { ok: true as const };
      },
    });
  return new ToolRegistry()
    .register(make("read_tool", "read"))
    .register(make("write_tool", "write"))
    .register(make("destructive_tool", "destructive"));
}

export interface ScriptedTurn {
  text: string;
  calls: { name: string; input: unknown }[];
}

/** Provider that replays turns in order. With `endless`, it keeps calling tools forever. */
export function scriptedProvider(turns: ScriptedTurn[], endless = false): Provider {
  let i = 0;
  return {
    id: "scripted",
    isMock: false,
    async complete(): Promise<ProviderReply> {
      const turn = turns[i++] ?? (endless ? turns[turns.length - 1] : undefined);
      if (!turn) return { text: "done", toolCalls: [] };
      return {
        text: turn.text,
        toolCalls: turn.calls.map((c, k) => ({ id: `c${i}-${k}`, name: c.name, input: c.input })),
      };
    },
  };
}

/** Every assistant tool call must be followed by exactly one tool message with its id. */
export function historyIsValid(messages: readonly ChatMessage[]): boolean {
  const wanted = new Set<string>();
  for (const m of messages) {
    if (m.role === "assistant") for (const c of m.toolCalls ?? []) wanted.add(c.id);
  }
  const seen = new Map<string, number>();
  for (const m of messages) {
    if (m.role === "tool") seen.set(m.toolCallId, (seen.get(m.toolCallId) ?? 0) + 1);
  }
  return [...wanted].every((id) => seen.get(id) === 1) && seen.size === wanted.size;
}
