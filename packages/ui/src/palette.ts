import { useEffect } from "react";

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Predictable ranking for the palette. 1: the whole query appears in the label or a keyword.
 * 0.8: every query word starts a word there. 0.5: every query word appears somewhere.
 * 0: no match. Unlike cmdk's default, scattered letters never match: "api key" must not
 * pick "Draft a reply to Maya about dinner".
 */
export function paletteScore(value: string, search: string, keywords: string[] = []): number {
  const q = fold(search).trim();
  if (q === "") return 1;
  const hay = fold([value, ...keywords].join(" "));
  const at = hay.indexOf(q);
  // The phrase starts a word: "set" in "Open settings".
  if (at >= 0 && (at === 0 || /[^\p{L}\p{N}]/u.test(hay[at - 1] ?? " "))) return 1;
  const terms = q.split(/\s+/);
  const words = hay.split(/[^\p{L}\p{N}]+/u);
  if (terms.every((t) => words.some((w) => w.startsWith(t)))) return 0.8;
  // The phrase sits inside a word: "set" in "reset".
  if (at >= 0) return 0.6;
  if (terms.every((t) => hay.includes(t))) return 0.5;
  return 0;
}

/** True when the event is ⌘K on macOS or Ctrl+K elsewhere. */
export function isPaletteHotkey(
  e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
): boolean {
  return e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
}

/** Toggle the palette on ⌘K / Ctrl+K anywhere on the page. */
export function usePaletteHotkey(setOpen: (update: (open: boolean) => boolean) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteHotkey(e)) return;
      e.preventDefault();
      setOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
