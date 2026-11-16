import { SearchService } from "@seance/core";
import type { Storage } from "@seance/storage";
import {
  CONVERSATIONS,
  conversationId,
  type Conversation,
  type NormalizedConversation,
} from "./types";

/** The full-text index over conversations: title, messages, summary and tags. */
export function createArchiveSearch(storage: Storage, persistDebounceMs = 500): SearchService {
  return new SearchService({
    storage,
    name: "conversations",
    collection: CONVERSATIONS,
    fields: ["title", "text", "summary", "tags"],
    revisionOf: (item) => String(item.rev ?? 0),
    schemaVersion: 1,
    persistDebounceMs,
    extract: (item, field) => {
      if (field === "text") {
        const messages = Array.isArray(item.messages)
          ? (item.messages as { text?: unknown }[])
          : [];
        return messages.map((m) => (typeof m.text === "string" ? m.text : "")).join("\n");
      }
      const v = item[field];
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").join(" ");
      return "";
    },
  });
}

/** Write a changed conversation and keep the search index in step. Bumps `rev`. */
export async function saveConversation(
  storage: Storage,
  search: SearchService,
  c: Conversation,
): Promise<Conversation> {
  const next = { ...c, rev: c.rev + 1 };
  await storage.put(CONVERSATIONS, next);
  search.index(next);
  return next;
}

export async function getConversation(
  storage: Storage,
  id: string,
): Promise<Conversation | undefined> {
  return storage.get<Conversation>(CONVERSATIONS, id);
}

export interface ImportCounts {
  added: number;
  updated: number;
  unchanged: number;
}

const contentKey = (c: NormalizedConversation) =>
  JSON.stringify([c.title, c.createdAt, c.updatedAt, c.messages]);

/**
 * Store imported conversations. A chat is identified by source and source id, so importing the
 * same file again changes nothing (property P3). A newer export of the same chat replaces its
 * content but keeps the user's tags, summary and banished state.
 */
export async function importConversations(
  storage: Storage,
  search: SearchService,
  items: NormalizedConversation[],
  onProgress?: (done: number, total: number) => void,
): Promise<ImportCounts> {
  const counts: ImportCounts = { added: 0, updated: 0, unchanged: 0 };
  for (const [i, n] of items.entries()) {
    const id = conversationId(n.source, n.sourceId);
    const existing = await getConversation(storage, id);
    if (!existing) {
      const c: Conversation = { ...n, id, rev: 1, tags: [] };
      await storage.put(CONVERSATIONS, c);
      search.index(c);
      counts.added++;
    } else if (contentKey(existing) !== contentKey(n)) {
      await saveConversation(storage, search, { ...existing, ...n, id });
      counts.updated++;
    } else {
      counts.unchanged++;
    }
    if ((i + 1) % 25 === 0 || i === items.length - 1) {
      onProgress?.(i + 1, items.length);
      // Let the page paint between batches on big imports.
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return counts;
}
