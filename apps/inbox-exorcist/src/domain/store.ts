import { SearchService } from "@seance/core";
import type { Storage } from "@seance/storage";
import { MailboxTally, emailId } from "./normalize";
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
 *
 * Each call is one file, so one mailbox. Mail keeps its Delivered-To address as its mailbox; mail
 * without one (sent mail, some exports) gets the file's main address once the file is read, and so
 * do stored copies imported before mailboxes existed.
 */
export async function importEmails(
  storage: Storage,
  search: SearchService,
  emails: Iterable<NormalizedEmail> | AsyncIterable<NormalizedEmail>,
  onStored?: (counts: ImportCounts) => void,
): Promise<ImportCounts> {
  const counts: ImportCounts = { added: 0, duplicates: 0 };
  const tally = new MailboxTally();
  const unassigned: string[] = [];
  let n = 0;
  for await (const e of emails) {
    const id = emailId(e);
    tally.add(e);
    const existing = await getEmail(storage, id);
    if (existing) {
      counts.duplicates++;
      if (!existing.mailbox) unassigned.push(id);
    } else {
      const stored: Email = {
        ...e,
        id,
        rev: 1,
        labels: [],
        ...(e.deliveredTo ? { mailbox: e.deliveredTo } : {}),
      };
      await storage.put(EMAILS, stored);
      search.index(stored);
      counts.added++;
      if (!e.deliveredTo) unassigned.push(id);
    }
    if (++n % 50 === 0) {
      onStored?.({ ...counts });
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const mailbox = tally.best;
  if (mailbox) {
    for (const id of unassigned) {
      // Read again: the agent may have labelled or banished it while the file was importing.
      const fresh = await getEmail(storage, id);
      if (fresh && !fresh.mailbox) await storage.put(EMAILS, { ...fresh, mailbox });
    }
  }
  onStored?.({ ...counts });
  return counts;
}
