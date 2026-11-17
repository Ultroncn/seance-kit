import { looksLikeChatGPT, parseChatGPT } from "./chatgpt";
import { looksLikeClaude, parseClaude } from "./claude";
import { parseMarkdown } from "./markdown";
import { ImportError, isRecord, type ImportResult } from "./types";

export { ImportError, type ImportResult, type SkippedItem } from "./types";
export { parseChatGPT } from "./chatgpt";
export { parseClaude } from "./claude";
export { parseMarkdown, toMarkdown, isMarkerLine } from "./markdown";

/** The parts of a browser `File` we need. Easy to fake in tests. */
export interface FileLike {
  name: string;
  lastModified?: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type DetectedFormat = "chatgpt" | "claude" | "markdown" | "zip";

const TEXT_EXT = /\.(md|markdown|txt)$/i;

function parseJsonExport(text: string, where: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError(`${where} is not valid JSON.`);
  }
  // Some tools wrap the list: { "conversations": [...] }.
  if (isRecord(data) && Array.isArray(data.conversations)) data = data.conversations;
  if (looksLikeChatGPT(data)) return parseChatGPT(data);
  if (looksLikeClaude(data)) return parseClaude(data);
  throw new ImportError(
    `${where} is not a ChatGPT or Claude export. Pick the conversations.json file from your export.`,
  );
}

/** One Markdown or text chat. A file with no text is reported as skipped, not imported empty. */
function markdownResult(text: string, fileName: string, lastModified?: number): ImportResult {
  const c = parseMarkdown(text, { fileName, lastModified });
  return c.messages.length === 0
    ? { conversations: [], skipped: [{ where: fileName, reason: "empty file" }] }
    : { conversations: [c], skipped: [] };
}

function merge(results: ImportResult[]): ImportResult {
  return {
    conversations: results.flatMap((r) => r.conversations),
    skipped: results.flatMap((r) => r.skipped),
  };
}

/**
 * Read one dropped or picked file. Accepts a ChatGPT or Claude `conversations.json`, the export
 * `.zip` itself, and Markdown or plain-text chats. Throws ImportError when nothing usable is found.
 */
export async function parseFile(
  file: FileLike,
): Promise<ImportResult & { format: DetectedFormat }> {
  const name = file.name;
  if (/\.zip$/i.test(name)) {
    const { strFromU8, unzipSync } = await import("fflate");
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => /(^|\/)conversations\.json$/i.test(f.name) || TEXT_EXT.test(f.name),
      });
    } catch {
      throw new ImportError(`${name} could not be opened as a zip file.`);
    }
    // macOS adds __MACOSX/ and "._" files to zips; dotfiles are never chats.
    const usable = Object.entries(entries).filter(([entry]) => {
      const base = entry.split("/").pop() ?? entry;
      return !/(^|\/)__MACOSX\//.test(entry) && !base.startsWith(".");
    });
    const hasExport = usable.some(([entry]) => !TEXT_EXT.test(entry));
    const results: ImportResult[] = [];
    for (const [entry, bytes] of usable) {
      const base = entry.split("/").pop() ?? entry;
      if (!TEXT_EXT.test(entry)) {
        results.push(parseJsonExport(strFromU8(bytes), entry));
      } else if (hasExport) {
        // Next to a conversations.json, text files are attachments, not chats.
        results.push({
          conversations: [],
          skipped: [{ where: base, reason: "attachment next to conversations.json, not a chat" }],
        });
      } else {
        results.push(markdownResult(strFromU8(bytes), base, file.lastModified));
      }
    }
    if (results.length === 0)
      throw new ImportError(`${name} has no conversations.json or Markdown files inside.`);
    return { ...merge(results), format: "zip" };
  }
  if (TEXT_EXT.test(name)) {
    return { ...markdownResult(await file.text(), name, file.lastModified), format: "markdown" };
  }
  if (/\.json$/i.test(name)) {
    const result = parseJsonExport(await file.text(), name);
    const format = result.conversations[0]?.source === "claude" ? "claude" : "chatgpt";
    return { ...result, format };
  }
  throw new ImportError(`${name}: unsupported file type. Use .json, .zip, .md or .txt.`);
}
