/** Pretty JSON for tool input and output, cut to `maxChars` so huge results stay readable. */
export function formatJson(value: unknown, maxChars = 2000): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > maxChars
    ? `${text.slice(0, maxChars)}\n… (${text.length - maxChars} more characters)`
    : text;
}

/** "320 ms" or "1.4 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
