import { motion } from "motion/react";
import { useRef, type ReactNode } from "react";
import { ApprovalCard } from "./ApprovalCard";
import { cn } from "./cn";
import { Ban, Check, CircleAlert, LoaderCircle, X } from "lucide-react";
import { Caret, Thinking } from "./Thinking";
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
  write: "warn",
  destructive: "danger",
};
type Kit = (typeof kitMessages)["en"];

/**
 * The mark on the thread beside an entry. Only steps get one, so each mark means "the agent did
 * something here": a spinner while it runs, an amber dot while it waits for you, then a quiet
 * check, cross or stop sign. Messages and thinking sit on the thread without a mark.
 */
function StepNode({ entry }: { entry: TimelineEntry | ReadRun }) {
  if (entry.kind === "reads") return <Check aria-hidden className="size-3.5 text-muted" />;
  if (entry.kind === "notice")
    return entry.tone === "error" ? (
      <CircleAlert aria-hidden className="size-3.5 text-danger" />
    ) : null;
  if (entry.kind !== "tool") return null;
  switch (entry.status) {
    case "running":
      return (
        <LoaderCircle
          aria-hidden
          className="size-3.5 animate-spin text-accent motion-reduce:animate-none"
        />
      );
    case "awaiting_approval":
      return (
        <span
          aria-hidden
          data-pending-dot
          className="size-2 rounded-full bg-warn motion-safe:animate-pulse-dot motion-reduce:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-warn)_35%,transparent)]"
        />
      );
    case "done":
      return <Check aria-hidden className="size-3.5 text-muted" />;
    case "failed":
      return <X aria-hidden className="size-3.5 text-danger" />;
    case "rejected":
      return <Ban aria-hidden className="size-3.5 text-muted" />;
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
    if (e?.kind === "message" && e.streaming) return t.writing;
    if (e?.kind === "thinking" && e.streaming) return t.thinking;
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
      <pre className="mt-1.5 max-h-56 overflow-auto rounded-md bg-bg p-2 font-mono text-xs leading-relaxed text-fg">
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

  const summary = step.status === "done" ? outputSummary(step.output, t) : null;
  return (
    <div className="min-w-0">
      <details className="group/step -mx-2 rounded-lg border border-transparent transition-colors duration-150 open:border-line open:bg-raised/40">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-raised/70 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              "min-w-0 truncate text-sm",
              step.status === "running" ? "text-fg" : "text-fg-2",
            )}
          >
            {label ?? step.name}
          </span>
          {risk &&
            (step.risk === "read" ? (
              <span className="sr-only">{risk.label}</span>
            ) : (
              <Badge tone={risk.tone}>{risk.label}</Badge>
            ))}
          {summary && (
            <span className="shrink-0 whitespace-nowrap text-xs text-muted">{summary}</span>
          )}
          <span
            className={cn(
              "ml-auto shrink-0 text-xs",
              step.status === "failed"
                ? "text-danger"
                : step.status === "rejected" || restored
                  ? "text-muted"
                  : "sr-only",
            )}
          >
            {restored ? t.restored : t.status[step.status as ToolStepStatus]}
          </span>
          {step.durationMs !== undefined && (
            <span className="shrink-0 font-mono text-xs text-muted">
              {formatDuration(step.durationMs)}
            </span>
          )}
          <span
            aria-hidden
            className="shrink-0 text-muted transition-transform duration-150 group-open/step:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="space-y-1.5 px-2 pb-2 pt-1">
          {label && <code className="block font-mono text-xs text-muted">{step.name}</code>}
          <JsonBlock label={t.input} value={step.input} />
          {step.status === "done" && <JsonBlock label={t.output} value={step.output} />}
        </div>
      </details>
      {step.error && step.status !== "rejected" && (
        <p className="mt-1 text-xs text-danger">
          {step.error.type}: {step.error.message}
        </p>
      )}
      {step.status === "done" && step.undoToken && props.onUndo && !restored && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 -ml-3 text-warn hover:text-warn"
          onClick={() => props.onUndo?.(step.undoToken as string)}
        >
          <span aria-hidden>↶</span>
          {t.undo}
        </Button>
      )}
    </div>
  );
}

/** A short count from a tool's output, such as "3 results". Null when there is nothing to count. */
export function outputSummary(output: unknown, t: Kit): string | null {
  if (typeof output !== "object" || output === null) return null;
  const o = output as Record<string, unknown>;
  if (typeof o.total === "number") return t.resultsN(o.total);
  for (const k of ["results", "updated", "banished", "restored", "messages", "labelled"]) {
    const v = o[k];
    if (Array.isArray(v)) return t.itemsN(v.length);
  }
  return null;
}

/** Two or more finished reads in a row, shown as one line. */
type ReadRun = { kind: "reads"; id: string; steps: ToolEntry[] };

const isSettledRead = (e: TimelineEntry): e is ToolEntry =>
  e.kind === "tool" && e.risk === "read" && (e.status === "done" || e.status === "failed");

/**
 * Fold runs of finished read steps into one line, like "Used 3 tools". Steps that write or hide
 * data always stay on their own line, because they changed something and may offer Undo.
 */
export function groupReads(entries: TimelineEntry[]): (TimelineEntry | ReadRun)[] {
  const out: (TimelineEntry | ReadRun)[] = [];
  let run: ToolEntry[] = [];
  const flush = () => {
    if (run.length >= 2) out.push({ kind: "reads", id: `reads:${run[0]?.id}`, steps: run });
    else out.push(...run);
    run = [];
  };
  for (const e of entries) {
    if (isSettledRead(e)) run.push(e);
    else {
      flush();
      out.push(e);
    }
  }
  flush();
  return out;
}

function ReadGroup({ steps, props }: { steps: ToolEntry[]; props: InnerProps }) {
  const names = [...new Set(steps.map((s) => props.toolLabels?.[s.name] ?? s.name))];
  return (
    <details className="group/reads min-w-0">
      <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-raised/70 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-fg">{props.t.toolsUsed(steps.length)}</span>
        <span className="min-w-0 truncate text-xs text-muted">{names.join(" · ")}</span>
        <span
          aria-hidden
          className="ml-auto shrink-0 text-muted transition-transform duration-150 group-open/reads:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-1 space-y-1 border-l border-line pl-3">
        {steps.map((s) => (
          <ToolStep key={s.id} step={s} props={props} />
        ))}
      </div>
    </details>
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
        <div className="flex flex-col items-end">
          <p className="sr-only">{props.t.you}</p>
          <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-line bg-raised px-3.5 py-2 text-sm text-fg">
            {entry.text}
          </p>
        </div>
      );
    case "message":
      return (
        <p className="whitespace-pre-wrap text-md leading-relaxed text-fg">
          {entry.text}
          {entry.streaming && <Caret />}
        </p>
      );
    case "thinking":
      return <Thinking entry={entry} t={props.t} />;
    case "notice":
      return (
        <p
          role={entry.tone === "error" ? "alert" : undefined}
          className={cn("text-sm", entry.tone === "error" ? "text-danger" : "text-muted")}
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
            {groupReads(entries).map((entry) => (
              <motion.li
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3"
              >
                <span aria-hidden className="flex h-7 items-center justify-center">
                  <StepNode entry={entry} />
                </span>
                {entry.kind === "reads" ? (
                  <ReadGroup steps={entry.steps} props={inner} />
                ) : (
                  <EntryBody entry={entry} props={inner} />
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
