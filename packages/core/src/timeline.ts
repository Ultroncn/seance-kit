import type { AgentEvent } from "./agent";
import type { Risk, ToolError } from "./types";

/**
 * View model for the séance timeline. `@seance/ui` declares the same shape for its props
 * (ui never imports core), so apps pass `reduceTimeline` output straight to `<SeanceTimeline>`.
 * Keep the two declarations identical.
 */
export type ToolStepStatus = "running" | "awaiting_approval" | "rejected" | "done" | "failed";

export type TimelineEntry =
  | { kind: "user"; id: string; text: string }
  /** `streaming` while the model is still writing it. */
  | { kind: "message"; id: string; text: string; streaming?: boolean }
  /** The model's reasoning for one step. `durationMs` is set once it has finished thinking. */
  | { kind: "thinking"; id: string; text: string; streaming?: boolean; durationMs?: number }
  | {
      kind: "tool";
      id: string;
      name: string;
      input: unknown;
      risk: Risk | null;
      status: ToolStepStatus;
      output?: unknown;
      error?: ToolError;
      durationMs?: number;
      undoToken?: string;
    }
  | { kind: "notice"; id: string; tone: "error" | "info"; text: string; code?: string };

type ToolEntry = Extract<TimelineEntry, { kind: "tool" }>;

function updateTool(
  entries: TimelineEntry[],
  callId: string,
  patch: (e: ToolEntry) => ToolEntry,
): TimelineEntry[] {
  return entries.map((e) => (e.kind === "tool" && e.id === callId ? patch(e) : e));
}

type Thinking = Extract<TimelineEntry, { kind: "thinking" }>;
type Message = Extract<TimelineEntry, { kind: "message" }>;

/** Append to the open entry of this kind at the end, or open a new one. */
function appendStreaming(entries: TimelineEntry[], kind: "message" | "thinking", text: string) {
  const last = entries[entries.length - 1];
  if (last && last.kind === kind && last.streaming)
    return [...entries.slice(0, -1), { ...last, text: last.text + text }];
  // Text starting means thinking is over, though its duration arrives later.
  const settled = kind === "message" ? entries.map(stopThinking) : entries;
  return [
    ...settled,
    { kind, id: `${kind[0]}${entries.length}`, text, streaming: true } as Thinking | Message,
  ];
}

const stopThinking = (e: TimelineEntry): TimelineEntry =>
  e.kind === "thinking" && e.streaming ? { ...e, streaming: false } : e;

/** End every open stream, for example when a run stops halfway through a reply. */
const settleAll = (entries: TimelineEntry[]) =>
  entries.some((e) => (e.kind === "message" || e.kind === "thinking") && e.streaming)
    ? entries.map((e) =>
        (e.kind === "message" || e.kind === "thinking") && e.streaming
          ? { ...e, streaming: false }
          : e,
      )
    : entries;

/** Index of the step's entry of this kind: searched back over this step's thinking and text only. */
function stepEntry(entries: TimelineEntry[], match: (e: TimelineEntry) => boolean): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as TimelineEntry;
    if (match(e)) return i;
    if (e.kind !== "message" && e.kind !== "thinking") return -1;
  }
  return -1;
}

/** Fold one agent event into the timeline. Pure: returns a new array, never mutates. */
export function reduceTimeline(entries: TimelineEntry[], event: AgentEvent): TimelineEntry[] {
  switch (event.type) {
    case "run_started":
      return [...entries, { kind: "user", id: `${event.runId}:user`, text: event.prompt }];
    case "message_delta":
      return appendStreaming(entries, "message", event.text);
    case "reasoning_delta":
      return appendStreaming(entries, "thinking", event.text);
    case "reasoning": {
      const at = stepEntry(entries, (e) => e.kind === "thinking" && e.durationMs === undefined);
      const done: Thinking = {
        kind: "thinking",
        id: at >= 0 ? (entries[at] as Thinking).id : `t${entries.length}`,
        text: event.text,
        durationMs: event.durationMs,
      };
      return at >= 0 ? entries.map((e, i) => (i === at ? done : e)) : [...entries, done];
    }
    case "message": {
      const at = stepEntry(entries, (e) => e.kind === "message" && e.streaming === true);
      const done: Message = {
        kind: "message",
        id: at >= 0 ? (entries[at] as Message).id : `m${entries.length}`,
        text: event.text,
      };
      return at >= 0 ? entries.map((e, i) => (i === at ? done : e)) : [...entries, done];
    }
    case "tool_called":
      return [
        ...entries,
        {
          kind: "tool",
          id: event.callId,
          name: event.name,
          input: event.input,
          risk: event.risk,
          status: "running",
        },
      ];
    case "approval_requested":
      return updateTool(entries, event.callId, (e) => ({
        ...e,
        input: event.input,
        status: "awaiting_approval",
      }));
    case "approval_resolved":
      return updateTool(entries, event.callId, (e) => ({
        ...e,
        status: event.approved ? "running" : "rejected",
      }));
    case "tool_result":
      return updateTool(entries, event.callId, (e) => ({
        ...e,
        status: event.ok ? "done" : e.status === "rejected" ? "rejected" : "failed",
        durationMs: event.durationMs,
        ...(event.ok ? { output: event.output } : { error: event.error }),
        ...(event.undoToken ? { undoToken: event.undoToken } : {}),
      }));
    case "error":
      return [
        ...settleAll(entries),
        {
          kind: "notice",
          id: `n${entries.length}`,
          tone: "error",
          text: event.message,
          code: event.code,
        },
      ];
    case "step_started":
      return entries;
    case "run_finished":
      return settleAll(entries);
  }
}

/** Fold a whole event list. */
export function timelineFromEvents(events: AgentEvent[]): TimelineEntry[] {
  return events.reduce(reduceTimeline, [] as TimelineEntry[]);
}
