import { SearchService } from "@seance/core";
import type { Storage, StoredItem } from "@seance/storage";

// Step 1 of making this app yours: describe your data.
export const NOTES = "notes";

export interface Note extends StoredItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  /** Bump on every write so the saved search index knows it is stale. */
  rev: number;
  banishedAt?: string;
}

/** What the tools need besides the core ToolContext. */
export interface NotebookDeps {
  search: SearchService;
}

export function createNotesSearch(storage: Storage, persistDebounceMs = 500): SearchService {
  return new SearchService({
    storage,
    name: NOTES,
    collection: NOTES,
    fields: ["title", "body"],
    revisionOf: (item) => String(item.rev ?? 0),
    persistDebounceMs,
  });
}
