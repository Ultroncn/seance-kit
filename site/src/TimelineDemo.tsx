import { Button, SeanceProvider, SeanceTimeline, useT, type TimelineEntry } from "@seance/ui";
import { useState } from "react";
import { siteMessages } from "./messages";

type Demo = (typeof siteMessages)["en"]["demo"];
type Phase = "waiting" | "approved" | "rejected";

/** The run so far, in the reader's language. Derived on render, so switching language mid-demo works. */
function entriesFor(phase: Phase, d: Demo): TimelineEntry[] {
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
  if (phase === "waiting") return [...start, banish];
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
    { kind: "message", id: "r", text: phase === "approved" ? d.approved : d.rejected },
  ];
}

/** A canned run of the real timeline component. No agent, no data: it shows the approval gate. */
export function TimelineDemo() {
  const d = useT(siteMessages).demo;
  const [phase, setPhase] = useState<Phase>("waiting");
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  const entries = entriesFor(phase, d);

  return (
    <SeanceProvider>
      <div className="max-w-2xl overflow-hidden rounded-xl border border-line bg-surface">
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
              onClick={() => (setPhase("waiting"), setUndone(new Set()))}
            >
              {d.replay}
            </Button>
          </div>
        )}
      </div>
    </SeanceProvider>
  );
}
