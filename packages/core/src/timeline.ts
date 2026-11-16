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
  | { kind: "message"; id: string; text: string }
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

/** Fold one agent event into the timeline. Pure: returns a new array, never mutates. */
export function reduceTimeline(entries: TimelineEntry[], event: AgentEvent): TimelineEntry[] {
  switch (event.type) {
    case "run_started":
      return [...entries, { kind: "user", id: `${event.runId}:user`, text: event.prompt }];
    case "message":
      return [...entries, { kind: "message", id: `m${entries.length}`, text: event.text }];
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
        ...entries,
        {
          kind: "notice",
          id: `n${entries.length}`,
          tone: "error",
          text: event.message,
          code: event.code,
        },
      ];
    case "step_started":
    case "run_finished":
      return entries;
  }
}

/** Fold a whole event list. */
export function timelineFromEvents(events: AgentEvent[]): TimelineEntry[] {
  return events.reduce(reduceTimeline, [] as TimelineEntry[]);
}
