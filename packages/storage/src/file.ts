// Node-only adapter. Imported through "@seance/storage/file" so browser bundles never see node:fs.
// Layout: <dir>/<collection>.json, each a JSON array of items sorted by id.
// Writes in one process are serialized and atomic (temp file + rename). It does not coordinate
// between processes, so run one writer per directory.
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

export class FileStorage implements Storage {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dir: string) {}

  /** Run operations one at a time so read-modify-write cycles never interleave. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private file(collection: string): string {
    return join(this.dir, `${collection}.json`);
  }

  private async read(collection: string): Promise<StoredItem[]> {
    try {
      return JSON.parse(await readFile(this.file(collection), "utf8")) as StoredItem[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async write(collection: string, items: StoredItem[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    if (items.length === 0) {
      await rm(this.file(collection), { force: true });
      return;
    }
    const tmp = `${this.file(collection)}.tmp-${process.pid}-${tmpCounter++}`;
    await writeFile(tmp, JSON.stringify(items), "utf8");
    await rename(tmp, this.file(collection));
  }

  async put<T extends StoredItem>(collection: string, item: T): Promise<void> {
    assertCollection(collection);
    assertId(item?.id);
    const stored = cloneJson(item);
    return this.serial(async () => {
      const items = (await this.read(collection)).filter((i) => i.id !== item.id);
      items.push(stored);
      items.sort((a, b) => compareIds(a.id, b.id));
      await this.write(collection, items);
    });
  }

  async get<T extends StoredItem = StoredItem>(
    collection: string,
    id: string,
  ): Promise<T | undefined> {
    assertCollection(collection);
    assertId(id);
    return this.serial(async () => {
      const found = (await this.read(collection)).find((i) => i.id === id);
      return found === undefined ? undefined : (found as T);
    });
  }

  async list<T extends StoredItem = StoredItem>(
    collection: string,
    opts?: ListOptions,
  ): Promise<T[]> {
    assertCollection(collection);
    return this.serial(async () => {
      const items = (await this.read(collection)).sort((a, b) => compareIds(a.id, b.id));
      return paginate(items, opts) as T[];
    });
  }

  async remove(collection: string, id: string): Promise<void> {
    assertCollection(collection);
    assertId(id);
    return this.serial(async () => {
      const items = await this.read(collection);
      const next = items.filter((i) => i.id !== id);
      if (next.length !== items.length) await this.write(collection, next);
    });
  }

  exportAll(): Promise<Blob> {
    return this.serial(async () => {
      const out: Record<string, StoredItem[]> = {};
      for (const name of await this.collectionNames()) {
        const items = await this.read(name);
        if (items.length > 0) out[name] = items.sort((a, b) => compareIds(a.id, b.id));
      }
      return toExportBlob(out);
    });
  }

  wipe(): Promise<void> {
    return this.serial(async () => {
      for (const name of await this.collectionNames()) {
        await rm(this.file(name), { force: true });
      }
    });
  }

  private async collectionNames(): Promise<string[]> {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -".json".length))
        .filter((n) => /^[A-Za-z][A-Za-z0-9_-]*$/.test(n))
        .sort(compareIds);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}
