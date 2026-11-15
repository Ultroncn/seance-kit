import {
  assertCollection,
  assertId,
  cloneJson,
  compareIds,
  paginate,
  toExportBlob,
} from "./shared";
import type { ListOptions, Storage, StoredItem } from "./types";

/** In-memory adapter for tests and ephemeral sessions. */
export class MemoryStorage implements Storage {
  private readonly data = new Map<string, Map<string, StoredItem>>();

  async put<T extends StoredItem>(collection: string, item: T): Promise<void> {
    assertCollection(collection);
    assertId(item?.id);
    const stored = cloneJson(item);
    let items = this.data.get(collection);
    if (!items) {
      items = new Map();
      this.data.set(collection, items);
    }
    items.set(item.id, stored);
  }

  async get<T extends StoredItem = StoredItem>(
    collection: string,
    id: string,
  ): Promise<T | undefined> {
    assertCollection(collection);
    assertId(id);
    const found = this.data.get(collection)?.get(id);
    return found === undefined ? undefined : (cloneJson(found) as T);
  }

  async list<T extends StoredItem = StoredItem>(
    collection: string,
    opts?: ListOptions,
  ): Promise<T[]> {
    assertCollection(collection);
    const items = [...(this.data.get(collection)?.values() ?? [])].sort((a, b) =>
      compareIds(a.id, b.id),
    );
    return paginate(items, opts).map((i) => cloneJson(i) as T);
  }

  async remove(collection: string, id: string): Promise<void> {
    assertCollection(collection);
    assertId(id);
    this.data.get(collection)?.delete(id);
  }

  async exportAll(): Promise<Blob> {
    const out: Record<string, StoredItem[]> = {};
    for (const [name, items] of this.data) {
      if (items.size === 0) continue;
      out[name] = [...items.values()].sort((a, b) => compareIds(a.id, b.id)).map(cloneJson);
    }
    return toExportBlob(out);
  }

  async wipe(): Promise<void> {
    this.data.clear();
  }
}
