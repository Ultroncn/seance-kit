/** Small line icons for the landing page. Decorative: the text beside them says what they are. */
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Chat bubbles rising from a scroll: old conversations brought back. */
export const ArchiveIcon = (p: { className?: string }) => (
  <svg {...base} className={p.className}>
    <path d="M5 18.5h11a3 3 0 0 0 3-3V6" />
    <path d="M8 5h11" />
    <path d="M5 18.5a2.5 2.5 0 0 1 0-5h9" />
    <path d="M9 9.5h6M9 12.5h4" />
  </svg>
);

/** An envelope with a small flame: mail, gently exorcised. */
export const InboxIcon = (p: { className?: string }) => (
  <svg {...base} className={p.className}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="m3.5 7 8.5 6.5L20.5 7" />
    <path d="M12 2.2c1.2 1 1.4 2.2.6 3.1-.4.4-1.2.4-1.6-.1-.7-.8-.3-2 1-3z" />
  </svg>
);

export const ShieldIcon = (p: { className?: string }) => (
  <svg {...base} className={p.className}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const UndoIcon = (p: { className?: string }) => (
  <svg {...base} className={p.className}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const MaskIcon = (p: { className?: string }) => (
  <svg {...base} className={p.className}>
    <path d="M4 6c5-2 11-2 16 0v5a8 8 0 0 1-16 0z" />
    <path d="M8.5 10.5h2M13.5 10.5h2M9.5 15c1.6 1 3.4 1 5 0" />
  </svg>
);

export const HouseIcon = (p: { className?: string }) => (
  <svg {...base} className={p.className}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 9.5V20h12V9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);
