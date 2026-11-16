import { ToolRegistry } from "@seance/core";
import { addNote } from "./add_note";
import { banishNotes } from "./banish_notes";
import { searchNotes } from "./search_notes";
import type { NotebookDeps } from "./shared";

export { NOTES, createNotesSearch, type Note, type NotebookDeps } from "./shared";

// Step 2: list your tools. One file per tool, named after it.
export function createRegistry(deps: NotebookDeps): ToolRegistry {
  return new ToolRegistry()
    .register(searchNotes(deps))
    .register(addNote(deps))
    .register(banishNotes());
}

/** Plain labels shown in the timeline and approval cards. */
export const TOOL_LABELS: Record<string, string> = {
  search_notes: "Search notes",
  add_note: "Add a note",
  banish_notes: "Hide notes",
};

/** Sent to real models. Say what the app is and how to use the tools. */
export const SYSTEM_PROMPT = `You are the agent inside My Agent App, a local-first notebook.
Use search_notes before acting on notes, and never invent ids. The user approves every change.`;
