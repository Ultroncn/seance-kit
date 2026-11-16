import { Button, SeanceProvider, SeanceTimeline, useT, type TimelineEntry } from "@seance/ui";
import { useState } from "react";
import { siteMessages } from "./messages";
import { useInView } from "./useInView";
import { usePlayback } from "./usePlayback";

type Demo = (typeof siteMessages)["en"]["demo"];
type Phase = "waiting" | "approved" | "rejected";

/** The run so far, in the reader's language. Derived on render, so switching language mid-demo works. */
/** Ticks of the opening: prompt, a search that runs then finishes, the reply typing out. */
const RUN_AT = 5;
const DONE_AT = 14;
const TYPE_AT = 16;
const CHARS = 3;
export const openingLength = (d: Demo) => TYPE_AT + Math.ceil(d.found.length / CHARS) + 3;

function entriesFor(phase: Phase, d: Demo, tick: number, replyTick: number): TimelineEntry[] {
  const banish: TimelineEntry = {
    kind: "tool",
    id: "b",
    name: "banish_conversation",
    input: { ids: ["chatgpt:01", "chatgpt:08"] },
    risk: "destructive",
    status: "awaiting_approval",
  };
  const start: TimelineEntry[] = [
    { kind: "user", id: "u", text: d.prompt },
    {
      kind: "tool",
      id: "s",
      name: "search_conversations",
      input: { query: "test", limit: 20 },
      risk: "read",
      status: "done",
      output: { total: 2 },
      durationMs: 12,
    },
    { kind: "message", id: "m", text: d.found },
  ];
  if (phase === "waiting") {
    if (tick < RUN_AT) return start.slice(0, 1);
    if (tick < DONE_AT) {
      const search = { ...(start[1] as Extract<TimelineEntry, { kind: "tool" }>) };
      return [
        start[0] as TimelineEntry,
        { ...search, status: "running", output: undefined, durationMs: undefined },
      ];
    }
    const shown = Math.max(0, (tick - TYPE_AT) * CHARS);
    if (shown < d.found.length)
      return [
        ...start.slice(0, 2),
        ...(tick >= TYPE_AT
          ? [{ kind: "message" as const, id: "m", text: d.found.slice(0, shown), streaming: true }]
          : []),
      ];
    return [...start, banish];
  }
  const reply = phase === "approved" ? d.approved : d.rejected;
  const typed = Math.min(reply.length, replyTick * CHARS);
  return [
    ...start,
    phase === "approved"
      ? {
          ...banish,
          status: "done",
          durationMs: 9,
          output: { undoToken: "demo" },
          undoToken: "demo",
        }
      : {
          ...banish,
          status: "rejected",
          durationMs: 900,
          error: { type: "Rejected", message: "The user rejected this action" },
        },
    { kind: "message", id: "r", text: reply.slice(0, typed), streaming: typed < reply.length },
  ];
}

/** A canned run of the real timeline component. No agent, no data: it shows the approval gate. */
export function TimelineDemo() {
  const d = useT(siteMessages).demo;
  const [phase, setPhase] = useState<Phase>("waiting");
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  // The play starts when the reader scrolls to it, and the answer types out after a decision.
  const [stage, inView] = useInView<HTMLDivElement>();
  const opening = usePlayback(inView, openingLength(d), 60);
  const answer = usePlayback(
    phase !== "waiting",
    Math.ceil(Math.max(d.approved.length, d.rejected.length) / CHARS) + 1,
    40,
  );
  const entries = entriesFor(phase, d, opening.tick, answer.tick);

  return (
    <SeanceProvider>
      <div
        ref={stage}
        className="relative min-h-[23rem] max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface/80 shadow-[0_30px_80px_-40px_black] backdrop-blur"
      >
        <SeanceTimeline
          entries={entries}
          onApprove={() => setPhase("approved")}
          onReject={() => setPhase("rejected")}
          onUndo={(t) => setUndone(new Set([t]))}
          undone={undone}
          autoFocusApprovals={false}
          toolLabels={{ banish_conversation: d.hide, search_conversations: d.search }}
          describeApproval={() => ({
            summary: d.summary,
            details: (
              <ul className="list-disc space-y-1 pl-5 text-fg">
                {d.rows.map((row) => (
                  <li key={row}>{row}</li>
                ))}
              </ul>
            ),
          })}
        />
        {phase !== "waiting" && (
          <div className="border-t border-line px-4 py-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPhase("waiting");
                setUndone(new Set());
                opening.restart();
              }}
            >
              {d.replay}
            </Button>
          </div>
        )}
      </div>
    </SeanceProvider>
  );
}
