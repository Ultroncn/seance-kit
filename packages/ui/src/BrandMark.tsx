import { cn } from "./cn";

/**
 * The Séance Kit mark: an indigo tile with a thread and two nodes, the agent timeline in miniature.
 * Decorative; the link or heading around it carries the name.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cn("size-5", className)}>
      <rect width="20" height="20" rx="5" fill="var(--color-accent-solid)" />
      <path
        d="M7 5v10"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="7" r="1.9" fill="white" />
      <circle cx="7" cy="13" r="1.9" fill="white" />
      <path d="M10.5 7h4M10.5 13h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
