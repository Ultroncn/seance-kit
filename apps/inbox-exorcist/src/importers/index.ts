import { unzipSync } from "fflate";
import PostalMime from "postal-mime";
import { normalizeEmail } from "../domain/normalize";
import type { NormalizedEmail } from "../domain/types";
import { htmlToText } from "./html";
import { MboxSplitter, binaryToBytes, bytesToBinary } from "./mbox";

export { htmlToText } from "./html";
export { MboxSplitter, splitMbox, writeMbox, bytesToBinary, binaryToBytes } from "./mbox";

export interface SkippedItem {
  where: string;
  reason: string;
}

/** The whole file is unusable. */
export class ImportError extends Error {
  override name = "ImportError";
}

/** The parts of a browser `File` we need. A Node `File`/`Blob` works too. */
export interface FileLike {
  name: string;
  size: number;
  stream(): ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type ReadEvent =
  | { kind: "email"; email: NormalizedEmail }
  | { kind: "skipped"; item: SkippedItem }
  | { kind: "progress"; bytes: number; total: number };

/** Parse one raw RFC 5322 message (bytes, any charset) into a normalized email. */
export async function parseMessage(bytes: Uint8Array): Promise<NormalizedEmail> {
  const e = await PostalMime.parse(bytes);
  // postal-mime reads header-less input as a body. Every real message has headers.
  if (e.headers.length === 0) throw new ImportError("not an email (no headers)");
  const text = e.text && e.text.trim() !== "" ? e.text : e.html ? htmlToText(e.html) : "";
  return normalizeEmail({
    messageId: e.messageId,
    from: e.from,
    to: e.to,
    cc: e.cc,
    subject: e.subject,
    date: e.date,
    text,
    attachments: e.attachments?.length ?? 0,
  });
}

async function* fromRaw(raw: string, where: string): AsyncGenerator<ReadEvent> {
  try {
    const email = await parseMessage(binaryToBytes(raw));
    if (email.from.address === "" && email.text === "" && email.subject === "(no subject)") {
      yield {
        kind: "skipped",
        item: { where, reason: "not an email (no sender, subject or body)" },
      };
    } else {
      yield { kind: "email", email };
    }
  } catch (err) {
    yield {
      kind: "skipped",
      item: { where, reason: err instanceof Error ? err.message : String(err) },
    };
  }
}

/** Stream an mbox file chunk by chunk, so multi-gigabyte exports never sit in memory at once. */
async function* readMbox(
  stream: ReadableStream<Uint8Array>,
  total: number,
  label = "",
): AsyncGenerator<ReadEvent> {
  const splitter = new MboxSplitter();
  const reader = stream.getReader();
  let bytes = 0;
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const messages = done ? splitter.end() : splitter.push(bytesToBinary(value));
      for (const raw of messages) yield* fromRaw(raw, `${label}#${++n}`);
      if (done) break;
      bytes += value.length;
      yield { kind: "progress", bytes, total };
    }
  } finally {
    reader.releaseLock();
  }
}

const bytesStream = (u8: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(u8);
      c.close();
    },
  });

/**
 * Read emails from one file: `.mbox` (Google Takeout, Thunderbird, Apple Mail export), `.eml`,
 * or a `.zip` holding either. Unreadable messages are reported and skipped; the rest import.
 */
export async function* readEmails(file: FileLike): AsyncGenerator<ReadEvent> {
  const name = file.name;
  if (/\.eml$/i.test(name)) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    yield* fromRaw(bytesToBinary(bytes), name);
    yield { kind: "progress", bytes: bytes.length, total: bytes.length };
    return;
  }
  if (/\.zip$/i.test(name)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => /\.(mbox|eml)$/i.test(f.name),
      });
    } catch {
      throw new ImportError(
        `${name} could not be opened as a zip file. For a large Takeout zip, unzip it and drop the .mbox file.`,
      );
    }
    const list = Object.entries(entries);
    if (list.length === 0) throw new ImportError(`${name} has no .mbox or .eml files inside.`);
    for (const [entry, bytes] of list) {
      const short = entry.split("/").pop() ?? entry;
      if (/\.eml$/i.test(entry)) yield* fromRaw(bytesToBinary(bytes), short);
      else yield* readMbox(bytesStream(bytes), bytes.length, `${short} `);
    }
    return;
  }
  if (/\.(mbox|mbx)$/i.test(name) || !/\.[a-z0-9]+$/i.test(name)) {
    yield* readMbox(file.stream(), file.size);
    return;
  }
  throw new ImportError(`${name}: unsupported file type. Use .mbox, .eml or a .zip of them.`);
}

/** For tests and zipped text: a UTF-8 or binary string as a FileLike. */
export function fileFrom(name: string, content: string | Uint8Array): FileLike {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  // Copy into a fresh ArrayBuffer: File wants ArrayBuffer-backed parts, not SharedArrayBuffer views.
  return new File([new Uint8Array(bytes).buffer as ArrayBuffer], name);
}
