import type { ChatMessage } from "./types";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Throw a readable error for a failed provider call. Never includes request headers or keys. */
export async function ensureOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  let detail = "";
  try {
    detail = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 300);
  } catch {
    // Body unreadable. The status is enough.
  }
  throw new Error(`${provider} request failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`);
}

/** Model output for tool arguments is a JSON string. Keep the raw string if it is not valid JSON. */
export function parseToolArguments(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export type ToolMessage = Extract<ChatMessage, { role: "tool" }>;
