import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Command } from "cmdk";
import { useEffect, useMemo, type ReactNode } from "react";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { Kbd } from "./primitives";

export interface PaletteCommand {
  /** React key. Labels must be unique too: the palette matches and selects by label. */
  id: string;
  label: string;
  /** Group heading, for example "Library" or "Agent". */
  group?: string;
  /** Extra words that should match, for example plain synonyms of a spooky label. */
  keywords?: string[];
  /** Display only, for example "⌘I". */
  shortcut?: string;
  hint?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
  placeholder?: string;
}

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

/** Keyboard-first command palette. Every app action should be listed here. */
export function CommandPalette({ open, onOpenChange, commands, placeholder }: CommandPaletteProps) {
  const t = useT(kitMessages);
  const groups = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    for (const c of commands) {
      const key = c.group ?? "";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()];
  }, [commands]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[18vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
        >
          <VisuallyHidden>
            <Dialog.Title>{t.commandPalette}</Dialog.Title>
          </VisuallyHidden>
          <Command label={t.commands} loop filter={paletteScore}>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-ecto shadow-[0_0_10px_var(--color-ecto)]"
              />
              <Command.Input
                placeholder={placeholder ?? t.paletteSearch}
                className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted focus-visible:outline-none"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
                {t.paletteEmpty}
              </Command.Empty>
              {groups.map(([heading, items]) => (
                <Command.Group
                  key={heading}
                  heading={heading || undefined}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
                >
                  {items.map((c) => (
                    <Command.Item
                      key={c.id}
                      value={c.label}
                      keywords={c.keywords}
                      disabled={c.disabled}
                      onSelect={() => {
                        onOpenChange(false);
                        c.onSelect();
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-fg data-[disabled=true]:cursor-default data-[disabled=true]:opacity-50 data-[selected=true]:bg-raised"
                    >
                      <span>{c.label}</span>
                      {c.hint && <span className="text-xs text-muted">{c.hint}</span>}
                      {c.shortcut && (
                        <span className="ml-auto">
                          <Kbd>{c.shortcut}</Kbd>
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
