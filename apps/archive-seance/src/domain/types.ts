import type { StoredItem } from "@seance/storage";

export const CONVERSATIONS = "conversations";
export const RESURRECTIONS = "resurrections";

export type Source = "chatgpt" | "claude" | "markdown";
export const SOURCES: readonly Source[] = ["chatgpt", "claude", "markdown"];
export const SOURCE_LABEL: Record<Source, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  markdown: "Markdown",
};

export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  text: string;
  /** ISO timestamp, when the export has one. */
  at?: string;
}

/** What every importer produces, after `normalizeConversation`. */
export interface NormalizedConversation {
  source: Source;
  /** Id inside the source export. Together with `source` it identifies a chat across imports. */
  sourceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

/** A stored conversation: imported content plus what the user and agent added. */
export interface Conversation extends NormalizedConversation, StoredItem {
  /** `${source}:${sourceId}` */
  id: string;
  /** Bumped on every write. The search index uses it to detect stale saved indexes. */
  rev: number;
  tags: string[];
  summary?: string;
  summarizedAt?: string;
  banishedAt?: string;
  banishToken?: string;
}

export interface Resurrection extends StoredItem {
  id: string;
  conversationId: string;
  title: string;
  prompt: string;
  createdAt: string;
}

export function conversationId(source: Source, sourceId: string): string {
  return `${source}:${sourceId}`;
}
