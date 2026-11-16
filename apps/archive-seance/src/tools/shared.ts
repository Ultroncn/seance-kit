import type { SearchService } from "@seance/core";
import type { Storage } from "@seance/storage";
import { getConversation } from "../domain/store";
import type { Conversation } from "../domain/types";

/** What the archive tools need beyond the core ToolContext. */
export interface ArchiveDeps {
  search: SearchService;
}

export async function requireConversation(storage: Storage, id: string): Promise<Conversation> {
  const c = await getConversation(storage, id);
  if (!c) throw new Error(`No conversation with id "${id}". Use search_conversations to find ids.`);
  return c;
}

/** Lower-case, hyphenated, letters and digits only. "Baking Ideas!" → "baking-ideas". */
export function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** A short excerpt around the first query word, or the start of the chat. */
export function snippetFor(c: Conversation, query: string, max = 180): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const m of c.messages) {
    const lower = m.text.toLowerCase();
    const at = terms
      .map((t) => lower.indexOf(t))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    if (at !== undefined) {
      const start = Math.max(0, at - 60);
      return (start > 0 ? "…" : "") + clip(m.text.slice(start).replace(/\s+/g, " "), max);
    }
  }
  return clip((c.summary ?? c.messages[0]?.text ?? "").replace(/\s+/g, " "), max);
}

export const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
