import { cn } from "@seance/ui";
import { FileText } from "lucide-react";
import type { Source } from "../domain/types";

/**
 * A small monochrome mark for where a chat came from. Not the vendors' logos: a neutral glyph with
 * the vendor's initial, so the list reads at a glance without borrowing trademarks.
 */
export function SourceIcon({ source, className }: { source: Source; className?: string }) {
  if (source === "markdown")
    return <FileText aria-hidden className={cn("size-4 shrink-0 text-muted", className)} />;
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-[4px] bg-surface-3 text-[10px] font-semibold leading-none text-fg-2",
        className,
      )}
    >
      {source === "chatgpt" ? "G" : "C"}
    </span>
  );
}
