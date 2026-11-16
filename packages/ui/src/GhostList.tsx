import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

/**
 * A list whose items fade in as they arrive and dissolve when they leave, for example when an
 * import adds chats or Banish hides them. Items already there on first render do not animate.
 * Give the list a `key` that changes with its filters: a new filter then rebuilds the list at once
 * instead of dissolving every row that no longer matches.
 */
export function GhostList({ children, ...rest }: ComponentProps<"ul">) {
  return (
    <ul {...rest}>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </ul>
  );
}

/** One item of a `GhostList`. Needs a stable `key`, like any list item. */
export function GhostItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: -10, filter: "blur(4px)", transition: { duration: 0.18 } }}
    >
      {children}
    </motion.li>
  );
}
