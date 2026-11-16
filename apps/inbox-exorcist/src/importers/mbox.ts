/**
 * Streaming mbox splitter (mboxrd). Messages start at a `From ` line at the start of the file or
 * after a blank line. Body lines that start with `>From `, `>>From ` ... lose one `>`, undoing
 * the writer's escaping. Works on "binary strings" (one char per byte) so each message keeps its
 * original bytes and charset for the MIME parser. The output does not depend on how the input is
 * chunked (property P4).
 */
export class MboxSplitter {
  private rest = "";
  private current: string[] | null = null;
  private prevBlank = true;

  /** Feed the next chunk. Returns the messages completed by it. */
  push(chunk: string): string[] {
    const out: string[] = [];
    const text = this.rest + chunk;
    let start = 0;
    for (let nl = text.indexOf("\n", start); nl !== -1; nl = text.indexOf("\n", start)) {
      this.line(text.slice(start, nl), out);
      start = nl + 1;
    }
    this.rest = text.slice(start);
    return out;
  }

  /** Signal the end of input. Returns the last message, if any. */
  end(): string[] {
    const out: string[] = [];
    if (this.rest !== "") this.lastLine(out);
    this.finish(out);
    return out;
  }

  private lastLine(out: string[]) {
    // A final line without a newline. Mark it so finish() does not add one back.
    this.line(this.rest, out);
    this.rest = "";
    if (this.current) this.current.push("\u0000eof");
  }

  private line(line: string, out: string[]) {
    const bare = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (this.prevBlank && bare.startsWith("From ")) {
      this.finish(out);
      this.current = [];
      this.prevBlank = false;
      return;
    }
    this.current ??= [];
    this.current.push(/^>+From /.test(line) ? line.slice(1) : line);
    this.prevBlank = bare === "";
  }

  private finish(out: string[]) {
    const lines = this.current;
    this.current = null;
    if (!lines) return;
    const eof = lines[lines.length - 1] === "\u0000eof";
    if (eof) lines.pop();
    // The blank line before the next `From ` belongs to the separator, not the message.
    else if (
      lines.length > 0 &&
      (lines[lines.length - 1] === "" || lines[lines.length - 1] === "\r")
    )
      lines.pop();
    const message = lines.join("\n") + (eof || lines.length === 0 ? "" : "\n");
    if (message.trim() !== "") out.push(message);
  }
}

/** Split a whole mbox string at once. */
export function splitMbox(text: string): string[] {
  const s = new MboxSplitter();
  return [...s.push(text), ...s.end()];
}

/** Write messages as mboxrd. The exact inverse of the splitter for messages ending in a newline. */
export function writeMbox(messages: string[]): string {
  return messages
    .map((m) => {
      const body = m.endsWith("\n") ? m.slice(0, -1) : m;
      const escaped = body
        .split("\n")
        .map((l) => (/^>*From /.test(l) ? `>${l}` : l))
        .join("\n");
      return `From MAILER-DAEMON Thu Jan  1 00:00:00 1970\n${escaped}\n\n`;
    })
    .join("");
}

/** Bytes to a string with one char per byte (lossless, unlike TextDecoder("latin1")). */
export function bytesToBinary(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return s;
}

export function binaryToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
