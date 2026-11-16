// Node-only adapter. Imported through "@seance/storage/file" so browser bundles never see node:fs.
// Layout: <dir>/<collection>.json, each a JSON array of items sorted by id.
//
// Each collection is read once and kept in memory. Writes update memory at once and are saved
// to disk shortly after, many changes in one atomic write (temp file + rename). This keeps large
// imports linear instead of rewriting the whole file per item. Call `flush()` before exiting.
// One process should own a directory at a time; the MCP server takes a lock file for that.
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertCollection,
  assertId,
  cloneJson,
  compareIds,
  paginate,
  toExportBlob,
} from "./shared";
import type { ListOptions, Storage, StoredItem } from "./types";

let tmpCounter = 0;
const NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

export interface FileStorageOptions {
  /** How long changes wait in memory before they are written. Default 200 ms. */
  flushDelayMs?: number;
}

export class FileStorage implements Storage {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly cache = new Map<string, Map<string, StoredItem>>();
  private readonly dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly dir: string,
    private readonly options: FileStorageOptions = {},
  ) {}

  /** Run operations one at a time so read-modify-write cycles never interleave. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private file(collection: string): string {
    return join(this.dir, `${collection}.json`);
  }

  private async load(collection: string): Promise<Map<string, StoredItem>> {
    const cached = this.cache.get(collection);
    if (cached) return cached;
    let items: StoredItem[] = [];
    try {
      items = JSON.parse(await readFile(this.file(collection), "utf8")) as StoredItem[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const map = new Map(items.map((i) => [i.id, i]));
    this.cache.set(collection, map);
    return map;
  }

  private sorted(map: Map<string, StoredItem>): StoredItem[] {
    return [...map.values()].sort((a, b) => compareIds(a.id, b.id));
  }

  private markDirty(collection: string): void {
    this.dirty.add(collection);
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.flushDelayMs ?? 200);
    // A pending save must not keep a finished process alive. Callers flush before exit.
    this.timer.unref?.();
  }

  private async writeDirty(): Promise<void> {
    if (this.dirty.size === 0) return;
    await mkdir(this.dir, { recursive: true });
    for (const collection of [...this.dirty]) {
      this.dirty.delete(collection);
      const items = this.sorted(this.cache.get(collection) ?? new Map());
      if (items.length === 0) {
        await rm(this.file(collection), { force: true });
        continue;
      }
      const tmp = `${this.file(collection)}.tmp-${process.pid}-${tmpCounter++}`;
      await writeFile(tmp, JSON.stringify(items), "utf8");
      await rename(tmp, this.file(collection));
    }
  }

  /** Write pending changes to disk now. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    return this.serial(() => this.writeDirty());
  }

  async put<T extends StoredItem>(collection: string, item: T): Promise<void> {
    assertCollection(collection);
    assertId(item?.id);
    const stored = cloneJson(item);
    return this.serial(async () => {
      (await this.load(collection)).set(item.id, stored);
      this.markDirty(collection);
    });
  }

  async get<T extends StoredItem = StoredItem>(
    collection: string,
    id: string,
  ): Promise<T | undefined> {
    assertCollection(collection);
    assertId(id);
    return this.serial(async () => {
      const found = (await this.load(collection)).get(id);
      return found === undefined ? undefined : (cloneJson(found) as T);
    });
  }

  async list<T extends StoredItem = StoredItem>(
    collection: string,
    opts?: ListOptions,
  ): Promise<T[]> {
    assertCollection(collection);
    return this.serial(async () =>
      paginate(this.sorted(await this.load(collection)), opts).map((i) => cloneJson(i) as T),
    );
  }

  async remove(collection: string, id: string): Promise<void> {
    assertCollection(collection);
    assertId(id);
    return this.serial(async () => {
      if ((await this.load(collection)).delete(id)) this.markDirty(collection);
    });
  }

  exportAll(): Promise<Blob> {
    return this.serial(async () => {
      const out: Record<string, StoredItem[]> = {};
      const names = new Set([...(await this.collectionNames()), ...this.cache.keys()]);
      for (const name of [...names].sort(compareIds)) {
        const items = this.sorted(await this.load(name));
        if (items.length > 0) out[name] = items.map(cloneJson);
      }
      return toExportBlob(out);
    });
  }

  wipe(): Promise<void> {
    return this.serial(async () => {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = undefined;
      }
      for (const name of await this.collectionNames()) await rm(this.file(name), { force: true });
      this.cache.clear();
      this.dirty.clear();
    });
  }

  private async collectionNames(): Promise<string[]> {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -".json".length))
        .filter((n) => NAME_RE.test(n))
        .sort(compareIds);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}
