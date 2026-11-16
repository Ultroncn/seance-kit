import { defineTool } from "@seance/core";
import { z } from "zod";
import { NOTES, type Note, type NotebookDeps } from "./shared";

// A write tool. Anything that is not "read" waits for the user's Allow before it runs.
export const addNote = ({ search }: NotebookDeps) =>
  defineTool({
    name: "add_note",
    description: "Save a new note.",
    risk: "write",
    input: z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().max(5000).default(""),
    }),
    output: z.object({ id: z.string(), title: z.string() }),
    async run({ title, body }, { storage, now }) {
      const at = now();
      const note: Note = {
        id: `note-${at.getTime()}`,
        title,
        body,
        createdAt: at.toISOString(),
        rev: 1,
      };
      await storage.put(NOTES, note);
      search.index(note);
      return { id: note.id, title };
    },
  });
