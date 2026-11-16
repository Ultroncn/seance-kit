import type { TimelineEntry } from "@seance/ui";

/** A scripted run for the gallery. Real apps get entries from `reduceTimeline` in core. */
export const galleryRun: TimelineEntry[] = [
  { kind: "user", id: "u1", text: "Find my oldest chats about sourdough and tag them." },
  {
    kind: "thinking",
    id: "th1",
    text: "Search for sourdough, oldest first. Read the first hit before summarizing, then tag it so it is easy to find again.",
    durationMs: 2400,
  },
  {
    kind: "tool",
    id: "c1",
    name: "search_conversations",
    input: { query: "sourdough", sort: "oldest", limit: 3 },
    risk: "read",
    status: "done",
    output: { hits: [{ id: "chat-2019-04", title: "Starter keeps dying" }] },
    durationMs: 38,
  },
  {
    kind: "tool",
    id: "c2",
    name: "summarize_conversation",
    input: { id: "chat-2019-04" },
    risk: "write",
    status: "done",
    output: { summary: "Troubleshooting a starter: feeding ratio, warmer spot, rye flour." },
    durationMs: 1840,
  },
  { kind: "message", id: "m1", text: "I found one from April 2019. Tagging it next." },
  {
    kind: "tool",
    id: "c3",
    name: "tag_conversation",
    input: { id: "chat-2019-04", tags: ["baking", "sourdough"] },
    risk: "write",
    status: "awaiting_approval",
  },
];

export const banishStep: TimelineEntry = {
  kind: "tool",
  id: "c4",
  name: "banish_conversation",
  input: { ids: ["chat-2018-11", "chat-2018-12"] },
  risk: "destructive",
  status: "awaiting_approval",
};

export const banishTitles = ["Untitled chat (Nov 2018)", "Test test 123 (Dec 2018)"];
