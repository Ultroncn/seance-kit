import type { Message, NormalizedConversation, Role, Source } from "./types";

export const UNTITLED = "Untitled chat";
const EPOCH = "1970-01-01T00:00:00.000Z";
const MAX_TITLE = 200;

/**
 * Parse a timestamp from an export into ISO 8601. Numbers below 1e12 are Unix seconds
 * (ChatGPT), larger ones milliseconds. Returns undefined for anything unusable.
 */
export function toIso(value: unknown): string | undefined {
  let ms: number;
  if (typeof value === "number" && Number.isFinite(value)) {
    ms = Math.round(value < 1e12 ? value * 1000 : value);
  } else if (typeof value === "string" && value.trim() !== "") {
    ms = Date.parse(value);
  } else {
    return undefined;
  }
  if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return undefined;
  return new Date(ms).toISOString();
}

export function normalizeTitle(raw: unknown): string {
  const t =
    typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE).trimEnd() : "";
  return t === "" ? UNTITLED : t;
}

/** Unify line endings and trim the ends. Inner whitespace and blank lines are kept. */
export function normalizeText(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";
}

function normalizeMessage(m: { role: unknown; text: unknown; at?: unknown }): Message | null {
  const role = m.role === "user" || m.role === "assistant" ? (m.role as Role) : null;
  const text = normalizeText(m.text);
  if (!role || text === "") return null;
  const at = toIso(m.at);
  return at ? { role, text, at } : { role, text };
}

export interface RawConversation {
  source: Source;
  sourceId: string;
  title?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  messages: { role: unknown; text: unknown; at?: unknown }[];
}

/**
 * The single place where imported data is cleaned. Idempotent (property P2):
 * `normalizeConversation(normalizeConversation(x))` equals `normalizeConversation(x)`.
 */
export function normalizeConversation(raw: RawConversation): NormalizedConversation {
  const messages = raw.messages.map(normalizeMessage).filter((m): m is Message => m !== null);
  const firstAt = messages.find((m) => m.at)?.at;
  const lastAt = [...messages].reverse().find((m) => m.at)?.at;
  const createdAt = toIso(raw.createdAt) ?? firstAt ?? toIso(raw.updatedAt) ?? EPOCH;
  const updatedRaw = toIso(raw.updatedAt) ?? lastAt ?? createdAt;
  const updatedAt = updatedRaw < createdAt ? createdAt : updatedRaw;
  return {
    source: raw.source,
    sourceId: String(raw.sourceId),
    title: normalizeTitle(raw.title),
    createdAt,
    updatedAt,
    messages,
  };
}
