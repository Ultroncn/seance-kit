import { useCallback, useEffect, useState } from "react";

/** Side pane widths in px on wide screens. The content pane takes the rest. */
export interface PaneWidths {
  library: number;
  agent: number;
}

export const PANE_DEFAULTS: PaneWidths = { library: 272, agent: 400 };
export const PANE_LIMITS = {
  library: { min: 200, max: 400 },
  agent: { min: 320, max: 560 },
} as const;
/** What the content pane always keeps, so dragging a side pane never squeezes the reader away. */
export const CONTENT_MIN = 360;

/**
 * Keep both widths inside their limits and leave the content pane room on a screen this wide.
 * Pure, so it is property-tested; anything stored or dragged goes through it.
 */
export function clampWidths(w: PaneWidths, screen: number): PaneWidths {
  const fit = (n: unknown, { min, max }: { min: number; max: number }, fallback: number) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.round(Math.min(max, Math.max(min, n)))
      : fallback;
  let library = fit(w.library, PANE_LIMITS.library, PANE_DEFAULTS.library);
  let agent = fit(w.agent, PANE_LIMITS.agent, PANE_DEFAULTS.agent);
  // Too wide for this screen: give back space from the agent first, then the library.
  let over = library + agent + CONTENT_MIN - screen;
  if (over > 0) {
    const fromAgent = Math.min(over, agent - PANE_LIMITS.agent.min);
    agent -= fromAgent;
    over -= fromAgent;
    library -= Math.min(over, library - PANE_LIMITS.library.min);
  }
  return { library, agent };
}

/** Read saved widths. Anything missing or damaged falls back to the defaults. */
export function readWidths(raw: string | null): PaneWidths {
  try {
    const v = JSON.parse(raw ?? "null") as Partial<PaneWidths> | null;
    return {
      library: typeof v?.library === "number" ? v.library : PANE_DEFAULTS.library,
      agent: typeof v?.agent === "number" ? v.agent : PANE_DEFAULTS.agent,
    };
  } catch {
    return PANE_DEFAULTS;
  }
}

/** Pane widths for one app, saved per app in localStorage, re-fitted when the window resizes. */
export function usePaneWidths(storageKey: string | undefined) {
  const screen = () => (typeof window === "undefined" ? 1440 : window.innerWidth);
  const [widths, setWidths] = useState<PaneWidths>(() =>
    clampWidths(
      storageKey && typeof localStorage !== "undefined"
        ? readWidths(localStorage.getItem(storageKey))
        : PANE_DEFAULTS,
      screen(),
    ),
  );
  useEffect(() => {
    const refit = () => setWidths((w) => clampWidths(w, screen()));
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, []);
  const update = useCallback(
    (patch: Partial<PaneWidths>) =>
      setWidths((w) => {
        const next = clampWidths({ ...w, ...patch }, screen());
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // Storage can be full or blocked. The widths still apply for this visit.
          }
        }
        return next;
      }),
    [storageKey],
  );
  return [widths, update] as const;
}
