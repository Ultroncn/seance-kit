import { cn } from "@seance/ui";
import type { PointerEvent, ReactNode } from "react";

/** Move the card's light to the pointer. Kept in CSS variables, so React never re-renders. */
const follow = (e: PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
};

/**
 * A card whose edge and surface catch the light where the pointer is, like a candle held close.
 * `tone` picks ectoplasm or candle light. Static (no light) for touch and keyboard users.
 */
export function GlowCard({
  href,
  tone = "ecto",
  className,
  children,
}: {
  href?: string;
  tone?: "ecto" | "candle";
  className?: string;
  children: ReactNode;
}) {
  const color = tone === "ecto" ? "var(--color-ecto)" : "var(--color-candle)";
  const Tag = href ? "a" : "div";
  return (
    <Tag
      href={href}
      onPointerMove={follow}
      style={{ ["--glow" as string]: color }}
      className={cn(
        "group relative isolate block overflow-hidden rounded-2xl border border-line bg-surface/80 p-6 transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--glow)_45%,var(--color-line))] motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 [background:radial-gradient(22rem_circle_at_var(--x,50%)_var(--y,0%),color-mix(in_oklab,var(--glow)_12%,transparent),transparent_65%)]"
      />
      {children}
    </Tag>
  );
}
