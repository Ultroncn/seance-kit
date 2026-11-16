import { useEffect, useId, useRef, type ReactNode } from "react";
import { formatJson } from "./format";
import { useT } from "./i18n";
import { kitMessages } from "./messages";
import { ChevronRight } from "lucide-react";
import { Badge, Button, Kbd } from "./primitives";
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
 * The approval gate: one quiet card with an amber edge. Destructive actions say so with a red
 * badge; Allow is always the primary action. The pending dot beside it in the timeline pulses,
 * the card does not. Focus moves to the card, not to Allow, so a stray Enter never approves.
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
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      data-focus-container
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onReject();
        }
      }}
      className="rounded-lg border border-warn-line bg-surface p-4 outline-none"
    >
      <div className="flex items-start gap-2">
        <p id={titleId} className="min-w-0 flex-1 text-sm font-semibold text-fg">
          <span className="sr-only">{t.allow} </span>
          {label ? (
            `${label}${t.question}`
          ) : (
            <code className="font-mono">
              {toolName}
              {t.question}
            </code>
          )}
        </p>
        <Badge tone={destructive ? "danger" : "warn"}>
          {destructive ? t.risk.destructive : t.needsApproval}
        </Badge>
      </div>
      {label && <p className="mt-0.5 font-mono text-xs text-muted">{toolName}</p>}
      <p className="mt-2 text-sm text-fg-2">
        {summary ?? (destructive ? t.approvalDestructive : t.approvalWrite)}
      </p>
      {details && (
        // Long batches scroll. tabIndex lets keyboard users scroll the list they are approving.
        <div
          tabIndex={0}
          role="region"
          aria-label={t.details}
          className="mt-3 max-h-48 overflow-y-auto rounded-md bg-bg px-3 py-2 text-sm"
        >
          {details}
        </div>
      )}
      <details className="group/input mt-3 text-xs">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-3.5 transition-transform duration-100 group-open/input:rotate-90"
          />
          {t.exactInput}
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-bg p-2 font-mono text-xs leading-relaxed text-fg-2">
          {formatJson(input)}
        </pre>
      </details>
      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={onApprove}>
          {t.allow}
        </Button>
        <Button variant="secondary" size="sm" onClick={onReject}>
          {t.reject}
        </Button>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted">
          <Kbd>Esc</Kbd>
          {t.escRejects.replace(/^(按\s*)?Esc\s*/i, "")}
        </span>
      </div>
    </div>
  );
}
