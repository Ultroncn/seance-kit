import { extendTailwindMerge } from "tailwind-merge";

/**
 * Tailwind-aware class merge: when two classes set the same thing, the later one wins, so a
 * caller's `className` reliably overrides a component's default. It is told about our own type
 * sizes, which it would otherwise read as colors.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "md"] }],
    },
  },
});

/** Join class names, skipping falsy values, and resolve conflicts (`h-8` then `h-10` gives `h-10`). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return merge(parts.filter(Boolean).join(" "));
}
