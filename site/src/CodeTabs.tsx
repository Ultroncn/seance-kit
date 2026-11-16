import { cn } from "@seance/ui";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { highlight } from "./highlight";

export interface CodeStep {
  title: string;
  text: string;
  file: string;
  code: string;
}

interface Props {
  steps: CodeStep[];
  label: string;
  codeOf: (title: string) => string;
}

/**
 * The three build steps as tabs over one code panel. Arrow keys move between tabs, as the ARIA
 * tabs pattern expects; the panel is focusable so its code can be scrolled by keyboard.
 */
export function CodeTabs({ steps, label, codeOf }: Props) {
  const [at, setAt] = useState(0);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const step = steps[at] as CodeStep;
  const move = (e: KeyboardEvent) => {
    const d =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!d) return;
    e.preventDefault();
    const next = (at + d + steps.length) % steps.length;
    setAt(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={move}
        className="flex flex-col gap-1"
      >
        {steps.map((s, i) => (
          <button
            key={s.title}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${id}-tab-${i}`}
            aria-selected={i === at}
            aria-controls={`${id}-panel`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => setAt(i)}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors duration-100",
              i === at ? "border-line bg-surface" : "border-transparent hover:bg-surface",
            )}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-fg">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-xs",
                  i === at ? "bg-accent-solid text-on-accent" : "bg-surface-3 text-fg-2",
                )}
              >
                {i + 1}
              </span>
              {s.title}
            </span>
            <span className="mt-1.5 block pl-[1.875rem] text-meta leading-relaxed text-muted">
              {s.text}
            </span>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${at}`}
        className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface"
      >
        <div className="flex h-10 items-center border-b border-line px-4 font-mono text-xs text-muted">
          {step.file}
        </div>
        <pre
          tabIndex={0}
          aria-label={codeOf(step.title)}
          className="max-h-[26rem] overflow-auto p-5 font-mono text-[12.5px] leading-relaxed text-fg-2"
        >
          <code>{highlight(step.code)}</code>
        </pre>
      </div>
    </div>
  );
}
