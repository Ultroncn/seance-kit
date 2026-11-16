import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "./cn";

/**
 * A draggable border between two panes, following the WAI-ARIA window splitter pattern: it is
 * focusable, says its current width, and arrow keys resize it as well as the pointer does.
 * `side` says which pane it sizes: the one on its left (library) or on its right (agent).
 */
export function Splitter({
  label,
  side,
  value,
  min,
  max,
  onChange,
  className,
}: {
  label: string;
  side: "left" | "right";
  value: number;
  min: number;
  max: number;
  onChange: (width: number) => void;
  className?: string;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const sign = side === "left" ? 1 : -1;

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width: value };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (start.current) onChange(start.current.width + sign * (e.clientX - start.current.x));
  };
  const up = () => {
    start.current = null;
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    const by: Record<string, number> = {
      ArrowLeft: -sign * step,
      ArrowRight: sign * step,
    };
    if (e.key in by) onChange(value + (by[e.key] ?? 0));
    else if (e.key === "Home") onChange(min);
    else if (e.key === "End") onChange(max);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className={cn(
        "group absolute inset-y-0 z-20 hidden w-3 -translate-x-1/2 cursor-col-resize touch-none lg:block",
        "focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors duration-100 group-hover:bg-accent group-focus-visible:bg-accent group-active:bg-accent"
      />
    </div>
  );
}
