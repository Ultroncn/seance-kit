import type { Storage, StoredItem } from "@seance/storage";
import MiniSearch from "minisearch";
import { isBanished } from "./banish";

/** Collection that holds persisted search indexes, one record per index name. */
export const SEARCH_INDEX_COLLECTION = "searchIndex";

// 2: terms are lower-cased and accents are folded ("café" matches "cafe").
// 3: also folds ß, ø, ł, æ, œ and ligatures. Older saved indexes are rebuilt.
const INDEX_FORMAT = 3;

/** Lower-case and strip accents, at index time and at query time. */
/** Letters that are not "base letter + accent", so stripping marks does not reach them. */
const SPECIAL: Record<string, string> = {
  ß: "ss",
  ẞ: "ss",
  ø: "o",
  Ø: "o",
  ł: "l",
  Ł: "l",
  æ: "ae",
  Æ: "ae",
  œ: "oe",
  Œ: "oe",
  đ: "d",
  Đ: "d",
  þ: "th",
  Þ: "th",
  ı: "i",
};

export function foldTerm(term: string): string {
  // NFKD also splits ligatures such as "ﬁ" into "fi".
  return term
    .replace(/[ßẞøØłŁæÆœŒđĐþÞı]/g, (c) => SPECIAL[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export interface SearchServiceOptions {
  storage: Storage;
  /** Index name. Used as the record id in the `searchIndex` collection. */
  name: string;
  /** Collection whose items are indexed. */
  collection: string;
  /** Item fields to index. String and string[] values are indexed, other values are ignored. */
  fields: string[];
  /**
   * A string that changes whenever an item's searchable content changes. The default is
   * `updatedAt`, so writers must set `updatedAt` on every change. A persisted index is reused
   * only when every item's revision still matches, otherwise it is rebuilt.
   */
  revisionOf?: (item: StoredItem) => string;
  /** Delay before changes are saved to storage. 0 disables automatic saving. Default 500. */
  persistDebounceMs?: number;
  /**
   * Text to index for one field of an item. Default: the field's string or string[] value.
   * Use it for derived text, for example the joined messages of a conversation.
   */
  extract?: (item: Record<string, unknown>, field: string) => string;
  /** Bump when `extract` changes meaning, so saved indexes built the old way are rebuilt. */
  schemaVersion?: number;
}

export interface SearchOptions {
  limit?: number;
  /** Include banished items. Default false. */
  includeBanished?: boolean;
  /** Match word beginnings, as in type-ahead. Default true. */
  prefix?: boolean;
  /** Typo tolerance from 0 (exact) to 1. Default 0.2. */
  fuzzy?: number;
}

export interface SearchHit {
  id: string;
  score: number;
  /** Indexed words that matched. */
  terms: string[];
}

interface PersistedIndex extends StoredItem {
  format: number;
  schemaVersion?: number;
  fields: string[];
  signature: string;
  index: unknown;
}

function extractField(doc: Record<string, unknown>, field: string): string {
  const v = doc[field];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").join(" ");
  return "";
}

/** FNV-1a over a string. Not cryptographic. It only detects that the indexed data changed. */
function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Full-text search over one collection, backed by MiniSearch. The index lives in memory and is
 * saved to storage so a reload does not have to re-read every item.
 */
export class SearchService {
  private mini: MiniSearch;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private readonly revisionOf: (item: StoredItem) => string;
  private readonly extractField: (doc: Record<string, unknown>, field: string) => string;

  constructor(private readonly options: SearchServiceOptions) {
    this.revisionOf = options.revisionOf ?? ((i) => String(i.updatedAt ?? ""));
    // MiniSearch also extracts the id field through this function. Never let a custom extract see it.
    const custom = options.extract;
    this.extractField = custom
      ? (doc, field) => (field === "id" ? String(doc.id) : custom(doc, field))
      : extractField;
    this.mini = this.createIndex();
  }

  private createIndex(): MiniSearch {
    return new MiniSearch({
      fields: this.options.fields,
      idField: "id",
      extractField: this.extractField,
      processTerm: foldTerm,
    });
  }

  get size(): number {
    return this.mini.documentCount;
  }

  /** Restore the saved index when it still matches storage, otherwise rebuild it. */
  async load(): Promise<"restored" | "rebuilt"> {
    const { storage, name, collection } = this.options;
    const items = await storage.list(collection);
    const signature = this.signatureOf(items);
    const saved = await storage.get<PersistedIndex>(SEARCH_INDEX_COLLECTION, name);
    if (
      saved &&
      saved.format === INDEX_FORMAT &&
      saved.signature === signature &&
      (saved.schemaVersion ?? 0) === (this.options.schemaVersion ?? 0) &&
      JSON.stringify(saved.fields) === JSON.stringify(this.options.fields)
    ) {
      try {
        this.mini = MiniSearch.loadJS(saved.index as Parameters<typeof MiniSearch.loadJS>[0], {
          fields: this.options.fields,
          idField: "id",
          extractField: this.extractField,
          processTerm: foldTerm,
        });
        return "restored";
      } catch {
        // A damaged saved index is not fatal. Fall through to a rebuild.
      }
    }
    this.buildFrom(items);
    await this.persistNow(signature);
    return "rebuilt";
  }

  /** Drop the in-memory index and rebuild it from storage. */
  async rebuild(): Promise<void> {
    const items = await this.options.storage.list(this.options.collection);
    this.buildFrom(items);
    await this.persistNow(this.signatureOf(items));
  }

  private buildFrom(items: StoredItem[]): void {
    this.mini = this.createIndex();
    this.mini.addAll(items);
  }

  private signatureOf(items: StoredItem[]): string {
    // Items arrive sorted by id, so the signature is stable. Two hashes cut collision odds.
    let a = 0;
    let b = 0;
    for (const item of items) {
      const part = `${item.id}\u0000${this.revisionOf(item)}\u0001`;
      a = fnv1a(part, a || 0x811c9dc5);
      b = fnv1a(part, (b || 0x01234567) ^ 0x9e3779b9);
    }
    return `${items.length}:${a.toString(16)}:${b.toString(16)}`;
  }

  /** Add an item or replace its earlier version. Call after every write to the item. */
  index(item: StoredItem): void {
    if (this.mini.has(item.id)) this.mini.replace(item);
    else this.mini.add(item);
    this.schedulePersist();
  }

  /** Remove an item from the index. Banishing does not need this: search filters banished items. */
  unindex(id: string): void {
    if (this.mini.has(id)) this.mini.discard(id);
    this.schedulePersist();
  }

  /**
   * Search the index. Banished items are left out unless `includeBanished` is set. The banished
   * check reads current storage, so it is right even when another process changed the data.
   */
  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    const { limit = 50, includeBanished = false, prefix = true, fuzzy = 0.2 } = opts;
    if (limit <= 0 || query.trim() === "") return [];
    const raw = this.mini.search(query, {
      prefix,
      // Typos are tolerated in words, never in numbers or codes: "LX4821" must not find "LX4831".
      fuzzy: (term: string) => (fuzzy > 0 && !/\d/.test(term) ? fuzzy : false),
      combineWith: "AND",
    });
    const hits: SearchHit[] = [];
    for (const r of raw) {
      if (hits.length >= limit) break;
      const id = String(r.id);
      if (!includeBanished) {
        const item = await this.options.storage.get(this.options.collection, id);
        if (!item || isBanished(item)) continue;
      }
      hits.push({ id, score: r.score, terms: r.terms });
    }
    return hits;
  }

  /** Save any pending changes now. Call before the page unloads and in tests. */
  async flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.dirty) return;
    const items = await this.options.storage.list(this.options.collection);
    await this.persistNow(this.signatureOf(items));
  }

  private schedulePersist(): void {
    this.dirty = true;
    const delay = this.options.persistDebounceMs ?? 500;
    if (delay <= 0) return;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  private saving: Promise<unknown> = Promise.resolve();

  /** Saves run one after another, so an older snapshot can never land after a newer one. */
  private persistNow(signature: string): Promise<void> {
    const run = this.saving.then(() => this.persistOnce(signature));
    this.saving = run.catch(() => undefined);
    return run;
  }

  private async persistOnce(signature: string): Promise<void> {
    const record: PersistedIndex = {
      id: this.options.name,
      format: INDEX_FORMAT,
      schemaVersion: this.options.schemaVersion ?? 0,
      fields: this.options.fields,
      signature,
      index: this.mini.toJSON(),
    };
    await this.options.storage.put(SEARCH_INDEX_COLLECTION, record);
    this.dirty = false;
  }
}
