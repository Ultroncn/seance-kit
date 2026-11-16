import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { ApprovalCard } from "./ApprovalCard";
import { cn } from "./cn";
import { formatDuration, formatJson } from "./format";
import { getLocale, tNow, useT } from "./i18n";
import { kitMessages } from "./messages";
import { Badge, Button, type BadgeTone } from "./primitives";
import type { StepRisk, TimelineEntry, ToolEntry, ToolStepStatus } from "./timeline-types";

export interface ApprovalCopy {
  summary?: ReactNode;
  details?: ReactNode;
}

export interface SeanceTimelineProps {
  entries: TimelineEntry[];
  onApprove: (callId: string) => void;
  onReject: (callId: string) => void;
  /** Shown as an Undo button on finished destructive steps that returned an undo token. */
  onUndo?: (undoToken: string) => void;
  /** Tokens already undone. Their steps show "Restored" instead of the Undo button. */
  undone?: ReadonlySet<string>;
  /** App-specific approval text, for example the list of emails a bulk Banish would hide. */
  describeApproval?: (step: ToolEntry) => ApprovalCopy | undefined;
  /** Plain labels for tool names, for example { banish_emails: "Hide emails" }. */
  toolLabels?: Record<string, string>;
  /** Move focus to a new approval card. Default true. Turn off for decorative timelines. */
  autoFocusApprovals?: boolean;
  /** Shown when there are no entries yet. */
  empty?: ReactNode;
}

const riskTone: Record<StepRisk, BadgeTone> = {
  read: "neutral",
  write: "candle",
  destructive: "blood",
};
type Kit = (typeof kitMessages)["en"];

function nodeClass(entry: TimelineEntry): string {
  if (entry.kind === "user") return "border border-muted bg-bg";
  if (entry.kind === "message") return "bg-ecto shadow-[0_0_10px_var(--color-ecto)]";
  if (entry.kind === "notice") return entry.tone === "error" ? "bg-blood" : "bg-muted";
  switch (entry.status) {
    case "running":
      return "border border-ecto bg-bg";
    case "awaiting_approval":
      return entry.risk === "destructive"
        ? "bg-blood shadow-[0_0_12px_var(--color-blood)]"
        : "bg-candle shadow-[0_0_12px_var(--color-candle)]";
    case "done":
      return entry.risk === "destructive"
        ? "bg-blood/80"
        : "bg-ecto/80 shadow-[0_0_8px_var(--color-ecto)]";
    case "failed":
      return "bg-blood";
    case "rejected":
      return "border border-line bg-raised";
  }
}

/** One-line description of what the agent is doing, for screen readers. */
export function timelineStatus(
  entries: TimelineEntry[],
  labels: Record<string, string> = {},
  t: Kit = tNow(kitMessages),
): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e?.kind === "message" && i === entries.length - 1)
      return t.announceReply(e.text.length > 200 ? `${e.text.slice(0, 199)}…` : e.text);
    if (e?.kind !== "tool") continue;
    const name = labels[e.name] ?? e.name;
    if (e.status === "awaiting_approval") return t.announceWaiting(name);
    if (e.status === "running") return t.announceRunning(name);
  }
  return "";
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="group text-xs">
      <summary className="cursor-pointer select-none text-muted hover:text-fg">{label}</summary>
      <pre className="mt-1.5 max-h-56 overflow-auto rounded-md bg-bg p-2 font-mono text-[11px] leading-relaxed text-fg">
        {formatJson(value)}
      </pre>
    </details>
  );
}

type InnerProps = SeanceTimelineProps & { onDecided: (decide: () => void) => void; t: Kit };

