import Dexie, { type Table } from "dexie";
import {
  assertCollection,
  assertId,
  cloneJson,
  compareIds,
  paginate,
  toExportBlob,
} from "./shared";
import type { ListOptions, Storage, StoredItem } from "./types";

interface Row {
  collection: string;
  id: string;
  data: StoredItem;
}

class SeanceDb extends Dexie {
  items!: Table<Row, [string, string]>;

  constructor(name: string, options?: ConstructorParameters<typeof Dexie>[1]) {
    super(name, options);
    // One table for every collection. The compound key keeps per-collection ranges sorted by id.
    this.version(1).stores({ items: "[collection+id], collection" });
  }
}

export interface IndexedDbStorageOptions {
  /** IndexedDB database name. Default "seance". */
  name?: string;
  /** Inject an IndexedDB implementation (tests use fake-indexeddb). */
  indexedDB?: IDBFactory;
  IDBKeyRange?: typeof IDBKeyRange;
}

/** Browser adapter backed by IndexedDB through Dexie. */
export class IndexedDbStorage implements Storage {
  private readonly db: SeanceDb;

  constructor(options: IndexedDbStorageOptions = {}) {
    const { name = "seance", indexedDB, IDBKeyRange } = options;
    this.db = new SeanceDb(name, indexedDB && IDBKeyRange ? { indexedDB, IDBKeyRange } : undefined);
  }

  /** Close the connection. Mostly for tests. */
  close(): void {
    this.db.close();
  }

  async put<T extends StoredItem>(collection: string, item: T): Promise<void> {
    assertCollection(collection);
    assertId(item?.id);
    await this.db.items.put({ collection, id: item.id, data: cloneJson(item) });
  }

  async get<T extends StoredItem = StoredItem>(
    collection: string,
    id: string,
  ): Promise<T | undefined> {
    assertCollection(collection);
    assertId(id);
    const row = await this.db.items.get([collection, id]);
    return row ? (cloneJson(row.data) as T) : undefined;
  }

  async list<T extends StoredItem = StoredItem>(
    collection: string,
    opts?: ListOptions,
  ): Promise<T[]> {
    assertCollection(collection);
    const rows = await this.db.items
      .where("[collection+id]")
      .between([collection, Dexie.minKey], [collection, Dexie.maxKey])
      .toArray();
    // IndexedDB already sorts by key. Sorting again keeps the contract independent of that detail.
    rows.sort((a, b) => compareIds(a.id, b.id));
    return paginate(rows, opts).map((r) => cloneJson(r.data) as T);
  }

  async remove(collection: string, id: string): Promise<void> {
    assertCollection(collection);
    assertId(id);
    await this.db.items.delete([collection, id]);
  }

  async exportAll(): Promise<Blob> {
    const rows = await this.db.items.toArray();
    rows.sort((a, b) => compareIds(a.collection, b.collection) || compareIds(a.id, b.id));
    const out: Record<string, StoredItem[]> = {};
    for (const row of rows) (out[row.collection] ??= []).push(cloneJson(row.data));
    return toExportBlob(out);
  }

  async wipe(): Promise<void> {
    await this.db.items.clear();
  }
}
