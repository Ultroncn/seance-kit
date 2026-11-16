import { SearchService } from "@seance/core";
import type { Storage } from "@seance/storage";
import { emailId } from "./normalize";
import { EMAILS, type Address, type Email, type NormalizedEmail } from "./types";

const who = (a: unknown) => {
  const x = (a ?? {}) as Partial<Address>;
  return `${x.name ?? ""} ${x.address ?? ""}`;
};

/** Full-text index over emails: subject, body, sender, recipients, labels and category. */
export function createInboxSearch(storage: Storage, persistDebounceMs = 500): SearchService {
  return new SearchService({
    storage,
    name: "emails",
    collection: EMAILS,
    fields: ["subject", "text", "from", "to", "labels", "category"],
    revisionOf: (item) => String(item.rev ?? 0),
    schemaVersion: 1,
    persistDebounceMs,
    extract: (item, field) => {
      const v = item[field];
      if (field === "from") return who(v);
      if (field === "to") return Array.isArray(v) ? v.map(who).join(" ") : "";
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").join(" ");
      return "";
    },
  });
}

export async function getEmail(storage: Storage, id: string): Promise<Email | undefined> {
  return storage.get<Email>(EMAILS, id);
}

/** Write a changed email and keep the search index in step. Bumps `rev`. */
export async function saveEmail(storage: Storage, search: SearchService, e: Email): Promise<Email> {
  const next = { ...e, rev: e.rev + 1 };
  await storage.put(EMAILS, next);
  search.index(next);
  return next;
}

export interface ImportCounts {
  added: number;
  /** Already in the inbox (same Message-ID, or same content without one). */
  duplicates: number;
}

/**
 * Store imported emails. A message is identified by its Message-ID, or by a content hash when it
 * has none, so importing the same file again adds nothing (P3). Mail content never changes after
 * import, so a duplicate keeps the stored copy with its labels, category and banished state.
 */
export async function importEmails(
  storage: Storage,
  search: SearchService,
  emails: Iterable<NormalizedEmail> | AsyncIterable<NormalizedEmail>,
  onStored?: (counts: ImportCounts) => void,
): Promise<ImportCounts> {
  const counts: ImportCounts = { added: 0, duplicates: 0 };
  let n = 0;
  for await (const e of emails) {
    const id = emailId(e);
    if (await getEmail(storage, id)) {
      counts.duplicates++;
    } else {
      const stored: Email = { ...e, id, rev: 1, labels: [] };
      await storage.put(EMAILS, stored);
      search.index(stored);
      counts.added++;
    }
    if (++n % 50 === 0) {
      onStored?.({ ...counts });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onStored?.({ ...counts });
  return counts;
}
