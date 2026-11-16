import type { ReactNode } from "react";

/**
 * A tiny highlighter for the landing page's short TypeScript and JSX samples: comments, strings,
 * keywords and tags. Not a parser; the samples are fixed, and tests read their exact text.
 */
const TOKEN =
  /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(export|const|async|await|return|new|import|from|type)\b|(<\/?[A-Z][A-Za-z]*|\/>)|\b([a-z][A-Za-z]*)(?=\s*[(=:])/g;

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    const [text, comment, str, keyword, tag] = m;
    const tone = comment
      ? "text-muted italic"
      : str
        ? "text-warn"
        : keyword
          ? "text-accent"
          : tag
            ? "text-danger"
            : "text-fg";
    out.push(
      <span key={at} className={tone}>
        {text}
      </span>,
    );
    last = at + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}
