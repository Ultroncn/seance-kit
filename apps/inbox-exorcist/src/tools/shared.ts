import type { SearchService } from "@seance/core";
import type { Storage } from "@seance/storage";
import { getEmail } from "../domain/store";
import type { Address, Email } from "../domain/types";

export interface InboxDeps {
  search: SearchService;
}

export async function requireEmail(storage: Storage, id: string): Promise<Email> {
  const e = await getEmail(storage, id);
  if (!e) throw new Error(`No email with id "${id}". Use search_emails to find ids.`);
  return e;
}

export const formatAddress = (a: Address) => (a.name ? `${a.name} <${a.address}>` : a.address);

/** Replies go to Reply-To when the sender set one, otherwise to the sender. */
export const replyAddress = (e: Pick<Email, "from" | "replyTo">) =>
  e.replyTo?.[0]?.address || e.from.address;

/** Lower-case, hyphenated, letters and digits only. "Follow Up!" → "follow-up". */
export function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .normalize("NFC")
    .slice(0, 32);
}

export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function snippetFor(e: Email, query: string, max = 160): string {
  const flat = e.text.replace(/\s+/g, " ");
  const lower = flat.toLowerCase();
  const at = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => lower.indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  if (at === undefined) return clip(flat, max);
  const start = Math.max(0, at - 50);
  return (start > 0 ? "…" : "") + clip(flat.slice(start), max);
}
