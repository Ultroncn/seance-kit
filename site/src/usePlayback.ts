import { useEffect, useState } from "react";

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Count from 0 to `end`, one tick per `ms`, once `play` turns true. `restart` begins again.
 * People who prefer reduced motion get the last frame at once.
 */
export function usePlayback(play: boolean, end: number, ms: number) {
  const [tick, setTick] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!play) return;
    if (reducedMotion()) {
      setTick(end);
      return;
    }
    setTick(0);
    const timer = setInterval(() => {
      setTick((n) => {
        if (n + 1 >= end) clearInterval(timer);
        return Math.min(end, n + 1);
      });
    }, ms);
    return () => clearInterval(timer);
  }, [play, end, ms, run]);
  return { tick, restart: () => setRun((r) => r + 1) };
}
