import type { TimelineEntry } from "../src/index";

export const finishedRun: TimelineEntry[] = [
  { kind: "user", id: "u1", text: "Summarize my oldest chats" },
  {
    kind: "tool",
    id: "c1",
    name: "search_conversations",
    input: { query: "", sort: "oldest", limit: 3 },
    risk: "read",
    status: "done",
    output: { ids: ["a", "b", "c"] },
    durationMs: 42,
  },
  {
    kind: "tool",
    id: "c2",
    name: "banish_conversation",
    input: { id: "b" },
    risk: "destructive",
    status: "done",
    output: { undoToken: "undo-1" },
    durationMs: 8,
    undoToken: "undo-1",
  },
  {
    kind: "tool",
    id: "c3",
    name: "tag_conversation",
    input: { id: "a", tags: ["recipes"] },
    risk: "write",
    status: "rejected",
    error: { type: "Rejected", message: "The user rejected this action" },
    durationMs: 1200,
  },
  { kind: "message", id: "m1", text: "Here are your three oldest chats." },
];

export const pendingRun: TimelineEntry[] = [
  { kind: "user", id: "u1", text: "Clear out newsletters" },
  {
    kind: "tool",
    id: "c9",
    name: "banish_emails",
    input: { ids: ["e1", "e2"] },
    risk: "destructive",
    status: "awaiting_approval",
  },
];
