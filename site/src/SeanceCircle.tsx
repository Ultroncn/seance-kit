import { useId } from "react";

/** The tools a Séance Kit agent calls, written around the circle like runes. */
const RUNES =
  "search · read · summarize · tag · banish · resurrect · undo_banish · classify · draft_reply · ";
/** Circumference of the rune ring (r = 132), so the text meets itself exactly once around. */
const RING = 2 * Math.PI * 132;

const C = 240;
const CANDLES = Array.from({ length: 5 }, (_, i) => {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return { x: C + Math.cos(a) * 168, y: C + Math.sin(a) * 168, delay: `${-i * 0.53}s` };
});

/**
 * The landing hero: five candles around a slowly turning ring of tool names, an ectoplasm orb in
 * the middle. Decorative, so it is hidden from assistive tech. Reduced motion freezes it lit.
 */
export function SeanceCircle({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const ring = `${id}-ring`;
  return (
    <svg viewBox="0 0 480 480" aria-hidden className={className}>
      <defs>
        <radialGradient id={`${id}-orb`}>
          <stop offset="0%" stopColor="var(--color-ecto)" stopOpacity="0.9" />
          <stop offset="35%" stopColor="var(--color-ecto)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-ecto)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0%" stopColor="var(--color-candle)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-candle)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#fff4d6" />
          <stop offset="45%" stopColor="var(--color-candle)" />
          <stop offset="100%" stopColor="var(--color-blood)" stopOpacity="0.2" />
        </linearGradient>
        <path id={ring} d={`M ${C} ${C} m -132 0 a 132 132 0 1 1 264 0 a 132 132 0 1 1 -264 0`} />
      </defs>

      {/* Rings and the chords between candles */}
      <circle cx={C} cy={C} r="200" fill="none" stroke="var(--color-line)" />
      <circle cx={C} cy={C} r="168" fill="none" stroke="var(--color-line)" strokeDasharray="2 6" />
      <circle cx={C} cy={C} r="116" fill="none" stroke="var(--color-line)" opacity="0.7" />
      <polygon
        points={CANDLES.map((c) => `${c.x},${c.y}`).join(" ")}
        fill="none"
        stroke="var(--color-ecto)"
        strokeOpacity="0.12"
      />

      {/* Tool names, turning slowly */}
      <g className="motion-safe:animate-orbit" style={{ transformOrigin: `${C}px ${C}px` }}>
        <text
          fill="var(--color-muted)"
          fillOpacity="0.55"
          fontFamily="var(--font-mono)"
          fontSize="10"
        >
          <textPath href={`#${ring}`} textLength={RING} lengthAdjust="spacing">
            {RUNES}
          </textPath>
        </text>
      </g>

      {/* The spirit */}
      <g className="motion-safe:animate-breathe" style={{ transformOrigin: `${C}px ${C}px` }}>
        <circle cx={C} cy={C} r="96" fill={`url(#${id}-orb)`} />
      </g>
      <circle cx={C} cy={C} r="7" fill="var(--color-ecto)" />

      {/* Candles */}
      {CANDLES.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y})`}>
          <circle r="34" fill={`url(#${id}-halo)`} />
          <rect
            x="-5"
            y="2"
            width="10"
            height="20"
            rx="2"
            fill="var(--color-raised)"
            stroke="var(--color-line)"
          />
          <g
            className="motion-safe:animate-flicker"
            style={{ transformOrigin: "0px 2px", animationDelay: c.delay }}
          >
            <path d="M0 -16 C 5 -8, 6 -2, 0 2 C -6 -2, -5 -8, 0 -16 Z" fill={`url(#${id}-flame)`} />
          </g>
        </g>
      ))}
    </svg>
  );
}
