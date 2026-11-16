/**
 * Props shape for the séance timeline. It mirrors `TimelineEntry` in `@seance/core`
 * (`reduceTimeline` output) on purpose, because ui never imports core. Keep them identical.
 */
export type StepRisk = "read" | "write" | "destructive";
export type ToolStepStatus = "running" | "awaiting_approval" | "rejected" | "done" | "failed";

export type TimelineEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "message"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      input: unknown;
      risk: StepRisk | null;
      status: ToolStepStatus;
      output?: unknown;
      error?: { type: string; message: string };
      durationMs?: number;
      undoToken?: string;
    }
  | { kind: "notice"; id: string; tone: "error" | "info"; text: string; code?: string };

export type ToolEntry = Extract<TimelineEntry, { kind: "tool" }>;
