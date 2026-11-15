import type { ExportFile, ListOptions, StoredItem } from "./types";

const COLLECTION_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function assertCollection(collection: string): void {
  if (typeof collection !== "string" || !COLLECTION_RE.test(collection)) {
    throw new TypeError(`Invalid collection name: ${JSON.stringify(collection)}`);
  }
}

export function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Item id must be a non-empty string");
  }
}

/** Deep copy through JSON. This is the storage contract's definition of "stored value". */
export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Sort order shared by every adapter: UTF-16 code units, like IndexedDB keys. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function paginate<T>(sorted: T[], opts: ListOptions = {}): T[] {
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const end = opts.limit === undefined ? undefined : offset + Math.max(0, Math.floor(opts.limit));
  return sorted.slice(offset, end);
}

export function toExportBlob(collections: Record<string, StoredItem[]>): Blob {
  const file: ExportFile = { version: 1, collections };
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}
