import { Search } from "lucide-react";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { Kbd } from "./primitives";

const isMac = () => typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);

/** A search-box-shaped button in the header that opens the command palette, like Linear's. */
export function CommandTrigger({ onOpen, label }: { onOpen: () => void; label?: string }) {
  const t = useT(kitMessages);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden h-8 w-60 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-meta text-muted transition-colors duration-100 hover:border-edge hover:text-fg-2 md:flex"
    >
      <Search aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label ?? t.commandSearch}</span>
      <Kbd>{isMac() ? "⌘K" : "Ctrl K"}</Kbd>
    </button>
  );
}
