import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";
import { formatJson } from "./format";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { Button } from "./primitives";
import type { StepRisk } from "./timeline-types";

export interface ApprovalCardProps {
  /** Raw tool name, shown in monospace. */
  toolName: string;
  /** Plain label, for example "Hide emails". Falls back to the tool name. */
  label?: string;
  risk: Exclude<StepRisk, "read">;
  input: unknown;
  /** Plain description of what will happen, for example "Hide 12 emails. You can undo this." */
  summary?: ReactNode;
  /** Extra detail such as the list of affected items. Required by R6.5 for bulk Banish. */
  details?: ReactNode;
  onApprove: () => void;
  onReject: () => void;
  /** Move keyboard focus to the card when it appears. Default true. */
  autoFocus?: boolean;
}

/**
 * The approval gate. Amber for writes, blood for destructive actions. Pulses gently while it
 * waits, or shows a static ring when the user prefers reduced motion. Focus moves to the card,
 * not to the Allow button, so a stray Enter never approves anything.
 */
export function ApprovalCard({
  toolName,
  label,
  risk,
  input,
  summary,
  details,
  onApprove,
  onReject,
  autoFocus = true,
}: ApprovalCardProps) {
  const t = useT(kitMessages);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const destructive = risk === "destructive";

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: false });
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onReject();
        }
      }}
      className={cn(
        "rounded-lg border bg-raised p-4 outline-none",
        "motion-safe:animate-candle-pulse motion-reduce:ring-2",
        destructive
          ? "border-blood/60 motion-reduce:ring-blood/40"
          : "border-candle/60 motion-reduce:ring-candle/40",
        "focus-visible:ring-2 focus-visible:ring-ecto",
      )}
    >
      <p id={titleId} className="text-sm font-semibold">
        <span className={destructive ? "text-blood" : "text-candle"}>{t.allow}</span>{" "}
        {label ? (
          `${label}${t.question}`
        ) : (
          <code className="font-mono">
            {toolName}
            {t.question}
          </code>
        )}
      </p>
      {label && <p className="mt-0.5 font-mono text-[11px] text-muted">{toolName}</p>}
      <p className="mt-1 text-sm text-muted">
        {summary ?? (destructive ? t.approvalDestructive : t.approvalWrite)}
      </p>
      {details && (
        // Long batches scroll. tabIndex lets keyboard users scroll the list they are approving.
        <div
          tabIndex={0}
          role="region"
          aria-label={t.details}
          className="mt-3 max-h-48 overflow-y-auto rounded text-sm"
        >
          {details}
        </div>
      )}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">{t.exactInput}</summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-bg p-2 font-mono text-[11px] leading-relaxed text-fg">
          {formatJson(input)}
        </pre>
      </details>
      <div className="mt-4 flex gap-2">
        <Button variant={destructive ? "danger" : "primary"} size="sm" onClick={onApprove}>
          {t.allow}
        </Button>
        <Button variant="secondary" size="sm" onClick={onReject}>
          {t.reject}
        </Button>
        <span className="ml-auto self-center text-[11px] text-muted">{t.escRejects}</span>
      </div>
    </div>
  );
}
