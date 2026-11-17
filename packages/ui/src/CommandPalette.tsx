import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Command } from "cmdk";
import { useMemo, type ReactNode } from "react";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { Kbd } from "./primitives";
import { paletteScore } from "./palette";
export { isPaletteHotkey, paletteScore, usePaletteHotkey } from "./palette";

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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
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
                className="size-1.5 rounded-full bg-accent-solid shadow-[0_0_10px_var(--color-accent)]"
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
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
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
