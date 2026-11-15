/** Anything stored must have a string `id` and be JSON-serializable. */
export interface StoredItem {
  id: string;
  [key: string]: unknown;
}

export interface ListOptions {
  /** Skip this many items (after sorting by id). Default 0. */
  offset?: number;
  /** Return at most this many items. Default: all. */
  limit?: number;
}

/**
 * Local-first storage used by the agent core, tools and apps.
 *
 * Contract (checked by test/contract.ts for every adapter):
 * - Collections are named `[A-Za-z][A-Za-z0-9_-]*`. Ids are non-empty strings.
 * - Items are stored as JSON. `get` returns a deep copy that equals `JSON.parse(JSON.stringify(item))`.
 *   Mutating an item after `put`, or a value returned by `get`/`list`, never changes what is stored.
 * - `list` returns items sorted by id (UTF-16 code unit order), then applies offset and limit.
 * - `put` on an existing id replaces the item. `remove` on a missing id is a no-op.
 * - `wipe` removes every item in every collection.
 * - `remove` is a hard delete. Tools must soft-delete (set `banishedAt`) and never call it.
 */
export interface Storage {
  put<T extends StoredItem>(collection: string, item: T): Promise<void>;
  get<T extends StoredItem = StoredItem>(collection: string, id: string): Promise<T | undefined>;
  list<T extends StoredItem = StoredItem>(collection: string, opts?: ListOptions): Promise<T[]>;
  remove(collection: string, id: string): Promise<void>;
  /** All data as a JSON file: `{ version: 1, collections: { [name]: StoredItem[] } }`. */
  exportAll(): Promise<Blob>;
  wipe(): Promise<void>;
}

export interface ExportFile {
  version: 1;
  collections: Record<string, StoredItem[]>;
}
