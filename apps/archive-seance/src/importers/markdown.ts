import { contentHash } from "../domain/hash";
import { normalizeConversation, toIso } from "../domain/normalize";
import type { Message, NormalizedConversation, Role } from "../domain/types";

/**
 * Markdown or plain-text chats. Speakers are marked by a heading (`## User`), a bold label
 * (`**Assistant:**`) or a plain label (`User: hi`). A first `# Title` line names the chat.
 * Files written by `toMarkdown` carry a meta comment with id and dates, so they round-trip
 * exactly (property P1). Lines in a message that would read as markers are escaped with `\`.
 */

const USER = "user|you|human|me";
const ASSISTANT = "assistant|ai|chatgpt|claude|gpt|bot|model";
const ROLE_HEADING = new RegExp(`^##\\s+(${USER}|${ASSISTANT})\\s*:?\\s*$`, "i");
const ROLE_BOLD = new RegExp(`^\\*\\*(${USER}|${ASSISTANT})\\s*:?\\*\\*:?\\s?(.*)$`, "i");
const ROLE_PLAIN = new RegExp(`^(${USER}|${ASSISTANT})\\s*:\\s?(.*)$`, "i");
const TITLE = /^#\s+(.*)$/;
const META = /^<!--\s*seance:\s*(\{.*\})\s*-->\s*$/;

function roleOf(label: string): Role {
  return new RegExp(`^(${USER})$`, "i").test(label.trim()) ? "user" : "assistant";
}

/** True for lines the parser would treat as structure. Message lines like this get escaped. */
export function isMarkerLine(line: string): boolean {
  return (
    line.startsWith("\\") ||
    TITLE.test(line) ||
    META.test(line) ||
    ROLE_HEADING.test(line) ||
    ROLE_BOLD.test(line) ||
    ROLE_PLAIN.test(line)
  );
}

export interface MarkdownFileInfo {
  fileName?: string;
  /** File modification time in ms, used when the file has no dates. */
  lastModified?: number;
}

interface Meta {
  id?: unknown;
  created?: unknown;
  updated?: unknown;
}

export function parseMarkdown(text: string, info: MarkdownFileInfo = {}): NormalizedConversation {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let title: string | undefined;
  let meta: Meta = {};
  const messages: { role: Role; lines: string[] }[] = [];
  const preamble: string[] = [];

  for (const line of lines) {
    const current = messages[messages.length - 1];
    if (line.startsWith("\\")) {
      (current?.lines ?? preamble).push(line.slice(1));
      continue;
    }
    const heading = ROLE_HEADING.exec(line);
    const bold = heading ? null : ROLE_BOLD.exec(line);
    const plain = heading || bold ? null : ROLE_PLAIN.exec(line);
    const marker = heading ?? bold ?? plain;
    if (marker) {
      messages.push({ role: roleOf(marker[1] ?? ""), lines: heading ? [] : [marker[2] ?? ""] });
      continue;
    }
    if (messages.length === 0) {
      const t = TITLE.exec(line);
      if (t && title === undefined) {
        title = t[1];
        continue;
      }
      const m = META.exec(line);
      if (m) {
        try {
          meta = JSON.parse(m[1] ?? "{}") as Meta;
        } catch {
          // A broken meta comment is ignored.
        }
        continue;
      }
      preamble.push(line);
      continue;
    }
    current?.lines.push(line);
  }

  // No speaker markers at all: treat the whole note as one message from the user.
  const bodies: Message[] =
    messages.length > 0
      ? messages.map((m) => ({ role: m.role, text: m.lines.join("\n") }))
      : [{ role: "user", text: preamble.join("\n") }];

  const fallbackName = info.fileName?.replace(/\.[^.]+$/, "");
  const fileDate = info.lastModified !== undefined ? toIso(info.lastModified) : undefined;
  const draft = normalizeConversation({
    source: "markdown",
    sourceId: "pending",
    title: title ?? fallbackName,
    createdAt: meta.created ?? fileDate,
    updatedAt: meta.updated ?? meta.created ?? fileDate,
    messages: bodies,
  });
  const sourceId =
    typeof meta.id === "string" && meta.id !== ""
      ? meta.id
      : contentHash(JSON.stringify([draft.title, draft.messages]));
  return { ...draft, sourceId };
}

function escapeBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => (isMarkerLine(line) ? `\\${line}` : line))
    .join("\n");
}

/** Write a conversation as Markdown that `parseMarkdown` reads back exactly. */
export function toMarkdown(c: NormalizedConversation): string {
  const meta = JSON.stringify({ id: c.sourceId, created: c.createdAt, updated: c.updatedAt });
  const parts = [`# ${c.title}`, `<!-- seance: ${meta} -->`];
  for (const m of c.messages) {
    parts.push("", m.role === "user" ? "## User" : "## Assistant", "", escapeBlock(m.text));
  }
  return parts.join("\n") + "\n";
}
