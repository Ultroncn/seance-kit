import type { NormalizedConversation } from "../domain/types";

export interface SkippedItem {
  /** Position in the export, or a file name inside a zip. */
  where: string;
  title?: string;
  reason: string;
}

export interface ImportResult {
  conversations: NormalizedConversation[];
  /** Items that could not be read. The rest of the file still imports. */
  skipped: SkippedItem[];
}

/** The whole file is unusable, for example it is not an export at all. */
export class ImportError extends Error {
  override name = "ImportError";
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
