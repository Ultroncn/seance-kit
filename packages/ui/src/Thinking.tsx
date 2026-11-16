import type { kitMessages } from "./messages";
import type { TimelineEntry } from "./timeline-types";

type Kit = (typeof kitMessages)["en"];
type Entry = Extract<TimelineEntry, { kind: "thinking" }>;

/** The blinking bar at the end of text that is still arriving. A static bar under reduced motion. */
export function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.2em] rounded-full bg-ecto motion-safe:animate-caret"
    />
  );
}

/**
 * A step's reasoning. While the model thinks, the latest lines show faintly as they arrive; once
 * it is done, a single line says how long it thought, and opens to the full text.
 */
export function Thinking({ entry, t }: { entry: Entry; t: Kit }) {
  if (entry.streaming || entry.durationMs === undefined) {
    return (
      <div className="min-w-0">
        <p className="text-sm font-medium text-shimmer">{t.thinking}</p>
        <p className="mt-1 max-h-24 overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-muted [mask-image:linear-gradient(to_bottom,transparent,black_45%)]">
          {entry.text.slice(-600)}
        </p>
      </div>
    );
  }
  return (
    <details className="group/think min-w-0">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-sm text-muted transition-colors duration-150 hover:text-fg [&::-webkit-details-marker]:hidden">
        {t.thoughtFor((entry.durationMs / 1000).toFixed(1))}
        <span aria-hidden className="transition-transform duration-150 group-open/think:rotate-90">
          ›
        </span>
      </summary>
      <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap border-l-2 border-line pl-3 text-xs leading-relaxed text-muted">
        {entry.text}
      </p>
    </details>
  );
}
