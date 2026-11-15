import { assertCollection, assertId, cloneJson } from "./shared";
import type { ExportFile, Storage, StoredItem } from "./types";

/** Parse and validate the text of an export file. Throws a readable Error if it is not one. */
export function parseExportFile(text: string): ExportFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not a Séance Kit export: the file is not valid JSON");
  }
  if (typeof data !== "object" || data === null || (data as ExportFile).version !== 1) {
    throw new Error("Not a Séance Kit export: unsupported or missing version");
  }
  const collections = (data as ExportFile).collections;
  if (typeof collections !== "object" || collections === null || Array.isArray(collections)) {
    throw new Error("Not a Séance Kit export: missing collections");
  }
  for (const [name, items] of Object.entries(collections)) {
    assertCollection(name);
    if (!Array.isArray(items)) throw new Error(`Export collection "${name}" is not a list`);
    for (const item of items) assertId((item as StoredItem | null)?.id);
  }
  return data as ExportFile;
}

/**
 * Load an export file into storage. Items with the same id are replaced, other data is kept.
 * Call `storage.wipe()` first for an exact restore. Returns how many items were written.
 */
export async function importExportFile(storage: Storage, file: ExportFile): Promise<number> {
  let count = 0;
  for (const [collection, items] of Object.entries(file.collections)) {
    for (const item of items) {
      await storage.put(collection, cloneJson(item));
      count++;
    }
  }
  return count;
}
