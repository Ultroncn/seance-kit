import type { Storage, StoredItem } from "@seance/storage";

/** Collection that records every banish batch so it can be undone. */
export const BANISH_LOG = "banish_log";

interface BanishRecord extends StoredItem {
  collection: string;
  itemIds: string[];
  at: string;
}

export interface BanishResult {
  undoToken: string;
  banished: string[];
  /** Ids that were not found or were already banished. */
  skipped: string[];
}

/** An item is banished when it carries a `banishedAt` timestamp. */
export function isBanished(item: StoredItem): boolean {
  return typeof item.banishedAt === "string";
}

/** Items that have not been banished. Search and list views use this by default. */
export async function listActive<T extends StoredItem>(
  storage: Storage,
  collection: string,
): Promise<T[]> {
  return (await storage.list<T>(collection)).filter((i) => !isBanished(i));
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `undo-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Soft delete. Marks items with `banishedAt` and `banishToken`, never removes them.
 * The returned token restores exactly this batch through `undoBanish`.
 */
export async function banishItems(
  storage: Storage,
  collection: string,
  ids: string[],
  now: Date,
): Promise<BanishResult> {
  const undoToken = newToken();
  const targets: StoredItem[] = [];
  const skipped: string[] = [];
  for (const id of new Set(ids)) {
    const item = await storage.get(collection, id);
    if (!item || isBanished(item)) skipped.push(id);
    else targets.push(item);
  }
  const banished = targets.map((t) => t.id);
  if (banished.length > 0) {
    // Record the batch first: if a write fails halfway, undo still restores what was hidden.
    const record: BanishRecord = {
      id: undoToken,
      collection,
      itemIds: banished,
      at: now.toISOString(),
    };
    await storage.put(BANISH_LOG, record);
  }
  for (const item of targets) {
    await storage.put(collection, {
      ...item,
      banishedAt: now.toISOString(),
      banishToken: undoToken,
    });
  }
  return { undoToken, banished, skipped };
}

export interface UndoResult {
  restored: string[];
  /** Items that changed, were removed, or were banished again by a later batch. */
  skipped: string[];
}

/**
 * Undo one banish batch. Only items still banished under this token are restored, so later
 * edits and later banish batches are left alone. Undoing the same token twice restores nothing.
 */
export async function undoBanish(storage: Storage, undoToken: string): Promise<UndoResult> {
  const record = await storage.get<BanishRecord>(BANISH_LOG, undoToken);
  if (!record) return { restored: [], skipped: [] };
  const restored: string[] = [];
  const skipped: string[] = [];
  for (const id of record.itemIds) {
    const item = await storage.get(record.collection, id);
    if (!item || item.banishToken !== undoToken) {
      skipped.push(id);
      continue;
    }
    const { banishedAt: _a, banishToken: _t, ...rest } = item;
    await storage.put(record.collection, rest as StoredItem);
    restored.push(id);
  }
  await storage.remove(BANISH_LOG, undoToken);
  return { restored, skipped };
}

/**
 * Restore individual items, whatever batch banished them. Used by a "Banished" view. Items that
 * are missing or not banished are skipped. Batch records stay, and a later undo of that batch
 * simply finds nothing left to restore for these items.
 */
export async function restoreItems(
  storage: Storage,
  collection: string,
  ids: string[],
): Promise<UndoResult> {
  const restored: string[] = [];
  const skipped: string[] = [];
  for (const id of new Set(ids)) {
    const item = await storage.get(collection, id);
    if (!item || !isBanished(item)) {
      skipped.push(id);
      continue;
    }
    const { banishedAt: _a, banishToken: _t, ...rest } = item;
    await storage.put(collection, rest as StoredItem);
    restored.push(id);
  }
  return { restored, skipped };
}
