import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { Button } from "./primitives";

export interface ToastInput {
  text: string;
  tone?: "info" | "ok" | "error";
  /** One action, for example Undo. */
  action?: { label: string; onClick: () => void };
  /** Default 6000. Toasts with an action stay at least this long. */
  durationMs?: number;
}

interface Toast extends ToastInput {
  id: number;
}

const Ctx = createContext<((t: ToastInput) => void) | null>(null);

/**
 * Short notices at the bottom centre, announced politely to screen readers. Centre on purpose: the
 * side panes keep controls at the bottom (view switches, the agent's Send button) that a toast must not cover.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback(
    (t: ToastInput) => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.durationMs ?? 6000);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-lg border bg-raised px-4 py-3 text-sm shadow-lg shadow-black/40",
                t.tone === "error"
                  ? "border-blood/60"
                  : t.tone === "ok"
                    ? "border-ecto/40"
                    : "border-line",
              )}
            >
              <span className="flex-1">{t.text}</span>
              {t.action && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-ecto"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): (t: ToastInput) => void {
  const show = useContext(Ctx);
  if (!show) throw new Error("useToast needs a <ToastProvider> above it");
  return show;
}
