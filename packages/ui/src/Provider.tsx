import * as Tooltip from "@radix-ui/react-tooltip";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wrap each app once. Motion follows the user's `prefers-reduced-motion` setting: movement is
 * dropped and only opacity changes remain. CSS animations are handled in tokens.css.
 */
export function SeanceProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.16, ease: "easeOut" }}>
      <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
    </MotionConfig>
  );
}
