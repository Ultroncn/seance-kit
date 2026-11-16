const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

/** HTML bodies past this size are cut before conversion. Plain text is capped later anyway. */
const MAX_HTML = 1_000_000;
/** Elements whose content is never shown. An unclosed one hides the rest of the document. */
const HIDDEN = new Set(["head", "style", "script", "title", "noscript", "template"]);
const BLOCK_END = new Set([
  "p",
  "div",
  "tr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "table",
  "ul",
  "ol",
]);

type Token =
  { kind: "text"; text: string } | { kind: "tag"; name: string; closing: boolean; raw: string };

/**
 * Split HTML into text and tags in one forward pass. Every search starts where the last one
 * ended, so hostile input (thousands of unclosed tags or comments) stays linear in its size.
 */
function* tokens(html: string): Generator<Token> {
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      yield { kind: "text", text: html.slice(i) };
      return;
    }
    if (lt > i) yield { kind: "text", text: html.slice(i, lt) };
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end < 0) return; // An unclosed comment hides the rest, as in a browser.
      i = end + 3;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) {
      // No ">" anywhere after this point: the rest is literal text.
      yield { kind: "text", text: html.slice(lt) };
      return;
    }
    const raw = html.slice(lt + 1, gt);
    const m = /^(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(raw);
    if (m) yield { kind: "tag", name: (m[2] ?? "").toLowerCase(), closing: m[1] === "/", raw };
    else yield { kind: "text", text: html.slice(lt, gt + 1) };
    i = gt + 1;
  }
}

/**
 * Readable plain text from an HTML email body. Not a full renderer: it keeps paragraphs, line
 * breaks, list bullets and link targets, and drops styles, scripts and tracking pixels.
 */
export function htmlToText(input: string): string {
  const html = input.length > MAX_HTML ? input.slice(0, MAX_HTML) : input;
  const out: string[] = [];
  let hidden: string | null = null;
  let link: { href: string; label: string[] } | null = null;
  const emit = (s: string) => (link ? link.label : out).push(s);

  for (const t of tokens(html)) {
    if (hidden) {
      if (t.kind === "tag" && t.closing && t.name === hidden) hidden = null;
      continue;
    }
    if (t.kind === "text") {
      emit(decodeEntities(t.text));
      continue;
    }
    if (!t.closing && HIDDEN.has(t.name)) {
      hidden = t.name;
      continue;
    }
    if (t.name === "a") {
      if (!t.closing) {
        const href = /href\s*=\s*["']([^"']*)["']/i.exec(t.raw)?.[1] ?? "";
        link = { href: decodeEntities(href), label: [] };
      } else if (link) {
        const text = link.label.join("").replace(/\s+/g, " ").trim();
        const { href } = link;
        link = null;
        emit(
          /^https?:/i.test(href) && text && text !== href
            ? `${text} (${href})`
            : text || (/^https?:/i.test(href) ? href : ""),
        );
      }
      continue;
    }
    if (t.name === "br") emit("\n");
    else if (t.name === "li" && !t.closing) emit("\n• ");
    else if (t.name === "p" && !t.closing) emit("\n");
    else if (t.closing && BLOCK_END.has(t.name)) emit("\n");
  }
  if (link) out.push(link.label.join(""));

  return out
    .join("")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
