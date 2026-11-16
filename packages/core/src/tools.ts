import { z } from "zod";
import { undoBanish } from "./banish";
import { defineTool } from "./registry";

/**
 * Undo an earlier banish with the token it returned. Generic: the token records which collection
 * and items it covers. Apps register it so MCP clients, not only the browser's Undo button, can undo.
 */
export const undoBanishTool = () =>
  defineTool({
    name: "undo_banish",
    description:
      "Bring back the items an earlier banish hid, using the undoToken that banish returned.",
    risk: "write",
    input: z.object({ undoToken: z.string().min(1) }),
    output: z.object({ restored: z.array(z.string()), skipped: z.array(z.string()) }),
    run: ({ undoToken }, { storage }) => undoBanish(storage, undoToken),
  });
