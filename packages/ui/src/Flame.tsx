import { cn } from "./cn";

/** A running step's node: a small candle flame. Reduced motion keeps it lit and still. */
export function Flame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 14" className={cn("h-3.5 w-2.5 overflow-visible", className)}>
      <circle cx="5" cy="9" r="6" fill="var(--color-candle)" opacity="0.18" />
      <path
        className="motion-safe:animate-flicker"
        style={{ transformOrigin: "5px 13px" }}
        d="M5 0 C 8 4, 9 8, 5 13 C 1 8, 2 4, 5 0 Z"
        fill="var(--color-candle)"
      />
      <path d="M5 6 C 6.5 8, 6.5 10, 5 12 C 3.5 10, 3.5 8, 5 6 Z" fill="#fff4d6" />
    </svg>
  );
}
