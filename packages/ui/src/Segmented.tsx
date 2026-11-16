import { cn } from "./cn";

export interface SegmentedItem<V extends string> {
  value: V;
  label: string;
  /** Shown after the label in a quieter color, for example the number of items in a view. */
  count?: number;
}

/**
 * Switch between a few views of the same list, like Linear's view tabs. Each option is a toggle
 * button inside a labelled navigation landmark, so it reads as "Views: Inbox 18, pressed".
 */
export function Segmented<V extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: SegmentedItem<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn("flex h-8 rounded-md border border-line bg-bg p-0.5", className)}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          aria-pressed={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 text-meta font-medium transition-colors duration-100",
            value === it.value ? "bg-raised text-fg" : "text-muted hover:text-fg-2",
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className="tabular text-xs font-normal text-muted">{it.count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
