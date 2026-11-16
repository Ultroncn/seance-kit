import { Button, SeanceProvider, SeanceTimeline, type TimelineEntry } from "@seance/ui";
import { useState } from "react";

const START: TimelineEntry[] = [
  { kind: "user", id: "u", text: "Banish my empty test chats" },
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
  {
    kind: "message",
    id: "m",
    text: "These look like empty test chats: “Untitled chat” and “test test 123”.",
  },
  {
    kind: "tool",
    id: "b",
    name: "banish_conversation",
    input: { ids: ["chatgpt:01", "chatgpt:08"] },
    risk: "destructive",
    status: "awaiting_approval",
  },
];

/** A canned run of the real timeline component. No agent, no data: it shows the approval gate. */
export function TimelineDemo() {
  const [entries, setEntries] = useState(START);
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  const settle = (approved: boolean) =>
    setEntries((all) => [
      ...all.map((e): TimelineEntry =>
        e.kind === "tool" && e.id === "b"
          ? approved
            ? {
                ...e,
                status: "done",
                durationMs: 9,
                output: { undoToken: "demo" },
                undoToken: "demo",
              }
            : {
                ...e,
                status: "rejected",
                durationMs: 900,
                error: { type: "Rejected", message: "The user rejected this action" },
              }
          : e,
      ),
      {
        kind: "message",
        id: "r",
        text: approved
          ? "Banished both. Nothing was deleted: undo it here."
          : "Okay, I left them where they are.",
      },
    ]);

  return (
    <SeanceProvider>
      <div className="max-w-2xl overflow-hidden rounded-xl border border-line bg-surface">
        <SeanceTimeline
          entries={entries}
          onApprove={() => settle(true)}
          onReject={() => settle(false)}
          onUndo={(t) => setUndone(new Set([t]))}
          undone={undone}
          autoFocusApprovals={false}
          toolLabels={{ banish_conversation: "Hide chats", search_conversations: "Search chats" }}
          describeApproval={() => ({
            summary: "Hide 2 chats. Nothing is deleted, and you can undo it.",
            details: (
              <ul className="list-disc space-y-1 pl-5 text-fg">
                <li>Untitled chat (Nov 2019, 2 messages)</li>
                <li>test test 123 (May 2024, 2 messages)</li>
              </ul>
            ),
          })}
        />
        {entries.length > START.length && (
          <div className="border-t border-line px-4 py-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => (setEntries(START), setUndone(new Set()))}
            >
              Replay
            </Button>
          </div>
        )}
      </div>
    </SeanceProvider>
  );
}