function ToolStep({ step, props }: { step: ToolEntry; props: InnerProps }) {
  const label = props.toolLabels?.[step.name];
  const { t } = props;
  const risk = step.risk ? { tone: riskTone[step.risk], label: t.risk[step.risk] } : null;
  const restored = step.undoToken !== undefined && props.undone?.has(step.undoToken);

  if (step.status === "awaiting_approval" && step.risk && step.risk !== "read") {
    const copy = props.describeApproval?.(step);
    return (
      <ApprovalCard
        toolName={step.name}
        label={label}
        risk={step.risk}
        input={step.input}
        summary={copy?.summary}
        details={copy?.details}
        onApprove={() => props.onDecided(() => props.onApprove(step.id))}
        onReject={() => props.onDecided(() => props.onReject(step.id))}
        autoFocus={props.autoFocusApprovals ?? true}
      />
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm text-fg">{step.name}</code>
        {label && <span className="text-xs text-muted">{label}</span>}
        {risk && <Badge tone={risk.tone}>{risk.label}</Badge>}
        <span
          className={cn(
            "text-xs",
            step.status === "failed"
              ? "text-blood"
              : step.status === "done"
                ? "text-ecto"
                : "text-muted",
          )}
        >
          {restored ? t.restored : t.status[step.status as ToolStepStatus]}
        </span>
        {step.durationMs !== undefined && (
          <span className="ml-auto font-mono text-[11px] text-muted">
            {formatDuration(step.durationMs)}
          </span>
        )}
      </div>
      {step.error && step.status !== "rejected" && (
        <p className="mt-1 text-xs text-blood">
          {step.error.type}: {step.error.message}
        </p>
      )}
      <div className="mt-2 space-y-1.5">
        <JsonBlock label={t.input} value={step.input} />
        {step.status === "done" && <JsonBlock label={t.output} value={step.output} />}
      </div>
      {step.status === "done" && step.undoToken && props.onUndo && !restored && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-3"
          onClick={() => props.onUndo?.(step.undoToken as string)}
        >
          {t.undo}
        </Button>
      )}
    </div>
  );
}

/** Notices from the agent loop are English. Known codes get the reader's language. */
function noticeText(entry: Extract<TimelineEntry, { kind: "notice" }>, t: Kit): string {
  if (getLocale() === "en" || !entry.code) return entry.text;
  return t.notice[entry.code] ?? entry.text;
}
function EntryBody({ entry, props }: { entry: TimelineEntry; props: InnerProps }) {
  switch (entry.kind) {
    case "user":
      return (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {props.t.you}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{entry.text}</p>
        </div>
      );
    case "message":
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{entry.text}</p>;
    case "notice":
      return (
        <p
          role={entry.tone === "error" ? "alert" : undefined}
          className={cn("text-sm", entry.tone === "error" ? "text-blood" : "text-muted")}
        >
          {noticeText(entry, props.t)}
        </p>
      );
    case "tool":
      return <ToolStep step={entry} props={props} />;
  }
}

/**
 * The agent run as a séance timeline: a candle-lit thread of prompt, tool steps, approvals
 * and replies. Pass `reduceTimeline` output from `@seance/core` as `entries`.
 */
export function SeanceTimeline(props: SeanceTimelineProps) {
  const t = useT(kitMessages);
  const listRef = useRef<HTMLOListElement>(null);
  // The approval card disappears after a decision. Keep keyboard focus in the timeline instead
  // of letting it fall to <body>. A new pending card takes focus itself.
  const onDecided = (decide: () => void) => {
    decide();
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected) listRef.current?.focus();
    });
  };
  const inner: InnerProps = { ...props, onDecided, t };
  const { entries, empty, toolLabels } = props;
  const status = timelineStatus(entries, toolLabels, t);

  return (
    <div>
      <p className="sr-only" aria-live="polite" role="status">
        {status}
      </p>
      {entries.length === 0 ? (
        (empty ?? null)
      ) : (
        <div className="relative">
          <div
            aria-hidden
            className="absolute bottom-4 left-[1.69rem] top-6 w-px bg-gradient-to-b from-line via-line to-transparent"
          />
          <ol
            ref={listRef}
            tabIndex={-1}
            aria-label={t.agentRun}
            className="relative space-y-4 py-4 pl-4 pr-4 outline-none"
          >
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3"
              >
                <span aria-hidden className="flex justify-center pt-1.5">
                  <span className={cn("size-2.5 rounded-full", nodeClass(entry))} />
                </span>
                <EntryBody entry={entry} props={inner} />
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
