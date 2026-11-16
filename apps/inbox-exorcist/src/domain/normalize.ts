import { contentHash } from "./hash";
import type { Address, NormalizedEmail } from "./types";

export const NO_SUBJECT = "(no subject)";
const EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_TEXT = 200_000;

/** Parse a date header or ISO string into ISO 8601. Returns undefined for anything unusable. */
export function toIso(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return undefined;
  return new Date(ms).toISOString();
}

const oneLine = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

export function normalizeAddress(raw: unknown): Address {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as {
    name?: unknown;
    address?: unknown;
  };
  return { name: oneLine(r.name), address: oneLine(r.address).toLowerCase() };
}

/** Unify line endings, drop trailing spaces, squeeze runs of blank lines, trim, cap the size. */
export function normalizeBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT)
    .trimEnd();
}

export interface RawEmail {
  messageId?: unknown;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  replyTo?: unknown;
  subject?: unknown;
  date?: unknown;
  text?: unknown;
  attachments?: unknown;
}

const list = (v: unknown) =>
  Array.isArray(v) ? v.map(normalizeAddress).filter((a) => a.address !== "") : [];

/** The single place where imported mail is cleaned. Idempotent (P2). */
export function normalizeEmail(raw: RawEmail): NormalizedEmail {
  const id = oneLine(raw.messageId).replace(/^<|>$/g, "").trim();
  const subject = oneLine(raw.subject);
  return {
    messageId: id === "" ? null : id,
    from: normalizeAddress(raw.from),
    to: list(raw.to),
    cc: list(raw.cc),
    replyTo: list(raw.replyTo),
    subject: subject === "" ? NO_SUBJECT : subject,
    date: toIso(raw.date) ?? EPOCH,
    text: normalizeBody(raw.text),
    attachments:
      typeof raw.attachments === "number" && raw.attachments > 0 ? Math.floor(raw.attachments) : 0,
  };
}

/**
 * Stable id for deduplication (P3). The Message-ID when there is one, otherwise a hash of the
 * sender, date, subject and body, so the same message imported twice gets the same id.
 */
export function emailId(e: NormalizedEmail): string {
  return e.messageId
    ? `mid:${e.messageId}`
    : `h:${contentHash([e.from.address, e.date, e.subject, e.text].join("\u0000"))}`;
}
