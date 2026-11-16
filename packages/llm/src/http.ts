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

/** True when the server answered with a stream rather than one JSON body. */
export const isEventStream = (res: Response) =>
  (res.headers.get("content-type") ?? "").includes("text/event-stream") && res.body !== null;

/**
 * Read a Server-Sent Events body: yields each event's name and data. Lines may be split across
 * network chunks at any point, so text is buffered until a blank line ends the event.
 */
export async function* readEvents(res: Response): AsyncGenerator<{ event: string; data: string }> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  let data: string[] = [];
  const flush = function* () {
    if (data.length > 0) yield { event, data: data.join("\n") };
    event = "";
    data = [];
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(buffer[nl] === "\r" ? nl + 2 : nl + 1);
        if (line === "") yield* flush();
        else if (line.startsWith(":")) continue;
        else {
          const at = line.indexOf(":");
          const field = at < 0 ? line : line.slice(0, at);
          const value = at < 0 ? "" : line.slice(at + 1).replace(/^ /, "");
          if (field === "event") event = value;
          else if (field === "data") data.push(value);
        }
      }
      if (done) break;
    }
    if (buffer !== "") {
      if (buffer.startsWith("data:")) data.push(buffer.slice(5).replace(/^ /, ""));
    }
    yield* flush();
  } finally {
    reader.releaseLock();
  }
}
